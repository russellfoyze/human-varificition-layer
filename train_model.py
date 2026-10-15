# Train a Biomechanical Classifier on collected telemetry from the Dataset Hub
import os
import sys
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, roc_auc_score

# Ensure ml_audit is in path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'ml_audit'))
from feature_extractor import extract_features_from_sample, FEATURE_NAMES

DATA_PATH = os.path.join(os.path.dirname(__file__), 'data', 'ml_dataset.json')
RULES_PATH = os.path.join(os.path.dirname(__file__), 'ml_audit', 'artifacts', 'exported_rf_rules.json')
CSV_EXPORT_PATH = os.path.join(os.path.dirname(__file__), 'antigravity_ml_dataset.csv')

def load_hub_dataset():
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(f"Dataset Hub storage not found at {DATA_PATH}")

    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        raw = json.load(f)

    X_list = []
    y_list = []
    export_rows = []

    for d in raw:
        feat = extract_features_from_sample(d)
        is_bot = 1 if (d.get('is_bot') == 1 or d.get('isBot') is True or d.get('label') == 'bot') else 0
        X_list.append(feat)
        y_list.append(is_bot)

        # Build row for CSV export
        row = {FEATURE_NAMES[i]: feat[i] for i in range(len(FEATURE_NAMES))}
        row['is_bot'] = is_bot
        row['is_human'] = 1 - is_bot
        # Snake_case aliases for compatibility
        row['reaction_time_ms'] = feat[0]
        row['slot_fit_error_px'] = feat[1]
        row['ballistic_peaks'] = feat[2]
        row['wrist_coupling'] = feat[3]
        row['submovement_rate_hz'] = feat[4]
        row['mean_velocity'] = feat[5]
        row['max_velocity'] = feat[6]
        row['hold_duration_ms'] = feat[7]
        row['velocity_variance'] = feat[8]
        export_rows.append(row)

    X = np.array(X_list, dtype=float)
    y = np.array(y_list, dtype=int)
    df = pd.DataFrame(export_rows)
    return X, y, df

def train():
    X, y, df = load_hub_dataset()
    human_count = int((y == 0).sum())
    bot_count = int((y == 1).sum())

    print("=================================================================")
    print("  AntiGravity Biomechanical Classifier - Dataset Hub Training")
    print("=================================================================")
    print(f"Loaded from Dataset Hub: {len(X)} total samples")
    print(f"  - Genuine Human Telemetry Samples: {human_count}")
    print(f"  - Automated Bot Telemetry Samples: {bot_count}")

    # Synchronize CSV
    df.to_csv(CSV_EXPORT_PATH, index=False)
    print(f"Synchronized export to: {CSV_EXPORT_PATH}")

    # Standardize & Train
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    test_size = 0.25 if len(X) >= 20 else 0.2
    stratify = y if min(human_count, bot_count) >= 2 else None

    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=test_size, random_state=42, stratify=stratify
    )

    clf = RandomForestClassifier(n_estimators=150, max_depth=6, random_state=42)
    clf.fit(X_train, y_train)

    preds = clf.predict(X_test)
    probs = clf.predict_proba(X_test)[:, 1] if hasattr(clf, 'predict_proba') else None

    print("\nClassification Report on Dataset Hub Validation Set:")
    print(classification_report(y_test, preds, target_names=['Human', 'Bot'], digits=4))

    if probs is not None and len(np.unique(y_test)) > 1:
        auc = roc_auc_score(y_test, probs)
        print(f"Validation ROC-AUC Score: {auc:.5f}")

    # Feature Importances
    print("\nLearned Biomechanical Invariant Importances:")
    importances = sorted(zip(FEATURE_NAMES, clf.feature_importances_), key=lambda x: x[1], reverse=True)
    for feat, imp in importances:
        bar = "#" * int(imp * 35)
        print(f"  {feat:22s}: {imp * 100:6.2f}%  [{bar}]")

    # Export updated weights to Node.js ML Inference Gate
    if os.path.exists(os.path.dirname(RULES_PATH)):
        human_mask = (y_train == 0)
        feature_importance_dict = {
            f: round(float(imp), 4) for f, imp in zip(FEATURE_NAMES, clf.feature_importances_)
        }

        centroid_human = np.mean(X_train[human_mask], axis=0).tolist()
        inv_cov_human = (1.0 / (np.var(X_train[human_mask], axis=0) + 1e-4)).tolist()

        export_rules = {
            "featureNames": FEATURE_NAMES,
            "scalerMean": scaler.mean_.tolist(),
            "scalerScale": scaler.scale_.tolist(),
            "humanCentroid": centroid_human,
            "humanInvCovDiag": inv_cov_human,
            "featureImportances": feature_importance_dict,
            "optimalThreshold": 0.5
        }

        with open(RULES_PATH, 'w', encoding='utf-8') as f:
            json.dump(export_rules, f, indent=2)
        print(f"\n[OK] Successfully deployed updated model weights to: {RULES_PATH}")

    return {
        "samples": len(X),
        "human_samples": human_count,
        "bot_samples": bot_count,
        "importances": dict(importances)
    }

if __name__ == '__main__':
    train()
