/**
 * @file expandColorScale.mjs
 * @input Color scale config { accent?, neutralStyle?, contrast? }
 * @output Token overrides for the theme-derivable colour roles
 * @position Theme utility; consumed by defineTheme.mjs
 *
 * Generates the semantic colour layer from an accent seed using HCT. Only
 * roles that *meaningfully derive* from an accent are produced here; status
 * colours (success / warning / danger), the categorical data ramps, rings and
 * elevation are deliberately left alone, exactly as Astryx leaves them — they
 * are convention-bound, not brand-derived, so a theme states them outright.
 *
 * Ported from Meta's Astryx (MIT), adapted to this repo's dotted token paths
 * and its `theme.*` semantic role names. Astryx's tone assignments are
 * reproduced as-is, because the tone numbers *are* the accessibility
 * argument — see below.
 *
 * WCAG guarantees, verified every build by usage.json's pairings:
 * - Text tones clear 4.5:1 against their surfaces by tone spacing alone. HCT
 *   tone is CIE L*, which pins relative luminance regardless of hue and
 *   chroma, so the fixed assignments hold for *any* accent a brand seeds
 *   (WCAG 1.4.3). That is the whole reason to generate rather than hand-pick:
 *   a new brand colour cannot silently break contrast.
 * - theme.border.strong outlines form controls, so it is a non-text boundary
 *   under WCAG 1.4.11 and is tone-walked until it reaches 3:1.
 * - theme.border.default is a decorative hairline and is NOT held to 3:1.
 *
 * SYNC: when this changes, update
 * - packages/tokens/src/theme/theme.test.mjs
 * - packages/tokens/THEME-ENGINE.md
 */

import { contrastRatio, hexWithAlpha } from "./color.mjs";
import { hexToHct, hctToHex, tonalPalette } from "./hct.mjs";

/** How much of the seed's hue bleeds into the greys. */
const NEUTRAL_CHROMA = { warm: 7, cool: 5, neutral: 3 };
const NEUTRAL_VARIANT_CHROMA = { warm: 10, cool: 8, neutral: 6 };

/**
 * Hue source for accent-less configs. Only the *hue* reaches the output: the
 * accent roles stay ungenerated so they keep whatever the theme states.
 */
const DEFAULT_ACCENT_SEED = "#0064E0";

/** WCAG 1.4.11 minimum for non-text UI boundaries. */
const NON_TEXT_MIN_CONTRAST = 3;

/**
 * Walk tone in `step` increments from `startTone` until the colour reaches
 * `minRatio` against `background`.
 *
 * Needed for tokens whose preferred tone isn't guaranteed by spacing alone.
 * Because tone is CIE L*, each step moves luminance monotonically, so this
 * always terminates — at worst at black or white, which is 21:1 against
 * anything mid-range.
 */
export function ensureContrastTone(
  hue,
  chroma,
  startTone,
  step,
  background,
  minRatio,
) {
  let tone = startTone;
  let hex = hctToHex({ hue, chroma, tone });
  while (
    contrastRatio(hex, background) < minRatio &&
    tone + step >= 0 &&
    tone + step <= 100
  ) {
    tone += step;
    hex = hctToHex({ hue, chroma, tone });
  }
  return hex;
}

/**
 * @typedef {object} ColorScaleConfig
 * @property {string | [light: string, dark: string]} [accent]
 *   Seed accent. A tuple seeds each scheme from its own colour; a string
 *   seeds both identically. Omit to re-tone only the neutrals.
 * @property {'warm'|'cool'|'neutral'} [neutralStyle] Grey temperature. Default 'cool'.
 * @property {'standard'|'high'} [contrast] 'high' widens the text/surface tone gap.
 */

/**
 * Expand a colour config into token overrides, as `[light, dark]` tuples.
 * @param {ColorScaleConfig} config
 * @returns {Record<string, string | [string, string]>}
 */
