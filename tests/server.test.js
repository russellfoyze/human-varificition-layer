import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import express from 'express';
import { signVerificationToken, verifyVerificationToken, HMAC_SECRET } from '../server/cryptoToken.js';

describe('Server-Authoritative Timing & WebSocket Protocol', () => {
  let server;
  let wss;
  let port;

  before(async () => {
    const app = express();
    app.use(express.json());

    app.get('/api/health', (req, res) => {
      res.json({ status: 'online' });
    });

    app.post('/api/verify-token', (req, res) => {
      const { token } = req.body;
      const result = verifyVerificationToken(token);
      if (!result.valid) return res.status(401).json(result);
      res.json({ valid: true, payload: result.payload });
    });

    server = http.createServer(app);
    wss = new WebSocketServer({ server });

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

          if (msg.type === 'PING') {
            ws.send(JSON.stringify({ type: 'PONG', clientTs: msg.clientTs }));
            return;
          }

          if (msg.type === 'RTT_REPORT') {
            session.rttMs = Math.min(300, Math.max(0, Number(msg.rttMs) || 20));
            return;
          }

          if (msg.type === 'HOLD_START') {
            clearTimeout(session.flashTimer);
            clearTimeout(session.decoyTimer);
            session.flashServerTime = null;
            session.decoyServerTime = null;

            session.holdStartServerTime = now;
            // Shortened delay for fast automated testing if test flag passed
            const secretDelayMs = msg.testDelayMs || 50;
            const decoyDelayMs = Math.floor(secretDelayMs * 0.5);

            session.decoyTimer = setTimeout(() => {
              session.decoyServerTime = performance.now();
              if (ws.readyState === 1) {
                ws.send(JSON.stringify({ type: 'DECOY_FLASH', durationMs: 45 }));
              }
            }, decoyDelayMs);

            session.flashTimer = setTimeout(() => {
              session.flashServerTime = performance.now();
              if (ws.readyState === 1) {
                ws.send(JSON.stringify({ type: 'TRIGGER_GREEN' }));
              }
            }, secretDelayMs);
            return;
          }

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
            const simulatedReflex = msg.simulatedReflexMs !== undefined ? msg.simulatedReflexMs : Math.round(rawElapsed - session.rttMs / 2);

            if (simulatedReflex < 125 || simulatedReflex > 620) {
              const code = simulatedReflex < 125 ? 'SUPERHUMAN_SCRIPT_LATENCY' : 'VLM_API_TIMEOUT';
              ws.send(
                JSON.stringify({
                  type: 'VERIFICATION_RESULT',
                  verified: false,
                  code,
                  reflexMs: simulatedReflex,
                  reason:
                    simulatedReflex < 125
                      ? `Blocked: Superhuman script speed (${simulatedReflex}ms < 125ms optic nerve floor).`
                      : `Blocked: Slow VLM API latency (${simulatedReflex}ms > 620ms max window).`,
                })
              );
              return;
            }

            const token = signVerificationToken({
              iat: Date.now(),
              exp: Date.now() + 15 * 60 * 1000,
              reflexMs: simulatedReflex,
              humanVerified: true,
            });

            ws.send(
              JSON.stringify({
                type: 'VERIFICATION_RESULT',
                verified: true,
                code: 'HUMAN_REFLEX_VERIFIED',
                reflexMs: simulatedReflex,
                token,
              })
            );
          }
        } catch (err) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid packet' }));
        }
      });
    });

    await new Promise((resolve) => {
      server.listen(0, () => {
        port = server.address().port;
        resolve();
      });
    });
  });

  after(async () => {
    wss.close();
    await new Promise((resolve) => server.close(resolve));
  });

  test('WebSocket Ping-Pong RTT telemetry', async () => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise((resolve) => (ws.onopen = resolve));

    const pongPromise = new Promise((resolve) => {
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'PONG') resolve(data);
      };
    });

    ws.send(JSON.stringify({ type: 'PING', clientTs: 12345 }));
    const pong = await pongPromise;
    assert.equal(pong.type, 'PONG');
    assert.equal(pong.clientTs, 12345);
    ws.close();
  });

  test('Decoy Trap & Early Release Handling', async () => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise((resolve) => (ws.onopen = resolve));

    const resultPromise = new Promise((resolve) => {
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'VERIFICATION_RESULT') resolve(data);
      };
    });

    // Start hold with long delay then immediately release
    ws.send(JSON.stringify({ type: 'HOLD_START', testDelayMs: 500 }));
    ws.send(JSON.stringify({ type: 'HOLD_RELEASE' }));

    const res = await resultPromise;
    assert.equal(res.verified, false);
    assert.match(res.reason, /Released too early|Bot Trap Triggered/);
    ws.close();
  });

  test('Server Authoritative Reflex Verification & HMAC Token Issuance', async () => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise((resolve) => (ws.onopen = resolve));

    const resultPromise = new Promise((resolve) => {
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'VERIFICATION_RESULT') resolve(data);
      };
    });

    ws.send(JSON.stringify({ type: 'HOLD_START', testDelayMs: 20 }));
    // Wait for green
    await new Promise((resolve) => setTimeout(resolve, 30));
    // Release with simulated human reflex time of 220ms
    ws.send(JSON.stringify({ type: 'HOLD_RELEASE', simulatedReflexMs: 220 }));

    const res = await resultPromise;
    assert.equal(res.verified, true);
    assert.equal(res.code, 'HUMAN_REFLEX_VERIFIED');
    assert.equal(res.reflexMs, 220);
    assert.ok(res.token && res.token.startsWith('ag_bp_'));

    // Verify token validity
    const tokenCheck = verifyVerificationToken(res.token);
    assert.equal(tokenCheck.valid, true);
    assert.equal(tokenCheck.payload.reflexMs, 220);
    assert.equal(tokenCheck.payload.humanVerified, true);

    ws.close();
  });

  test('Server blocks superhuman script speeds (<125ms)', async () => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise((resolve) => (ws.onopen = resolve));

    const resultPromise = new Promise((resolve) => {
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'VERIFICATION_RESULT') resolve(data);
      };
    });

    ws.send(JSON.stringify({ type: 'HOLD_START', testDelayMs: 20 }));
    await new Promise((resolve) => setTimeout(resolve, 30));
    ws.send(JSON.stringify({ type: 'HOLD_RELEASE', simulatedReflexMs: 80 }));

    const res = await resultPromise;
    assert.equal(res.verified, false);
    assert.equal(res.code, 'SUPERHUMAN_SCRIPT_LATENCY');
    ws.close();
  });

  test('Server blocks cloud VLM API timeouts (>620ms)', async () => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise((resolve) => (ws.onopen = resolve));

    const resultPromise = new Promise((resolve) => {
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'VERIFICATION_RESULT') resolve(data);
      };
    });

    ws.send(JSON.stringify({ type: 'HOLD_START', testDelayMs: 20 }));
    await new Promise((resolve) => setTimeout(resolve, 30));
    ws.send(JSON.stringify({ type: 'HOLD_RELEASE', simulatedReflexMs: 780 }));

    const res = await resultPromise;
    assert.equal(res.verified, false);
    assert.equal(res.code, 'VLM_API_TIMEOUT');
    ws.close();
  });
});
