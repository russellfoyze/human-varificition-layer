# Train a Biomechanical Classifier on collected telemetry
import os
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, roc_auc_score

# 1. Load dataset exported from AntiGravity
csv_path = 'antigravity_ml_dataset.csv' if os.path.exists('antigravity_ml_dataset.csv') else 'data/ml_dataset_exported.csv'
df = pd.read_csv(csv_path)

# Map columns if using exported schema
if 'reactionMs' in df.columns:
    features = [
        'reactionMs',
        'slotErrorPx',
        'ballisticPeaks',
        'wristCoupling',
        'submovementRateHz',
        'meanVelocity',
        'maxVelocity',
        'velocitySkewness'
    ]
    y = 1 - df['is_human']
else:
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
    y = df['is_bot']

X = df[features].fillna(0)

# 2. Train/Test Split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=42)

# 3. Train Random Forest Classifier
clf = RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42)
clf.fit(X_train, y_train)

# 4. Evaluate Performance
preds = clf.predict(X_test)
probs = clf.predict_proba(X_test)[:, 1]

print("=== AntiGravity Biomechanical Telemetry Classifier ===")
print(f"Dataset samples evaluated: {len(df)} ({len(X_train)} train, {len(X_test)} test)")
print("\nClassification Report:")
print(classification_report(y_test, preds, target_names=['Human', 'Bot'], digits=4))
print(f"ROC-AUC Score: {roc_auc_score(y_test, probs):.5f}")

# 5. Top Feature Importances
print("\nFeature Importances (Gini):")
importances = sorted(zip(features, clf.feature_importances_), key=lambda x: x[1], reverse=True)
for feat, imp in importances:
    print(f"  {feat:22s}: {imp * 100:6.2f}%")
