/**
 * @file color.mjs
 * @input Hex / rgb() color strings
 * @output Parsed RGBA, formatted hex, WCAG contrast ratios
 * @position Theme utility; consumed by hct.mjs and expandColorScale.mjs
 *
 * Colour parsing, formatting, and WCAG contrast math with no dependencies.
 *
 * Ported from Meta's Astryx (MIT) — packages/core/src/utils/color.ts and
 * packages/core/src/theme/contrast.ts. See THEME-ENGINE.md for what was
 * adapted and why.
 *
 * The contrast half of this file supersedes the private relativeLuminance /
 * contrast pair that used to live inside build.mjs: same formula, but it
 * additionally composites a translucent foreground over its background
 * first, which the build's copy could not do. Alpha matters here because
 * generated tokens legitimately carry it (borders, overlays, muted fills).
 */

/** @typedef {{r: number, g: number, b: number, a: number}} RGBA */

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

function expandShorthand(body) {
  return [...body].map((c) => c + c).join("");
}

/**
 * Parse `#RGB`, `#RGBA`, `#RRGGBB`, or `#RRGGBBAA` into {@link RGBA}.
 * Returns null rather than throwing so callers can decide what a bad value means.
 * @param {string} hex
 * @returns {RGBA | null}
 */
export function parseHex(hex) {
  if (typeof hex !== "string") return null;
  const body = hex.trim().replace(/^#/, "");
  const normalized =
    body.length === 3 || body.length === 4 ? expandShorthand(body) : body;

  if (
    (normalized.length !== 6 && normalized.length !== 8) ||
    !/^[0-9a-fA-F]+$/.test(normalized)
  ) {
    return null;
  }

  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
    a: normalized.length === 8 ? parseInt(normalized.slice(6, 8), 16) / 255 : 1,
  };
}

/**
 * Serialize three 0–255 channels to `#RRGGBB` (uppercase).
 * @returns {string}
 */
export function formatHex(r, g, b) {
  const channel = (c) =>
    clamp(Math.round(c), 0, 255).toString(16).padStart(2, "0").toUpperCase();
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/**
 * Append an alpha (0–1) to a hex colour as a two-digit suffix.
 * @param {string} hex
 * @param {number} alpha
 * @returns {string}
 */
export function hexWithAlpha(hex, alpha) {
  const alphaHex = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  return hex + alphaHex;
}

/** Composite a translucent colour over an opaque one. */
function compositeOver(fg, bg) {
  return {
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  };
}

/** WCAG 2.x relative luminance. */
function relativeLuminance({ r, g, b }) {
  const channel = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function resolve(value, role) {
  if (typeof value !== "string") return value;
  const parsed = parseHex(value);
  if (parsed === null) {
    throw new TypeError(`contrastRatio: could not parse ${role} "${value}"`);
  }
  return parsed;
}

/**
 * WCAG contrast ratio between two colours, 1–21.
 *
 * A translucent foreground is composited over the background first — that is
 * what a viewer actually sees. A translucent *background* is refused rather
 * than guessed at: what sits behind it is the caller's knowledge, not ours.
 *
 * @param {string | RGBA} foreground
 * @param {string | RGBA} background
 * @returns {number}
 */
export function contrastRatio(foreground, background) {
  const bg = resolve(background, "background");
  if (bg.a < 1) {
    throw new TypeError(
      "contrastRatio: background must be opaque — composite it over its backdrop first",
    );
  }
  let fg = resolve(foreground, "foreground");
  if (fg.a < 1) fg = compositeOver(fg, bg);

  const lumA = relativeLuminance(fg);
  const lumB = relativeLuminance(bg);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}
