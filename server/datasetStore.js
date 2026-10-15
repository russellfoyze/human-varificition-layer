import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const DATASET_FILE = path.join(DATA_DIR, 'ml_dataset.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory dataset cache
let dataset = [];

// Load existing data from file if present
try {
  if (fs.existsSync(DATASET_FILE)) {
    const raw = fs.readFileSync(DATASET_FILE, 'utf8');
    dataset = JSON.parse(raw);
  }
} catch (err) {
  console.error('Could not load existing ML dataset, starting fresh:', err.message);
  dataset = [];
}

/**
 * Persists the current dataset to disk
 */
function persistDataset() {
  try {
    fs.writeFileSync(DATASET_FILE, JSON.stringify(dataset, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save dataset file:', err.message);
  }
}

/**
 * Records a new biomechanical telemetry training sample
 */
export function recordSample(sample) {
  const record = {
    id: sample.id || `sample_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: sample.timestamp || new Date().toISOString(),
    label: sample.label || (sample.isBot ? 'bot' : 'human'),
    is_bot: sample.isBot ? 1 : 0,
    verified: sample.verified ? 1 : 0,
    reaction_time_ms: Number(sample.reactionMs || 0),
    slot_fit_error_px: Number(sample.slotErrorPx || 0),
    ballistic_peaks: Number(sample.ballisticPeaks || 0),
    wrist_coupling: Number(sample.wristCoupling || 0),
    submovement_rate_hz: Number(sample.submovementRateHz || 0),
    mean_velocity: Number(sample.meanVelocity || 0),
    max_velocity: Number(sample.maxVelocity || 0),
    velocity_variance: Number(sample.velocityVariance || 0),
    hold_duration_ms: Number(sample.holdDurationMs || 0),
    sample_count: Number(sample.sampleCount || 0),
    noise_scaling_ratio: Number(sample.noiseScalingRatio || 0),
    raw_trajectory_length: Array.isArray(sample.rawTrajectory) ? sample.rawTrajectory.length : 0,
  };

  dataset.unshift(record);
  persistDataset();
  return record;
}

/**
 * Returns all recorded samples
 */
export function getDataset() {
  return dataset;
}

/**
 * Computes statistical summaries for the ML dashboard
 */
export function getDatasetStats() {
  const total = dataset.length;
  const humanCount = dataset.filter((d) => d.is_bot === 0).length;
  const botCount = dataset.filter((d) => d.is_bot === 1).length;
  const passedCount = dataset.filter((d) => d.verified === 1).length;

  const humans = dataset.filter((d) => d.is_bot === 0);
  const avgReactionTime = humans.length
    ? Number((humans.reduce((acc, h) => acc + h.reaction_time_ms, 0) / humans.length).toFixed(1))
    : 0;

  const avgWristCoupling = humans.length
    ? Number((humans.reduce((acc, h) => acc + h.wrist_coupling, 0) / humans.length).toFixed(3))
    : 0;

  const avgBallisticPeaks = humans.length
    ? Number((humans.reduce((acc, h) => acc + h.ballistic_peaks, 0) / humans.length).toFixed(1))
    : 0;

  return {
    totalSamples: total,
    humanSamples: humanCount,
    botSamples: botCount,
    passedSamples: passedCount,
    failedSamples: total - passedCount,
    avgHumanReactionMs: avgReactionTime,
    avgHumanWristCoupling: avgWristCoupling,
    avgHumanBallisticPeaks: avgBallisticPeaks,
  };
}

/**
 * Exports tabular dataset as CSV format ready for pandas / scikit-learn
 */
export function exportToCSV() {
  const headers = [
    'id',
    'timestamp',
    'label',
    'is_bot',
    'verified',
    'reaction_time_ms',
    'slot_fit_error_px',
    'ballistic_peaks',
    'wrist_coupling',
    'submovement_rate_hz',
    'mean_velocity',
    'max_velocity',
    'velocity_variance',
    'hold_duration_ms',
    'sample_count',
    'noise_scaling_ratio',
    'raw_trajectory_length',
  ];

  const rows = dataset.map((d) =>
    headers
      .map((h) => {
        const val = d[h] !== undefined ? d[h] : '';
        return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
      })
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Clears the dataset
 */
export function clearDataset() {
  dataset = [];
  persistDataset();
}
