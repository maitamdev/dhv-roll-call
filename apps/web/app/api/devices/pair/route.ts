import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { pairingCodeHash } from '@/lib/scanner-security';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Dữ liệu không hợp lệ.' }, { status: 400 });
  }

  const pairingCode = typeof body.pairingCode === 'string' ? body.pairingCode : '';
  const deviceUuid = typeof body.deviceUuid === 'string' ? body.deviceUuid : '';
  const publicKey = typeof body.publicKey === 'string' ? body.publicKey.trim() : '';
  const deviceName = typeof body.deviceName === 'string' ? body.deviceName.trim().slice(0, 80) : '';
  const androidVersion = typeof body.androidVersion === 'string' ? body.androidVersion.slice(0, 40) : '';

  if (!/^[A-Z2-9]{8}$/i.test(pairingCode) || !UUID_PATTERN.test(deviceUuid)) {
    return NextResponse.json({ success: false, message: 'Mã ghép nối hoặc UUID không hợp lệ.' }, { status: 400 });
  }
  if (!publicKey.startsWith('-----BEGIN PUBLIC KEY-----') || publicKey.length > 4_096) {
    return NextResponse.json({ success: false, message: 'Khóa công khai của thiết bị không hợp lệ.' }, { status: 400 });
  }

  const { data: slot } = await supabaseAdmin
    .from('devices')
    .select('id, status, pairing_expires_at, room_id, rooms(room_code)')
    .eq('pairing_code_hash', pairingCodeHash(pairingCode))
    .maybeSingle();

  if (!slot || slot.status !== 'PENDING' || !slot.pairing_expires_at || Date.parse(slot.pairing_expires_at) < Date.now()) {
    return NextResponse.json({ success: false, message: 'Mã ghép nối sai hoặc đã hết hạn.' }, { status: 403 });
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('devices')
    .update({
      device_uuid: deviceUuid,
      device_name: deviceName || 'Máy quét cố định',
      android_version: androidVersion || null,
      public_key: publicKey,
      key_algorithm: 'RSA-SHA256',
      status: 'APPROVED',
      pairing_code_hash: null,
      pairing_expires_at: null,
      paired_at: now,
      approved_at: now,
      last_seen_at: now,
    })
    .eq('id', slot.id)
    .eq('status', 'PENDING');

  if (error) {
    return NextResponse.json({ success: false, message: 'Không thể ghép nối thiết bị.' }, { status: 409 });
  }
  const room = Array.isArray(slot.rooms) ? slot.rooms[0] : slot.rooms;
  return NextResponse.json({ success: true, deviceId: slot.id, roomCode: room?.room_code || '' });
}
