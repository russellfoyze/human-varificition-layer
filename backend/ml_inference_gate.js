import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RULES_PATH = path.join(__dirname, '..', 'ml_audit', 'artifacts', 'exported_rf_rules.json');

/**
 * Evaluates a live BiomechanicalTelemetryVector using both the Deterministic
 * Algorithms (1-5) and the trained ML Mahalanobis/Importance Scorer.
 */
export function scoreLiveTelemetryWithML(telemetry) {
  // 1. Deterministic Hard Bounds (Algorithms 1 - 4)
  if (telemetry.slotErrorPx > 9.0) {
    return { verified: false, mlScore: 0.0, reason: 'Failed Algorithm 1: C/D Gain Slot Error > 9px' };
  }
  if (telemetry.reactionMs < 115 || telemetry.reactionMs > 680) {
    return { verified: false, mlScore: 0.0, reason: 'Failed Algorithm 4: Optic-Nerve / VLM Latency Bound' };
  }
  if (telemetry.submovementRateHz < 1.2 || telemetry.submovementRateHz > 28.0 || telemetry.ballisticPeaks < 3) {
    return { verified: false, mlScore: 0.0, reason: 'Failed Algorithm 2: Craik Ballistic Submovement Bound' };
  }
  if (telemetry.wristCoupling < 0.035) {
    return { verified: false, mlScore: 0.0, reason: 'Failed Algorithm 3: 2D Wrist-Finger Arc Coupling' };
  }

  // 2. Load Trained ML Parameters
  if (!fs.existsSync(RULES_PATH)) {
    return { verified: true, mlScore: 0.95, reason: 'Passed Deterministic Gate (ML weights pending build)' };
  }

  const model = JSON.parse(fs.readFileSync(RULES_PATH, 'utf-8'));
  const rawVector = [
    telemetry.reactionMs ?? 220,
    telemetry.slotErrorPx ?? 1.2,
    telemetry.ballisticPeaks ?? 6,
    telemetry.wristCoupling ?? 0.06,
    telemetry.submovementRateHz ?? 3.5,
    telemetry.meanVelocity ?? 0.38,
    telemetry.maxVelocity ?? 1.3,
    telemetry.holdDurationMs ?? 1000,
    telemetry.velocitySkewness ?? 1.15,
    telemetry.harrisWolpertRatio ?? 2.6,
    telemetry.jerkZeroCrossings ?? 0.45,
    telemetry.windCrossCorrLagMs ?? 188
  ];

  // Standardize vector and compute weighted biomechanical likelihood
  let weightedDistSq = 0;
  for (let i = 0; i < rawVector.length; i++) {
    const z = (rawVector[i] - model.scalerMean[i]) / model.scalerScale[i];
    const diff = z - model.humanCentroid[i];
    const weight = model.featureImportances[model.featureNames[i]] || 0.08;
    weightedDistSq += weight * diff * diff * model.humanInvCovDiag[i];
  }

  // Convert distance into probability [0, 1] via logistic decay
  const mlProbability = Number((1 / (1 + Math.exp(weightedDistSq - 3.2))).toFixed(4));
  const verified = mlProbability >= 0.5;

  return {
    verified,
    mlScore: mlProbability,
    aiReplaceabilityRisk: Number(((1 - mlProbability) * 100).toFixed(2)) + '%',
    reason: verified
      ? 'Passed Deterministic + ML Sensorimotor Ensemble'
      : `ML Anomaly Detected (Score: ${mlProbability} < 0.50)`
  };
}

export default { scoreLiveTelemetryWithML };
