import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashCardUid, normalizeCardUid } from '@/lib/crypto';
import { verifyScannerRequest } from '@/lib/scanner-security';
import { NFCScanRequestPayload } from '@shared/index';

const MAX_BATCH_SIZE = 100;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SyncResult = {
  requestId: string;
  status: string;
  finalStatus?: 'PRESENT' | 'LATE';
};

export async function POST(req: NextRequest) {
  let body: { scans?: NFCScanRequestPayload[] };
  const rawBody = await req.text();

  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { success: false, message: 'Dữ liệu JSON không hợp lệ.' },
      { status: 400 }
    );
  }
  const trust = await verifyScannerRequest(req, rawBody);
  if (trust.error || !trust.device) {
    return NextResponse.json(
      { success: false, message: trust.error || 'Máy quét không được tin cậy.' },
      { status: 403 }
    );
  }

  const scans = body.scans;
  if (!Array.isArray(scans) || scans.length === 0) {
    return NextResponse.json({ success: true, processedCount: 0, results: [] });
  }
  if (scans.length > MAX_BATCH_SIZE) {
    return NextResponse.json(
      { success: false, message: `Mỗi lần chỉ được đồng bộ tối đa ${MAX_BATCH_SIZE} lượt quét.` },
      { status: 413 }
    );
  }

  const results: SyncResult[] = [];

  for (const scan of scans) {
    const requestId = typeof scan?.requestId === 'string' ? scan.requestId : '';

    try {
      const sessionId = typeof scan?.sessionId === 'string'
        ? scan.sessionId.replace(/^#/, '')
        : '';
      const normalizedUid = normalizeCardUid(scan?.cardUid || '');
      const scanTime = new Date(scan?.clientScannedAt || '');

      if (
        !requestId ||
        !UUID_PATTERN.test(sessionId) ||
        normalizedUid.length < 8 ||
        Number.isNaN(scanTime.getTime())
      ) {
        results.push({ requestId, status: 'INVALID_PAYLOAD' });
        continue;
      }

      const { data: existingEvent } = await supabaseAdmin
        .from('scan_events')
        .select('id')
        .eq('request_id', requestId)
        .maybeSingle();

      if (existingEvent) {
        results.push({ requestId, status: 'SKIPPED_DUPLICATE' });
        continue;
      }

      const targetUidHash = hashCardUid(normalizedUid);
      const { data: card } = await supabaseAdmin
        .from('student_cards')
        .select('student_id, status')
        .eq('uid_hash', targetUidHash)
        .maybeSingle();

      if (!card || card.status !== 'ACTIVE') {
        results.push({ requestId, status: 'CARD_INVALID' });
        continue;
      }

      const { data: session } = await supabaseAdmin
        .from('attendance_sessions')
        .select('late_after, scan_deadline, course_section_id, status, face_verification_required, room_id')
        .eq('id', sessionId)
        .maybeSingle();

      if (!session) {
        results.push({ requestId, status: 'SESSION_NOT_FOUND' });
        continue;
      }
      if (session.face_verification_required) {
        results.push({ requestId, status: 'FACE_VERIFICATION_REQUIRED' });
        continue;
      }
      if (trust.device.roomId && session.room_id && trust.device.roomId !== session.room_id) {
        results.push({ requestId, status: 'WRONG_ROOM' });
        continue;
      }

      if (session.status === 'DRAFT' || session.status === 'CANCELLED') {
        results.push({ requestId, status: 'SESSION_CLOSED' });
        continue;
      }

      const { data: enrollment } = await supabaseAdmin
        .from('enrollments')
        .select('id')
        .eq('course_section_id', session.course_section_id)
        .eq('student_id', card.student_id)
        .maybeSingle();

      if (!enrollment) {
        results.push({ requestId, status: 'NOT_ENROLLED' });
        continue;
      }

      const deviceId = trust.device.id;
      const nowIso = scanTime.toISOString();
      const lateThreshold = new Date(session.late_after);
      const finalStatus = scanTime > lateThreshold ? 'LATE' : 'PRESENT';

      const { data: existingRecord } = await supabaseAdmin
        .from('attendance_records')
        .select('id, status')
        .eq('session_id', sessionId)
        .eq('student_id', card.student_id)
        .maybeSingle();

      if (existingRecord?.status === 'PRESENT' || existingRecord?.status === 'LATE') {
        const { error: duplicateAuditError } = await supabaseAdmin.from('scan_events').insert({
          request_id: requestId,
          session_id: sessionId,
          card_uid_hash: targetUidHash,
          device_id: deviceId,
          client_scanned_at: nowIso,
          result_code: 'ALREADY_ATTENDED',
          offline: true,
          metadata: { source: 'ANDROID_NFC_OFFLINE' }
        });
        if (duplicateAuditError) throw duplicateAuditError;

        results.push({ requestId, status: 'SKIPPED_DUPLICATE' });
        continue;
      }

      const recordPayload = {
        status: finalStatus,
        first_scan_at: nowIso,
        last_scan_at: nowIso,
        device_id: deviceId,
        offline_sync: true,
        source: 'ANDROID_NFC_OFFLINE',
        updated_at: new Date().toISOString()
      };

      const recordQuery = existingRecord
        ? supabaseAdmin.from('attendance_records').update(recordPayload).eq('id', existingRecord.id)
        : supabaseAdmin.from('attendance_records').insert({
            ...recordPayload,
            session_id: sessionId,
            student_id: card.student_id
          });
      const { error: recordError } = await recordQuery;
      if (recordError) throw recordError;

      const { error: auditError } = await supabaseAdmin.from('scan_events').insert({
        request_id: requestId,
        session_id: sessionId,
        card_uid_hash: targetUidHash,
        device_id: deviceId,
        client_scanned_at: nowIso,
        result_code: 'ATTENDANCE_RECORDED',
        offline: true,
        metadata: { finalStatus, source: 'ANDROID_NFC_OFFLINE' }
      });
      if (auditError) throw auditError;

      results.push({ requestId, status: 'SUCCESS', finalStatus });
    } catch (error) {
      console.error('Offline sync item failed:', error);
      results.push({ requestId, status: 'RETRYABLE_ERROR' });
    }
  }

  return NextResponse.json({
    success: true,
    processedCount: results.length,
    results
  });
}
