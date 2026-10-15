import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { signVerificationToken, verifyVerificationToken } from '../server/cryptoToken.js';

describe('HMAC-SHA256 Zero-Trust Verification Token', () => {
  test('generates valid token with ag_bp_ prefix and valid HMAC signature', () => {
    const payload = {
      iat: Date.now(),
      exp: Date.now() + 60000,
      reflexMs: 235,
      humanVerified: true,
    };

    const token = signVerificationToken(payload);
    assert.ok(token.startsWith('ag_bp_'));

    const verification = verifyVerificationToken(token);
    assert.equal(verification.valid, true);
    assert.equal(verification.payload.reflexMs, 235);
    assert.equal(verification.payload.humanVerified, true);
  });

  test('rejects tampered token data', () => {
    const token = signVerificationToken({ reflexMs: 200, humanVerified: true });
    const tampered = token.replace('ag_bp_', 'ag_bp_eyJ0YW1wZXJlZCI6dHJ1ZX0=.');
    const result = verifyVerificationToken(tampered);
    assert.equal(result.valid, false);
    assert.match(result.reason, /failed|Malformed/);
  });

  test('rejects expired token', () => {
    const expiredPayload = {
      iat: Date.now() - 100000,
      exp: Date.now() - 1000,
      reflexMs: 220,
    };
    const token = signVerificationToken(expiredPayload);
    const result = verifyVerificationToken(token);
    assert.equal(result.valid, false);
    assert.equal(result.reason, 'Token expired');
  });

  test('rejects invalid or malformed token string', () => {
    assert.equal(verifyVerificationToken('not_a_token').valid, false);
    assert.equal(verifyVerificationToken(null).valid, false);
    assert.equal(verifyVerificationToken('ag_bp_invalid').valid, false);
  });
});
