import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { WebSocketServer } from 'ws';
import { signVerificationToken, verifyVerificationToken, HMAC_SECRET } from './cryptoToken.js';
import { verifyClosedLoopBiomechanics } from './closedLoopScorer.js';
import { scoreLiveTelemetryWithML } from './ml_inference_gate.js';
import {
  recordSample,
  getDataset,
  getDatasetStats,
  exportToCSV,
  clearDataset,
} from './datasetStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// CORS configuration for local development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// REST Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'AntiGravity Bio-Pulse Verification Server',
    timestamp: new Date().toISOString(),
  });
});

// REST Token Verification API
app.post('/api/verify-token', (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ valid: false, reason: 'Token is required' });
  }

  const result = verifyVerificationToken(token);
  if (!result.valid) {
    return res.status(401).json(result);
  }

  return res.json({
    valid: true,
    message: 'Token cryptographically verified',
    payload: result.payload,
  });
});

// REST Closed-Loop Biomechanics Verification API
app.post('/api/verify-closed-loop', (req, res) => {
  const { perturbations, pointerLog } = req.body;
  if (!perturbations || !pointerLog) {
    return res.status(400).json({
      verified: false,
      reason: 'Both perturbations and pointerLog arrays are required',
    });
  }

  const scoreResult = verifyClosedLoopBiomechanics(perturbations, pointerLog);
  if (!scoreResult.verified) {
    return res.status(403).json(scoreResult);
  }

  const token = signVerificationToken({
    iat: Date.now(),
    exp: Date.now() + 15 * 60 * 1000,
    closedLoopVerified: true,
    metrics: scoreResult.metrics,
  });

  return res.json({
    verified: true,
    metrics: scoreResult.metrics,
    token,
  });
});

// REST ML Telemetry Dataset Collection Endpoints
app.post('/api/telemetry/record', (req, res) => {
  const sample = req.body;
  if (!sample) {
    return res.status(400).json({ error: 'Sample body required' });
  }
  const saved = recordSample(sample);
  const stats = getDatasetStats();
  return res.json({ success: true, saved, stats });
});

app.get('/api/telemetry/dataset', (req, res) => {
  const dataset = getDataset();
  const stats = getDatasetStats();
  return res.json({ dataset, stats });
});

app.get('/api/telemetry/export-csv', (req, res) => {
  const csv = exportToCSV();
  res.header('Content-Type', 'text/csv');
  res.attachment(`antigravity_ml_dataset_${Date.now()}.csv`);
  return res.send(csv);
});

app.delete('/api/telemetry/clear', (req, res) => {
  clearDataset();
  return res.json({ success: true, message: 'Dataset cleared' });
});

// Score telemetry with Deterministic Algorithms + Trained ML Mahalanobis Ensemble
app.post('/api/telemetry/score-ml', (req, res) => {
  const telemetry = req.body;
  if (!telemetry) {
    return res.status(400).json({ error: 'Telemetry data required' });
  }
  const scoreResult = scoreLiveTelemetryWithML(telemetry);
  if (scoreResult.verified && !telemetry.isBot) {
    scoreResult.token = signVerificationToken({
      iat: Date.now(),
      exp: Date.now() + 15 * 60 * 1000,
      verified: true,
      mlScore: scoreResult.mlScore,
      aiReplaceabilityRisk: scoreResult.aiReplaceabilityRisk,
    });
  }
  return res.json(scoreResult);
});

// Get Adversarial AI-Replaceability Audit Report
app.get('/api/ml-audit/metrics', (req, res) => {
  const metricsPath = path.join(__dirname, '..', 'ml_audit', 'artifacts', 'model_metrics.json');
  if (fs.existsSync(metricsPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(metricsPath, 'utf-8'));
      return res.json(data);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to read audit metrics' });
    }
  }
  return res.status(404).json({ error: 'Audit metrics not yet generated' });
});

