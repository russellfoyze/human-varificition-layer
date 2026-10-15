import React, { useState, useEffect } from 'react';

export default function MLDatasetDashboard({ dataset = [], stats = {}, onClear, onRefresh }) {
  const [filter, setFilter] = useState('ALL'); // ALL | HUMAN | BOT | PASSED | FAILED
  const [copiedCode, setCopiedCode] = useState(false);

  const filteredData = dataset.filter((item) => {
    if (filter === 'HUMAN') return item.is_bot === 0;
    if (filter === 'BOT') return item.is_bot === 1;
    if (filter === 'PASSED') return item.verified === 1;
    if (filter === 'FAILED') return item.verified === 0;
    return true;
  });

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(dataset, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `antigravity_ml_dataset_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCSV = () => {
    window.location.href = 'http://localhost:4000/api/telemetry/export-csv';
  };

  const pythonSnippet = `# Train a Biomechanical Classifier on collected telemetry
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, roc_auc_score

# 1. Load dataset exported from AntiGravity
df = pd.read_csv('antigravity_ml_dataset.csv')

# 2. Select sensorimotor feature columns
features = [
    'reaction_time_ms',
    'slot_fit_error_px',
    'ballistic_peaks',
    'wrist_coupling',
    'submovement_rate_hz',
    'mean_velocity',
    'max_velocity',
    'velocity_variance'
]

X = df[features].fillna(0)
y = df['is_bot']  # Target: 0 = Human, 1 = Bot

# 3. Train/Test Split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=42)

# 4. Train Random Forest Classifier
clf = RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42)
clf.fit(X_train, y_train)

# 5. Evaluate Performance
preds = clf.predict(X_test)
print(classification_report(y_test, preds, target_names=['Human', 'Bot']))
`;

  const copyPythonCode = () => {
    navigator.clipboard.writeText(pythonSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-xl space-y-5 select-none font-sans">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-base font-extrabold text-white tracking-wide">
              ML Biomechanics Training Dataset Hub
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Collecting sensorimotor human vs bot telemetry samples for Machine Learning models
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={downloadCSV}
            className="px-3 py-1.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/60 rounded-xl text-xs text-emerald-300 font-semibold transition flex items-center gap-1.5"
          >
            📥 Export CSV (Tabular)
          </button>
          <button
            onClick={downloadJSON}
            className="px-3 py-1.5 bg-sky-950 hover:bg-sky-900 border border-sky-700/60 rounded-xl text-xs text-sky-300 font-semibold transition flex items-center gap-1.5"
          >
            📥 Export JSON
          </button>
          <button
            onClick={onClear}
            className="px-3 py-1.5 bg-slate-950 hover:bg-rose-950/80 border border-slate-800 hover:border-rose-800 rounded-xl text-xs text-slate-400 hover:text-rose-300 font-semibold transition"
          >
            🗑️ Clear Data
          </button>
        </div>
      </div>

      {/* Aggregate KPI Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Samples</div>
          <div className="text-xl font-mono font-extrabold text-white mt-0.5">
            {stats.totalSamples || dataset.length}
          </div>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Human Samples</div>
          <div className="text-xl font-mono font-extrabold text-cyan-400 mt-0.5">
            {stats.humanSamples || dataset.filter((d) => d.is_bot === 0).length}
          </div>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Bot Samples</div>
          <div className="text-xl font-mono font-extrabold text-rose-400 mt-0.5">
            {stats.botSamples || dataset.filter((d) => d.is_bot === 1).length}
          </div>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Mean Reflex Lag</div>
          <div className="text-xl font-mono font-extrabold text-emerald-400 mt-0.5">
            {stats.avgHumanReactionMs || 0} ms
          </div>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Mean Wrist Arc</div>
          <div className="text-xl font-mono font-extrabold text-pink-400 mt-0.5">
            {stats.avgHumanWristCoupling || '0.000'}
          </div>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Mean Craik Peaks</div>
          <div className="text-xl font-mono font-extrabold text-amber-400 mt-0.5">
            {stats.avgHumanBallisticPeaks || 0}
          </div>
        </div>
      </div>

      {/* Dataset Filter Tabs & Record Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {['ALL', 'HUMAN', 'BOT', 'PASSED', 'FAILED'].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                  filter === tab
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <span className="text-slate-400 font-mono text-[11px]">
            Showing {filteredData.length} of {dataset.length} samples
          </span>
        </div>

        {/* Scrollable Data Table */}
        <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/70">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 sticky top-0 border-b border-slate-800 text-slate-400 text-[10px] uppercase">
              <tr>
                <th className="p-2.5">Class</th>
                <th className="p-2.5">Verdict</th>
                <th className="p-2.5">Reaction</th>
                <th className="p-2.5">Fit Error</th>
                <th className="p-2.5">Craik Peaks</th>
                <th className="p-2.5">Wrist Arc</th>
                <th className="p-2.5">Frames</th>
                <th className="p-2.5">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-6 text-center text-slate-500 font-sans text-xs">
                    No samples matching filter. Complete a verification or run a bot simulation to collect data!
                  </td>
                </tr>
              ) : (
                filteredData.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-900/60 transition">
                    <td className="p-2.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          d.is_bot === 1
                            ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                            : 'bg-cyan-950/80 text-cyan-300 border border-cyan-800'
                        }`}
                      >
                        {d.label}
                      </span>
                    </td>
                    <td className="p-2.5">
                      <span
                        className={`font-semibold ${
                          d.verified === 1 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {d.verified === 1 ? '✓ PASS' : '✗ FAIL'}
                      </span>
                    </td>
                    <td className="p-2.5">{d.reaction_time_ms} ms</td>
                    <td className="p-2.5">{d.slot_fit_error_px} px</td>
                    <td className="p-2.5">{d.ballistic_peaks}</td>
                    <td className="p-2.5">{d.wrist_coupling}</td>
                    <td className="p-2.5 text-slate-400">{d.sample_count}</td>
                    <td className="p-2.5 text-slate-500 text-[10px] truncate max-w-[120px]">
                      {d.timestamp ? new Date(d.timestamp).toLocaleTimeString() : 'N/A'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Python Quickstart Snippet */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-300 flex items-center gap-1.5">
            🐍 Python Scikit-Learn Training Pipeline
          </span>
          <button
            onClick={copyPythonCode}
            className="text-[11px] text-cyan-400 hover:text-cyan-300 transition font-semibold"
          >
            {copiedCode ? '✓ Copied' : 'Copy Code'}
          </button>
        </div>
        <pre className="text-[10px] font-mono text-slate-400 overflow-x-auto bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 leading-relaxed max-h-36">
          {pythonSnippet}
        </pre>
      </div>
    </div>
  );
}
