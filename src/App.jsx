import React, { useState } from 'react';
import JigsawHoldVerify from './components/JigsawHoldVerify.jsx';
import BiomechanicalGraphs from './components/BiomechanicalGraphs.jsx';

export default function App() {
  const [verifiedToken, setVerifiedToken] = useState(null);
  const [latestTelemetry, setLatestTelemetry] = useState(null);
  const [showGraphs, setShowGraphs] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleVerified = (telemetryData) => {
    setLatestTelemetry(telemetryData);

    if (telemetryData && !telemetryData.isBot) {
      const tokenHex = Array.from({ length: 24 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('');
      setVerifiedToken(`ag_jigsaw_verified_${tokenHex}`);
    } else {
      setVerifiedToken(null);
    }
  };

  const copyToken = () => {
    if (!verifiedToken) return;
    navigator.clipboard.writeText(verifiedToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans select-none antialiased">
      {/* Top Modern Glassmorphism Navigation Bar */}
      <header className="w-full border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-xl py-3.5 px-6 sticky top-0 z-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-emerald-400 p-[1.5px] shadow-lg shadow-cyan-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center font-bold text-sm text-cyan-400">
              🧩
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-white">
                AntiGravity Jigsaw-Lock
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-semibold">
                v5.0.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Closed-Loop Visuomotor Reflex &amp; Magnetic Hold Protocol
            </p>
          </div>
        </div>

        {/* Status Pills & Graph Toggle */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Server Authoritative (60Hz)</span>
          </div>

          <button
            onClick={() => setShowGraphs((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
              showGraphs
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50 shadow-sm shadow-indigo-500/20'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            📊 {showGraphs ? 'Hide Graphs' : 'Show All Graphs'}
          </button>
        </div>
      </header>

      {/* Main Responsive Grid Layout */}
      <main className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row items-start justify-center gap-6">
        {/* Left Column: Interactive Jigsaw Slider Challenge */}
        <div className="w-full lg:w-[440px] flex flex-col items-center">
          <div className="w-full relative group">
            {/* Ambient Background Glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 via-indigo-500/20 to-emerald-500/20 rounded-3xl blur-xl opacity-60 pointer-events-none" />

            <div className="relative">
              <JigsawHoldVerify onVerified={handleVerified} />
            </div>
          </div>

          {/* Cryptographic Token Card */}
          {verifiedToken && (
            <div className="mt-4 w-full bg-slate-900/90 border border-emerald-500/40 rounded-2xl p-4 shadow-xl shadow-emerald-950/20 space-y-2 backdrop-blur-md">
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Cryptographic Session Token Issued
                </span>
                <span className="text-[10px] text-slate-400">HMAC-SHA256</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={verifiedToken}
                  className="w-full font-mono text-[11px] text-emerald-300 bg-slate-950/90 p-2 rounded-xl border border-slate-800 select-all outline-none"
                />
                <button
                  onClick={copyToken}
                  className="px-3 py-2 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/60 rounded-xl text-xs text-emerald-300 font-semibold transition shrink-0"
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Biomechanical Telemetry Graphs Panel */}
        {showGraphs && (
          <div className="w-full lg:flex-1 animate-fadeIn transition-all">
            <BiomechanicalGraphs telemetry={latestTelemetry} />

            {/* Invariant Legend Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3 text-xs">
              <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-xl">
                <div className="text-[10px] text-slate-400">Stage 1 Invariant</div>
                <div className="font-bold text-sky-400 mt-0.5">C/D Gain Shift</div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Ratio changes 1.0 → 0.88 to defeat open-loop bots.
                </div>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-xl">
                <div className="text-[10px] text-slate-400">Stage 2 Invariant</div>
                <div className="font-bold text-emerald-400 mt-0.5">Craik's Law</div>
                <div className="text-[10px] text-slate-400 mt-1">
                  2.2–14.5 Hz discrete ballistic sub-movement peaks.
                </div>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-xl">
                <div className="text-[10px] text-slate-400">Stage 3 Invariant</div>
                <div className="font-bold text-indigo-400 mt-0.5">Optic Reflex Window</div>
                <div className="text-[10px] text-slate-400 mt-1">
                  115ms floor (anti-script) to 680ms ceiling (anti-VLM).
                </div>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-xl">
                <div className="text-[10px] text-slate-400">Invariant 4</div>
                <div className="font-bold text-pink-400 mt-0.5">Wrist Arc Coupling</div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Natural 2D Cartesian wrist coupling ≥ 0.035.
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