// Train ML Model directly on live Dataset Hub telemetry
app.post('/api/ml/train', (req, res) => {
  const py = spawn('python', ['train_model.py'], {
    cwd: path.join(__dirname, '..'),
  });

  let output = '';
  let errOutput = '';

  py.stdout.on('data', (d) => {
    output += d.toString();
  });

  py.stderr.on('data', (d) => {
    errOutput += d.toString();
  });

  py.on('close', (code) => {
    if (code === 0) {
      return res.json({
        success: true,
        message: 'Trained Random Forest model on live Dataset Hub telemetry',
        output,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: errOutput || 'Python process returned non-zero exit code',
        output,
      });
    }
  });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  let session = {
    holdStartServerTime: null,
    flashServerTime: null,
    decoyServerTime: null,
    flashTimer: null,
    decoyTimer: null,
    rttMs: 20,
  };

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      const now = performance.now();

      // 1. Measure RTT Ping
      if (msg.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', clientTs: msg.clientTs, serverTs: now }));
        return;
      }

      if (msg.type === 'RTT_REPORT') {
        session.rttMs = Math.min(300, Math.max(0, Number(msg.rttMs) || 20));
        return;
      }

      // 2. Human starts holding the button -> Server schedules secret random flash time
      if (msg.type === 'HOLD_START') {
        clearTimeout(session.flashTimer);
        clearTimeout(session.decoyTimer);
        session.flashServerTime = null;
        session.decoyServerTime = null;

        session.holdStartServerTime = now;
        const secretDelayMs = 950 + Math.floor(Math.random() * 750); // 950ms - 1700ms
        const decoyDelayMs = Math.floor(secretDelayMs * 0.52);

        // Emit Decoy Flash Packet halfway through
        session.decoyTimer = setTimeout(() => {
          session.decoyServerTime = performance.now();
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'DECOY_FLASH', durationMs: 45 }));
          }
        }, decoyDelayMs);

        // Emit Real Green Trigger Packet
        session.flashTimer = setTimeout(() => {
          session.flashServerTime = performance.now();
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'TRIGGER_GREEN' }));
          }
        }, secretDelayMs);
        return;
      }

      // 3. Human releases the button -> Server computes authoritative reflex time
      if (msg.type === 'HOLD_RELEASE') {
        clearTimeout(session.flashTimer);
        clearTimeout(session.decoyTimer);

        if (!session.flashServerTime) {
          const hitDecoy =
            session.decoyServerTime && Math.abs(now - session.decoyServerTime) < 120;
          ws.send(
            JSON.stringify({
              type: 'VERIFICATION_RESULT',
              verified: false,
              code: hitDecoy ? 'DECOY_TRAP_TRIGGERED' : 'EARLY_RELEASE',
              reason: hitDecoy
                ? 'Bot Trap Triggered: Released on 45ms Decoy Flash!'
                : 'Released too early before green trigger.',
            })
          );
          return;
        }

        const rawElapsed = now - session.flashServerTime;
        const rttAdjustedReflexMs = Math.round(rawElapsed - session.rttMs / 2);

        if (rttAdjustedReflexMs < 125 || rttAdjustedReflexMs > 620) {
          const code = rttAdjustedReflexMs < 125 ? 'SUPERHUMAN_SCRIPT_LATENCY' : 'VLM_API_TIMEOUT';
          ws.send(
            JSON.stringify({
              type: 'VERIFICATION_RESULT',
              verified: false,
              code,
              reflexMs: rttAdjustedReflexMs,
              reason:
                rttAdjustedReflexMs < 125
                  ? `Blocked: Superhuman script speed (${rttAdjustedReflexMs}ms < 125ms optic nerve floor).`
                  : `Blocked: Slow VLM API latency (${rttAdjustedReflexMs}ms > 620ms max window).`,
            })
          );
          return;
        }

        const token = signVerificationToken({
          iat: Date.now(),
          exp: Date.now() + 15 * 60 * 1000,
          reflexMs: rttAdjustedReflexMs,
          humanVerified: true,
        });

        ws.send(
          JSON.stringify({
            type: 'VERIFICATION_RESULT',
            verified: true,
            code: 'HUMAN_REFLEX_VERIFIED',
            reflexMs: rttAdjustedReflexMs,
            token,
          })
        );
      }
    } catch (err) {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid packet payload' }));
      }
    }
  });

  ws.on('close', () => {
    clearTimeout(session.flashTimer);
    clearTimeout(session.decoyTimer);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`AntiGravity Bio-Pulse Verification Server listening on ws://localhost:${PORT}`);
});

export { app, server, wss };
