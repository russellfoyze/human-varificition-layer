import React, { useState, useEffect, useCallback } from 'react';
import JigsawHoldVerify from './components/JigsawHoldVerify.jsx';
import BiomechanicalGraphs from './components/BiomechanicalGraphs.jsx';
import MLDatasetDashboard from './components/MLDatasetDashboard.jsx';
import CelebrationEffects from './components/CelebrationEffects.jsx';
import { soundEffects } from './utils/soundEffects.js';

// Player Tier Progression System
const RANKS = [
  { level: 1, title: 'Novice Human', minXP: 0, icon: '🌱', color: 'text-slate-300', bg: 'bg-slate-800' },
  { level: 2, title: 'Biometric Scout', minXP: 300, icon: '🔵', color: 'text-cyan-300', bg: 'bg-cyan-950' },
  { level: 3, title: 'Reflex Operative', minXP: 750, icon: '⚡', color: 'text-indigo-300', bg: 'bg-indigo-950' },
  { level: 4, title: 'Cybernetic Hunter', minXP: 1400, icon: '🛡️', color: 'text-emerald-300', bg: 'bg-emerald-950' },
  { level: 5, title: 'Master Biomechanic', minXP: 2300, icon: '🔥', color: 'text-amber-300', bg: 'bg-amber-950' },
  { level: 6, title: 'Neural Apex', minXP: 3500, icon: '🚀', color: 'text-rose-300', bg: 'bg-rose-950' },
  { level: 7, title: 'Cyborg Slayer', minXP: 5200, icon: '💎', color: 'text-purple-300', bg: 'bg-purple-950' },
  { level: 8, title: 'Transcendent Human', minXP: 7500, icon: '👑', color: 'text-yellow-300', bg: 'bg-yellow-950' },
];

// Achievement Badges
const ACHIEVEMENTS = [
  { id: 'first_win', title: 'First Blood', desc: 'Solve your first human verification challenge', icon: '🎯' },
  { id: 'speed_demon', title: 'Reflex God', desc: 'React in under 220ms upon green flash', icon: '⚡' },
  { id: 'pixel_perfect', title: 'Pixel Perfect', desc: 'Lock the jigsaw slot with < 1.0px error', icon: '💎' },
  { id: 'streak_3', title: 'Triple Threat', desc: 'Achieve a 3x verification streak', icon: '🔥' },
  { id: 'streak_5', title: 'Untouchable', desc: 'Achieve a 5x verification streak', icon: '🛡️' },
  { id: 'streak_10', title: 'Biomechanical Legend', desc: 'Achieve a 10x verification streak', icon: '👑' },
  { id: 'dataset_10', title: 'Data Pioneer', desc: 'Contribute 10+ samples to the ML training dataset', icon: '🧠' },
  { id: 'bot_buster', title: 'Bot Hunter', desc: 'Run and defeat the OpenCV WindMouse bot simulation', icon: '🤖' },
];

