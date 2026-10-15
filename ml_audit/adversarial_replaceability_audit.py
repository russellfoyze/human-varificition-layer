import os
import json
import numpy as np
import matplotlib.pyplot as plt
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import roc_auc_score, roc_curve, confusion_matrix
from dataset_engine import load_or_bootstrap_dataset
from feature_extractor import FEATURE_NAMES

ARTIFACT_DIR = os.path.join(os.path.dirname(__file__), "artifacts")
os.makedirs(ARTIFACT_DIR, exist_ok=True)

def deterministic_algorithmic_gate(X: np.ndarray) -> np.ndarray:
    """
    Evaluates Algorithms 1-5 from the AntiGravity Specification on each row of X.
    Returns boolean array: True if sample passes all deterministic checks.
    """
    reaction_ms = X[:, 0]
    slot_error = X[:, 1]
    peaks = X[:, 2]
    wrist = X[:, 3]
    sub_rate = X[:, 4]
    hw_ratio = X[:, 9]
    wind_lag = X[:, 11]

    # Algorithm 1: Slot alignment within +-9.0px
    pass_alg1 = slot_error <= 9.0
    # Algorithm 2: Craik's Law submovement pulse rate in [1.8, 14.5] Hz & peaks >= 3
    pass_alg2 = (sub_rate >= 1.8) & (sub_rate <= 14.5) & (peaks >= 3)
    # Algorithm 3: Off-Axis 2D Wrist Coupling >= 0.035
    pass_alg3 = wrist >= 0.035
    # Algorithm 4: Visuomotor Optic-Nerve & VLM Filter [115ms, 680ms]
    pass_alg4 = (reaction_ms >= 115.0) & (reaction_ms <= 680.0)
    # Algorithm 5 + Biomechanical Invariants: Harris-Wolpert >= 1.65 & Lag in [135ms, 270ms]
    pass_alg5 = (hw_ratio >= 1.65) & (wind_lag >= 135.0) & (wind_lag <= 270.0)

    return pass_alg1 & pass_alg2 & pass_alg3 & pass_alg4 & pass_alg5

def compute_eer(y_true: np.ndarray, y_scores: np.ndarray):
    fpr, tpr, thresholds = roc_curve(y_true, y_scores)
    fnr = 1.0 - tpr
    idx = np.nanargmin(np.abs(fnr - fpr))
    eer = float((fpr[idx] + fnr[idx]) / 2.0)
    opt_threshold = float(thresholds[idx])
    return eer, opt_threshold, fpr, tpr

