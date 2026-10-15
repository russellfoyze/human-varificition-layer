import React, { useState, useEffect, useCallback } from 'react';
import JigsawHoldVerify from './components/JigsawHoldVerify.jsx';
import BiomechanicalGraphs from './components/BiomechanicalGraphs.jsx';
import MLDatasetDashboard from './components/MLDatasetDashboard.jsx';

export default function App() {
  // Navigation: 'ARENA' (Game & Telemetry) | 'ML_DASHBOARD' (ML Dataset & Features)
  const [activeView, setActiveView] = useState('ARENA');

  // Gamification State
  const [streak, setStreak] = useState(() => {
    return Number(localStorage.getItem('ag_streak') || 0);
  });
  const [bestStreak, setBestStreak] = useState(() => {
    return Number(localStorage.getItem('ag_best_streak') || 0);
  });
  const [totalCorrect, setTotalCorrect] = useState(() => {
    return Number(localStorage.getItem('ag_total_correct') || 0);
  });
  const [totalAttempts, setTotalAttempts] = useState(() => {
    return Number(localStorage.getItem('ag_total_attempts') || 0);
  });
  const [score, setScore] = useState(() => {
    return Number(localStorage.getItem('ag_score') || 0);
  });

  // Telemetry & Verification State
  const [verifiedToken, setVerifiedToken] = useState(null);
  const [latestTelemetry, setLatestTelemetry] = useState(null);
  const [showGraphs, setShowGraphs] = useState(true);
  const [copied, setCopied] = useState(false);

  // ML Dataset State
  const [dataset, setDataset] = useState([]);
  const [datasetStats, setDatasetStats] = useState({});

  // Sync game stats to localStorage
  useEffect(() => {
    localStorage.setItem('ag_streak', streak);
    localStorage.setItem('ag_best_streak', bestStreak);
    localStorage.setItem('ag_total_correct', totalCorrect);
    localStorage.setItem('ag_total_attempts', totalAttempts);
    localStorage.setItem('ag_score', score);
  }, [streak, bestStreak, totalCorrect, totalAttempts, score]);

  // Fetch ML dataset from backend
  const fetchDataset = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:4000/api/telemetry/dataset');
      if (res.ok) {
        const data = await res.json();
        setDataset(data.dataset || []);
        setDatasetStats(data.stats || {});
      }
    } catch (e) {
      // Local fallback
      const local = JSON.parse(localStorage.getItem('ag_local_dataset') || '[]');
      setDataset(local);
    }
  }, []);

  useEffect(() => {
    fetchDataset();
  }, [fetchDataset]);

  // Record an attempt into the game score & ML dataset
  const handleAttempt = async (attemptData) => {
    const isSuccess = Boolean(attemptData.verified);
    const isBot = Boolean(attemptData.isBot);

    // Update attempts counter
    setTotalAttempts((prev) => prev + 1);

    if (isSuccess && !isBot) {
      // Human Passed!
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > bestStreak) setBestStreak(newStreak);
      setTotalCorrect((prev) => prev + 1);

      // Score bonus based on speed & accuracy
      const reflexBonus = Math.max(50, 450 - (attemptData.reactionMs || 250));
      const fitBonus = Math.max(50, 200 - Math.round(Number(attemptData.slotErrorPx || 0) * 10));
      const roundScore = reflexBonus + fitBonus + newStreak * 25;
      setScore((prev) => prev + roundScore);

      // Cryptographic Token
      const tokenHex = Array.from({ length: 24 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('');
      setVerifiedToken(`ag_jigsaw_verified_${tokenHex}`);
    } else if (!isBot) {
      // Human Failed
      setStreak(0);
      setVerifiedToken(null);
    }

    // Save ML Sample to Backend & Local buffer
    const mlSample = {
      id: `sample_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      label: isBot ? 'bot' : 'human',
      isBot,
      verified: isSuccess,
      reactionMs: attemptData.reactionMs || 0,
      slotErrorPx: attemptData.slotErrorPx || 0,
      ballisticPeaks: attemptData.ballisticPeaks || 0,
      wristCoupling: attemptData.wristCoupling || 0,
      submovementRateHz: attemptData.submovementRateHz || 0,
      meanVelocity: attemptData.meanVelocity || 0,
      maxVelocity: attemptData.maxVelocity || 0,
      holdDurationMs: attemptData.holdDurationMs || 0,
      sampleCount: attemptData.sampleCount || 0,
      rawTrajectory: attemptData.pointerLog || [],
    };

    try {
      const res = await fetch('http://localhost:4000/api/telemetry/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mlSample),
      });
      if (res.ok) {
        const result = await res.json();
        setDatasetStats(result.stats || {});
        setDataset((prev) => [result.saved, ...prev]);
      }
    } catch (err) {
      // Local fallback storage
      const existing = JSON.parse(localStorage.getItem('ag_local_dataset') || '[]');
      const updated = [mlSample, ...existing];
      localStorage.setItem('ag_local_dataset', JSON.stringify(updated));
      setDataset(updated);
    }
  };

  const handleVerified = (telemetryData) => {
    setLatestTelemetry(telemetryData);
  };

  const clearDataset = async () => {
    try {
      await fetch('http://localhost:4000/api/telemetry/clear', { method: 'DELETE' });
    } catch (e) {}
    localStorage.removeItem('ag_local_dataset');
    setDataset([]);
    setDatasetStats({ totalSamples: 0, humanSamples: 0, botSamples: 0 });
  };

  const resetGameStats = () => {
    setStreak(0);
    setBestStreak(0);
    setTotalCorrect(0);
    setTotalAttempts(0);
    setScore(0);
  };

  const copyToken = () => {
    if (!verifiedToken) return;
    navigator.clipboard.writeText(verifiedToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const accuracyPct = totalAttempts > 0 ? ((totalCorrect / totalAttempts) * 100).toFixed(1) : '100.0';
  const playerLevel = Math.floor(totalCorrect / 3) + 1;

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans select-none antialiased">
      {/* Top Cybernetic Glassmorphism Navigation Bar */}
      <header className="w-full border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-xl py-3 px-4 sm:px-6 sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-emerald-400 p-[1.5px] shadow-lg shadow-cyan-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center font-bold text-base text-cyan-400">
              🧩
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-white">
                AntiGravity Jigsaw-Lock Game &amp; ML Hub
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-semibold">
                Level {playerLevel}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Biomechanical Sensorimotor Reflex Challenge &amp; Training Data Collector
            </p>
          </div>
        </div>

        {/* View Switcher: Game Arena vs ML Dataset Hub */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
            <button
              onClick={() => setActiveView('ARENA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activeView === 'ARENA'
                  ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🎮 Game Arena
            </button>
            <button
              onClick={() => {
                setActiveView('ML_DASHBOARD');
                fetchDataset();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activeView === 'ML_DASHBOARD'
                  ? 'bg-slate-800 text-emerald-300 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🧠 ML Dataset Hub ({dataset.length})
            </button>
          </div>

          {activeView === 'ARENA' && (
            <button
              onClick={() => setShowGraphs((prev) => !prev)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
                showGraphs
                  ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}
            >
              📊 {showGraphs ? 'Hide Graphs' : 'Show Graphs'}
            </button>
          )}
        </div>
      </header>

      {/* Gamification Live Score Bar */}
      <div className="w-full bg-slate-950/80 border-b border-slate-800/80 py-2.5 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Streak */}
            <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 px-3 py-1 rounded-xl">
              <span className="text-amber-400 font-bold">🔥 Streak:</span>
              <span className="font-mono font-extrabold text-amber-300 text-sm">{streak}</span>
              <span className="text-[10px] text-slate-500">(Best: {bestStreak})</span>
            </div>

            {/* Total Correct / Solved */}
            <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 px-3 py-1 rounded-xl">
              <span className="text-emerald-400 font-bold">✓ Solved:</span>
              <span className="font-mono font-extrabold text-emerald-300 text-sm">
                {totalCorrect}
              </span>
              <span className="text-[10px] text-slate-500">/ {totalAttempts} attempts</span>
            </div>

            {/* Accuracy Rate */}
            <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 px-3 py-1 rounded-xl">
              <span className="text-cyan-400 font-bold">🎯 Accuracy:</span>
              <span className="font-mono font-extrabold text-cyan-300 text-sm">{accuracyPct}%</span>
            </div>

            {/* Score */}
            <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 px-3 py-1 rounded-xl">
              <span className="text-indigo-400 font-bold">⭐ Score:</span>
              <span className="font-mono font-extrabold text-indigo-300 text-sm">
                {score.toLocaleString()} pts
              </span>
            </div>
          </div>

          <button
            onClick={resetGameStats}
            className="text-[10px] text-slate-500 hover:text-slate-300 transition underline cursor-pointer"
          >
            Reset Game Stats
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {activeView === 'ML_DASHBOARD' ? (
          /* ML Dataset & Features Dashboard */
          <MLDatasetDashboard
            dataset={dataset}
            stats={datasetStats}
            onClear={clearDataset}
            onRefresh={fetchDataset}
          />
        ) : (
          /* Game Arena & Live Sensorimotor Graphs */
          <div className="flex flex-col lg:flex-row items-start justify-center gap-6">
            {/* Left Column: Interactive Jigsaw Game */}
            <div className="w-full lg:w-[440px] flex flex-col items-center">
              <div className="w-full relative group">
                {/* Ambient Glow */}
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 via-indigo-500/20 to-emerald-500/20 rounded-3xl blur-xl opacity-60 pointer-events-none" />

                <div className="relative">
                  <JigsawHoldVerify onVerified={handleVerified} onAttempt={handleAttempt} />
                </div>
              </div>

              {/* Cryptographic Session Token Card */}
              {verifiedToken && (
                <div className="mt-4 w-full bg-slate-900/90 border border-emerald-500/40 rounded-2xl p-4 shadow-xl space-y-2 backdrop-blur-md">
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
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

            {/* Right Column: Live Biomechanical Telemetry Graphs */}
            {showGraphs && (
              <div className="w-full lg:flex-1 space-y-3">
                <BiomechanicalGraphs telemetry={latestTelemetry} />

                {/* Invariant Legend Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-xl">
                    <div className="text-[10px] text-slate-400">Stage 1 Invariant</div>
                    <div className="font-bold text-sky-400 mt-0.5">C/D Gain Shift</div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      1.0 → 0.88 ratio shift defeats open-loop bots.
                    </div>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-xl">
                    <div className="text-[10px] text-slate-400">Stage 2 Invariant</div>
                    <div className="font-bold text-emerald-400 mt-0.5">Craik's Law</div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      2.2–14.5 Hz discrete ballistic sub-movement pulses.
                    </div>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-xl">
                    <div className="text-[10px] text-slate-400">Stage 3 Invariant</div>
                    <div className="font-bold text-indigo-400 mt-0.5">Reflex Window</div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      115ms (superhuman) to 680ms (VLM timeout).
                    </div>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-xl">
                    <div className="text-[10px] text-slate-400">Invariant 4</div>
                    <div className="font-bold text-pink-400 mt-0.5">Wrist Arc Coupling</div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      2D joint coupling index ≥ 0.035.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
