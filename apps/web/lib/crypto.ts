import CryptoJS from 'crypto-js';

function getHmacSecret(): string {
  const secret = process.env.CARD_HMAC_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('CARD_HMAC_SECRET must be configured in production.');
  }

  return 'dev-only-card-hmac-secret';
}

/**
 * Normalizes raw NFC UID string to uppercase hex without colons.
 * E.g., "80:74:a1:b2" -> "8074A1B2"
 */
export function normalizeCardUid(rawUid: string): string {
  if (!rawUid) return '';
  return rawUid.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
}

/**
 * Generates an HMAC-SHA256 hash of normalized hex UID for secure DB lookup.
 */
export function hashCardUid(normalizedUid: string): string {
  const cleanUid = normalizeCardUid(normalizedUid);
  return CryptoJS.HmacSHA256(cleanUid, getHmacSecret()).toString(CryptoJS.enc.Hex);
}

/**
 * Formats UID for public UI display (masks middle characters).
 * E.g., "8074A1B2" -> "80:74:**:**"
 */
export function maskCardUid(normalizedUid: string): string {
  const clean = normalizeCardUid(normalizedUid);
  if (clean.length < 4) return '**:**:**:**';
  const prefix = clean.substring(0, 4);
  const p1 = prefix.substring(0, 2);
  const p2 = prefix.substring(2, 4);
  return `${p1}:${p2}:**:**`;
}