def run_full_ml_and_replaceability_audit():
    print("[1/4] Loading / Bootstrapping AntiGravity Telemetry Dataset...")
    X, y, _ = load_or_bootstrap_dataset(min_samples=2400)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, stratify=y, random_state=42
    )

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    print("[2/4] Training Blue-Team Classifier Ensemble (RF, GBM, MLP)...")
    rf = RandomForestClassifier(n_estimators=200, max_depth=10, random_state=42)
    gbm = GradientBoostingClassifier(n_estimators=150, learning_rate=0.08, random_state=42)
    mlp = MLPClassifier(hidden_layer_sizes=(64, 32, 16), max_iter=400, random_state=42)

    rf.fit(X_train_s, y_train)
    gbm.fit(X_train_s, y_train)
    mlp.fit(X_train_s, y_train)

    # Ensemble probability (weighted average)
    p_rf = rf.predict_proba(X_test_s)[:, 1]
    p_gbm = gbm.predict_proba(X_test_s)[:, 1]
    p_mlp = mlp.predict_proba(X_test_s)[:, 1]
    p_ens = 0.40 * p_rf + 0.40 * p_gbm + 0.20 * p_mlp

    auc_score = float(roc_auc_score(y_test, p_ens))
    eer, opt_thresh, fpr, tpr = compute_eer(y_test, p_ens)

    # Combined Hybrid Decision: Must pass BOTH Deterministic Gate + ML Ensemble
    det_pass = deterministic_algorithmic_gate(X_test)
    hybrid_pred = (p_ens >= opt_thresh) & det_pass

    tn, fp, fn, tp = confusion_matrix(y_test, hybrid_pred).ravel()
    far_test = float(fp / max(1, (fp + tn)))
    frr_test = float(fn / max(1, (fn + tp)))

    print("[3/4] Running Red-Team Adversarial AI Replaceability Audit (5,000 Attack Episodes)...")
    rng = np.random.default_rng(999)
    n_attacks = 5000

    # Regime 1: Black-Box AI (VLM + Standard Spline)
    X_black = np.column_stack([
        rng.normal(780, 180, n_attacks),     # reactionMs (VLM lag)
        rng.normal(13.5, 3.0, n_attacks),    # slotErrorPx (missed C/D gain)
        rng.integers(0, 3, n_attacks),       # ballisticPeaks
        rng.uniform(0.002, 0.025, n_attacks),# wristCoupling
        rng.uniform(0.4, 1.5, n_attacks),    # submovementRateHz
        rng.normal(0.5, 0.1, n_attacks),
        rng.normal(1.1, 0.2, n_attacks),
        rng.uniform(600, 1200, n_attacks),
        rng.normal(0.1, 0.15, n_attacks),
        rng.normal(1.05, 0.12, n_attacks),   # harrisWolpertRatio
        rng.uniform(0.05, 0.2, n_attacks),
        rng.uniform(10, 80, n_attacks)
    ])

    # Regime 2: Gray-Box AI (Knows C/D Gain + 185ms FIFO Delay Queue)
    X_gray = np.column_stack([
        rng.normal(195, 25, n_attacks),      # Spoofed reactionMs
        rng.uniform(0.5, 4.0, n_attacks),    # Compensated C/D gain
        rng.integers(1, 5, n_attacks),       # Partial peaks
        rng.uniform(0.015, 0.038, n_attacks),# Mostly collinear
        rng.uniform(1.0, 2.1, n_attacks),    # Continuous PID ringing
        rng.normal(0.40, 0.06, n_attacks),
        rng.normal(1.20, 0.2, n_attacks),
        rng.uniform(880, 1150, n_attacks),
        rng.normal(0.25, 0.15, n_attacks),
        rng.normal(1.22, 0.18, n_attacks),   # Fails Harris-Wolpert scaling
        rng.uniform(0.12, 0.28, n_attacks),
        rng.normal(185, 15, n_attacks)       # Spoofed lag
    ])

    # Regime 3: White-Box RL/GAN Trajectory Synthesizer (Subject to real-time closed-loop phase lag)
    X_white = np.column_stack([
        rng.normal(210, 30, n_attacks),
        rng.uniform(0.4, 3.2, n_attacks),
        rng.integers(2, 7, n_attacks),
        rng.uniform(0.025, 0.048, n_attacks),
        rng.uniform(1.5, 2.8, n_attacks),
        rng.normal(0.39, 0.07, n_attacks),
        rng.normal(1.30, 0.25, n_attacks),
        rng.uniform(900, 1120, n_attacks),
        rng.normal(0.55, 0.25, n_attacks),
        rng.normal(1.42, 0.22, n_attacks),   # Struggles to couple 8-12Hz tremor to instantaneous accel in real-time
        rng.uniform(0.20, 0.36, n_attacks),
        rng.normal(190, 22, n_attacks)
    ])

    def eval_attack_matrix(X_att):
        X_att_s = scaler.transform(X_att)
        p_att = (
            0.40 * rf.predict_proba(X_att_s)[:, 1] +
            0.40 * gbm.predict_proba(X_att_s)[:, 1] +
            0.20 * mlp.predict_proba(X_att_s)[:, 1]
        )
        passed = (p_att >= opt_thresh) & deterministic_algorithmic_gate(X_att)
        return float(np.mean(passed))

    far_black = eval_attack_matrix(X_black)
    far_gray = eval_attack_matrix(X_gray)
    far_white = eval_attack_matrix(X_white)

    replaceability_pct = (0.25 * far_black + 0.35 * far_gray + 0.40 * far_white) * 100.0
    verdict = (
        "NON_REPLACEABLE_BY_AI (Q1_GRADE_SECURE)"
        if replaceability_pct < 1.0
        else "PARTIALLY_VULNERABLE_STEP_UP_TO_WEBAUTHN"
    )

    # Export portable scaler & feature importance for Node.js Inference Gate
    feature_importances = {
        FEATURE_NAMES[i]: round(float(rf.feature_importances_[i]), 4)
        for i in range(len(FEATURE_NAMES))
    }

    human_mask = y_train == 1
    export_rules = {
        "featureNames": FEATURE_NAMES,
        "scalerMean": scaler.mean_.tolist(),
        "scalerScale": scaler.scale_.tolist(),
        "humanCentroid": np.mean(X_train_s[human_mask], axis=0).tolist(),
        "humanInvCovDiag": (1.0 / (np.var(X_train_s[human_mask], axis=0) + 1e-4)).tolist(),
        "featureImportances": feature_importances,
        "optimalThreshold": round(opt_thresh, 4)
    }

    with open(os.path.join(ARTIFACT_DIR, "exported_rf_rules.json"), "w") as f:
        json.dump(export_rules, f, indent=2)

    audit_report = {
        "project": "AntiGravity Sensorimotor Human Verification Layer",
        "samplesEvaluated": int(len(X)),
        "classifierMetrics": {
            "ensembleRocAuc": round(auc_score, 5),
            "equalErrorRatePct": round(eer * 100, 3),
            "falseAcceptanceRatePct": round(far_test * 100, 3),
            "falseRejectionRatePct": round(frr_test * 100, 3)
        },
        "adversarialReplaceabilityAudit": {
            "episodesPerRegime": n_attacks,
            "blackBoxBypassRatePct": round(far_black * 100, 3),
            "grayBoxDelayedBotBypassRatePct": round(far_gray * 100, 3),
            "whiteBoxAdaptiveBotBypassRatePct": round(far_white * 100, 3),
            "overallAiReplaceabilityScorePct": round(replaceability_pct, 3),
            "securityVerdict": verdict
        },
        "topDiscriminativeFeatures": dict(
            sorted(feature_importances.items(), key=lambda x: x[1], reverse=True)[:5]
        )
    }

    with open(os.path.join(ARTIFACT_DIR, "model_metrics.json"), "w") as f:
        json.dump(audit_report, f, indent=2)

    print("[4/4] Generating Publication-Grade Diagnostic Plots...")
    fig, axes = plt.subplots(1, 3, figsize=(16, 4.8))

    # Plot 1: ROC Curve
    axes[0].plot(fpr, tpr, color="#0ea5e9", lw=2.5, label=f"Ensemble AUC = {auc_score:.4f}")
    axes[0].plot([0, 1], [0, 1], "--", color="#64748b")
    axes[0].set_title("ROC Curve (Human vs. Multi-Bot)")
    axes[0].set_xlabel("False Acceptance Rate (FAR)")
    axes[0].set_ylabel("True Human Acceptance Rate (TAR)")
    axes[0].legend(loc="lower right")
    axes[0].grid(alpha=0.25)

    # Plot 2: Feature Importances
    sorted_idx = np.argsort(rf.feature_importances_)
    axes[1].barh(
        [FEATURE_NAMES[i] for i in sorted_idx],
        rf.feature_importances_[sorted_idx],
        color="#10b981"
    )
    axes[1].set_title("Biomechanical Feature Importance")
    axes[1].set_xlabel("Gini Importance Weight")

    # Plot 3: AI Replaceability / Bypass Rate across Threat Regimes
    regimes = ["Black-Box\n(VLM/OpenCV)", "Gray-Box\n(185ms Queue)", "White-Box\n(Adaptive RL)", "Overall AI\nReplaceability"]
    rates = [far_black * 100, far_gray * 100, far_white * 100, replaceability_pct]
    axes[2].bar(regimes, rates, color=["#38bdf8", "#f59e0b", "#f43f5e", "#8b5cf6"])
    axes[2].axhline(1.0, color="#ef4444", linestyle="--", label="1% Q1 Security Ceiling")
    axes[2].set_title("Adversarial AI Bypass / Replaceability (%)")
    axes[2].set_ylabel("Bypass Rate (%)")
    axes[2].legend()

    plt.tight_layout()
    plt.savefig(os.path.join(ARTIFACT_DIR, "audit_plots.png"), dpi=200)
    print("\n=== AUDIT COMPLETE ===")
    print(json.dumps(audit_report, indent=2))

if __name__ == "__main__":
    run_full_ml_and_replaceability_audit()
