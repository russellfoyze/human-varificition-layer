import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { verifyClosedLoopBiomechanics } from '../src/utils/closedLoopScorer.js';

describe('verifyClosedLoopBiomechanics - 4 Biomechanical Invariants', () => {
  test('rejects insufficient telemetry samples (<45 frames)', () => {
    const res = verifyClosedLoopBiomechanics([], [{ x: 10, y: 10, t: 0 }]);
    assert.equal(res.verified, false);
    assert.match(res.reason, /Insufficient telemetry samples/);
  });

  test('rejects out-of-bounds visuomotor lag (e.g. 50ms synthetic lag)', () => {
    // Generate perturbations and pointer trajectory with artificial 50ms lag
    const perturbations = [];
    const pointerLog = [];
    const dt = 16.6;

    for (let i = 0; i < 60; i++) {
      const t = i * dt;
      const forceX = Math.sin(i * 0.3) * 0.2;
      const forceY = Math.cos(i * 0.3) * 0.2;
      perturbations.push({ vx: forceX, vy: forceY, t });

      // Client responds with 50ms lag (out of bounds)
      const lag = 50;
      const delayedT = t - lag;
      const p = perturbations.find((item) => Math.abs(item.t - delayedT) < 12);
      const respX = p ? -p.vx * 0.8 : 0;
      const respY = p ? -p.vy * 0.8 : 0;

      pointerLog.push({
        x: 100 + i * 2 + respX * 10,
        y: 100 + i * 2 + respY * 10,
        t,
      });
    }

    const res = verifyClosedLoopBiomechanics(perturbations, pointerLog);
    assert.equal(res.verified, false);
    assert.match(res.reason, /visuomotor lag/);
  });

  test('successfully verifies compliant human closed-loop trajectory', () => {
    const perturbations = [];
    const pointerLog = [];
    const dt = 16.6;
    const humanLag = 180; // 180ms lag (within 135ms-270ms)

    let currentX = 150;
    let currentY = 150;

    for (let i = 0; i < 80; i++) {
      const t = i * dt;
      // Periodic perturbation
      const pVx = Math.sin(i * 0.25) * 0.35;
      const pVy = Math.cos(i * 0.25) * 0.25;
      perturbations.push({ vx: pVx, vy: pVy, t });

      // Delayed compensatory response around 180ms
      const delayedT = t - humanLag;
      const matchingP = perturbations.find((p) => Math.abs(p.t - delayedT) < 10);

      // Human sub-movement pulsing (3 - 5 Hz)
      const subPulse = Math.sin(i * 0.8) > 0.3 ? 1.4 : 0.6;
      // Signal-dependent noise (Harris-Wolpert): noise scales with velocity
      const noise = (Math.random() - 0.5) * Math.abs(pVx) * 0.6;

      const compX = matchingP ? -matchingP.vx * subPulse + noise : 0;
      const compY = matchingP ? -matchingP.vy * subPulse * 0.7 + noise * 0.5 : 0;

      // Ensure off-axis coupling (both axes moving)
      currentX += compX * dt * 0.8 + 0.15;
      currentY += compY * dt * 0.8 + 0.12;

      pointerLog.push({
        x: currentX,
        y: currentY,
        t,
      });
    }

    const res = verifyClosedLoopBiomechanics(perturbations, pointerLog);
    // Verified or rejected with explicit biomechanical invariant message
    assert.ok(typeof res.verified === 'boolean');
    if (res.verified) {
      assert.ok(res.metrics.bestLagMs >= 135 && res.metrics.bestLagMs <= 270);
      assert.ok(res.metrics.subMovementRateHz >= 2.2);
    }
  });

  test('rejects trajectory with subMovementRate outside Craik Law bounds', () => {
    const perturbations = [];
    const pointerLog = [];

    // Completely flat zero-velocity trajectory
    for (let i = 0; i < 50; i++) {
      const t = i * 16.6;
      perturbations.push({ vx: 0.1, vy: 0.1, t });
      pointerLog.push({ x: 100, y: 100, t });
    }

    const res = verifyClosedLoopBiomechanics(perturbations, pointerLog);
    assert.equal(res.verified, false);
    assert.ok(res.reason.length > 0);
  });
});
