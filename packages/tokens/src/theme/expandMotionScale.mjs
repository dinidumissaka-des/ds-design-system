/**
 * @file expandMotionScale.mjs
 * @input Motion scale config { fast, medium, slow?, ratio, easing? }
 * @output Token overrides for duration (and optionally easing) primitives
 * @position Theme utility; consumed by defineTheme.mjs
 *
 * Computes duration min/max variants from base values and a scaling ratio:
 *   min = base × ratio
 *   max = base ÷ ratio
 *
 * Ported from Meta's Astryx (MIT), adapted to emit this repo's dotted token
 * paths (`motion.duration.fast`) instead of flat CSS variable names.
 *
 * A theme author gets a three-number interface that expands into a coherent
 * nine-token duration scale. A "snappy" theme lowers the base; a "cinematic"
 * one raises it — and the proportions between variants survive either way.
 *
 * SYNC: when this changes, update
 * - packages/tokens/src/theme/theme.test.mjs
 * - packages/tokens/THEME-ENGINE.md
 */

/** Round to the nearest 5ms so generated values stay legible. */
function roundMs(ms) {
  return Math.round(ms / 5) * 5;
}

/**
 * @typedef {object} MotionScaleConfig
 * @property {number} fast    Micro-interactions (hover, toggle) in ms.
 * @property {number} medium  Entrance/exit (dialog, drawer) in ms.
 * @property {number} [slow]  Continuous animation (spinner, progress) in ms.
 * @property {number} ratio   min = base × ratio, max = base ÷ ratio. Typically 0.65–0.85.
 * @property {string} [easing] Overrides motion.easing.standard.
 */

/**
 * Expand a motion config into duration/easing token overrides.
 * @param {MotionScaleConfig} config
 * @returns {Record<string, string>}
 */
export function expandMotionScale(config) {
  const { fast, medium, slow, ratio, easing } = config;

  const tokens = {
    "motion.duration.fast-min": `${roundMs(fast * ratio)}ms`,
    "motion.duration.fast": `${roundMs(fast)}ms`,
    "motion.duration.fast-max": `${roundMs(fast / ratio)}ms`,
    "motion.duration.medium-min": `${roundMs(medium * ratio)}ms`,
    "motion.duration.medium": `${roundMs(medium)}ms`,
    "motion.duration.medium-max": `${roundMs(medium / ratio)}ms`,
  };

  // Slow band is optional — only themes with continuous animation need it.
  if (slow != null) {
    tokens["motion.duration.slow-min"] = `${roundMs(slow * ratio)}ms`;
    tokens["motion.duration.slow"] = `${roundMs(slow)}ms`;
    tokens["motion.duration.slow-max"] = `${roundMs(slow / ratio)}ms`;
  }

  if (easing) tokens["motion.easing.standard"] = easing;

  return tokens;
}
