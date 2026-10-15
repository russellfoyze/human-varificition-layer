import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { recordSample, getDataset, getDatasetStats, exportToCSV, clearDataset } from '../server/datasetStore.js';

describe('ML Dataset Collection & Telemetry Store', () => {
  before(() => {
    clearDataset();
  });

  test('records human telemetry training sample', () => {
    const sample = {
      isBot: false,
      verified: true,
      reactionMs: 215,
      slotErrorPx: 2.3,
      ballisticPeaks: 8,
      wristCoupling: 0.065,
      submovementRateHz: 4.8,
      meanVelocity: 0.28,
      maxVelocity: 0.82,
      sampleCount: 65,
      rawTrajectory: [{ x: 18, y: 50, t: 0 }, { x: 230, y: 52, t: 1000 }],
    };

    const record = recordSample(sample);
    assert.ok(record.id);
    assert.equal(record.label, 'human');
    assert.equal(record.is_bot, 0);
    assert.equal(record.verified, 1);
    assert.equal(record.reaction_time_ms, 215);
  });

  test('records bot telemetry training sample', () => {
    const botSample = {
      isBot: true,
      verified: false,
      reactionMs: 195,
      slotErrorPx: 16.5,
      ballisticPeaks: 0,
      wristCoupling: 0.001,
      submovementRateHz: 0,
      sampleCount: 25,
    };

    const record = recordSample(botSample);
    assert.equal(record.label, 'bot');
    assert.equal(record.is_bot, 1);
    assert.equal(record.verified, 0);
  });

  test('computes aggregate statistics correctly', () => {
    const stats = getDatasetStats();
    assert.equal(stats.totalSamples, 2);
    assert.equal(stats.humanSamples, 1);
    assert.equal(stats.botSamples, 1);
    assert.equal(stats.avgHumanReactionMs, 215);
    assert.equal(stats.avgHumanWristCoupling, 0.065);
    assert.equal(stats.avgHumanBallisticPeaks, 8);
  });

  test('exports tabular dataset to formatted CSV', () => {
    const csv = exportToCSV();
    assert.ok(typeof csv === 'string');
    assert.ok(csv.includes('id,timestamp,label,is_bot,verified'));
    assert.ok(csv.includes('human,0,1,215,2.3,8,0.065'));
    assert.ok(csv.includes('bot,1,0,195,16.5,0,0.001'));
  });

  test('clears dataset properly', () => {
    clearDataset();
    assert.equal(getDataset().length, 0);
    assert.equal(getDatasetStats().totalSamples, 0);
  });
});
