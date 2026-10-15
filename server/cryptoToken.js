import crypto from 'crypto';

export const HMAC_SECRET = process.env.ANTIGRAVITY_SECRET || 'antigravity-biopulse-zero-trust-secret-key-2026';

/**
 * Signs verification payload using HMAC-SHA256 into a zero-trust verification token.
 * Format: ag_bp_<base64url(payload)>.<base64url(signature)>
 */
export function signVerificationToken(payload, secret = HMAC_SECRET) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64url');
  return `ag_bp_${data}.${signature}`;
}

/**
 * Validates a zero-trust verification token and returns the payload if valid.
 */
export function verifyVerificationToken(token, secret = HMAC_SECRET) {
  if (!token || typeof token !== 'string' || !token.startsWith('ag_bp_')) {
    return { valid: false, reason: 'Invalid token prefix' };
  }

  const raw = token.slice(6);
  const parts = raw.split('.');
  if (parts.length !== 2) {
    return { valid: false, reason: 'Malformed token structure' };
  }

  const [data, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64url');

  const sigBuffer = Buffer.from(signature);
  const expBuffer = Buffer.from(expectedSig);

  if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
    return { valid: false, reason: 'HMAC signature verification failed' };
  }

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) {
      return { valid: false, reason: 'Token expired', payload };
    }
    return { valid: true, payload };
  } catch (err) {
    return { valid: false, reason: 'Invalid JSON payload in token' };
  }
}
