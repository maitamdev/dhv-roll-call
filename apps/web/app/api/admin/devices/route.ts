import { NextRequest, NextResponse } from 'next/server';
import { rejectCrossSiteMutation, requireApiRole } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { generatePairingCode, pairingCodeHash } from '@/lib/scanner-security';

const staffRoles = ['ADMIN', 'TRAINING_OFFICE'] as const;

export async function GET() {
  const auth = await requireApiRole([...staffRoles]);
  if (auth.response) return auth.response;
  const { data, error } = await supabaseAdmin
    .from('devices')
    .select('id, device_uuid, device_name, android_version, status, last_seen_at, paired_at, room_id, rooms(room_code)')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  return NextResponse.json({ success: true, devices: data || [] });
}

export async function POST(request: NextRequest) {
  const crossSite = rejectCrossSiteMutation(request);
  if (crossSite) return crossSite;
  const auth = await requireApiRole([...staffRoles]);
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
  const roomId = typeof body.roomId === 'string' && body.roomId ? body.roomId : null;
  if (!name || !roomId) {
    return NextResponse.json({ success: false, message: 'Cần nhập tên máy quét và chọn phòng cố định.' }, { status: 400 });
  }
  const { data: room } = await supabaseAdmin.from('rooms').select('id').eq('id', roomId).maybeSingle();
  if (!room) {
    return NextResponse.json({ success: false, message: 'Phòng được chọn không tồn tại.' }, { status: 400 });
  }

  const pairingCode = generatePairingCode();
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  const placeholderUuid = crypto.randomUUID();
  const { data, error } = await supabaseAdmin
    .from('devices')
    .insert({
      device_uuid: placeholderUuid,
      device_name: name,
      room_id: roomId,
      status: 'PENDING',
      pairing_code_hash: pairingCodeHash(pairingCode),
      pairing_expires_at: expiresAt,
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });

  await supabaseAdmin.from('audit_logs').insert({
    actor_user_id: auth.profile!.appUserId,
    action: 'DEVICE_PAIRING_CREATED',
    entity_type: 'DEVICE',
    entity_id: data.id,
    new_value: { name, roomId, expiresAt },
  });
  return NextResponse.json({ success: true, pairingCode, expiresAt });
}

export async function PATCH(request: NextRequest) {
  const crossSite = rejectCrossSiteMutation(request);
  if (crossSite) return crossSite;
  const auth = await requireApiRole([...staffRoles]);
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === 'string' ? body.id : '';
  const status = body.status === 'APPROVED' || body.status === 'BLOCKED' ? body.status : null;
  const roomId = typeof body.roomId === 'string' && body.roomId ? body.roomId : null;
  if (!id || (!status && !roomId)) {
    return NextResponse.json({ success: false, message: 'Yêu cầu không hợp lệ.' }, { status: 400 });
  }
  if (roomId) {
    const { data: room } = await supabaseAdmin.from('rooms').select('id').eq('id', roomId).maybeSingle();
    if (!room) return NextResponse.json({ success: false, message: 'Phòng không tồn tại.' }, { status: 400 });
  }
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {};
  if (status) {
    updates.status = status;
    updates.revoked_at = status === 'BLOCKED' ? now : null;
    updates.approved_at = status === 'APPROVED' ? now : undefined;
  }
  if (roomId) updates.room_id = roomId;
  const { error } = await supabaseAdmin
    .from('devices')
    .update(updates)
    .eq('id', id);
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  await supabaseAdmin.from('audit_logs').insert({
    actor_user_id: auth.profile!.appUserId,
    action: status ? `DEVICE_${status}` : 'DEVICE_ROOM_ASSIGNED',
    entity_type: 'DEVICE',
    entity_id: id,
    new_value: { status, roomId },
  });
  return NextResponse.json({ success: true });
}
