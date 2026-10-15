import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { scoreLiveTelemetryWithML } from '../backend/ml_inference_gate.js';

describe('Real-Time Node.js ML Inference Gate', () => {
  test('verifies genuine compliant human telemetry', () => {
    const humanSample = {
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
    };

    const result = scoreLiveTelemetryWithML(humanSample);
    assert.equal(result.verified, true);
    assert.ok(result.mlScore >= 0.5, `Expected mlScore >= 0.5, got ${result.mlScore}`);
  });

  test('rejects bot failing C/D gain slot error (> 9px)', () => {
    const botSample = {
      slotErrorPx: 14.4,
      reactionMs: 220,
      ballisticPeaks: 6,
      wristCoupling: 0.05,
      submovementRateHz: 3.5,
    };

    const result = scoreLiveTelemetryWithML(botSample);
    assert.equal(result.verified, false);
    assert.ok(result.reason.includes('Algorithm 1'));
  });

  test('rejects bot failing optic-nerve latency floor (< 115ms)', () => {
    const botSample = {
      slotErrorPx: 1.0,
      reactionMs: 45, // Superhuman DOM trigger
      ballisticPeaks: 6,
      wristCoupling: 0.05,
      submovementRateHz: 3.5,
    };

    const result = scoreLiveTelemetryWithML(botSample);
    assert.equal(result.verified, false);
    assert.ok(result.reason.includes('Algorithm 4'));
  });

  test('rejects bot failing Craik submovement pulses (< 3 peaks)', () => {
    const botSample = {
      slotErrorPx: 1.0,
      reactionMs: 210,
      ballisticPeaks: 1, // Lacks Craik intermittency
      submovementRateHz: 0.8,
      wristCoupling: 0.05,
    };

    const result = scoreLiveTelemetryWithML(botSample);
    assert.equal(result.verified, false);
    assert.ok(result.reason.includes('Algorithm 2'));
  });

  test('rejects bot failing off-axis wrist coupling (< 0.035)', () => {
    const botSample = {
      slotErrorPx: 1.0,
      reactionMs: 210,
      ballisticPeaks: 6,
      submovementRateHz: 3.2,
      wristCoupling: 0.005, // 1D macro
    };

    const result = scoreLiveTelemetryWithML(botSample);
    assert.equal(result.verified, false);
    assert.ok(result.reason.includes('Algorithm 3'));
  });
});
