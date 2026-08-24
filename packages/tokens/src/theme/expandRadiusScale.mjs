/**
 * @file expandRadiusScale.mjs
 * @input Radius scale config { base, multiplier, steps? }
 * @output Token overrides for the semantic radius scale
 * @position Theme utility; consumed by defineTheme.mjs
 *
 * Computes border-radius values from a base unit and a multiplier:
 *   radius = base × step × multiplier
 *
 * `none` and `pill` are fixed anchors and never scale — a pill stays a pill
 * at any multiplier, and square is square.
 *
 * Ported from Meta's Astryx (MIT), with two adaptations:
 *  - emits this repo's dotted token paths, and keeps our `pill` name where
 *    Astryx says `full` (see THEME-ENGINE.md on the naming deviation);
 *  - `steps` is overridable. Astryx hard-codes 1/2/3/7/7; this repo's
 *    existing scale sits one notch softer, and a design system that sells
 *    multi-brand theming needs the step table to be a theme decision rather
 *    than an engine constant.
 *
 * SYNC: when this changes, update
 * - packages/tokens/src/theme/theme.test.mjs
 * - packages/tokens/THEME-ENGINE.md
 */

/**
 * Astryx's step table. Used when a theme doesn't supply its own.
 * @type {Record<string, number>}
 */
export const DEFAULT_RADIUS_STEPS = {
  inner: 1,
  element: 2,
  container: 3,
  chat: 7,
  page: 7,
};

/**
 * @typedef {object} RadiusScaleConfig
 * @property {number} base       Base radius unit in px.
 * @property {number} multiplier Scales every non-anchor step. 0 = brutalist, 2 = very soft.
 * @property {Record<string, number>} [steps] Step multiples per semantic name.
 */

/**
 * Expand a radius config into token overrides.
 * @param {RadiusScaleConfig} config
 * @returns {Record<string, string>}
 */
export function expandRadiusScale(config) {
  const { base, multiplier, steps = DEFAULT_RADIUS_STEPS } = config;

  const tokens = {
    "radius.none": "0px",
    "radius.pill": "9999px",
  };

  for (const [name, step] of Object.entries(steps)) {
    tokens[`radius.${name}`] = `${Math.round(base * step * multiplier)}px`;
  }

  return tokens;
}
