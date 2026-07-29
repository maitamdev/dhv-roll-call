import { createHash, createVerify, randomBytes } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_CLOCK_SKEW_MS = 60_000;

export type TrustedDevice = {
  id: string;
  deviceUuid: string;
  roomId: string | null;
};

export function sha256Hex(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

export function pairingCodeHash(code: string) {
  const secret = process.env.DEVICE_PAIRING_SECRET || process.env.CARD_HMAC_SECRET;
  if (!secret) throw new Error('DEVICE_PAIRING_SECRET must be configured.');
  return createHash('sha256').update(`${secret}:${code.trim().toUpperCase()}`).digest('hex');
}

export function generatePairingCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

export async function verifyScannerRequest(
  request: NextRequest,
  rawBody: string,
): Promise<{ device: TrustedDevice | null; error: string | null }> {
  const deviceUuid = request.headers.get('x-device-id')?.trim() || '';
  const timestamp = request.headers.get('x-device-timestamp')?.trim() || '';
  const signature = request.headers.get('x-device-signature')?.trim() || '';
  const requestId = request.headers.get('x-request-id')?.trim() || '';

  if (!UUID_PATTERN.test(deviceUuid) || !UUID_PATTERN.test(requestId) || !timestamp || !signature) {
    return { device: null, error: 'Thiếu chữ ký hoặc định danh máy quét.' };
  }

  const timestampMs = Date.parse(timestamp);
  if (Number.isNaN(timestampMs) || Math.abs(Date.now() - timestampMs) > MAX_CLOCK_SKEW_MS) {
    return { device: null, error: 'Đồng hồ máy quét sai lệch hoặc yêu cầu đã hết hạn.' };
  }

  const { data: device } = await supabaseAdmin
    .from('devices')
    .select('id, device_uuid, room_id, public_key, status, revoked_at')
    .eq('device_uuid', deviceUuid)
    .maybeSingle();

  if (!device || device.status !== 'APPROVED' || device.revoked_at || !device.public_key) {
    return { device: null, error: 'Máy quét chưa được phê duyệt hoặc đã bị khóa.' };
  }

  const canonical = `${timestamp}\n${requestId}\n${sha256Hex(rawBody)}`;
  let verified = false;
  try {
    const verifier = createVerify('RSA-SHA256');
    verifier.update(canonical);
    verifier.end();
    verified = verifier.verify(device.public_key, signature, 'base64');
  } catch {
    verified = false;
  }

  if (!verified) return { device: null, error: 'Chữ ký máy quét không hợp lệ.' };

  await supabaseAdmin
    .from('devices')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', device.id);

  return {
    device: { id: device.id, deviceUuid: device.device_uuid, roomId: device.room_id },
    error: null,
  };
}
