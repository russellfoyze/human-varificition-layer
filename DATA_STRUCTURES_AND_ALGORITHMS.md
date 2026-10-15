# Data Structures and Algorithms Specification: AntiGravity Human Verification Layer

This document provides a comprehensive technical, mathematical, and algorithmic specification of the **AntiGravity Sensorimotor Human Verification Layer & Telemetry Engine**.

---

## 📑 Table of Contents
1. [Core Data Structures](#1-core-data-structures)
   - [1.1 PointerSample & TrajectoryVector](#11-pointersample--trajectoryvector)
   - [1.2 MagneticPerturbation](#12-magneticperturbation)
   - [1.3 BiomechanicalTelemetryVector](#13-biomechanicaltelemetryvector)
   - [1.4 MLDatasetSample Schema](#14-mldatasetsample-schema)
   - [1.5 DatasetStatistics Record](#15-datasetstatistics-record)
   - [1.6 GamificationState & PlayerRank](#16-gamificationstate--playerrank)
   - [1.7 HMAC-SHA256 Token Structure](#17-hmac-sha256-token-structure)
   - [1.8 WebSocket Protocol Message Frame](#18-websocket-protocol-message-frame)
2. [Core Algorithms](#2-core-algorithms)
   - [2.1 Algorithm 1: Non-Linear Control-Display (C/D) Gain Shift](#21-algorithm-1-non-linear-control-display-cd-gain-shift)
   - [2.2 Algorithm 2: Craik's Law Ballistic Submovement Peak Detection](#22-algorithm-2-craiks-law-ballistic-submovement-peak-detection)
   - [2.3 Algorithm 3: Off-Axis 2D Wrist-Finger Arc Coupling Estimation](#23-algorithm-3-off-axis-2d-wrist-finger-arc-coupling-estimation)
   - [2.4 Algorithm 4: Visuomotor Optic-Nerve & VLM Latency Window Filter](#24-algorithm-4-visuomotor-optic-nerve--vlm-latency-window-filter)
   - [2.5 Algorithm 5: Closed-Loop Magnetic Force Perturbation Generator](#25-algorithm-5-closed-loop-magnetic-force-perturbation-generator)
   - [2.6 Algorithm 6: Zero-Trust Cryptographic Token Issuance & Timing-Safe Verification](#26-algorithm-6-zero-trust-cryptographic-token-issuance--timing-safe-verification)
   - [2.7 Algorithm 7: Gamification XP & Streak Multiplier Scoring Function](#27-algorithm-7-gamification-xp--streak-multiplier-scoring-function)
   - [2.8 Algorithm 8: Monotonic Interval Search for Player Rank Progression](#28-algorithm-8-monotonic-interval-search-for-player-rank-progression)
3. [Algorithmic Complexity Summary](#3-algorithmic-complexity-summary)

---

## 1. Core Data Structures

### 1.1 PointerSample & TrajectoryVector

The fundamental kinematic data stream collected during interaction.

```typescript
interface PointerSample {
  x: number; // Client viewport coordinate X in pixels
  y: number; // Client viewport coordinate Y in pixels
  t: number; // DOMHighResTimeStamp in milliseconds (performance.now())
}

type TrajectoryVector = PointerSample[];
```

* **Memory Layout**: Continuous flat array of records.
* **Sampling Rate**: Event-driven (`pointermove`), throttled by display refresh rate ($\approx 60\text{–}144\text{ Hz}$, $t_{i} - t_{i-1} \in [6.9\text{ ms}, 16.6\text{ ms}]$).
* **Length Bounds**: A compliant human drag produces $N \in [45, 600]$ points.

---

### 1.2 MagneticPerturbation

Captures the instantaneous wind perturbation injected into the jigsaw piece during the hold phase.

```typescript
interface MagneticPerturbation {
  vx: number; // Horizontal drift velocity component in px/frame
  t: number;  // Timestamp in ms when the force was applied
}
```

---

### 1.3 BiomechanicalTelemetryVector

The computed sensorimotor feature representation extracted from a single interaction session.

```typescript
interface BiomechanicalTelemetryVector {
  alignErrorPx: string;       // Formatted slot error (e.g., "0.6 px")
  releaseLagMs: string;       // Formatted reaction time (e.g., "214 ms")
  reactionMs: number;         // Numeric release latency Δt in ms
  slotErrorPx: number;        // Absolute difference |x_piece - x_target| in px
  ballisticPeaks: number;     // Count of local Craik velocity peaks
  wristCoupling: number;      // 2D wrist arc variance metric
  submovementRateHz: number;  // Pulsation frequency in Hz (ballisticPeaks / duration)
  meanVelocity: number;       // Mean path velocity in px/ms
  maxVelocity: number;        // Peak path velocity in px/ms
  holdDurationMs: number;     // Elapsed hold time inside target slot in ms
  sampleCount: number;        // Total pointer frames captured
  pointerLog: PointerSample[];// Raw trajectory points
  perturbations: MagneticPerturbation[];
  isBot: boolean;             // Ground truth label
  verified: boolean;          // Verification verdict
}
```

---

### 1.4 MLDatasetSample Schema

The standardized record format stored in `data/ml_dataset.json` and exported to CSV for Machine Learning pipelines.

```json
{
  "id": "sample_1740000000000_a1b2",
  "timestamp": "2026-10-15T19:40:00.000Z",
  "label": "human",
  "isBot": false,
  "verified": true,
  "reactionMs": 218,
  "slotErrorPx": 0.4,
  "ballisticPeaks": 8,
  "wristCoupling": 0.082,
  "submovementRateHz": 3.81,
  "meanVelocity": 0.38,
  "maxVelocity": 1.42,
  "holdDurationMs": 1042,
  "sampleCount": 94,
  "rawTrajectory": []
}
```

---

### 1.5 DatasetStatistics Record

In-memory aggregate metrics computed over all recorded samples.

```typescript
interface DatasetStatistics {
  totalSamples: number;
  humanSamples: number;
  botSamples: number;
  passRate: number;            // Percentage of verified attempts: (passed / total) * 100
  avgReactionTimeMs: number;   // Mean reaction latency across verified human attempts
  avgWristCoupling: number;    // Mean joint coupling metric
  avgSubmovementRate: number;  // Mean Craik pulse rate in Hz
}
```

---

### 1.6 GamificationState & PlayerRank

```typescript
interface PlayerRank {
  level: number;
  title: string;
  minXP: number;
  icon: string;
  color: string;
  bg: string;
}

interface GamificationState {
  streak: number;             // Current consecutive verified solves
  bestStreak: number;         // Historical maximum streak
  totalCorrect: number;       // Lifetime successful solves
  totalAttempts: number;      // Lifetime total attempts
  score: number;              // Accumulated XP points
  currentRank: PlayerRank;    // Current active tier
  nextRank: PlayerRank | null;// Next tier target
  levelProgressPct: number;   // Progress in current level [0, 100]%
  unlockedAchievements: string[]; // List of unlocked trophy IDs
}
```

---

### 1.7 HMAC-SHA256 Token Structure

A zero-trust, stateless cryptographic bearer token issued upon verified human execution.

```text
Format: ag_bp_<Base64URL_Payload>.<Hex_HMAC_Signature>
```

#### Payload Structure:
```json
{
  "sub": "session_uuid",
  "iat": 1740000000,
  "exp": 1740000300,
  "score": 0.985,
  "nonce": "c4ca4238a0b92382"
}
```

* **Header/Prefix**: `ag_bp_` (AntiGravity Bio-Pulse).
* **Payload**: URL-safe base64-encoded JSON metadata.
* **Signature**: 64-character hexadecimal string generated by $\text{HMAC-SHA256}(K_{\text{secret}}, \text{payload})$.

---

### 1.8 WebSocket Protocol Message Frame

Bi-directional communication frame exchange between client and authoritative server (`ws://localhost:4000`).

```typescript
interface WSFrame {
  type: 'PING' | 'PONG' | 'INIT' | 'REFLEX_CHALLENGE' | 'VERIFY_SUBMISSION' | 'VERIFY_RESULT';
  clientTime?: number;
  serverTime?: number;
  cueTimestamp?: number;
  reactionMs?: number;
  token?: string;
  success?: boolean;
  error?: string;
}
```

---

## 2. Core Algorithms

### 2.1 Algorithm 1: Non-Linear Control-Display (C/D) Gain Shift

#### Problem Definition:
Standard sliders map handle displacement $x_{\text{slider}}$ to canvas position $x_{\text{piece}}$ with a static linear ratio $1:1$. Automated open-loop bots (OpenCV template matchers, WindMouse bots) calculate the target slot position from an initial screenshot and slide the handle by exactly $\Delta x = x_{\text{target}} - x_{\text{initial}}$ in a single open loop.

#### Mathematical Formulation:
Let $x_{\text{pivot}}$ be the gain shift threshold ($110\text{ px}$) and $\gamma$ be the non-linear transfer coefficient ($0.88$).

$$x_{\text{canvas}}(x_{\text{slider}}) = \begin{cases} 
x_{\text{slider}}, & \text{if } x_{\text{slider}} \le x_{\text{pivot}} \\ 
x_{\text{pivot}} + (x_{\text{slider}} - x_{\text{pivot}}) \cdot \gamma, & \text{if } x_{\text{slider}} > x_{\text{pivot}} 
\end{cases}$$

#### Proof of Open-Loop Bot Defeat:
Assume target slot $x_{\text{target}} = 230\text{ px}$. An open-loop script calculates required travel:
$$x_{\text{bot}} = 230\text{ px}$$

Evaluating through the transfer function:
$$x_{\text{actual}} = 110 + (230 - 110) \cdot 0.88 = 110 + 120 \cdot 0.88 = 110 + 105.6 = 215.6\text{ px}$$

The resulting positional error:
$$\Delta x_{\text{error}} = |x_{\text{target}} - x_{\text{actual}}| = |230 - 215.6| = 14.4\text{ px}$$

Because the capture lock window tolerance is $\delta_{\text{tol}} = \pm 9\text{ px}$:
$$\Delta x_{\text{error}} > \delta_{\text{tol}} \implies 14.4\text{ px} > 9.0\text{ px} \implies \text{REJECT}$$

#### Pseudocode:
```python
def compute_canvas_x(raw_slider_x: float, pivot_x: float = 110.0, gamma: float = 0.88) -> float:
    if raw_slider_x <= pivot_x:
        return raw_slider_x
    return pivot_x + (raw_slider_x - pivot_x) * gamma
```
* **Time Complexity**: $O(1)$
* **Space Complexity**: $O(1)$

---

### 2.2 Algorithm 2: Craik's Law Ballistic Submovement Peak Detection

#### Theoretical Foundation (Craik's Invariant):
In motor neuroscience, Kenneth Craik (1947) demonstrated that the human motor system cannot generate continuous smooth acceleration over sustained voluntary manual tracking. Instead, voluntary motor adjustments are composed of discrete, intermittent ballistic submovements issued at a physiological rhythm of **$2.2\text{–}14.5\text{ Hz}$** (refractory period of the sensorimotor loop). Synthetic splines (e.g., standard Bézier curves, constant speed bots) generate continuous derivatives with either 0 or near-infinite uniform pulses.

#### Mathematical Formulation:
Given trajectory $P = \{(x_0, y_0, t_0), (x_1, y_1, t_1), \dots, (x_N, y_N, t_N)\}$:

1. **Velocity Extraction**:
   $$v_i = \frac{\sqrt{(x_i - x_{i-1})^2 + (y_i - y_{i-1})^2}}{\max(1.0, t_i - t_{i-1})}, \quad \forall i \in \{1, \dots, N\}$$

2. **Ballistic Peak Condition**:
   A sample index $i \in \{1, \dots, |V|-2\}$ is classified as a ballistic submovement peak if and only if:
   $$v_i > v_{i-1} \quad \land \quad v_i > v_{i+1} \quad \land \quad v_i > \epsilon_{\text{noise}}$$
   where $\epsilon_{\text{noise}} = 0.05\text{ px/ms}$.

3. **Submovement Pulse Rate Calculation**:
   $$f_{\text{sub}} = \frac{N_{\text{peaks}}}{\max(0.5, \Delta t_{\text{duration}} / 1000)}$$

4. **Acceptance Criterion**:
   $$\text{Verdict}_{\text{Craik}} = \begin{cases} 
   \text{VALID}, & \text{if } f_{\text{sub}} \in [1.8, 14.5]\text{ Hz} \land N_{\text{peaks}} \ge 3 \\ 
   \text{INVALID}, & \text{otherwise} 
   \end{cases}$$

#### Pseudocode:
```python
def extract_ballistic_submovements(trajectory: list[dict], min_noise: float = 0.05) -> tuple[int, float]:
    if len(trajectory) < 3:
        return 0, 0.0
    
    speeds = []
    for i in range(1, len(trajectory)):
        dt = max(1.0, trajectory[i]['t'] - trajectory[i-1]['t'])
        dx = trajectory[i]['x'] - trajectory[i-1]['x']
        dy = trajectory[i]['y'] - trajectory[i-1]['y']
        speeds.append((dx*dx + dy*dy)**0.5 / dt)
    
    peaks = 0
    for i in range(1, len(speeds) - 1):
        if speeds[i] > speeds[i-1] and speeds[i] > speeds[i+1] and speeds[i] > min_noise:
            peaks += 1
            
    total_time_sec = (trajectory[-1]['t'] - trajectory[0]['t']) / 1000.0
    rate_hz = peaks / max(0.5, total_time_sec)
    return peaks, rate_hz
```
* **Time Complexity**: $O(N)$
* **Space Complexity**: $O(N)$

---

### 2.3 Algorithm 3: Off-Axis 2D Wrist-Finger Arc Coupling Estimation

#### Theoretical Foundation:
When humans move a pointing device horizontally across a physical desk or screen, the biomechanics of the forearm, wrist, and distal phalanges enforce a natural perpendicular oscillatory deviation ($y$-axis motion coupled to horizontal progression). Scripted bots and synthetic macros produce strictly 1D movements ($\Delta y = 0$) or mathematically uncoupled noise.

#### Mathematical Formulation:
$$\mu_{\Delta y} = \frac{1}{N-1} \sum_{i=1}^{N-1} \frac{|y_{i+1} - y_i|}{\max(1.0, t_{i+1} - t_i)}$$

$$\text{Coupling Index } C_w = \frac{\mu_{\Delta y}}{N} + c_{\text{offset}}$$

$$\text{Verdict}_{\text{Wrist}} = \begin{cases} 
\text{PASS}, & \text{if } C_w \ge 0.035 \\ 
\text{FAIL (Synthetic)}, & \text{otherwise} 
\end{cases}$$

---

### 2.4 Algorithm 4: Visuomotor Optic-Nerve & VLM Latency Window Filter

#### Theoretical Foundation:
Human motor response to a visual trigger (the slot turning green) is strictly bounded by human neuroanatomy:
1. **Optic-Nerve Floor ($115\text{ ms}$)**:
   * Retinal phototransduction: $30\text{–}40\text{ ms}$
   * Lateral geniculate nucleus to primary visual cortex (V1): $25\text{–}35\text{ ms}$
   * Corticospinal motor output to finger flexors: $25\text{–}35\text{ ms}$
   * Neuromuscular junction excitation-contraction coupling: $20\text{–}30\text{ ms}$
   * **Absolute human minimum reaction limit**: $\approx 115\text{–}120\text{ ms}$. Releases occurring in $<115\text{ ms}$ are programmatic hooks inspecting canvas/DOM state.
2. **Vision-LLM API Ceiling ($680\text{ ms}$)**:
   * Screen capture & image encoding: $40\text{–}80\text{ ms}$
   * Network egress to model API: $80\text{–}200\text{ ms}$
   * Multimodal transformer inference: $400\text{–}1200\text{ ms}$
   * Ingress response & action dispatch: $100\text{–}300\text{ ms}$
   * Total latency: $> 750\text{ ms}$.

#### Decision Rule:
$$\text{VerifyLatency}(\Delta t) = \begin{cases}
\text{REJECT (Superhuman Bot)}, & \text{if } \Delta t < 115\text{ ms} \\
\text{ACCEPT (Human Reflex)}, & \text{if } 115\text{ ms} \le \Delta t \le 680\text{ ms} \\
\text{REJECT (VLM API Timeout)}, & \text{if } \Delta t > 680\text{ ms}
\end{cases}$$

---

### 2.5 Algorithm 5: Closed-Loop Magnetic Force Perturbation Generator

#### Mathematical Formulation:
While the user holds the piece inside the target cutout slot, a continuous multi-harmonic sinusoidal force vector is injected into the piece's horizontal position:

$$v_{\text{wind}}(t) = A_1 \sin(\omega_1 t) + A_2 \cos(\omega_2 t)$$

Where:
* $A_1 = 0.35\text{ px/frame}$, $\omega_1 = 0.014\text{ rad/ms}$
* $A_2 = 0.25\text{ px/frame}$, $\omega_2 = 0.023\text{ rad/ms}$

$$\Delta x_{\text{drift}}(t) = \int_{t_{\text{enter}}}^t v_{\text{wind}}(\tau) d\tau$$

$$x_{\text{piece}}(t) = x_{\text{user}}(t) + \Delta x_{\text{drift}}(t)$$

If $|x_{\text{piece}}(t) - x_{\text{target}}| > 15\text{ px}$, the magnetic lock is broken, and state transitions back to `DRAGGING`.

---

### 2.6 Algorithm 6: Zero-Trust Cryptographic Token Issuance & Timing-Safe Verification

#### Token Generation:
$$\text{Payload} = \text{base64url}(\text{JSON}(\{ \text{sid}, \text{iat}, \text{exp}, \text{metrics} \}))$$
$$\text{HMAC} = \text{HMAC-SHA256}(K_{\text{secret}}, \text{Payload})$$
$$\text{Token} = \texttt{"ag\_bp\_"} + \text{Payload} + \texttt{"."} + \text{HMAC}$$

#### Timing-Safe Verification:
To prevent timing side-channel attacks on signature evaluation:

$$\text{VerifyToken}(T) = \begin{cases}
\text{True}, & \text{if } \text{crypto.timingSafeEqual}(\text{HMAC}(T_{\text{payload}}), T_{\text{sig}}) \land \text{now}() \le T_{\text{exp}} \\
\text{False}, & \text{otherwise}
\end{cases}$$

---

### 2.7 Algorithm 7: Gamification XP & Streak Multiplier Scoring Function

#### Formulation:
Given reaction time $R\text{ (ms)}$, slot alignment error $E\text{ (px)}$, and streak count $S \ge 1$:

1. **Base Victory Score**:
   $$B_0 = 100\text{ XP}$$

2. **Reflex Speed Tier Bonus $B_{\text{reflex}}$**:
   $$B_{\text{reflex}}(R) = \begin{cases} 
   180, & \text{if } R \le 210\text{ ms} \quad (\text{Tier S+}) \\ 
   130, & \text{if } 210 < R \le 280\text{ ms} \quad (\text{Tier S}) \\ 
   90,  & \text{if } 280 < R \le 380\text{ ms} \quad (\text{Tier A}) \\ 
   50,  & \text{otherwise} \quad (\text{Tier B}) 
   \end{cases}$$

3. **Fit Precision Tier Bonus $B_{\text{fit}}$**:
   $$B_{\text{fit}}(E) = \begin{cases} 
   120, & \text{if } E \le 0.8\text{ px} \quad (\text{Tier Perfect 🎯}) \\ 
   80,  & \text{if } 0.8 < E \le 2.0\text{ px} \quad (\text{Tier Pinpoint}) \\ 
   40,  & \text{otherwise} \quad (\text{Tier Aligned}) 
   \end{cases}$$

4. **Streak Multiplier $M_{\text{streak}}$**:
   $$M_{\text{streak}}(S) = \min\left(2.50, 1.0 + (S - 1) \cdot 0.25\right)$$

5. **Total Round XP Earned**:
   $$\text{XP}_{\text{earned}} = \left\lfloor (B_0 + B_{\text{reflex}}(R) + B_{\text{fit}}(E)) \cdot M_{\text{streak}}(S) \right\rfloor$$

---

### 2.8 Algorithm 8: Monotonic Interval Search for Player Rank Progression

#### Problem Definition:
Given cumulative experience points $\text{XP} \in \mathbb{N}$ and an ordered list of $K$ rank thresholds:
$$\mathcal{R} = \{(L_1, \theta_1), (L_2, \theta_2), \dots, (L_K, \theta_K)\}, \quad \theta_1 < \theta_2 < \dots < \theta_K$$

#### Rank Identification:
$$\text{Rank}(\text{XP}) = \arg\max_{r \in \mathcal{R}} \{ \theta_r \mid \theta_r \le \text{XP} \}$$

$$\text{NextRank}(\text{XP}) = \arg\min_{r \in \mathcal{R}} \{ \theta_r \mid \theta_r > \text{XP} \}$$

#### Level Progress Percentage:
$$P(\text{XP}) = \begin{cases}
\min\left(100, \left\lfloor \frac{\text{XP} - \theta_{\text{current}}}{\theta_{\text{next}} - \theta_{\text{current}}} \cdot 100 \right\rfloor\right), & \text{if } \text{NextRank} \neq \emptyset \\
100\%, & \text{if at max level}
\end{cases}$$

---

## 3. Algorithmic Complexity Summary

| Algorithm | Function | Time Complexity | Space Complexity | Execution Context |
| :--- | :--- | :---: | :---: | :--- |
| **Algorithm 1** | Non-Linear C/D Gain Shift | $O(1)$ | $O(1)$ | Client (60 FPS on drag) |
| **Algorithm 2** | Craik's Law Ballistics Detection | $O(N)$ | $O(N)$ | Server & Client on verify |
| **Algorithm 3** | Off-Axis Wrist Arc Coupling | $O(N)$ | $O(1)$ | Server & Client on verify |
| **Algorithm 4** | Optic-Nerve & VLM Filter | $O(1)$ | $O(1)$ | Server & Client on release |
| **Algorithm 5** | Closed-Loop Magnetic Drift | $O(1)$ | $O(1)$ | Client (Animation Frame) |
| **Algorithm 6** | HMAC-SHA256 Token Engine | $O(M)$ | $O(M)$ | Server on issue/verify |
| **Algorithm 7** | Scoring & Multiplier Engine | $O(1)$ | $O(1)$ | Client post-verification |
| **Algorithm 8** | Rank & XP Interval Search | $O(K)$ | $O(1)$ | Client on state update |

*(Where $N$ is trajectory frame count $\approx 50\text{–}300$, $M$ is token payload byte length $\approx 128\text{ B}$, and $K$ is number of ranks = $8$)*
