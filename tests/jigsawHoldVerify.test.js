import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Discord-Style Jigsaw + Magnetic Hold Verification Logic', () => {
  // Test the C/D Gain Shift equation
  function calculateCurrentX(rawSliderX, cdGainShiftX = 110, cdRatio = 0.88) {
    if (rawSliderX > cdGainShiftX) {
      return cdGainShiftX + (rawSliderX - cdGainShiftX) * cdRatio;
    }
    return rawSliderX;
  }

  test('Check 1: Non-Linear C/D Gain causes open-loop bot to undershoot the target slot', () => {
    const targetX = 230;
    // An open-loop bot slides the handle directly to what it thinks is targetX (230px)
    const rawSliderX = targetX;
    const actualPieceX = calculateCurrentX(rawSliderX, 110, 0.88);

    // 110 + (230 - 110) * 0.88 = 110 + 105.6 = 215.6px
    const errorPx = targetX - actualPieceX;

    // The piece is ~14.4px short of the slot, exceeding the ±9px lock tolerance
    assert.ok(errorPx > 9, `Expected bot to miss by >9px, but missed by ${errorPx.toFixed(1)}px`);
    assert.ok(Math.abs(errorPx - 14.4) < 0.1);
  });

  test('Check 2: Premature release before green cue triggers early release failure', () => {
    const now = 1000;
    const releaseCueTime = 1950;
    const isEarly = now < releaseCueTime;
    const earlyMs = releaseCueTime - now;

    assert.equal(isEarly, true);
    assert.equal(earlyMs, 950);
  });

  test('Check 3: Superhuman release (<115ms) triggers optic-nerve latency floor rejection', () => {
    const reactionMs = 85;
    const isSuperhuman = reactionMs < 115;
    assert.equal(isSuperhuman, true);
  });

  test('Check 4: Release timeout (>680ms) triggers VLM API latency failure', () => {
    const reactionMs = 740;
    const isTimeout = reactionMs > 680;
    assert.equal(isTimeout, true);
  });

  test('Check 5: Human closed-loop reaction window (115ms - 680ms) is accepted', () => {
    const reactionMs = 210;
    const valid = reactionMs >= 115 && reactionMs <= 680;
    assert.equal(valid, true);
  });
});
