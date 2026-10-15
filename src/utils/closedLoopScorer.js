/**
 * Evaluates a 60Hz pointer trajectory against a known server perturbation stream
 * to distinguish human closed-loop biomechanics from delayed feedback bots.
 *
 * @param {Array<{vx: number, vy: number, t: number}>} perturbations - Server force stream
 * @param {Array<{x: number, y: number, t: number}>} pointerLog - Client pointer telemetry
 */
export function verifyClosedLoopBiomechanics(perturbations, pointerLog) {
  if (!pointerLog || pointerLog.length < 45) {
    return { verified: false, reason: 'Insufficient telemetry samples (<45 frames)' };
  }

  const velocities = [];
  const accelerations = [];

  for (let i = 1; i < pointerLog.length; i++) {
    const dt = Math.max(1, pointerLog[i].t - pointerLog[i - 1].t);
    const vx = (pointerLog[i].x - pointerLog[i - 1].x) / dt;
    const vy = (pointerLog[i].y - pointerLog[i - 1].y) / dt;
    const speed = Math.hypot(vx, vy);
    velocities.push({ vx, vy, speed, t: pointerLog[i].t });

    if (velocities.length > 1) {
      const prev = velocities[velocities.length - 2];
      const ax = (vx - prev.vx) / dt;
      const ay = (vy - prev.vy) / dt;
      accelerations.push({ ax, ay, mag: Math.hypot(ax, ay), speed, vx, vy });
    }
  }

  // -------------------------------------------------------------------------
  // INVARIANT 1: Visuomotor Cross-Correlation Lag (135ms - 270ms)
  // -------------------------------------------------------------------------
  let bestLagMs = 0;
  let maxCorr = -Infinity;

  for (let lagMs = 20; lagMs <= 360; lagMs += 16) {
    let corr = 0;
    for (const v of velocities) {
      const p = perturbations.find((item) => Math.abs(item.t - (v.t - lagMs)) < 12);
      if (p) {
        corr += (-p.vx * v.vx) + (-p.vy * v.vy);
      }
    }
    if (corr > maxCorr) {
      maxCorr = corr;
      bestLagMs = lagMs;
    }
  }

  if (bestLagMs < 135 || bestLagMs > 270) {
    return {
      verified: false,
      reason: `Out-of-bounds visuomotor lag (${bestLagMs}ms).`,
    };
  }

  // -------------------------------------------------------------------------
  // INVARIANT 2: Ballistic Sub-Movement Intermittency (Craik's Law)
  // Rejects continuous delayed PID/PD servos that lack discrete sub-movements.
  // -------------------------------------------------------------------------
  let localVelocityPeaks = 0;
  for (let i = 1; i < velocities.length - 1; i++) {
    if (
      velocities[i].speed > velocities[i - 1].speed &&
      velocities[i].speed > velocities[i + 1].speed &&
      velocities[i].speed > 0.04
    ) {
      localVelocityPeaks++;
    }
  }
  const durationSec = (pointerLog[pointerLog.length - 1].t - pointerLog[0].t) / 1000;
  const subMovementRateHz = localVelocityPeaks / Math.max(0.5, durationSec);

  if (subMovementRateHz < 2.2 || subMovementRateHz > 14.5) {
    return {
      verified: false,
      reason: `Non-ballistic control loop detected (${subMovementRateHz.toFixed(1)} Hz).`,
    };
  }

  // -------------------------------------------------------------------------
  // INVARIANT 3: Signal-Dependent Noise Scaling (Harris-Wolpert Law)
  // Rejects synthetic additive noise that does not scale with movement velocity.
  // -------------------------------------------------------------------------
  const fastFrames = accelerations.filter((a) => a.speed > 0.15);
  const slowFrames = accelerations.filter((a) => a.speed <= 0.15);

  if (fastFrames.length > 4 && slowFrames.length > 4) {
    const avgFastAccel =
      fastFrames.reduce((sum, a) => sum + a.mag, 0) / fastFrames.length;
    const avgSlowAccel =
      slowFrames.reduce((sum, a) => sum + a.mag, 0) / slowFrames.length;
    const noiseScalingRatio = avgFastAccel / Math.max(0.0001, avgSlowAccel);

    if (noiseScalingRatio < 1.65) {
      return {
        verified: false,
        reason: `Homoscedastic synthetic noise detected (Ratio: ${noiseScalingRatio.toFixed(2)}).`,
      };
    }
  }

  // -------------------------------------------------------------------------
  // INVARIANT 4: Off-Axis Biomechanical Wrist Coupling
  // Rejects purely orthogonal 1D vector adjustments.
  // -------------------------------------------------------------------------
  let crossAxisCoupling = 0;
  for (const v of velocities) {
    if (v.speed > 0.08) {
      const minAxis = Math.min(Math.abs(v.vx), Math.abs(v.vy));
      const maxAxis = Math.max(Math.abs(v.vx), Math.abs(v.vy));
      crossAxisCoupling += minAxis / Math.max(0.0001, maxAxis);
    }
  }
  const avgCoupling = crossAxisCoupling / velocities.length;

  if (avgCoupling < 0.035) {
    return {
      verified: false,
      reason: 'Collinear vector trajectory (missing biomechanical joint coupling).',
    };
  }

  return {
    verified: true,
    metrics: {
      bestLagMs,
      subMovementRateHz: Number(subMovementRateHz.toFixed(2)),
      wristCoupling: Number(avgCoupling.toFixed(3)),
    },
  };
}
