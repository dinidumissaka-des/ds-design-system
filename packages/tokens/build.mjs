// Token build: resolves {references} in the JSON source and emits
//   dist/css/tokens.css      — CSS custom properties (:root + [data-theme="dark"])
//   dist/index.js|.d.ts      — typed token object + cssVar() helper
//   dist/tailwind/preset.cjs — Tailwind preset mapping theme keys to the CSS vars
import { mkdir, readFile, readdir, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const PREFIX = "ds";

const readJson = async (p) => JSON.parse(await readFile(path.join(root, p), "utf8"));

// One file per primitive scale (src/primitives/color.json, space.json, …) —
// each file's basename becomes its top-level key, so `space.json` fills
// `base.space` exactly as a "space" key inside a single base.json would.
// Keeps a color-palette-sized diff from ever touching a one-line scale like
// border.json, and matches the design-tokens skill's one-scale-at-a-time model.
async function readBase() {
  const dir = path.join(root, "src/primitives");
  const base = {};
  for (const file of (await readdir(dir)).sort()) {
    if (!file.endsWith(".json")) continue;
    base[file.replace(/\.json$/, "")] = await readJson(path.join("src/primitives", file));
  }
  return base;
}

const base = await readBase();
const light = await readJson("src/semantics/color/light.json");
const dark = await readJson("src/semantics/color/dark.json");

// Non-color semantic roles (src/semantics/*.json) — theme-invariant, so
// unlike color they don't branch into light/dark. Color's semantics live in
// src/semantics/color/{light,dark}.json instead — same "one file per
// semantic group" layout, just the one group that needs two files because
// it's the one thing that varies by theme; read separately above, not by
// this loop (the "color" subdirectory is skipped here — it doesn't end in
// .json, only files directly under src/semantics/ do).
// Each file's basename maps to the primitive category it extends
// (spacing.json's roles fold into the "space" family alongside the raw
// space.0..12 steps, same way color's accent-role shares the "color" family
// with color.accent's raw ramp); typography.json has no primitive category
// of the same name, so it becomes its own "type" family instead of
// colliding with font.*.
const SEMANTIC_TARGET = { spacing: "space", radius: "radius", typography: "type", motion: "motion" };

async function readSemantics() {
  const dir = path.join(root, "src/semantics");
  const groups = {};
  for (const file of (await readdir(dir)).sort()) {
    if (!file.endsWith(".json")) continue;
    const key = file.replace(/\.json$/, "");
    const targetKey = SEMANTIC_TARGET[key] ?? key;
    const parsed = await readJson(path.join("src/semantics", file));
    groups[targetKey] = { ...(groups[targetKey] ?? {}), ...parsed };
  }
  return groups;
}

const semantics = await readSemantics();

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

function flatten(node, prefix = []) {
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (typeof v === "string") out[[...prefix, k].join("-")] = v;
    else Object.assign(out, flatten(v, [...prefix, k]));
  }
  return out;
}

const resolvedBase = resolve(base, base);
const resolvedLight = resolve(light, base);
const resolvedDark = resolve(dark, base);

// Fold each resolved semantic group into the primitive family it extends —
// e.g. spacing.json's "control"/"stack"/"section"/"page" land as new sibling
// keys next to space's raw "0".."12" steps, exactly how color's semantic
// roles already sit alongside color's raw ramps.
for (const [targetKey, group] of Object.entries(semantics)) {
  const resolvedGroup = resolve(group, base);
  resolvedBase[targetKey] = { ...(resolvedBase[targetKey] ?? {}), ...resolvedGroup };
}

const flatBase = flatten(resolvedBase);
const flatLight = flatten(resolvedLight);
const flatDark = flatten(resolvedDark);

const cssBlock = (selector, vars) =>
  `${selector} {\n${Object.entries(vars)
    .map(([k, v]) => `  --${PREFIX}-${k}: ${v};`)
    .join("\n")}\n}\n`;

const css = [
  "/* Generated by @ds/tokens — do not edit by hand. */",
  cssBlock(":root", { ...flatBase, ...flatLight }),
  cssBlock('[data-theme="dark"]', flatDark),
].join("\n");

// TypeScript/JS output: semantic tokens overlay the base tree (light values as defaults).
const merged = structuredClone(resolvedBase);
(function deepMerge(target, from) {
  for (const [k, v] of Object.entries(from)) {
    if (typeof v === "object" && typeof target[k] === "object") deepMerge(target[k], v);
    else target[k] = v;
  }
})(merged, resolvedLight);

function toType(node, indent = "  ") {
  if (typeof node === "string") return "string";
  const inner = Object.entries(node)
    .map(([k, v]) => `${indent}${JSON.stringify(k)}: ${toType(v, indent + "  ")};`)
    .join("\n");
  return `{\n${inner}\n${indent.slice(2)}}`;
}

const js = `// Generated by @ds/tokens — do not edit by hand.
export const tokens = ${JSON.stringify(merged, null, 2)};
export const cssVar = (tokenPath) => \`var(--${PREFIX}-\${tokenPath.replaceAll(".", "-")})\`;
`;

const dts = `// Generated by @ds/tokens — do not edit by hand.
export declare const tokens: ${toType(merged)};
export declare const cssVar: (tokenPath: string) => string;
`;

const tw = `// Generated by @ds/tokens — Tailwind preset (do not edit by hand).
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

await rm(path.join(root, "dist"), { recursive: true, force: true });
await mkdir(path.join(root, "dist/css"), { recursive: true });
await mkdir(path.join(root, "dist/tailwind"), { recursive: true });
await writeFile(path.join(root, "dist/css/tokens.css"), css);
await writeFile(path.join(root, "dist/index.js"), js);
await writeFile(path.join(root, "dist/index.d.ts"), dts);
await writeFile(path.join(root, "dist/tailwind/preset.cjs"), tw);

console.log(
  `@ds/tokens built: ${Object.keys(flatBase).length} base + ${Object.keys(flatLight).length} semantic tokens`
);
