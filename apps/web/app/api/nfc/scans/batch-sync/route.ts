import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashCardUid, normalizeCardUid } from '@/lib/crypto';
import { NFCScanRequestPayload } from '@shared/index';

export async function POST(req: NextRequest) {
  try {
    const body: { scans: NFCScanRequestPayload[] } = await req.json();
    const scans = body.scans || [];

    if (!Array.isArray(scans) || scans.length === 0) {
      return NextResponse.json({ success: true, processedCount: 0, results: [] });
    }

    const results = [];

    for (const scan of scans) {
      const { sessionId, cardUid, deviceId, clientScannedAt, requestId } = scan;

      // Check request_id idempotency
      const { data: existingEvent } = await supabaseAdmin
        .from('scan_events')
        .select('id')
        .eq('request_id', requestId)
        .single();

      if (existingEvent) {
        results.push({ requestId, status: 'SKIPPED_DUPLICATE' });
        continue;
      }

      // Hash card UID & lookup
      const normalizedUid = normalizeCardUid(cardUid);
      const targetUidHash = hashCardUid(normalizedUid);

      const { data: card } = await supabaseAdmin
        .from('student_cards')
        .select('student_id, status')
        .eq('uid_hash', targetUidHash)
        .single();

      if (!card || card.status !== 'ACTIVE') {
        results.push({ requestId, status: 'CARD_INVALID' });
        continue;
      }

      const scanTime = new Date(clientScannedAt || Date.now());
      const nowIso = scanTime.toISOString();

      // Check session
      const { data: session } = await supabaseAdmin
        .from('attendance_sessions')
        .select('late_after')
        .eq('id', sessionId)
        .single();

      if (!session) {
        results.push({ requestId, status: 'SESSION_NOT_FOUND' });
        continue;
      }

      const lateThreshold = new Date(session.late_after);
      const finalStatus = scanTime > lateThreshold ? 'LATE' : 'PRESENT';

      // Insert/Update Record
      const { data: existingRecord } = await supabaseAdmin
        .from('attendance_records')
        .select('id')
        .eq('session_id', sessionId)
        .eq('student_id', card.student_id)
        .single();

      if (existingRecord) {
        await supabaseAdmin
          .from('attendance_records')
          .update({
            status: finalStatus,
            first_scan_at: nowIso,
            last_scan_at: nowIso,
            device_id: deviceId || null,
            offline_sync: true,
            source: 'ANDROID_NFC_OFFLINE',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingRecord.id);
      } else {
        await supabaseAdmin
          .from('attendance_records')
          .insert({
            session_id: sessionId,
            student_id: card.student_id,
            status: finalStatus,
            first_scan_at: nowIso,
            last_scan_at: nowIso,
            device_id: deviceId || null,
            offline_sync: true,
            source: 'ANDROID_NFC_OFFLINE'
          });
      }

      // Audit scan event
      await supabaseAdmin.from('scan_events').insert({
        request_id: requestId,
        session_id: sessionId,
        card_uid_hash: targetUidHash,
        device_id: deviceId || null,
        client_scanned_at: nowIso,
        result_code: 'ATTENDANCE_RECORDED',
        offline: true,
        metadata: { finalStatus, source: 'ANDROID_NFC_OFFLINE' }
      });

      results.push({ requestId, status: 'SUCCESS', finalStatus });
    }

    return NextResponse.json({
      success: true,
      processedCount: results.length,
      results
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