export function expandColorScale(config) {
  const { accent, neutralStyle = "cool", contrast = "standard" } = config;

  // Normalise to per-scheme seeds. A string (or absent) accent uses one seed
  // for both halves, which keeps single-seed output identical to Astryx's.
  const [lightAccent, darkAccent] = Array.isArray(accent)
    ? accent
    : [accent, accent];

  const lightSeed = hexToHct(lightAccent ?? DEFAULT_ACCENT_SEED);
  const sameSeed = darkAccent === lightAccent;
  const darkSeed = sameSeed
    ? lightSeed
    : hexToHct(darkAccent ?? DEFAULT_ACCENT_SEED);

  const nc = NEUTRAL_CHROMA[neutralStyle] ?? 5;
  const nvc = NEUTRAL_VARIANT_CHROMA[neutralStyle] ?? 8;

  // *L palettes feed the light half of each pair, *D the dark half. With a
  // single seed the D palettes alias the L ones.
  const PL = tonalPalette(lightSeed.hue, Math.max(lightSeed.chroma, 48));
  const NL = tonalPalette(lightSeed.hue, nc);
  const NVL = tonalPalette(lightSeed.hue, nvc);
  const PD = sameSeed
    ? PL
    : tonalPalette(darkSeed.hue, Math.max(darkSeed.chroma, 48));
  const ND = sameSeed ? NL : tonalPalette(darkSeed.hue, nc);
  const NVD = sameSeed ? NVL : tonalPalette(darkSeed.hue, nvc);

  const isHigh = contrast === "high";

  const textPrimaryL = isHigh ? 0 : 10;
  const textPrimaryD = isHigh ? 99 : 90;
  const textSecondaryL = isHigh ? 20 : 30;
  const textSecondaryD = isHigh ? 80 : 70;

  // High contrast doubles the decorative hairline's alpha so structural
  // boundaries stay perceivable for people who opted in.
  const borderAlpha = isHigh ? 0.2 : 0.1;

  // Emphasized borders outline form controls — a 1.4.11 boundary. High
  // contrast starts mid-scale (guaranteeing a stronger result); standard
  // starts at 70/30 and walks only as far as it must.
  const borderStrong = [
    ensureContrastTone(
      lightSeed.hue,
      nvc,
      isHigh ? 50 : 70,
      -1,
      NL[99],
      NON_TEXT_MIN_CONTRAST,
    ),
    ensureContrastTone(
      darkSeed.hue,
      nvc,
      isHigh ? 50 : 30,
      1,
      ND[10],
      NON_TEXT_MIN_CONTRAST,
    ),
  ];

  const accentRoleBg = [PL[40], PD[80]];
  const accentRoleFg = [PL[40], PD[80]];

  return {
    // ── Accent roles — only with a seed. Without one these are omitted so
    // the theme's own values stand: defaulting the seed instead would
    // silently re-accent every neutral-only brand.
    ...(accent != null
      ? {
          "theme.accent-role.bg": accentRoleBg,
          "theme.accent-role.fg": accentRoleFg,
          // A tint, not a fill — and opaque, deliberately. Astryx makes the
          // equivalent token an alpha overlay so it composes over any
          // surface. This system asserts *measured* contrast for the text
          // that sits on it, and a translucent background has no measurable
          // ratio until you know what is behind it. An opaque tonal stop
          // trades that composability for a number the build can enforce.
          "theme.accent-role.subtle": [PL[90], PD[20]],
          "theme.fg.on-accent": [PL[100], PD[20]],
          "theme.tertiary-role.fg": accentRoleFg,
          // Focus is the accent at a mid tone: it must read as a boundary
          // against both canvas and surface, which usage.json asserts at
          // AA-nontext in both schemes.
          "theme.focus-ring": [PL[50], PD[70]],
        }
      : null),

    // ── Backgrounds. Surface is the *lifted* tone (99/10) and canvas the
    // tinted page behind it (95/5) — cards float rather than merge, which
    // is what makes elevation legible without a border.
    "theme.bg.surface": [NL[99], ND[10]],
    "theme.bg.canvas": [NL[95], ND[5]],
    // A quiet band inside a surface takes the canvas tone.
    "theme.bg.subtle": [NL[95], ND[10]],
    // The most recessed step — tracks, wells, skeletons.
    "theme.bg.muted": [NL[90], ND[20]],

    // ── Text
    "theme.fg.primary": [NL[textPrimaryL], ND[textPrimaryD]],
    "theme.fg.secondary": [NVL[textSecondaryL], NVD[textSecondaryD]],
    // Astryx puts its equivalent (text-disabled) at tone 60/40, which is
    // deliberately sub-AA — disabled text is exempt under WCAG 1.4.3. This
    // system's muted role is documented for *placeholders*, which are not
    // exempt and must stay readable, so it sits a step stronger at 40/60.
    "theme.fg.muted": [NVL[40], NVD[60]],

    // ── Secondary role (outlined controls) tracks the surface ladder.
    "theme.secondary-role.bg": [NL[99], ND[10]],
    "theme.secondary-role.fg": [NL[textPrimaryL], ND[textPrimaryD]],
    "theme.secondary-role.border": borderStrong,

    // ── Borders
    "theme.border.default": [
      hexWithAlpha(NL[10], borderAlpha),
      hexWithAlpha(ND[95], borderAlpha),
    ],
    "theme.border.strong": borderStrong,
  };
}
