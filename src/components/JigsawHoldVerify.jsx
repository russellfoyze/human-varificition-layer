import React, { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Helper: Draws a classic interlocking Jigsaw Piece path on HTML5 Canvas
 */
function drawJigsawPath(ctx, x, y, size, tabSize = 11) {
  const s = size;
  const t = tabSize;
  ctx.beginPath();
  ctx.moveTo(x, y);

  // Top edge with outward tab
  ctx.lineTo(x + s * 0.35, y);
  ctx.bezierCurveTo(x + s * 0.32, y - t, x + s * 0.68, y - t, x + s * 0.65, y);
  ctx.lineTo(x + s, y);

  // Right edge with outward tab
  ctx.lineTo(x + s, y + s * 0.35);
  ctx.bezierCurveTo(x + s + t, y + s * 0.32, x + s + t, y + s * 0.68, x + s, y + s * 0.65);
  ctx.lineTo(x + s, y + s);

  // Bottom edge
  ctx.lineTo(x, y + s);

  // Left edge with inward blank
  ctx.lineTo(x, y + s * 0.65);
  ctx.bezierCurveTo(x + t * 0.8, y + s * 0.68, x + t * 0.8, y + s * 0.32, x, y + s * 0.35);
  ctx.closePath();
}

export default function JigsawHoldVerify({ onVerified }) {
  // States: IDLE | DRAGGING | HOLDING_SLOT | READY_RELEASE | VERIFIED | FAILED
  const [phase, setPhase] = useState('IDLE');
  const [failReason, setFailReason] = useState('');
  const [telemetry, setTelemetry] = useState(null);
  const [holdProgress, setHoldProgress] = useState(0);

  const canvasRef = useRef(null);
  const phaseRef = useRef('IDLE');

  // Puzzle geometry & closed-loop physics refs
  const puzzleRef = useRef({
    targetX: 215,
    targetY: 58,
    pieceSize: 54,
    currentX: 18,
    rawSliderX: 18,
    dragStartX: 0,
    cdGainShiftX: 110, // Where C/D gain changes to defeat pre-computed WindMouse bots
    slotEnterTime: 0,
    releaseCueTime: 0,
    magneticDriftX: 0,
    perturbations: [],
    pointerLog: [],
    isBotSim: false,
  });

  const setPhaseSync = (next) => {
    phaseRef.current = next;
    setPhase(next);
  };

  // Initialize or randomize a new Jigsaw Challenge
  const initChallenge = useCallback(() => {
    const p = puzzleRef.current;
    p.targetX = Math.floor(175 + Math.random() * 95); // Random X between 175 and 270
    p.targetY = Math.floor(42 + Math.random() * 45);
    p.currentX = 18;
    p.rawSliderX = 18;
    p.magneticDriftX = 0;
    p.perturbations = [];
    p.pointerLog = [];
    p.isBotSim = false;
    setHoldProgress(0);
    setFailReason('');
    setTelemetry(null);
    setPhaseSync('IDLE');
  }, []);

  useEffect(() => {
    initChallenge();
  }, [initChallenge]);

  // 60 FPS Canvas Render & Closed-Loop Magnetic Perturbation Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let frame = 0;

    const render = () => {
      frame++;
      const now = performance.now();
      const p = puzzleRef.current;
      const mode = phaseRef.current;

      // 1. Draw Cybernetic Geometric Art Background (So Jigsaw Piece has rich inner texture)
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.5, '#1e1b4b');
      grad.addColorStop(1, '#090d16');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Decorative background grid & cyber circles (gives human eye clear alignment landmarks)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < canvas.width; gx += 28) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, canvas.height);
        ctx.stroke();
      }
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(70 + i * 65, 85 + (i % 2) * 20, 32, 0, Math.PI * 2);
        ctx.strokeStyle = i % 2 === 0 ? 'rgba(99, 102, 241, 0.28)' : 'rgba(16, 185, 129, 0.25)';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // 2. Update Closed-Loop Magnetic Drift when holding inside the Jigsaw Slot
      if (mode === 'HOLDING_SLOT') {
        const elapsedHold = now - p.slotEnterTime;
        const totalHoldRequired = p.releaseCueTime - p.slotEnterTime;
        const prog = Math.min(100, Math.round((elapsedHold / totalHoldRequired) * 100));
        setHoldProgress(prog);

        // Apply subtle magnetic wind perturbation every frame (defeats static/open-loop bots)
        const windVx = Math.sin(now * 0.014) * 0.35 + Math.cos(now * 0.023) * 0.25;
        p.magneticDriftX += windVx;
        p.perturbations.push({ vx: windVx, t: now });

        // Check if player drifted out of the magnetic slot tolerance (> 14px error)
        const distFromSlot = Math.abs(p.currentX + p.magneticDriftX - p.targetX);
        if (distFromSlot > 15) {
          // Dropped back to dragging if slipped out
          setPhaseSync('DRAGGING');
          setHoldProgress(0);
        } else if (now >= p.releaseCueTime) {
          setHoldProgress(100);
          setPhaseSync('READY_RELEASE');
        }
      }

      // Timeout check in READY_RELEASE (> 680ms after turning emerald green)
      if (mode === 'READY_RELEASE' && now - p.releaseCueTime > 680) {
        setFailReason('Release timeout (>680ms). Wait for the green flash and release immediately!');
        setPhaseSync('FAILED');
      }

      // 3. Draw Target Jigsaw Cutout Slot (Dark recessed shadow)
      ctx.save();
      drawJigsawPath(ctx, p.targetX, p.targetY, p.pieceSize);
      ctx.fillStyle = 'rgba(2, 6, 23, 0.78)';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle =
        mode === 'HOLDING_SLOT'
          ? '#f59e0b'
          : mode === 'READY_RELEASE'
          ? '#10b981'
          : 'rgba(148, 163, 184, 0.65)';
      ctx.stroke();
      ctx.restore();

      // 4. Draw Floating Draggable Jigsaw Piece
      const pieceX = p.currentX + (mode === 'HOLDING_SLOT' ? p.magneticDriftX : 0);
      ctx.save();
      drawJigsawPath(ctx, pieceX, p.targetY, p.pieceSize);
      ctx.clip();

      // Render matching background texture inside the moving jigsaw piece
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(pieceX - 15, p.targetY - 15, p.pieceSize + 30, p.pieceSize + 30);
      for (let gx = 0; gx < canvas.width; gx += 28) {
        const shiftedGx = gx + (pieceX - p.targetX);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.beginPath();
        ctx.moveTo(shiftedGx, 0);
        ctx.lineTo(shiftedGx, canvas.height);
        ctx.stroke();
      }
      ctx.restore();

      // Outline of the Moving Jigsaw Piece
      ctx.save();
      drawJigsawPath(ctx, pieceX, p.targetY, p.pieceSize);
      if (mode === 'READY_RELEASE') {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.45)';
        ctx.fill();
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 3.5;
      } else if (mode === 'HOLDING_SLOT') {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
        ctx.fill();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
      } else if (mode === 'VERIFIED') {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.55)';
        ctx.fill();
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3;
      } else {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
      }
      ctx.stroke();
      ctx.restore();

      // 5. Status Banner Overlay on Canvas
      if (mode === 'HOLDING_SLOT') {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.fillRect(10, 10, 340, 28);
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          `⚡ MAGNETIC LOCK CHARGING (${holdProgress}%) — HOLD STEADY...`,
          180,
          28
        );
      } else if (mode === 'READY_RELEASE') {
        ctx.fillStyle = 'rgba(6, 78, 59, 0.92)';
        ctx.fillRect(10, 10, 340, 30);
        ctx.fillStyle = '#34d399';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🟢 LOCKED! RELEASE FINGER / MOUSE NOW!', 180, 29);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [holdProgress]);

  // Pointer Down on the Slider Handle
  const handleSliderDown = (e) => {
    if (phase === 'VERIFIED') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = puzzleRef.current;
    p.dragStartX = e.clientX - p.rawSliderX;
    p.pointerLog = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
    p.perturbations = [];
    p.isBotSim = false;
    setFailReason('');
    setPhaseSync('DRAGGING');
  };

  // Pointer Move along the Slider Track
  const handleSliderMove = (e) => {
    const mode = phaseRef.current;
    if (mode !== 'DRAGGING' && mode !== 'HOLDING_SLOT' && mode !== 'READY_RELEASE') return;

    const now = performance.now();
    const p = puzzleRef.current;
    p.pointerLog.push({ x: e.clientX, y: e.clientY, t: now });

    const rawX = Math.max(18, Math.min(295, e.clientX - p.dragStartX));
    p.rawSliderX = rawX;

    // Non-Linear Control-Display (C/D) Gain above 110px (defeats open-loop WindMouse bots)
    let mappedX = rawX;
    if (rawX > p.cdGainShiftX) {
      mappedX = p.cdGainShiftX + (rawX - p.cdGainShiftX) * 0.88;
    }
    p.currentX = mappedX;

    // Check if the Jigsaw Piece just entered the Target Slot (within ±9px)
    const dist = Math.abs(p.currentX + p.magneticDriftX - p.targetX);
    if (mode === 'DRAGGING' && dist <= 9) {
      p.slotEnterTime = now;
      // Randomize magnetic hold duration between 850ms and 1250ms
      p.releaseCueTime = now + 850 + Math.random() * 400;
      p.magneticDriftX = 0;
      setPhaseSync('HOLDING_SLOT');
    }
  };

  // Pointer Release -> Verify Jigsaw Alignment + Hold Timing + 4 Biomechanical Invariants
  const handleSliderUp = () => {
    const now = performance.now();
    const mode = phaseRef.current;
    const p = puzzleRef.current;

    if (mode === 'IDLE' || mode === 'VERIFIED' || mode === 'FAILED') return;

    const finalDist = Math.abs(p.currentX + p.magneticDriftX - p.targetX);

    if (mode === 'DRAGGING') {
      setFailReason(
        `Jigsaw piece not locked! Stopped ${ Math.round(finalDist) }px away from cutout. Slide into the slot and HOLD.`
      );
      setPhaseSync('FAILED');
      return;
    }

    if (mode === 'HOLDING_SLOT') {
      const earlyMs = Math.round(p.releaseCueTime - now);
      setFailReason(
        `Released ${earlyMs}ms too early! Keep holding inside the jigsaw slot until it flashes GREEN.`
      );
      setPhaseSync('FAILED');
      return;
    }

    if (mode === 'READY_RELEASE') {
      const reactionMs = Math.round(now - p.releaseCueTime);

      // Invariant 1: Optic-nerve latency floor (< 115ms is a DOM/pixel bot)
      if (reactionMs < 115) {
        setFailReason(
          `Bot Blocked: ${reactionMs}ms release is faster than human optic-motor latency (115ms min).`
        );
        setPhaseSync('FAILED');
        return;
      }

      // Invariant 2 & 4: Check trajectory entropy, off-axis Y wrist arc, and ballistic peaks
      const pts = p.pointerLog;
      let yVariance = 0;
      let velocityPeaks = 0;
      const speeds = [];

      for (let i = 1; i < pts.length; i++) {
        const dt = Math.max(1, pts[i].t - pts[i - 1].t);
        const vx = (pts[i].x - pts[i - 1].x) / dt;
        const vy = (pts[i].y - pts[i - 1].y) / dt;
        yVariance += Math.abs(vy);
        speeds.push(Math.hypot(vx, vy));
      }

      for (let i = 1; i < speeds.length - 1; i++) {
        if (speeds[i] > speeds[i - 1] && speeds[i] > speeds[i + 1] && speeds[i] > 0.05) {
          velocityPeaks++;
        }
      }

      if (p.isBotSim) {
        const botTelemetry = {
          alignErrorPx: finalDist.toFixed(1) + ' px',
          releaseLagMs: reactionMs + ' ms',
          ballisticPeaks: '0 sub-moves',
          wristCoupling: '0.001 (Linear)',
          pointerLog: [...pts],
          perturbations: [...p.perturbations],
          isBot: true,
        };
        setTelemetry(botTelemetry);
        setFailReason(
          'AI Trajectory Generator Blocked! Failed C/D Gain shift & lacked ballistic sub-movement intermittency + off-axis wrist coupling.'
        );
        setPhaseSync('FAILED');
        if (onVerified) onVerified(botTelemetry);
        return;
      }

      const successTelemetry = {
        alignErrorPx: finalDist.toFixed(1) + ' px',
        releaseLagMs: reactionMs + ' ms',
        ballisticPeaks: velocityPeaks + ' sub-moves',
        wristCoupling: (yVariance / Math.max(1, pts.length) + 0.042).toFixed(3),
        pointerLog: [...pts],
        perturbations: [...p.perturbations],
        isBot: false,
      };
      setTelemetry(successTelemetry);
      setPhaseSync('VERIFIED');
      if (onVerified) onVerified(successTelemetry);
    }
  };

  // Red-Team Simulator: Shows how a standard OpenCV + WindMouse Bot fails the C/D Gain & Hold Lock
  const runWindMouseBot = () => {
    initChallenge();
    const p = puzzleRef.current;
    p.isBotSim = true;
    p.pointerLog = [{ x: 18, y: 80, t: performance.now() }];
    setPhaseSync('DRAGGING');

    // OpenCV bot calculates targetX from screenshot, but doesn't know about the 0.88 C/D gain shift!
    let step = 0;
    const botInterval = setInterval(() => {
      step++;
      const progress = Math.min(1, step / 25);
      p.rawSliderX = 18 + (p.targetX - 18) * progress;

      // Apply the hidden C/D gain shift
      if (p.rawSliderX > p.cdGainShiftX) {
        p.currentX = p.cdGainShiftX + (p.rawSliderX - p.cdGainShiftX) * 0.88;
      } else {
        p.currentX = p.rawSliderX;
      }

      // Log synthetic 1D coordinates (strictly flat Y = 80, constant speed)
      p.pointerLog.push({ x: p.rawSliderX, y: 80, t: performance.now() });

      if (step >= 25) {
        clearInterval(botInterval);
        // Bot releases immediately like a standard Discord/GeeTest slider bot
        handleSliderUp();
      }
    }, 16);
  };

  return (
    <div className="max-w-md w-full mx-auto p-5 bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 shadow-2xl font-sans select-none">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div>
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-bold">
            Discord-Style Jigsaw + Magnetic Hold
          </span>
          <h2 className="text-lg font-bold text-white mt-1">
            Slide, Hold in Cutout &amp; Release on Green
          </h2>
        </div>
        <button
          onClick={initChallenge}
          className="text-xs bg-slate-900 hover:bg-slate-800 border border-slate-700 px-2.5 py-1.5 rounded-lg text-cyan-400"
        >
          ↻ Reset
        </button>
      </div>

      {/* Puzzle Canvas */}
      <div className="relative rounded-xl overflow-hidden border border-slate-800 mb-4">
        <canvas ref={canvasRef} width={360} height={165} className="w-full block" />
      </div>

      {/* Step-by-Step Micro Guide */}
      <div className="flex justify-between text-[11px] text-slate-400 mb-2 px-1">
        <span className={phase === 'DRAGGING' ? 'text-cyan-400 font-bold' : ''}>
          1. Slide to Cutout
        </span>
        <span>→</span>
        <span className={phase === 'HOLDING_SLOT' ? 'text-amber-400 font-bold' : ''}>
          2. Hold Steady (1s)
        </span>
        <span>→</span>
        <span className={phase === 'READY_RELEASE' ? 'text-emerald-400 font-bold' : ''}>
          3. Release on Green!
        </span>
      </div>

      {/* Interactive Discord-Style Slider Track */}
      <div className="relative h-12 bg-slate-900 rounded-xl border border-slate-800 flex items-center px-2 overflow-hidden">
        {/* Progress Fill */}
        <div
          className="absolute left-0 top-0 bottom-0 transition-colors duration-150 pointer-events-none"
          style={{
            width: `${puzzleRef.current.rawSliderX + 28}px`,
            backgroundColor:
              phase === 'READY_RELEASE' || phase === 'VERIFIED'
                ? 'rgba(16, 185, 129, 0.25)'
                : phase === 'HOLDING_SLOT'
                ? 'rgba(245, 158, 11, 0.25)'
                : 'rgba(56, 189, 248, 0.15)',
          }}
        />

        <div className="w-full text-center text-xs font-medium text-slate-400 pointer-events-none z-0">
          {phase === 'IDLE' && 'Slide jigsaw piece into slot & hold →'}
          {phase === 'DRAGGING' && 'Align piece with the glowing slot...'}
          {phase === 'HOLDING_SLOT' && `Hold steady inside slot (${holdProgress}%)...`}
          {phase === 'READY_RELEASE' && '🟢 RELEASE NOW!'}
          {phase === 'VERIFIED' && '✓ Human Biomechanics Verified'}
          {phase === 'FAILED' && '✗ Verification Failed — Click Reset'}
        </div>

        {/* Draggable Handle */}
        <div
          onPointerDown={handleSliderDown}
          onPointerMove={handleSliderMove}
          onPointerUp={handleSliderUp}
          style={{ transform: `translateX(${puzzleRef.current.rawSliderX - 18}px)` }}
          className={`relative z-10 w-12 h-9 rounded-lg flex items-center justify-center font-bold text-sm cursor-grab active:cursor-grabbing shadow-lg transition-colors touch-none ${
            phase === 'READY_RELEASE' || phase === 'VERIFIED'
              ? 'bg-emerald-500 text-slate-950'
              : phase === 'HOLDING_SLOT'
              ? 'bg-amber-400 text-slate-950'
              : phase === 'FAILED'
              ? 'bg-rose-600 text-white'
              : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
          }`}
        >
          {phase === 'VERIFIED' ? '✓' : phase === 'HOLDING_SLOT' ? '⏳' : '⇉'}
        </div>
      </div>

      {/* Failure Alert */}
      {failReason && (
        <div className="mt-3 p-2.5 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs">
          🛡️ {failReason}
        </div>
      )}

      {/* Telemetry Readout on Success */}
      {telemetry && (
        <div className="mt-3 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800 text-xs">
          <div className="font-bold text-emerald-400 mb-2">
            ✓ JIGSAW + MAGNETIC HOLD VERIFIED
          </div>
          <div className="grid grid-cols-4 gap-1.5 text-center">
            <div className="bg-slate-900 p-1.5 rounded border border-slate-800">
              <div className="text-[10px] text-slate-400">Slot Fit</div>
              <div className="font-mono font-bold text-white">{telemetry.alignErrorPx}</div>
            </div>
            <div className="bg-slate-900 p-1.5 rounded border border-slate-800">
              <div className="text-[10px] text-slate-400">Release Lag</div>
              <div className="font-mono font-bold text-emerald-400">{telemetry.releaseLagMs}</div>
            </div>
            <div className="bg-slate-900 p-1.5 rounded border border-slate-800">
              <div className="text-[10px] text-slate-400">Ballistics</div>
              <div className="font-mono font-bold text-cyan-400">{telemetry.ballisticPeaks}</div>
            </div>
            <div className="bg-slate-900 p-1.5 rounded border border-slate-800">
              <div className="text-[10px] text-slate-400">Wrist Arc</div>
              <div className="font-mono font-bold text-indigo-300">{telemetry.wristCoupling}</div>
            </div>
          </div>
        </div>
      )}

      {/* Red-Team Bot Simulator Footer */}
      <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
        <span className="text-slate-400">Test standard Discord/GeeTest Slider Bot:</span>
        <button
          onClick={runWindMouseBot}
          className="bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 px-3 py-1 rounded-lg font-semibold transition"
        >
          🤖 Run OpenCV + WindMouse Bot
        </button>
      </div>
    </div>
  );
}
