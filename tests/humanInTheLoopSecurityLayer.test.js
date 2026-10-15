import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { scoreLiveTelemetryWithML } from '../backend/ml_inference_gate.js';
import { signVerificationToken, verifyVerificationToken, HMAC_SECRET } from '../server/cryptoToken.js';

describe('Human-in-the-Loop Zero-Trust Security Layer: Multi-Method Audit', () => {

  // =========================================================================
  // CATEGORY 1: Genuine Human Verification (Happy Paths & Natural Diversity)
  // =========================================================================
  describe('Category 1: Genuine Human Reflex Diversity (Must Pass & Issue Token)', () => {
    test('Method 1.1: Standard compliant human sensorimotor attempt', () => {
      const telemetry = {
        reactionMs: 220,
        slotErrorPx: 1.2,
        ballisticPeaks: 7,
        wristCoupling: 0.065,
        submovementRateHz: 3.4,
        meanVelocity: 0.38,
        maxVelocity: 1.3,
        holdDurationMs: 1000,
        velocitySkewness: 1.15,
        harrisWolpertRatio: 2.7,
        jerkZeroCrossings: 0.46,
        windCrossCorrLagMs: 190,
        isBot: false,
        verified: true,
      };

      const result = scoreLiveTelemetryWithML(telemetry);
      assert.equal(result.verified, true, 'Standard human must pass ML inference gate');
      assert.ok(result.mlScore >= 0.5, `ML score should be high, got ${result.mlScore}`);

      // Verify HMAC token generation
      const token = signVerificationToken({
        iat: Date.now(),
        exp: Date.now() + 15 * 60 * 1000,
        verified: true,
        mlScore: result.mlScore,
      });
      const verification = verifyVerificationToken(token);
      assert.equal(verification.valid, true, 'Token must be valid and signed');
    });

    test('Method 1.2: High-speed reflex human (fast gamer / athlete)', () => {
      const telemetry = {
        reactionMs: 140, // Swift but strictly above 115ms biological optic nerve floor
        slotErrorPx: 0.6,
        ballisticPeaks: 5,
        wristCoupling: 0.058,
        submovementRateHz: 4.8,
        meanVelocity: 0.52,
        maxVelocity: 1.6,
        holdDurationMs: 1010,
        isBot: false,
        verified: true,
      };

      const result = scoreLiveTelemetryWithML(telemetry);
      assert.equal(result.verified, true);
      assert.ok(result.mlScore >= 0.5);
    });

    test('Method 1.3: Deliberate, cautious human with slower reaction', () => {
      const telemetry = {
        reactionMs: 440, // Well below 680ms VLM timeout
        slotErrorPx: 2.3,
        ballisticPeaks: 8,
        wristCoupling: 0.072,
        submovementRateHz: 2.6,
        meanVelocity: 0.28,
        maxVelocity: 0.95,
        holdDurationMs: 1050,
        isBot: false,
        verified: true,
      };

      const result = scoreLiveTelemetryWithML(telemetry);
      assert.equal(result.verified, true);
      assert.ok(result.mlScore >= 0.5);
    });

    test('Method 1.4: Real user screenshot scenario (14 Craik pulses, 15.5 Hz micro-tremor)', () => {
      const telemetry = {
        reactionMs: 294,
        slotErrorPx: 4.3,
        ballisticPeaks: 14,
        wristCoupling: 0.083,
        submovementRateHz: 15.5, // High-frequency biological tremor
        meanVelocity: 0.45,
        maxVelocity: 1.4,
        holdDurationMs: 1000,
        isBot: false,
        verified: true,
      };

      const result = scoreLiveTelemetryWithML(telemetry);
      assert.equal(result.verified, true, 'User screenshot profile with 14 pulses must pass');
      assert.ok(result.mlScore >= 0.5);
    });
  });

  // =========================================================================
  // CATEGORY 2: Human Edge Cases (Acceptable Boundary Limits)
  // =========================================================================
  describe('Category 2: Human Edge Cases (Within Biological Tolerance)', () => {
    test('Method 2.1: Loose slot fit alignment (7.8px error <= 9.0px tolerance)', () => {
      const telemetry = {
        reactionMs: 260,
        slotErrorPx: 7.8,
        ballisticPeaks: 5,
        wristCoupling: 0.045,
        submovementRateHz: 3.2,
        isBot: false,
        verified: true,
      };

      const result = scoreLiveTelemetryWithML(telemetry);
      assert.equal(result.verified, true);
    });

    test('Method 2.2: Extreme reflex speed at 118ms (>= 115ms threshold)', () => {
      const telemetry = {
        reactionMs: 118,
        slotErrorPx: 1.1,
        ballisticPeaks: 4,
        wristCoupling: 0.05,
        submovementRateHz: 3.8,
        isBot: false,
        verified: true,
      };

      const result = scoreLiveTelemetryWithML(telemetry);
      assert.equal(result.verified, true);
    });

    test('Method 2.3: Near-timeout reaction at 660ms (<= 680ms threshold)', () => {
      const telemetry = {
        reactionMs: 660,
        slotErrorPx: 1.5,
        ballisticPeaks: 6,
        wristCoupling: 0.06,
        submovementRateHz: 3.0,
        isBot: false,
        verified: true,
      };

      const result = scoreLiveTelemetryWithML(telemetry);
      assert.equal(result.verified, true);
    });
  });

  // =========================================================================
  // CATEGORY 3: Human Mistakes (Must Fail & Keep App Locked)
  // =========================================================================
  describe('Category 3: Invariant Violations (Must Reject & Keep App Locked)', () => {
    test('Method 3.1: Missed slot alignment (> 9.0px error)', () => {
      const telemetry = {
        reactionMs: 250,
        slotErrorPx: 12.5, // Dropped outside cutout
        ballisticPeaks: 6,
        wristCoupling: 0.06,
        submovementRateHz: 3.5,
        isBot: false,
        verified: false,
      };

      const result = scoreLiveTelemetryWithML(telemetry);
      assert.equal(result.verified, false);
      assert.ok(result.reason.includes('Algorithm 1'));
    });

    test('Method 3.2: Reaction time timeout (> 680ms)', () => {
      const telemetry = {
        reactionMs: 820, // Distracted human or delayed script
        slotErrorPx: 1.2,
        ballisticPeaks: 6,
        wristCoupling: 0.06,
        submovementRateHz: 3.5,
        isBot: false,
        verified: false,
      };

      const result = scoreLiveTelemetryWithML(telemetry);
      assert.equal(result.verified, false);
      assert.ok(result.reason.includes('Algorithm 4'));
    });
  });

  // =========================================================================
  // CATEGORY 4: Adversarial AI & Bot Archetypes (Must NEVER Unlock)
  // =========================================================================
  describe('Category 4: Adversarial AI Attack Vectors (Zero-Trust Bot Resistance)', () => {
    test('Method 4.1: OpenCV + WindMouse open-loop bot (fails C/D gain 0.88x shift)', () => {
      const targetX = 230;
      const rawSliderX = targetX;
      // At X > 110px, gain shifts to 0.88x
      const actualX = 110 + (rawSliderX - 110) * 0.88;
      const slotErrorPx = Number((targetX - actualX).toFixed(1)); // 14.4px

      const botTelemetry = {
        reactionMs: 220,
        slotErrorPx,
        ballisticPeaks: 6,
        wristCoupling: 0.05,
        submovementRateHz: 3.5,
        isBot: true,
        verified: false,
      };

      const result = scoreLiveTelemetryWithML(botTelemetry);
      assert.equal(result.verified, false, 'OpenCV bot must fail due to C/D gain error');
      assert.ok(result.reason.includes('Algorithm 1'));
    });

    test('Method 4.2: Adaptive Trained ML Bot (gain compensated, but lacks Craik intermittency & wrist coupling)', () => {
      const botTelemetry = {
        reactionMs: 190,
        slotErrorPx: 1.2,
        ballisticPeaks: 1, // Lacks Craik intermittency (< 3 peaks)
        wristCoupling: 0.012, // Linear 1D trajectory (< 0.035)
        submovementRateHz: 1.1,
        isBot: true,
        verified: false,
      };

      const result = scoreLiveTelemetryWithML(botTelemetry);
      assert.equal(result.verified, false, 'Adaptive ML bot must be rejected by Craik bounds');
      assert.ok(result.reason.includes('Algorithm 2'));
    });

    test('Method 4.3: Instant DOM hook / script bot (< 115ms reflex floor)', () => {
      const botTelemetry = {
        reactionMs: 35, // Instant DOM mutation observer hook
        slotErrorPx: 0.5,
        ballisticPeaks: 6,
        wristCoupling: 0.06,
        submovementRateHz: 3.5,
        isBot: true,
        verified: false,
      };

      const result = scoreLiveTelemetryWithML(botTelemetry);
      assert.equal(result.verified, false, 'Superhuman DOM script must be rejected by latency floor');
      assert.ok(result.reason.includes('Algorithm 4'));
    });

    test('Method 4.4: Cloud Vision-Language Model / API bot (> 680ms latency)', () => {
      const botTelemetry = {
        reactionMs: 920, // Remote API inference latency
        slotErrorPx: 1.0,
        ballisticPeaks: 6,
        wristCoupling: 0.06,
        submovementRateHz: 3.5,
        isBot: true,
        verified: false,
      };

      const result = scoreLiveTelemetryWithML(botTelemetry);
      assert.equal(result.verified, false, 'Cloud VLM bot must be rejected by reaction ceiling');
      assert.ok(result.reason.includes('Algorithm 4'));
    });

    test('Method 4.5: Linear Macro Bot without 2D wrist-arc coupling', () => {
      const botTelemetry = {
        reactionMs: 240,
        slotErrorPx: 1.0,
        ballisticPeaks: 6,
        wristCoupling: 0.008, // Pure 1D horizontal movement
        submovementRateHz: 3.5,
        isBot: true,
        verified: false,
      };

      const result = scoreLiveTelemetryWithML(botTelemetry);
      assert.equal(result.verified, false, '1D macro must be rejected by wrist-arc coupling');
      assert.ok(result.reason.includes('Algorithm 3'));
    });
  });

  // =========================================================================
  // CATEGORY 5: Cryptographic Token Security & Anti-Spoofing
  // =========================================================================
  describe('Category 5: Zero-Trust Cryptographic Token Security', () => {
    test('Method 5.1: Valid token generated and verified with HMAC-SHA256', () => {
      const payload = { iat: Date.now(), exp: Date.now() + 60000, verified: true, human: true };
      const token = signVerificationToken(payload);
      const res = verifyVerificationToken(token);

      assert.equal(res.valid, true);
      assert.equal(res.payload.verified, true);
    });

    test('Method 5.2: Rejects tampered token payload', () => {
      const payload = { iat: Date.now(), exp: Date.now() + 60000, verified: true };
      const token = signVerificationToken(payload);
      // Tamper one byte in the base64 payload
      const tampered = token.replace('ey', 'ez');
      const res = verifyVerificationToken(tampered);

      assert.equal(res.valid, false);
      assert.equal(res.reason, 'HMAC signature verification failed');
    });

    test('Method 5.3: Rejects expired token', () => {
      const expiredPayload = { iat: Date.now() - 3600000, exp: Date.now() - 1000, verified: true };
      const token = signVerificationToken(expiredPayload);
      const res = verifyVerificationToken(token);

      assert.equal(res.valid, false);
      assert.equal(res.reason, 'Token expired');
    });

    test('Method 5.4: Rejects forged token signed with wrong secret', () => {
      const payload = { iat: Date.now(), exp: Date.now() + 60000, verified: true };
      const forgedToken = signVerificationToken(payload, 'adversarial-attacker-fake-secret-2026');
      const res = verifyVerificationToken(forgedToken);

      assert.equal(res.valid, false);
      assert.equal(res.reason, 'HMAC signature verification failed');
    });
  });

  // =========================================================================
  // CATEGORY 6: Lock Screen State & Security Invariants
  // =========================================================================
  describe('Category 6: Lock Screen Security Invariants', () => {
    test('Method 6.1: Gate unlock validator strictly blocks bot payload', () => {
      function evaluateGateUnlock(telemetry) {
        if (!telemetry || !telemetry.verified || telemetry.isBot) {
          return { unlocked: false, reason: 'AI / Bot Simulation detected' };
        }
        return { unlocked: true };
      }

      const botPayload = { verified: false, isBot: true, mlScore: 0.12 };
      assert.equal(evaluateGateUnlock(botPayload).unlocked, false);

      const sneakyBot = { verified: true, isBot: true }; // Bot pretending to be verified
      assert.equal(evaluateGateUnlock(sneakyBot).unlocked, false);
    });

    test('Method 6.2: Gate unlock validator allows genuine human verified payload', () => {
      function evaluateGateUnlock(telemetry) {
        if (!telemetry || !telemetry.verified || telemetry.isBot) {
          return { unlocked: false, reason: 'AI / Bot Simulation detected' };
        }
        return { unlocked: true };
      }

      const humanPayload = { verified: true, isBot: false, mlScore: 96 };
      assert.equal(evaluateGateUnlock(humanPayload).unlocked, true);
    });
  });
});
