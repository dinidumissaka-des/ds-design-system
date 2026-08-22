// Token build: resolves {references} in the JSON source, validates that every
// token is documented in src/usage.json, verifies the documented contrast
// pairings against the resolved values, and emits
//   dist/css/tokens.css      — CSS custom properties (:root + [data-theme="dark"]), annotated
//   dist/index.js|.d.ts      — typed token object + cssVar() helper, with usage in JSDoc
//   dist/tailwind/preset.cjs — Tailwind preset mapping theme keys to the CSS vars
//   dist/usage.json          — machine-readable usage docs + measured contrast
//   TOKENS.md                — the human/agent-facing reference (committed to the repo)
//
// Run with --check to fail instead of rewriting TOKENS.md when it is out of date.
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const PREFIX = "ds";
const CHECK_ONLY = process.argv.includes("--check");

const readJson = async (p) => JSON.parse(await readFile(path.join(root, p), "utf8"));

const base = await readJson("src/base.json");
const light = await readJson("src/themes/light.json");
const dark = await readJson("src/themes/dark.json");
const usage = await readJson("src/usage.json");

function getPath(obj, dotted) {
  return dotted.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

// Resolve "{a.b.c}" references against the base token tree (refs may chain).
function resolve(node, source, trail = []) {
  if (typeof node === "string") {
    let value = node;
    let guard = 0;
    while (typeof value === "string" && value.startsWith("{") && value.endsWith("}")) {
      const ref = value.slice(1, -1);
      if (trail.includes(ref) || ++guard > 10) throw new Error(`Circular token reference: ${ref}`);
      const next = getPath(source, ref);
      if (next === undefined) throw new Error(`Unknown token reference: ${ref}`);
      value = typeof next === "string" ? next : resolve(next, source, [...trail, ref]);
    }
    return value;
  }
  return Object.fromEntries(
    Object.entries(node).map(([k, v]) => [k, resolve(v, source, trail)])
  );
}

// Flat token list carrying both the CSS variable name and the dotted token path.
// Token segments may themselves contain "-" (accent-role, on-accent), so the
// dotted path cannot be recovered from the CSS name — it is tracked here.
function flatten(node, prefix = []) {
  const out = [];
  for (const [k, v] of Object.entries(node)) {
    const next = [...prefix, k];
    if (typeof v === "string") out.push({ name: next.join("-"), path: next.join("."), leaf: k, value: v });
    else out.push(...flatten(v, next));
  }
  return out;
}

const resolvedBase = resolve(base, base);
const resolvedLight = resolve(light, base);
const resolvedDark = resolve(dark, base);

const flatBase = flatten(resolvedBase);
const flatLight = flatten(resolvedLight);
const flatDark = flatten(resolvedDark);

const semanticPaths = new Set(flatLight.map((t) => t.path));
const allPaths = new Set([...flatBase, ...flatLight].map((t) => t.path));

/* ------------------------------------------------------------------ *
 * Documentation coverage — every token must be documented, and every
 * documented token must exist. Both directions fail the build, so the
 * docs cannot silently drift from the token source.
 * ------------------------------------------------------------------ */

// Docs may be attached to a leaf token or to a group (the group's `scale`
// then describes the individual steps). Lookup walks up the path.
function docFor(dotted) {
  const parts = dotted.split(".");
  for (let i = parts.length; i > 0; i--) {
    const key = parts.slice(0, i).join(".");
    if (usage.tokens[key]) return { key, entry: usage.tokens[key], exact: i === parts.length };
  }
  return null;
}

const errors = [];

for (const key of Object.keys(usage.tokens)) {
  const existsAsLeaf = allPaths.has(key);
  const existsAsGroup = [...allPaths].some((p) => p.startsWith(`${key}.`));
  if (!existsAsLeaf && !existsAsGroup) {
    errors.push(`usage.json documents "${key}", which is not a token or token group.`);
  }
}

// Semantic tokens carry the theme-dependent meaning, so each one needs its own
// entry — inheriting a group description is not specific enough to build from.
for (const token of flatLight) {
  const doc = docFor(token.path);
  if (!doc || !doc.exact) {
    errors.push(`Semantic token "${token.path}" has no entry of its own in usage.json.`);
  }
}

for (const token of flatBase) {
  if (!docFor(token.path)) errors.push(`Base token "${token.path}" is undocumented in usage.json.`);
}

for (const [name, entry] of Object.entries(usage.tokens)) {
  for (const field of ["summary"]) {
    if (!entry[field]) errors.push(`usage.json entry "${name}" is missing "${field}".`);
  }
  for (const ref of Object.values(entry.instead ?? {})) {
    // "instead" values are prose that names one or more replacement tokens;
    // every dotted path mentioned must be real.
    for (const candidate of ref.match(/\b[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+\b/g) ?? []) {
      if (!allPaths.has(candidate) && !usage.tokens[candidate]) {
        errors.push(`usage.json entry "${name}" points at unknown token "${candidate}".`);
      }
    }
  }
  for (const ref of entry.pairsWith ?? []) {
    if (!allPaths.has(ref)) errors.push(`usage.json entry "${name}" pairsWith unknown token "${ref}".`);
  }
}

/* ------------------------------------------------------------------ *
 * Contrast — measured from the resolved values, not asserted by hand.
 * Documented pairings must meet their stated level in every theme they
 * claim; documented gaps must still be gaps. A palette change that
 * breaks a promise, or that quietly fixes a gap, fails the build.
 * ------------------------------------------------------------------ */

const LEVELS = { "AA-text": 4.5, "AA-large": 3, "AA-nontext": 3 };

function relativeLuminance(hex) {
  const h = hex.trim().replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const themeValues = {
  light: Object.fromEntries([...flatBase, ...flatLight].map((t) => [t.path, t.value])),
  dark: Object.fromEntries([...flatBase, ...flatDark].map((t) => [t.path, t.value])),
};

const round = (n) => Math.round(n * 100) / 100;

const contrastReport = [];

for (const pair of usage.pairings) {
  const themes = pair.themes ?? ["light", "dark"];
  const min = LEVELS[pair.requires];
  if (min === undefined) errors.push(`Pairing ${pair.fg} on ${pair.bg} has unknown level "${pair.requires}".`);
  const measured = {};
  for (const theme of themes) {
    const fg = themeValues[theme][pair.fg];
    const bg = themeValues[theme][pair.bg];
    if (!fg || !bg) {
      errors.push(`Pairing ${pair.fg} on ${pair.bg} references a token missing from the ${theme} theme.`);
      continue;
    }
    const ratio = round(contrast(fg, bg));
    measured[theme] = ratio;
    if (min !== undefined && ratio < min) {
      errors.push(
        `Contrast promise broken: ${pair.fg} on ${pair.bg} is ${ratio}:1 in the ${theme} theme, ` +
          `below the ${min}:1 required by "${pair.requires}". Fix the tokens or move this to knownGaps.`
      );
    }
  }
  contrastReport.push({ ...pair, themes, measured });
}

const gapReport = [];

for (const gap of usage.knownGaps) {
  const themes = gap.themes ?? ["light", "dark"];
  const limit = LEVELS[gap.below];
  if (limit === undefined) errors.push(`knownGap ${gap.fg} on ${gap.bg} has unknown level "${gap.below}".`);
  const measured = {};
  for (const theme of themes) {
    const fg = themeValues[theme][gap.fg];
    const bg = themeValues[theme][gap.bg];
    if (!fg || !bg) {
      errors.push(`knownGap ${gap.fg} on ${gap.bg} references a token missing from the ${theme} theme.`);
      continue;
    }
    const ratio = round(contrast(fg, bg));
    measured[theme] = ratio;
    if (limit !== undefined && ratio >= limit) {
      errors.push(
        `Stale knownGap: ${gap.fg} on ${gap.bg} now measures ${ratio}:1 in the ${theme} theme, ` +
          `at or above ${limit}:1. The gap is fixed — promote it to pairings and delete the gap entry.`
      );
    }
  }
  gapReport.push({ ...gap, themes, measured });
}

for (const [name, recipe] of Object.entries(usage.recipes)) {
  for (const value of Object.values(recipe.tokens)) {
    for (const candidate of String(value).match(/\b[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+\b/g) ?? []) {
      if (!allPaths.has(candidate)) errors.push(`Recipe "${name}" names unknown token "${candidate}".`);
    }
  }
}

if (errors.length) {
  console.error(`@ds/tokens: ${errors.length} documentation error(s)\n`);
  for (const e of errors) console.error(`  • ${e}`);
  process.exit(1);
}

/* ------------------------------------------------------------------ *
 * Emit
 * ------------------------------------------------------------------ */

// One-line annotation for a token: its own summary if documented directly,
// otherwise its group's description of that step on the scale. Tokens that
// only inherit a group summary (the palette ramps) are annotated once for the
// whole group rather than repeating the same line on every step.
function inlineDoc(token, seenGroups) {
  const doc = docFor(token.path);
  if (!doc) return null;
  if (doc.exact) return doc.entry.summary;
  const step = doc.entry.scale?.[token.leaf];
  if (step) return step;
  if (seenGroups.has(doc.key)) return null;
  seenGroups.add(doc.key);
  return doc.entry.summary;
}

const GROUP_TITLES = {
  color: "Color — palette primitives (do not use directly) then semantic roles",
  space: "Spacing — every margin, padding, and gap",
  radius: "Corner radius",
  size: "Interactive control sizing",
  font: "Typography",
  motion: "Motion",
  elevation: "Elevation",
  state: "Interaction-state opacities",
  focus: "Focus-ring geometry",
};

function cssBlock(selector, tokens, { groupHeaders }) {
  const lines = [`${selector} {`];
  const seenGroups = new Set();
  let currentGroup = null;
  for (const token of tokens) {
    const group = token.path.split(".")[0];
    if (groupHeaders && group !== currentGroup) {
      if (currentGroup !== null) lines.push("");
      lines.push(`  /* ${GROUP_TITLES[group] ?? group} */`);
      currentGroup = group;
    }
    const doc = inlineDoc(token, seenGroups);
    if (doc) lines.push(`  /* ${doc} */`);
    lines.push(`  --${PREFIX}-${token.name}: ${token.value};`);
  }
  lines.push("}");
  return lines.join("\n") + "\n";
}

const css = [
  [
    "/* Generated by @ds/tokens — do not edit by hand.",
    " * Edit src/base.json, src/themes/*.json, or src/usage.json and rebuild.",
    " *",
    " * Comments come from src/usage.json. Full guidance, contrast data, and",
    " * component recipes live in packages/tokens/TOKENS.md.",
    " *",
    " * Palette tokens (--ds-color-neutral-*, --ds-color-accent-*, and the other",
    " * numbered ramps) are identical in both themes. Never use them in a",
    " * component — use the semantic tokens below them.",
    " */",
  ].join("\n"),
  cssBlock(":root", [...flatBase, ...flatLight], { groupHeaders: true }),
  [
    "/* Dark theme — only the semantic tokens change. Every token below has the",
    " * same meaning as its :root counterpart; only the value differs. */",
    cssBlock('[data-theme="dark"]', flatDark, { groupHeaders: false }),
  ].join("\n"),
].join("\n");

// TypeScript/JS output: semantic tokens overlay the base tree (light values as defaults).
const merged = structuredClone(resolvedBase);
(function deepMerge(target, from) {
  for (const [k, v] of Object.entries(from)) {
    if (typeof v === "object" && typeof target[k] === "object") deepMerge(target[k], v);
    else target[k] = v;
  }
})(merged, resolvedLight);

// JSDoc block for a token or group, so editors and coding agents see the usage
// rules on hover and in completions rather than having to find the docs.
function jsdoc(dotted, indent) {
  const doc = docFor(dotted);
  if (!doc || doc.key !== dotted) return "";
  const e = doc.entry;
  const lines = [e.summary];
  if (semanticPaths.has(dotted)) {
    lines.push("", `Light: \`${themeValues.light[dotted]}\` · Dark: \`${themeValues.dark[dotted]}\``);
  }
  if (e.use?.length) lines.push("", "Use for:", ...e.use.map((u) => `- ${u}`));
  if (e.scale) lines.push("", "Scale:", ...Object.entries(e.scale).map(([k, v]) => `- \`${k}\` — ${v}`));
  if (e.dont?.length) lines.push("", "Do not use for:", ...e.dont.map((d) => `- ${d}`));
  if (e.instead) lines.push("", "Use instead:", ...Object.entries(e.instead).map(([k, v]) => `- ${k} → \`${v}\``));
  if (e.pairsWith?.length) lines.push("", `Pairs with: ${e.pairsWith.map((p) => `\`${p}\``).join(", ")}`);
  if (e.notes?.length) lines.push("", ...e.notes.map((n) => `Note: ${n}`));
  if (e.example?.css) lines.push("", "```css", e.example.css, "```");
  return `${indent}/**\n${lines.map((l) => `${indent} *${l ? ` ${l}` : ""}`).join("\n")}\n${indent} */\n`;
}

function toType(node, dotted = "", indent = "  ") {
  if (typeof node === "string") return "string";
  const inner = Object.entries(node)
    .map(([k, v]) => {
      const childPath = dotted ? `${dotted}.${k}` : k;
      return `${jsdoc(childPath, indent)}${indent}${JSON.stringify(k)}: ${toType(v, childPath, indent + "  ")};`;
    })
    .join("\n");
  return `{\n${inner}\n${indent.slice(2)}}`;
}

const js = `// Generated by @ds/tokens — do not edit by hand.
export const tokens = ${JSON.stringify(merged, null, 2)};
export const cssVar = (tokenPath) => \`var(--${PREFIX}-\${tokenPath.replaceAll(".", "-")})\`;
export const usage = ${JSON.stringify(usage.tokens, null, 2)};
export const contrast = ${JSON.stringify({ pairings: contrastReport, knownGaps: gapReport }, null, 2)};
export const recipes = ${JSON.stringify(usage.recipes, null, 2)};
`;

const dts = `// Generated by @ds/tokens — do not edit by hand.

/**
 * Resolved token values, with the light theme's semantic values as defaults.
 *
 * Prefer \`cssVar()\` over these literals in component code: only the CSS
 * variables react to the active theme.
 */
export declare const tokens: ${toType(merged)};

/**
 * Returns the CSS variable reference for a dotted token path.
 *
 * \`\`\`ts
 * cssVar("color.accent-role.bg"); // "var(--ds-color-accent-role-bg)"
 * \`\`\`
 */
export declare const cssVar: (tokenPath: string) => string;

/** Usage documentation for every token, keyed by dotted path. */
export declare const usage: Record<string, {
  layer: "palette" | "semantic" | "base";
  summary: string;
  use?: string[];
  dont?: string[];
  instead?: Record<string, string>;
  pairsWith?: string[];
  scale?: Record<string, string>;
  notes?: string[];
  example?: { css?: string };
}>;

/** Contrast ratios measured from the resolved token values at build time. */
export declare const contrast: {
  pairings: { fg: string; bg: string; requires: string; themes: string[]; measured: Record<string, number>; note?: string }[];
  knownGaps: { fg: string; bg: string; below: string; themes: string[]; measured: Record<string, number>; note?: string; workaround?: string }[];
};

/** Token-by-token specs for common components. */
export declare const recipes: Record<string, { summary: string; tokens: Record<string, string> }>;
`;

const tw = `// Generated by @ds/tokens — Tailwind preset (do not edit by hand).
// Only semantic tokens are exposed: the palette ramps are deliberately absent
// so utilities cannot bypass the theme. See packages/tokens/TOKENS.md.
const v = (name) => \`var(--${PREFIX}-\${name})\`;
module.exports = {
  theme: {
    extend: {
      colors: {
        canvas: v("color-bg-canvas"),
        surface: v("color-bg-surface"),
        subtle: v("color-bg-subtle"),
        muted: v("color-bg-muted"),
        foreground: v("color-fg-primary"),
        secondary: v("color-fg-secondary"),
        accent: {
          DEFAULT: v("color-accent-role-bg"),
          hover: v("color-accent-role-bg-hover"),
          fg: v("color-accent-role-fg"),
          subtle: v("color-accent-role-subtle"),
        },
        danger: {
          DEFAULT: v("color-danger-role-bg"),
          fg: v("color-danger-role-fg"),
          subtle: v("color-danger-role-subtle"),
        },
        success: {
          DEFAULT: v("color-success-role-bg"),
          fg: v("color-success-role-fg"),
          subtle: v("color-success-role-subtle"),
        },
        warning: {
          DEFAULT: v("color-warning-role-bg"),
          fg: v("color-warning-role-fg"),
          subtle: v("color-warning-role-subtle"),
        },
        border: v("color-border-default"),
      },
      borderRadius: {
        sm: v("radius-sm"),
        DEFAULT: v("radius-md"),
        lg: v("radius-lg"),
        xl: v("radius-xl"),
      },
      fontFamily: {
        sans: v("font-family-sans"),
        mono: v("font-family-mono"),
      },
    },
  },
};
`;

const usageJson = JSON.stringify(
  {
    $comment: "Generated by @ds/tokens — do not edit by hand. Source: src/usage.json.",
    rules: usage.rules,
    tokens: Object.fromEntries(
      Object.entries(usage.tokens).map(([key, entry]) => [
        key,
        {
          ...entry,
          cssVar: allPaths.has(key) ? `var(--${PREFIX}-${key.replaceAll(".", "-")})` : undefined,
          value: semanticPaths.has(key)
            ? { light: themeValues.light[key], dark: themeValues.dark[key] }
            : allPaths.has(key)
              ? themeValues.light[key]
              : undefined,
        },
      ])
    ),
    contrast: { pairings: contrastReport, knownGaps: gapReport },
    recipes: usage.recipes,
  },
  null,
  2
);

/* ---- TOKENS.md -------------------------------------------------- */

const md = [];
const bullets = (items) => items.map((i) => `- ${i}`).join("\n");

md.push("<!-- Generated by @ds/tokens from src/usage.json — do not edit by hand. -->");
md.push("<!-- Regenerate with `npm run build -w @ds/tokens`. -->");
md.push("");
md.push("# Token usage reference");
md.push("");
md.push(
  "Every token in this system, what it is for, and what it is *not* for. " +
    "If you are building a component, find the token whose **Use for** list matches what you are styling — " +
    "there is exactly one right answer for each decision."
);
md.push("");
md.push("## Rules");
md.push("");
md.push(usage.rules.map((r, i) => `${i + 1}. ${r}`).join("\n"));
md.push("");
md.push("## Layers");
md.push("");
md.push("| Layer | Tokens | Use in components? |");
md.push("|---|---|---|");
md.push("| Palette | `color.neutral.*`, `color.accent.*`, `color.success.*`, `color.warning.*`, `color.danger.*`, `color.white`, `color.black` | **No** — identical in both themes, so they break dark mode |");
md.push("| Semantic | `color.bg.*`, `color.fg.*`, `color.border.*`, `color.*-role.*`, `color.focus-ring` | **Yes** — these are the only color tokens a component may use |");
md.push("| Base scales | `space`, `radius`, `size`, `font`, `motion`, `elevation`, `state`, `focus` | **Yes** — theme-independent by design |");
md.push("");
md.push("## Pick a token");
md.push("");
md.push("| I am styling… | Token |");
md.push("|---|---|");
for (const [what, token] of [
  ["The page background", "`color.bg.canvas`"],
  ["A card, dialog, menu, or popover background", "`color.bg.surface`"],
  ["A table header, zebra stripe, or quiet band", "`color.bg.subtle`"],
  ["A progress track, skeleton, or inset well", "`color.bg.muted`"],
  ["Body text, headings, meaningful icons", "`color.fg.primary`"],
  ["Helper text, captions, metadata", "`color.fg.secondary`"],
  ["Placeholders and decorative icons", "`color.fg.muted`"],
  ["The label on a filled accent or danger button", "`color.fg.on-accent`"],
  ["A divider or card outline", "`color.border.default`"],
  ["An input or outlined-button border", "`color.border.strong`"],
  ["The primary button / selected state", "`color.accent-role.bg`"],
  ["A link or text-only action", "`color.accent-role.fg`"],
  ["An informational banner background", "`color.accent-role.subtle`"],
  ["A destructive button", "`color.danger-role.bg`"],
  ["A validation error message", "`color.danger-role.fg`"],
  ["An error banner background", "`color.danger-role.subtle`"],
  ["A success or warning message", "the role's `subtle` background with its `fg` text — never its `bg`"],
  ["A status dot or non-text indicator", "the role's `bg`"],
  ["The keyboard focus ring", "`color.focus-ring` with `focus.ring-width` / `focus.ring-offset`"],
  ["Hover or press feedback", "the `.ds-state-layer` class — not a color swap"],
  ["Any margin, padding, or gap", "a `space.*` step"],
  ["A control's height", "a `size.control.*` step"],
]) {
  md.push(`| ${what} | ${token} |`);
}
md.push("");

// Recipe values mix token paths with prose ("1px solid color.border.default").
// Backtick the token paths and leave the prose alone.
function markTokens(text) {
  return String(text).replace(/\b[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+\b/g, (m) =>
    allPaths.has(m) ? `\`${m}\`` : m
  );
}

function renderToken(key, entry) {
  const out = [];
  const isToken = allPaths.has(key);
  out.push(`### \`${key}\``);
  out.push("");
  if (isToken) {
    if (semanticPaths.has(key)) {
      out.push(
        `\`var(--${PREFIX}-${key.replaceAll(".", "-")})\` · light \`${themeValues.light[key]}\` · dark \`${themeValues.dark[key]}\``
      );
    } else {
      out.push(`\`var(--${PREFIX}-${key.replaceAll(".", "-")})\` · \`${themeValues.light[key]}\``);
    }
    out.push("");
  }
  out.push(entry.summary);
  out.push("");
  if (entry.scale) {
    out.push("| Step | CSS variable | Value | Use for |");
    out.push("|---|---|---|---|");
    for (const [step, desc] of Object.entries(entry.scale)) {
      const full = `${key}.${step}`;
      const resolved = themeValues.light[full];
      const varName = allPaths.has(full) ? `\`var(--${PREFIX}-${full.replaceAll(".", "-")})\`` : "—";
      const value = allPaths.has(full) ? `\`${resolved}\`` : "—";
      // Scale descriptions lead with the value ("16px — the default…") so they read
      // on their own in the CSS comments and JSDoc; the table has a Value column
      // already, so drop the duplicated prefix here.
      const text = resolved && desc.startsWith(`${resolved} — `) ? desc.slice(resolved.length + 3) : desc;
      out.push(`| \`${step}\` | ${varName} | ${value} | ${text} |`);
    }
    out.push("");
  }
  if (entry.use?.length) {
    out.push("**Use for**");
    out.push("");
    out.push(bullets(entry.use));
    out.push("");
  }
  if (entry.dont?.length) {
    out.push("**Do not use for**");
    out.push("");
    out.push(bullets(entry.dont));
    out.push("");
  }
  if (entry.instead) {
    out.push("**Use instead**");
    out.push("");
    out.push("| Instead of reaching for this | Use |");
    out.push("|---|---|");
    for (const [what, token] of Object.entries(entry.instead)) out.push(`| ${what} | \`${token}\` |`);
    out.push("");
  }
  if (entry.pairsWith?.length) {
    out.push(`**Pairs with** ${entry.pairsWith.map((p) => `\`${p}\``).join(", ")}`);
    out.push("");
  }
  if (entry.notes?.length) {
    for (const n of entry.notes) out.push(`> ${n}`);
    out.push("");
  }
  if (entry.example?.css) {
    out.push("```css");
    out.push(entry.example.css);
    out.push("```");
    out.push("");
  }
  return out.join("\n");
}

const semanticEntries = Object.entries(usage.tokens).filter(([k]) => semanticPaths.has(k));
const paletteEntries = Object.entries(usage.tokens).filter(([, e]) => e.layer === "palette");
const baseEntries = Object.entries(usage.tokens).filter(([, e]) => e.layer === "base");

md.push("## Semantic color tokens");
md.push("");
md.push("These are the only color tokens a component may use. Each one is the correct answer to exactly one styling question.");
md.push("");
for (const [k, e] of semanticEntries) md.push(renderToken(k, e));

md.push("## Palette tokens (reference only)");
md.push("");
md.push("Raw ramps. They do not change between themes, so a component that uses one is broken in the other. They exist only as reference targets for the semantic tokens above.");
md.push("");
for (const [k, e] of paletteEntries) md.push(renderToken(k, e));

md.push("## Base scales");
md.push("");
md.push("Theme-independent scales for everything that is not a color.");
md.push("");
for (const [k, e] of baseEntries) md.push(renderToken(k, e));

md.push("## Verified contrast");
md.push("");
md.push(
  "Ratios are measured from the resolved token values every build. A pairing listed here is guaranteed to hold: " +
    "if a token change breaks one, the build fails."
);
md.push("");
md.push("`AA-text` needs 4.5:1 · `AA-large` and `AA-nontext` need 3:1.");
md.push("");
md.push("| Foreground | Background | Level | Light | Dark |");
md.push("|---|---|---|---|---|");
for (const p of contrastReport) {
  const cell = (t) => (p.measured[t] === undefined ? "n/a" : `${p.measured[t].toFixed(2)}:1`);
  md.push(`| \`${p.fg}\` | \`${p.bg}\` | ${p.requires} | ${cell("light")} | ${cell("dark")} |`);
}
md.push("");
md.push("### Known gaps — do not use these combinations");
md.push("");
md.push(
  "These combinations fall short of the stated level. They are verified every build too: if a token change closes one, " +
    "the build fails so the gap gets promoted to a guarantee instead of going stale."
);
md.push("");
md.push("| Foreground | Background | Falls short of | Light | Dark |");
md.push("|---|---|---|---|---|");
for (const g of gapReport) {
  const cell = (t) => (g.measured[t] === undefined ? "n/a" : `${g.measured[t].toFixed(2)}:1`);
  md.push(`| \`${g.fg}\` | \`${g.bg}\` | ${g.below} | ${cell("light")} | ${cell("dark")} |`);
}
md.push("");
for (const g of gapReport) {
  const why = g.note ? `${g.note} ` : "";
  md.push(`- **\`${g.fg}\` on \`${g.bg}\`** (${g.themes.join(", ")}) — ${why}${g.workaround ?? ""}`);
}
md.push("");

md.push("## Component recipes");
md.push("");
md.push("The exact token for every property of a common component. Build from these rather than choosing tokens one at a time.");
md.push("");
for (const [name, recipe] of Object.entries(usage.recipes)) {
  md.push(`### ${name}`);
  md.push("");
  md.push(recipe.summary);
  md.push("");
  md.push("| Property | Token |");
  md.push("|---|---|");
  for (const [prop, token] of Object.entries(recipe.tokens)) md.push(`| ${prop} | ${markTokens(token)} |`);
  md.push("");
}

const markdown = md.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";

/* ---- Write ------------------------------------------------------- */

const mdPath = path.join(root, "TOKENS.md");

if (CHECK_ONLY) {
  const existing = await readFile(mdPath, "utf8").catch(() => null);
  if (existing !== markdown) {
    console.error(
      "@ds/tokens: TOKENS.md is out of date with src/usage.json.\n" +
        "Run `npm run build -w @ds/tokens` and commit the result."
    );
    process.exit(1);
  }
  console.log("@ds/tokens: TOKENS.md is up to date.");
  process.exit(0);
}

await rm(path.join(root, "dist"), { recursive: true, force: true });
await mkdir(path.join(root, "dist/css"), { recursive: true });
await mkdir(path.join(root, "dist/tailwind"), { recursive: true });
await writeFile(path.join(root, "dist/css/tokens.css"), css);
await writeFile(path.join(root, "dist/index.js"), js);
await writeFile(path.join(root, "dist/index.d.ts"), dts);
await writeFile(path.join(root, "dist/tailwind/preset.cjs"), tw);
await writeFile(path.join(root, "dist/usage.json"), usageJson);
await writeFile(mdPath, markdown);

console.log(
  `@ds/tokens built: ${flatBase.length} base + ${flatLight.length} semantic tokens, ` +
    `${Object.keys(usage.tokens).length} documented entries, ` +
    `${contrastReport.length} verified pairings, ${gapReport.length} known gaps, ` +
    `${Object.keys(usage.recipes).length} recipes`
);
