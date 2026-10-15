import React, { useRef, useEffect } from 'react';

/**
 * Renders 4 high-contrast, modern cyber-telemetry graphs from sensorimotor pointer telemetry.
 */
export default function BiomechanicalGraphs({ telemetry }) {
  const trajCanvasRef = useRef(null);
  const velCanvasRef = useRef(null);
  const lagCanvasRef = useRef(null);
  const wristCanvasRef = useRef(null);

  const pts = telemetry?.pointerLog || [];
  const perts = telemetry?.perturbations || [];
  const isBot = Boolean(telemetry?.isBot);

  // 1. Draw Trajectory X(t) Graph
  useEffect(() => {
    const canvas = trajCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    // Subtle grid
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    if (pts.length < 2) {
      ctx.fillStyle = '#64748b';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Awaiting trajectory data...', w / 2, h / 2);
      return;
    }

    const t0 = pts[0].t;
    const totalT = Math.max(1, pts[pts.length - 1].t - t0);
    const minX = 0;
    const maxX = 320;

    // Draw C/D Shift Marker at x = 110
    const cdY = h - ((110 - minX) / (maxX - minX)) * (h - 24) - 12;
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, cdY);
    ctx.lineTo(w, cdY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#f59e0b';
    ctx.font = '9px Inter, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('C/D Shift (0.88x)', 6, Math.max(12, cdY - 3));

    // Draw Curve
    ctx.beginPath();
    ctx.strokeStyle = isBot ? '#f43f5e' : '#38bdf8';
    ctx.lineWidth = 2;
    ctx.shadowColor = isBot ? 'rgba(244, 63, 94, 0.4)' : 'rgba(56, 189, 248, 0.4)';
    ctx.shadowBlur = 4;

    for (let i = 0; i < pts.length; i++) {
      const px = ((pts[i].t - t0) / totalT) * (w - 20) + 10;
      const py = h - ((pts[i].x - minX) / (maxX - minX)) * (h - 24) - 12;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, [pts, isBot]);

  // 2. Draw Velocity & Craik Ballistic Pulses v(t)
  useEffect(() => {
    const canvas = velCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    // Subtle grid
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    if (pts.length < 3) {
      ctx.fillStyle = '#64748b';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Awaiting velocity stream...', w / 2, h / 2);
      return;
    }

    const velocities = [];
    for (let i = 1; i < pts.length; i++) {
      const dt = Math.max(1, pts[i].t - pts[i - 1].t);
      const vx = (pts[i].x - pts[i - 1].x) / dt;
      const vy = (pts[i].y - pts[i - 1].y) / dt;
      velocities.push({ v: Math.hypot(vx, vy), t: pts[i].t });
    }

    const maxV = Math.max(0.4, ...velocities.map((v) => v.v));
    const t0 = pts[0].t;
    const totalT = Math.max(1, pts[pts.length - 1].t - t0);

    // Velocity gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, isBot ? 'rgba(244, 63, 94, 0.35)' : 'rgba(16, 185, 129, 0.35)');
    grad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

    ctx.beginPath();
    ctx.moveTo(10, h - 10);
    for (let i = 0; i < velocities.length; i++) {
      const px = ((velocities[i].t - t0) / totalT) * (w - 20) + 10;
      const py = h - (velocities[i].v / maxV) * (h - 25) - 10;
      ctx.lineTo(px, py);
    }
    ctx.lineTo(w - 10, h - 10);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line stroke
    ctx.beginPath();
    ctx.strokeStyle = isBot ? '#f43f5e' : '#10b981';
    ctx.lineWidth = 2;
    for (let i = 0; i < velocities.length; i++) {
      const px = ((velocities[i].t - t0) / totalT) * (w - 20) + 10;
      const py = h - (velocities[i].v / maxV) * (h - 25) - 10;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Mark Craik Ballistic Peaks
    ctx.fillStyle = '#34d399';
    for (let i = 1; i < velocities.length - 1; i++) {
      if (
        velocities[i].v > velocities[i - 1].v &&
        velocities[i].v > velocities[i + 1].v &&
        velocities[i].v > 0.06
      ) {
        const px = ((velocities[i].t - t0) / totalT) * (w - 20) + 10;
        const py = h - (velocities[i].v / maxV) * (h - 25) - 10;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [pts, isBot]);

  // 3. Draw Visuomotor Reaction Lag Spectrum (Lag Curve)
  useEffect(() => {
    const canvas = lagCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    // Subtle grid
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Human biological reflex window highlight (135ms - 270ms)
    const minLag = 20;
    const maxLag = 360;
    const x1 = ((135 - minLag) / (maxLag - minLag)) * (w - 24) + 12;
    const x2 = ((270 - minLag) / (maxLag - minLag)) * (w - 24) + 12;

    ctx.fillStyle = 'rgba(99, 102, 241, 0.12)';
    ctx.fillRect(x1, 10, x2 - x1, h - 20);
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
    ctx.strokeRect(x1, 10, x2 - x1, h - 20);

    ctx.fillStyle = '#818cf8';
    ctx.font = '9px Inter, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Human Window [135-270ms]', (x1 + x2) / 2, 22);

    // Compute cross-correlation curve across lag values
    const lagValues = [];
    const correlations = [];

    const velocities = [];
    for (let i = 1; i < pts.length; i++) {
      const dt = Math.max(1, pts[i].t - pts[i - 1].t);
      velocities.push({
        vx: (pts[i].x - pts[i - 1].x) / dt,
        vy: (pts[i].y - pts[i - 1].y) / dt,
        t: pts[i].t,
      });
    }

    for (let lag = minLag; lag <= maxLag; lag += 10) {
      let corr = 0;
      for (const v of velocities) {
        const p = perts.find((item) => Math.abs(item.t - (v.t - lag)) < 16);
        if (p) corr += -p.vx * v.vx;
      }
      lagValues.push(lag);
      correlations.push(corr);
    }

    const minC = Math.min(0, ...correlations);
    const maxC = Math.max(1, ...correlations);
    const rangeC = Math.max(0.001, maxC - minC);

    ctx.beginPath();
    ctx.strokeStyle = isBot ? '#f43f5e' : '#6366f1';
    ctx.lineWidth = 2;
    for (let i = 0; i < lagValues.length; i++) {
      const px = ((lagValues[i] - minLag) / (maxLag - minLag)) * (w - 24) + 12;
      const py = h - ((correlations[i] - minC) / rangeC) * (h - 35) - 12;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Mark peak lag
    const maxIdx = correlations.indexOf(Math.max(...correlations));
    if (maxIdx >= 0 && correlations[maxIdx] > 0) {
      const px = ((lagValues[maxIdx] - minLag) / (maxLag - minLag)) * (w - 24) + 12;
      const py = h - ((correlations[maxIdx] - minC) / rangeC) * (h - 35) - 12;
      ctx.fillStyle = '#a5b4fc';
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText(`${lagValues[maxIdx]}ms`, px, Math.max(34, py - 6));
    }
  }, [pts, perts, isBot]);

  // 4. Draw Off-Axis 2D Wrist Arc Phase Plane (X vs Y)
  useEffect(() => {
    const canvas = wristCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    // Subtle grid
    ctx.strokeStyle = 'rgba(236, 72, 153, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    if (pts.length < 2) {
      ctx.fillStyle = '#64748b';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Awaiting 2D motion arc...', w / 2, h / 2);
      return;
    }

    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(minX + 40, ...xs);
    const minY = Math.min(...ys) - 10;
    const maxY = Math.max(minY + 20, ...ys) + 10;

    ctx.beginPath();
    ctx.strokeStyle = isBot ? '#f43f5e' : '#ec4899';
    ctx.lineWidth = 2;
    ctx.shadowColor = isBot ? 'rgba(244, 63, 94, 0.4)' : 'rgba(236, 72, 153, 0.4)';
    ctx.shadowBlur = 4;

    for (let i = 0; i < pts.length; i++) {
      const px = ((pts[i].x - minX) / (maxX - minX)) * (w - 30) + 15;
      const py = ((pts[i].y - minY) / (maxY - minY)) * (h - 26) + 13;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Start and End dots
    if (pts.length > 0) {
      const sx = ((pts[0].x - minX) / (maxX - minX)) * (w - 30) + 15;
      const sy = ((pts[0].y - minY) / (maxY - minY)) * (h - 26) + 13;
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
      ctx.fill();

      const ex = ((pts[pts.length - 1].x - minX) / (maxX - minX)) * (w - 30) + 15;
      const ey = ((pts[pts.length - 1].y - minY) / (maxY - minY)) * (h - 26) + 13;
      ctx.fillStyle = isBot ? '#f43f5e' : '#10b981';
      ctx.beginPath();
      ctx.arc(ex, ey, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [pts, isBot]);

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 shadow-xl backdrop-blur-md space-y-3">
      <div className="flex items-center justify-between border-b border-slate-800/70 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Biomechanical Sensorimotor Telemetry Graphs
          </h3>
        </div>
        <span
          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
            isBot
              ? 'bg-rose-950/70 text-rose-300 border-rose-800'
              : 'bg-emerald-950/70 text-emerald-300 border-emerald-800'
          }`}
        >
          {isBot ? '⚠️ Synthetic Bot Trajectory' : '✓ Live Biological Telemetry'}
        </span>
      </div>

      {/* 2x2 Graphs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Graph 1 */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
          <div className="flex justify-between items-center text-[11px]">
            <span className="font-semibold text-sky-400">1. Trajectory Displacement X(t)</span>
            <span className="font-mono text-[10px] text-slate-400">C/D Shift @ 110px</span>
          </div>
          <canvas ref={trajCanvasRef} width={280} height={120} className="w-full rounded-lg" />
          <div className="text-[10px] text-slate-400 flex justify-between">
            <span>Slide Start</span>
            <span>Target Slot Alignment</span>
          </div>
        </div>

        {/* Graph 2 */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
          <div className="flex justify-between items-center text-[11px]">
            <span className="font-semibold text-emerald-400">2. Velocity &amp; Craik Peaks v(t)</span>
            <span className="font-mono text-[10px] text-emerald-400">
              {telemetry?.ballisticPeaks || '0 sub-moves'}
            </span>
          </div>
          <canvas ref={velCanvasRef} width={280} height={120} className="w-full rounded-lg" />
          <div className="text-[10px] text-slate-400 flex justify-between">
            <span>Intermittency (2.2-14.5 Hz)</span>
            <span>Release Deceleration</span>
          </div>
        </div>

        {/* Graph 3 */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
          <div className="flex justify-between items-center text-[11px]">
            <span className="font-semibold text-indigo-400">3. Visuomotor Lag Correlation</span>
            <span className="font-mono text-[10px] text-indigo-300">
              {telemetry?.releaseLagMs || '~180 ms'}
            </span>
          </div>
          <canvas ref={lagCanvasRef} width={280} height={120} className="w-full rounded-lg" />
          <div className="text-[10px] text-slate-400 flex justify-between">
            <span>20ms (Superhuman Script)</span>
            <span>360ms (VLM Timeout)</span>
          </div>
        </div>

        {/* Graph 4 */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
          <div className="flex justify-between items-center text-[11px]">
            <span className="font-semibold text-pink-400">4. 2D Wrist Arc Phase Plane (X×Y)</span>
            <span className="font-mono text-[10px] text-pink-300">
              Coupling: {telemetry?.wristCoupling || '0.052'}
            </span>
          </div>
          <canvas ref={wristCanvasRef} width={280} height={120} className="w-full rounded-lg" />
          <div className="text-[10px] text-slate-400 flex justify-between">
            <span>Off-Axis Biomechanics</span>
            <span>Natural Hand Curvature</span>
          </div>
        </div>
      </div>
    </div>
  );
}
