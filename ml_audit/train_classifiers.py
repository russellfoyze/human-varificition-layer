import os
import json
import numpy as np
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import classification_report
from dataset_engine import load_or_bootstrap_dataset
from feature_extractor import FEATURE_NAMES

def train_and_evaluate():
    print("[1/3] Loading dataset...")
    X, y, _ = load_or_bootstrap_dataset(min_samples=2000)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    models = {
        "RandomForestClassifier": RandomForestClassifier(n_estimators=150, max_depth=10, random_state=42),
        "GradientBoostingClassifier": GradientBoostingClassifier(n_estimators=100, learning_rate=0.1, random_state=42),
        "MLPClassifier": MLPClassifier(hidden_layer_sizes=(64, 32, 16), max_iter=350, random_state=42)
    }

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    results = {}

    print("[2/3] Performing 5-Fold Stratified Cross-Validation...")
    for name, model in models.items():
        scores = cross_val_score(model, X_scaled, y, cv=cv, scoring="roc_auc")
        results[name] = {
            "mean_roc_auc": round(float(np.mean(scores)), 5),
            "std_roc_auc": round(float(np.std(scores)), 5)
        }
        print(f"  {name}: Mean ROC-AUC = {np.mean(scores):.5f} (+/- {np.std(scores):.5f})")

    print("[3/3] Cross-validation complete.")
    return results

if __name__ == "__main__":
    train_and_evaluate()
