import os
import sys
import json
import uuid
import numpy as np
import pandas as pd
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(__file__))
from feature_extractor import extract_features_from_sample, FEATURE_NAMES

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "ml_dataset.json")
CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "ml_dataset_exported.csv")

def generate_synthetic_sample(archetype: str, rng: np.random.Generator) -> dict:
    now_iso = datetime.now(timezone.utc).isoformat()
    sample_id = f"sample_{int(datetime.now().timestamp()*1000)}_{uuid.uuid4().hex[:4]}"

    if archetype == "human":
        reaction_ms = float(rng.normal(225, 42))
        reaction_ms = float(np.clip(reaction_ms, 125, 580))
        slot_error = float(np.abs(rng.normal(1.4, 1.1)))
        hold_dur = float(rng.uniform(860, 1240))
        peaks = int(rng.integers(5, 13))
        sub_rate = float(peaks / (hold_dur / 1000.0 + 0.8))
        wrist = float(rng.uniform(0.042, 0.115))
        mean_v = float(rng.normal(0.39, 0.08))
        max_v = float(mean_v * rng.uniform(2.6, 4.2))
        vel_skew = float(rng.normal(1.25, 0.28))
        hw_ratio = float(rng.normal(2.95, 0.65))
        jerk_zc = float(rng.uniform(0.38, 0.64))
        wind_lag = float(rng.normal(188, 24))
        is_bot = False
        verified = True

    elif archetype == "opencv_linear_bot":
        reaction_ms = float(rng.uniform(12, 65))
        slot_error = float(rng.normal(14.4, 1.8)) # Defeated by Algorithm 1 (C/D Gain = 0.88)
        hold_dur = float(rng.uniform(50, 300))
        peaks = int(rng.integers(0, 2))
        sub_rate = float(peaks / 1.0)
        wrist = float(rng.uniform(0.001, 0.012))
        mean_v = float(rng.normal(0.85, 0.1))
        max_v = float(mean_v * 1.15)
        vel_skew = float(rng.normal(0.05, 0.1))
        hw_ratio = float(rng.normal(1.0, 0.08))
        jerk_zc = float(rng.uniform(0.02, 0.12))
        wind_lag = float(rng.uniform(8, 24))
        is_bot = True
        verified = False

    elif archetype == "windmouse_spline_bot":
        reaction_ms = float(rng.normal(195, 30))
        slot_error = float(rng.uniform(2.5, 9.5))
        hold_dur = float(rng.uniform(850, 1150))
        peaks = int(rng.integers(1, 4))
        sub_rate = float(rng.uniform(0.6, 1.65)) # Fails Craik's Law
        wrist = float(rng.uniform(0.015, 0.033)) # Fails Wrist Coupling
        mean_v = float(rng.normal(0.45, 0.06))
        max_v = float(mean_v * 1.8)
        vel_skew = float(rng.normal(0.22, 0.15))
        hw_ratio = float(rng.normal(1.12, 0.15)) # Homoscedastic synthetic noise
        jerk_zc = float(rng.uniform(0.15, 0.28))
        wind_lag = float(rng.uniform(32, 95))
        is_bot = True
        verified = False

    elif archetype == "vlm_gpt4o_agent":
        reaction_ms = float(rng.normal(920, 160)) # Exceeds 680ms VLM ceiling (Algorithm 4)
        slot_error = float(rng.uniform(1.0, 5.0))
        hold_dur = float(rng.uniform(1400, 2100))
        peaks = int(rng.integers(1, 3))
        sub_rate = float(rng.uniform(0.5, 1.4))
        wrist = float(rng.uniform(0.005, 0.025))
        mean_v = float(rng.normal(0.25, 0.05))
        max_v = float(mean_v * 2.1)
        vel_skew = float(rng.normal(0.4, 0.2))
        hw_ratio = float(rng.normal(1.08, 0.12))
        jerk_zc = float(rng.uniform(0.08, 0.20))
        wind_lag = float(rng.uniform(310, 360))
        is_bot = True
        verified = False

    else: # "informed_delayed_pid_bot" (Knows the 185ms lag window!)
        reaction_ms = float(rng.normal(190, 18))
        slot_error = float(rng.uniform(0.8, 3.5))
        hold_dur = float(rng.uniform(900, 1150))
        peaks = int(rng.integers(1, 4))
        sub_rate = float(rng.uniform(1.1, 1.95)) # Continuous PID ringing instead of discrete ballistic pulses
        wrist = float(rng.uniform(0.010, 0.031))
        mean_v = float(rng.normal(0.41, 0.05))
        max_v = float(mean_v * 1.65)
        vel_skew = float(rng.normal(0.18, 0.14))
        hw_ratio = float(rng.normal(1.18, 0.16)) # Fails Harris-Wolpert Signal-Dependent Noise
        jerk_zc = float(rng.uniform(0.14, 0.26))
        wind_lag = float(rng.normal(185, 12))    # Intentionally spoofs Check 1!
        is_bot = True
        verified = False

    return {
        "id": sample_id,
        "timestamp": now_iso,
        "label": "bot" if is_bot else "human",
        "archetype": archetype,
        "isBot": is_bot,
        "verified": verified,
        "reactionMs": round(reaction_ms, 2),
        "slotErrorPx": round(slot_error, 2),
        "ballisticPeaks": peaks,
        "wristCoupling": round(wrist, 4),
        "submovementRateHz": round(sub_rate, 2),
        "meanVelocity": round(mean_v, 3),
        "maxVelocity": round(max_v, 3),
        "holdDurationMs": round(hold_dur, 1),
        "velocitySkewness": round(vel_skew, 3),
        "harrisWolpertRatio": round(hw_ratio, 3),
        "jerkZeroCrossings": round(jerk_zc, 3),
        "windCrossCorrLagMs": round(wind_lag, 1),
        "sampleCount": int(rng.integers(60, 140)),
        "rawTrajectory": []
    }

def load_or_bootstrap_dataset(min_samples: int = 2000):
    os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
    existing = []
    if os.path.exists(DATA_PATH):
        try:
            with open(DATA_PATH, "r", encoding="utf-8") as f:
                existing = json.load(f)
        except Exception:
            existing = []

    rng = np.random.default_rng(42)
    if len(existing) < min_samples:
        needed = min_samples - len(existing)
        bot_types = [
            "opencv_linear_bot",
            "windmouse_spline_bot",
            "vlm_gpt4o_agent",
            "informed_delayed_pid_bot"
        ]
        for i in range(needed):
            if i % 2 == 0:
                existing.append(generate_synthetic_sample("human", rng))
            else:
                b_type = bot_types[(i // 2) % len(bot_types)]
                existing.append(generate_synthetic_sample(b_type, rng))

        with open(DATA_PATH, "w", encoding="utf-8") as f:
            json.dump(existing, f, indent=2)

    X_list, y_list = [], []
    for s in existing:
        X_list.append(extract_features_from_sample(s))
        # y = 1 for Human, 0 for Bot
        y_list.append(0 if s.get("isBot", False) else 1)

    X = np.vstack(X_list)
    y = np.array(y_list, dtype=int)

    df = pd.DataFrame(X, columns=FEATURE_NAMES)
    df["is_human"] = y
    df.to_csv(CSV_PATH, index=False)
    return X, y, existing
