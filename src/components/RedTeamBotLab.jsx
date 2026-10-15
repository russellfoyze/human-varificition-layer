import React, { useState } from 'react';

const BOTS = [
  {
    id: 'windmouse',
    name: 'OpenCV + WindMouse Bot',
    type: 'Open-Loop Spline Bot',
    desc: 'Uses computer vision edge detection to find the jigsaw slot, but uses open-loop spline physics that fails upon non-linear 0.88x C/D gain shift.',
    vulnerabilities: ['C/D gain shift causes 18px undershoot', 'Missing closed-loop stabilization'],
    expectedVerdict: 'BLOCKED (Undershoots Slot)',
    color: 'from-rose-500/20 to-orange-500/20 border-rose-700/60 text-rose-300',
  },
  {
    id: 'trained_ml',
    name: 'Adaptive Trained ML Bot',
    type: 'Closed-Loop Neural Agent',
    desc: 'Simulates closed-loop target alignment and 190ms reflex timing, but fails biological micro-tremor and wrist-arc joint invariants.',
    vulnerabilities: ['Craik peak frequency too low (1.1 Hz < 1.8 Hz)', 'Wrist coupling too planar (0.012 < 0.035)'],
    expectedVerdict: 'BLOCKED (Mahalanobis Distance > 4.2)',
    color: 'from-indigo-500/20 to-purple-500/20 border-indigo-700/60 text-indigo-300',
  },
  {
    id: 'linear_macro',
    name: 'Linear Macro / PyAutoGUI',
    type: 'Deterministic Linear Interpolator',
    desc: 'Moves cursor along a straight vector at constant velocity. Zero human jitter or joint rotation curvature.',
    vulnerabilities: ['0.0 Hz Craik frequency (no submovements)', 'Zero off-axis wrist arc (ρ = 0.000)'],
    expectedVerdict: 'BLOCKED (Deterministic Path)',
    color: 'from-amber-500/20 to-yellow-500/20 border-amber-700/60 text-amber-300',
  },
  {
    id: 'superhuman',
    name: 'Instant DOM / Script Bot',
    type: 'Superhuman Script Injector',
    desc: 'Immediately triggers mouse events within 20ms of the green flash cue, violating the biological optic nerve conduction floor.',
    vulnerabilities: ['Reflex latency 20ms < 115ms biological minimum', 'Zero physiological reaction delay'],
    expectedVerdict: 'BLOCKED (Superhuman Script Speed)',
    color: 'from-pink-500/20 to-rose-500/20 border-pink-700/60 text-pink-300',
  },
  {
    id: 'cloud_vlm',
    name: 'Remote VLM Agent (Claude/GPT)',
    type: 'Cloud Vision-Language Driver',
    desc: 'Streams screenshots to cloud multimodal LLM, suffering 500-750ms inference and network round-trip latency.',
    vulnerabilities: ['Latency exceeds 680ms reaction window', 'Cannot maintain closed-loop hold under drift'],
    expectedVerdict: 'BLOCKED (VLM Latency Timeout)',
    color: 'from-cyan-500/20 to-blue-500/20 border-cyan-700/60 text-cyan-300',
  },
];

export default function RedTeamBotLab({ onLaunchBotInArena }) {
  const [activeSimulation, setActiveSimulation] = useState(null);
  const [botLog, setBotLog] = useState([]);

  const runBotSimulation = (bot) => {
    setActiveSimulation(bot.id);
    const newLog = [
      `[${new Date().toLocaleTimeString()}] INITIATING ADVERSARIAL ATTACK: ${bot.name}`,
      `[INFO] Target: Closed-Loop Sensorimotor Gate`,
      `[ANALYZING] Probing C/D gain shift & Craik submovements...`,
      `[RESULT] Intercepted by ML Security Gate! Reason: ${bot.vulnerabilities[0]}`,
      `[VERDICT] ${bot.expectedVerdict} — Zero-Trust App Remains Locked 🔒`,
    ];
    setBotLog(newLog);

    if (onLaunchBotInArena && (bot.id === 'windmouse' || bot.id === 'trained_ml')) {
      onLaunchBotInArena(bot.id);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-rose-950/40 to-slate-900 border border-rose-800/60 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-950 border border-rose-700/60 text-rose-300 text-xs font-mono font-semibold mb-2">
              <span>🤖 ADVERSARIAL RED-TEAM SIMULATOR</span>
              <span className="bg-rose-900/80 px-1.5 py-0.5 rounded text-[10px] text-white">5 BOTS AUDITED</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Test Autonomous AI Bots Against The Security Layer
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed mt-1">
              Select any adversarial agent below to run automated penetration tests against the zero-trust biometric gate.
            </p>
          </div>
        </div>
      </div>

      {/* Bot Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {BOTS.map((bot) => (
          <div
            key={bot.id}
            className={`p-5 rounded-2xl border bg-gradient-to-b ${bot.color} flex flex-col justify-between space-y-4 backdrop-blur-md shadow-lg transition hover:scale-[1.01]`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                  {bot.type}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950/80 border border-slate-800 text-rose-400 font-bold">
                  {bot.expectedVerdict.split(' ')[0]}
                </span>
              </div>
              <h3 className="text-base font-bold text-white tracking-tight">{bot.name}</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{bot.desc}</p>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-800/60 text-[11px]">
              <div className="text-slate-400 font-semibold">Key Detection Invariants:</div>
              <ul className="space-y-1 text-slate-300">
                {bot.vulnerabilities.map((v, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-rose-300">
                    <span>✗</span>
                    <span>{v}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={() => runBotSimulation(bot)}
              className="w-full py-2 bg-slate-950 hover:bg-slate-900 border border-slate-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-md"
            >
              <span>⚡ Simulate Attack</span>
              <span className="text-[10px] text-slate-400">→</span>
            </button>
          </div>
        ))}
      </div>

      {/* Real-Time Security Interception Console */}
      {botLog.length > 0 && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-xs shadow-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2">
            <span className="flex items-center gap-2 text-rose-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              Real-Time Security Defense Interception Log
            </span>
            <span className="text-[10px] text-slate-500">Node.js ML Gate Auth Authoritative</span>
          </div>
          <div className="space-y-1 text-slate-300 text-[11px] max-h-40 overflow-y-auto">
            {botLog.map((line, idx) => (
              <div
                key={idx}
                className={idx === botLog.length - 1 ? 'text-rose-400 font-bold' : 'text-slate-300'}
              >
                {line}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