export default function App() {
  // Navigation: 'ARENA' (Game & Telemetry) | 'ML_DASHBOARD' (ML Dataset & Features)
  const [activeView, setActiveView] = useState('ARENA');

  // Gamification State
  const [streak, setStreak] = useState(() => Number(localStorage.getItem('ag_streak') || 0));
  const [bestStreak, setBestStreak] = useState(() => Number(localStorage.getItem('ag_best_streak') || 0));
  const [totalCorrect, setTotalCorrect] = useState(() => Number(localStorage.getItem('ag_total_correct') || 0));
  const [totalAttempts, setTotalAttempts] = useState(() => Number(localStorage.getItem('ag_total_attempts') || 0));
  const [score, setScore] = useState(() => Number(localStorage.getItem('ag_score') || 0));

  // Audio & Rewards
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('ag_sound') !== 'false');
  const [lastReward, setLastReward] = useState(null);
  const [celebrationTrigger, setCelebrationTrigger] = useState(0);
  const [isLevelUpCelebration, setIsLevelUpCelebration] = useState(false);
  const [levelUpModal, setLevelUpModal] = useState(null);

  // Achievements
  const [unlockedAchievements, setUnlockedAchievements] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ag_achievements') || '[]');
    } catch {
      return [];
    }
  });
  const [recentAchievementToast, setRecentAchievementToast] = useState(null);
  const [showTrophyModal, setShowTrophyModal] = useState(false);

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

  // Sync sound settings
  useEffect(() => {
    soundEffects.enabled = soundEnabled;
  }, [soundEnabled]);

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
      const local = JSON.parse(localStorage.getItem('ag_local_dataset') || '[]');
      setDataset(local);
    }
  }, []);

  useEffect(() => {
    fetchDataset();
  }, [fetchDataset]);

  // Calculate current rank & level progression
  const currentRank = RANKS.slice().reverse().find((r) => score >= r.minXP) || RANKS[0];
  const nextRank = RANKS.find((r) => r.minXP > score) || null;
  const xpInLevel = score - currentRank.minXP;
  const xpNeeded = nextRank ? nextRank.minXP - currentRank.minXP : 1;
  const levelProgressPct = nextRank ? Math.min(100, Math.round((xpInLevel / xpNeeded) * 100)) : 100;

  // Evaluate & trigger unlocked achievements
  const checkAchievements = ({ rx, slotErr, newStreak, datasetCount, isBot }) => {
    const current = new Set(unlockedAchievements);
    const newlyUnlocked = [];

    if (!isBot && !current.has('first_win')) newlyUnlocked.push('first_win');
    if (!isBot && rx > 0 && rx <= 220 && !current.has('speed_demon')) newlyUnlocked.push('speed_demon');
    if (!isBot && slotErr < 1.0 && !current.has('pixel_perfect')) newlyUnlocked.push('pixel_perfect');
    if (newStreak >= 3 && !current.has('streak_3')) newlyUnlocked.push('streak_3');
    if (newStreak >= 5 && !current.has('streak_5')) newlyUnlocked.push('streak_5');
    if (newStreak >= 10 && !current.has('streak_10')) newlyUnlocked.push('streak_10');
    if (datasetCount >= 10 && !current.has('dataset_10')) newlyUnlocked.push('dataset_10');
    if (isBot && !current.has('bot_buster')) newlyUnlocked.push('bot_buster');

    if (newlyUnlocked.length > 0) {
      const updated = [...unlockedAchievements, ...newlyUnlocked];
      setUnlockedAchievements(updated);
      localStorage.setItem('ag_achievements', JSON.stringify(updated));
      const firstAch = ACHIEVEMENTS.find((a) => a.id === newlyUnlocked[0]);
      if (firstAch) {
        setRecentAchievementToast(firstAch);
        setTimeout(() => setRecentAchievementToast(null), 3500);
      }
    }
  };

  // Record an attempt into the game score & ML dataset
  const handleAttempt = async (attemptData) => {
    const isSuccess = Boolean(attemptData.verified);
    const isBot = Boolean(attemptData.isBot);

    setTotalAttempts((prev) => prev + 1);

    if (isSuccess && !isBot) {
      // Calculate human reward grades
      const rx = attemptData.reactionMs || 250;
      let reflexGrade = 'B';
      let reflexBonus = 50;
      if (rx <= 210) {
        reflexGrade = 'S+';
        reflexBonus = 180;
      } else if (rx <= 280) {
        reflexGrade = 'S';
        reflexBonus = 130;
      } else if (rx <= 380) {
        reflexGrade = 'A';
        reflexBonus = 90;
      } else {
        reflexGrade = 'B';
        reflexBonus = 50;
      }

      const slotErr = Number(attemptData.slotErrorPx || 0);
      let fitGrade = 'ALIGNED';
      let fitBonus = 40;
      if (slotErr <= 0.8) {
        fitGrade = 'PERFECT 🎯';
        fitBonus = 120;
      } else if (slotErr <= 2.0) {
        fitGrade = 'PINPOINT';
        fitBonus = 80;
      } else {
        fitGrade = 'ALIGNED';
        fitBonus = 40;
      }

      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > bestStreak) setBestStreak(newStreak);
      setTotalCorrect((prev) => prev + 1);

      const streakMult = Math.min(2.5, Number((1.0 + (newStreak - 1) * 0.25).toFixed(2)));
      const earnedXP = Math.round((100 + reflexBonus + fitBonus) * streakMult);
      const newScore = score + earnedXP;
      setScore(newScore);

      const reward = {
        earnedXP,
        reflexGrade,
        fitGrade,
        streakMult,
      };
      setLastReward(reward);

      // Check level-up
      const oldRank = RANKS.slice().reverse().find((r) => score >= r.minXP) || RANKS[0];
      const newRank = RANKS.slice().reverse().find((r) => newScore >= r.minXP) || RANKS[0];
      const leveledUp = newRank.level > oldRank.level;

      if (leveledUp) {
        setLevelUpModal(newRank);
        setIsLevelUpCelebration(true);
        setCelebrationTrigger(Date.now());
        soundEffects.playLevelUp();
      } else {
        setIsLevelUpCelebration(false);
        setCelebrationTrigger(Date.now());
      }

      // Check Achievements
      checkAchievements({
        rx,
        slotErr,
        newStreak,
        datasetCount: dataset.length + 1,
        isBot: false,
      });

      // Cryptographic Token
      const tokenHex = Array.from({ length: 24 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('');
      setVerifiedToken(`ag_jigsaw_verified_${tokenHex}`);
    } else if (!isBot) {
      // Human Failed
      setStreak(0);
      setVerifiedToken(null);
      setLastReward(null);
    } else if (isBot) {
      // Defeated the bot simulation
      checkAchievements({
        rx: 0,
        slotErr: 0,
        newStreak: 0,
        datasetCount: dataset.length + 1,
        isBot: true,
      });
    }

    // Save ML Sample
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
    setLastReward(null);
    setVerifiedToken(null);
  };

  const copyToken = () => {
    if (!verifiedToken) return;
    navigator.clipboard.writeText(verifiedToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const accuracyPct = totalAttempts > 0 ? ((totalCorrect / totalAttempts) * 100).toFixed(1) : '100.0';

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans select-none antialiased">
      {/* Particle & Confetti Celebration Emitter */}
      <CelebrationEffects trigger={celebrationTrigger} isLevelUp={isLevelUpCelebration} />

      {/* Level Up Celebration Modal */}
      {levelUpModal && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border-2 border-amber-500/80 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl shadow-amber-500/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500" />
            <div className="text-5xl mb-3 animate-bounce">{levelUpModal.icon}</div>
            <div className="text-xs uppercase tracking-widest text-amber-400 font-extrabold mb-1">
              ⭐ LEVEL UP! PROMOTED ⭐
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight mb-1">
              Level {levelUpModal.level}
            </h2>
            <div className="text-base font-bold bg-gradient-to-r from-amber-300 to-yellow-200 bg-clip-text text-transparent mb-3">
              {levelUpModal.title}
            </div>
            <p className="text-xs text-slate-300 mb-5 leading-relaxed">
              Your closed-loop sensorimotor reflexes and precision have evolved. Tier privileges unlocked!
            </p>
            <button
              onClick={() => setLevelUpModal(null)}
              className="w-full py-3 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black rounded-xl text-sm shadow-lg shadow-amber-500/30 transition cursor-pointer active:scale-95"
            >
              CLAIM REWARD &amp; CONTINUE →
            </button>
          </div>
        </div>
      )}

      {/* Achievement Toast */}
      {recentAchievementToast && (
        <div className="fixed bottom-6 right-6 z-[120] bg-gradient-to-r from-amber-950 via-slate-900 to-slate-950 border border-amber-500/80 rounded-2xl p-3.5 shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom duration-300">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xl shrink-0">
            {recentAchievementToast.icon}
          </div>
          <div>
            <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
              🏆 Achievement Unlocked!
            </div>
            <div className="text-xs font-bold text-white">{recentAchievementToast.title}</div>
            <div className="text-[10px] text-slate-400">{recentAchievementToast.desc}</div>
          </div>
        </div>
      )}

      {/* Trophies & Achievements Modal */}
      {showTrophyModal && (
        <div className="fixed inset-0 z-[115] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🏆</span>
                <div>
                  <h3 className="font-bold text-white text-base">Achievement Showcase</h3>
                  <div className="text-xs text-amber-400 font-medium">
                    Unlocked: {unlockedAchievements.length} / {ACHIEVEMENTS.length}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowTrophyModal(false)}
                className="text-slate-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-4 max-h-[60vh] overflow-y-auto pr-1">
              {ACHIEVEMENTS.map((ach) => {
                const isUnlocked = unlockedAchievements.includes(ach.id);
                return (
                  <div
                    key={ach.id}
                    className={`p-3 rounded-2xl border flex items-center gap-3 transition ${
                      isUnlocked
                        ? 'bg-amber-950/20 border-amber-500/40 text-slate-200'
                        : 'bg-slate-950/60 border-slate-800/80 opacity-40 grayscale'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${
                        isUnlocked ? 'bg-amber-500/20 border border-amber-500/30' : 'bg-slate-800'
                      }`}
                    >
                      {ach.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs truncate flex items-center gap-1.5">
                        {ach.title}
                        {isUnlocked && <span className="text-[10px] text-amber-400">✓</span>}
                      </div>
                      <div className="text-[10px] text-slate-400 leading-tight mt-0.5">{ach.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Top Cybernetic Glassmorphism Navigation Bar */}
      <header className="w-full border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xl py-3 px-4 sm:px-6 sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3">
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
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${currentRank.bg} ${currentRank.color} border border-slate-700 font-semibold flex items-center gap-1`}>
                <span>{currentRank.icon}</span> Level {currentRank.level}: {currentRank.title}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Biomechanical Sensorimotor Reflex Challenge &amp; Training Data Collector
            </p>
          </div>
        </div>

        {/* View Switcher, Audio Toggle & Trophy Showcase */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Audio Toggle */}
          <button
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              localStorage.setItem('ag_sound', next ? 'true' : 'false');
              soundEffects.enabled = next;
            }}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1 ${
              soundEnabled
                ? 'bg-slate-900 border-slate-700 text-cyan-300 hover:border-cyan-500'
                : 'bg-slate-900/50 border-slate-800 text-slate-500'
            }`}
            title={soundEnabled ? 'Sound Effects Enabled' : 'Sound Effects Muted'}
          >
            {soundEnabled ? '🔊 Sound On' : '🔇 Muted'}
          </button>

          {/* Trophies Button */}
          <button
            onClick={() => setShowTrophyModal(true)}
            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-950/40 hover:bg-amber-900/60 border border-amber-700/60 text-amber-300 transition flex items-center gap-1.5 shadow-sm"
          >
            🏆 Trophies ({unlockedAchievements.length}/{ACHIEVEMENTS.length})
          </button>

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

      {/* Gamification Rewarding Score Bar */}
      <div className="w-full bg-slate-950/80 border-b border-slate-800/80 py-2.5 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            {/* Rank & XP Progress Bar */}
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3 py-1 rounded-xl">
              <span className="text-base">{currentRank.icon}</span>
              <div className="flex flex-col">
                <div className="flex items-center justify-between gap-2 text-[10px]">
                  <span className={`font-bold ${currentRank.color}`}>
                    Lvl {currentRank.level}: {currentRank.title}
                  </span>
                  <span className="font-mono text-slate-400">
                    {score} / {nextRank ? nextRank.minXP : 'MAX'} XP
                  </span>
                </div>
                <div className="w-24 sm:w-28 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-amber-400 transition-all duration-300"
                    style={{ width: `${levelProgressPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Streak */}
            <div className={`flex items-center gap-1.5 border px-3 py-1.5 rounded-xl transition ${
              streak >= 3
                ? 'bg-amber-950/40 border-amber-500/50 shadow-sm shadow-amber-500/20'
                : 'bg-slate-900/90 border-slate-800'
            }`}>
              <span className="text-amber-400 font-bold">🔥 Streak:</span>
              <span className="font-mono font-extrabold text-amber-300 text-sm">{streak}</span>
              <span className="text-[10px] text-slate-500">(Best: {bestStreak})</span>
              {streak >= 2 && (
                <span className="text-[10px] font-bold text-amber-400 bg-amber-950/80 px-1 rounded ml-1">
                  {Math.min(2.5, Number((1.0 + (streak - 1) * 0.25).toFixed(2)))}x
                </span>
              )}
            </div>

            {/* Total Correct / Solved */}
            <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-xl">
              <span className="text-emerald-400 font-bold">✓ Solved:</span>
              <span className="font-mono font-extrabold text-emerald-300 text-sm">
                {totalCorrect}
              </span>
              <span className="text-[10px] text-slate-500">/ {totalAttempts}</span>
            </div>

            {/* Accuracy Rate */}
            <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-xl">
              <span className="text-cyan-400 font-bold">🎯 Accuracy:</span>
              <span className="font-mono font-extrabold text-cyan-300 text-sm">{accuracyPct}%</span>
            </div>

            {/* Score PTS */}
            <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-xl">
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
                  <JigsawHoldVerify
                    onVerified={handleVerified}
                    onAttempt={handleAttempt}
                    streak={streak}
                    soundEnabled={soundEnabled}
                    lastReward={lastReward}
                  />
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
