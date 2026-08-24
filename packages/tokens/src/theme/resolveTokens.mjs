/**
 * @file resolveTokens.mjs
 * @input The primitive JSON tree, the semantic JSON roles, and a defined theme
 * @output Resolved light/dark token trees and flat token lists
 * @position Shared pipeline; consumed by build.mjs and build-theme.mjs
 *
 * The one place that knows how a theme becomes values. The base build and the
 * brand-theme build both go through here, so a brand cannot resolve by
 * different rules than the theme it extends — which is the only reason the
 * contrast guarantees mean anything across themes.
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

/**
 * Semantic role files whose basename differs from the primitive family they
 * extend. Everything else folds into a family of its own name.
 */
const SEMANTIC_TARGET = { spacing: "space", motion: "motion" };

const readJson = async (p) => JSON.parse(await readFile(p, "utf8"));

/**
 * Read src/primitives/*.json into one tree, each file's basename becoming a
 * top-level family. One file per scale keeps a colour-palette-sized diff from
 * ever touching a one-line scale like border.json.
 */
export async function readPrimitives(root) {
  const dir = path.join(root, "src/primitives");
  const base = {};
  for (const file of (await readdir(dir)).sort()) {
    if (!file.endsWith(".json")) continue;
    base[file.replace(/\.json$/, "")] = await readJson(path.join(dir, file));
  }
  return base;
}

/** Read src/semantics/*.json, keyed by the family each one extends. */
export async function readSemantics(root) {
  const dir = path.join(root, "src/semantics");
  const groups = {};
  for (const file of (await readdir(dir)).sort()) {
    if (!file.endsWith(".json")) continue;
    const key = file.replace(/\.json$/, "");
    const targetKey = SEMANTIC_TARGET[key] ?? key;
    const parsed = await readJson(path.join(dir, file));
    groups[targetKey] = { ...(groups[targetKey] ?? {}), ...parsed };
  }
  return groups;
}

function getPath(obj, dotted) {
  return dotted.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

/**
 * Resolve "{a.b.c}" references against `source`. References may chain.
 *
 * `at` is the dotted path of the token currently being resolved. It exists
 * only for the error message: "Unknown token reference: motion.duration.fast"
 * on its own does not say which token wanted it, which is the thing you need
 * in order to fix it.
 */
export function resolve(node, source, trail = [], at = "") {
  if (typeof node === "string") {
    let value = node;
    let guard = 0;
    while (typeof value === "string" && value.startsWith("{") && value.endsWith("}")) {
      const ref = value.slice(1, -1);
      if (trail.includes(ref) || ++guard > 10) {
        throw new Error(
          `Circular token reference: ${ref}${at ? ` (resolving ${at})` : ""}`,
        );
      }
      const next = getPath(source, ref);
      if (next === undefined) {
        throw new Error(
          `Unknown token reference "${ref}"${at ? `, needed by "${at}"` : ""}. ` +
            `Either the reference is a typo, or it points at a generated token ` +
            `this theme does not produce — a theme that does not \`extends\` the ` +
            `base theme must supply its own seeds for every scale it references.`,
        );
      }
      value =
        typeof next === "string" ? next : resolve(next, source, [...trail, ref], at);
    }
    return value;
  }
  return Object.fromEntries(
    Object.entries(node).map(([k, v]) => [
      k,
      resolve(v, source, trail, at ? `${at}.${k}` : k),
    ]),
  );
}

/**
 * Flatten a tree to a list carrying both the CSS variable name and the dotted
 * path. Segments contain "-" of their own (accent-role, on-accent), so the
 * dotted path cannot be recovered from the CSS name — it is tracked here.
 */
export function flatten(node, prefix = []) {
  const out = [];
  for (const [k, v] of Object.entries(node)) {
    const next = [...prefix, k];
    if (typeof v === "string") {
      out.push({ name: next.join("-"), path: next.join("."), leaf: k, value: v });
    } else {
      out.push(...flatten(v, next));
    }
  }
  return out;
}

function setPath(target, dotted, value) {
  const parts = dotted.split(".");
  let node = target;
  for (const key of parts.slice(0, -1)) {
    if (typeof node[key] !== "object" || node[key] === null) node[key] = {};
    node = node[key];
  }
  node[parts.at(-1)] = value;
}

/**
 * Split a theme's flat token map into two nested trees, one per scheme.
 * A bare string means "same in both"; a `[light, dark]` tuple splits.
 */
export function splitScheme(themeTokens) {
  const light = {};
  const dark = {};
  for (const [dotted, value] of Object.entries(themeTokens)) {
    const [l, d] = Array.isArray(value) ? value : [value, value];
    setPath(light, dotted, l);
    setPath(dark, dotted, d);
  }
  return { light, dark };
}

/** Recursively merge `from` into a clone of `into`; `from` wins at the leaves. */
export function deepMergeTree(into, from) {
  const out = structuredClone(into);
  (function walk(target, source) {
    for (const [k, v] of Object.entries(source)) {
      if (v && typeof v === "object" && target[k] && typeof target[k] === "object") {
        walk(target[k], v);
      } else {
        target[k] = v;
      }
    }
  })(out, from);
  return out;
}

/**
 * Resolve a theme into everything downstream needs.
 *
 * Ordering is load-bearing:
 *   1. primitives resolve against themselves;
 *   2. each scheme resolves against primitives + its own half of the theme,
 *      separately, so one reference can mean different things per scheme;
 *   3. semantic roles resolve LAST, against primitives + the light theme,
 *      because they point at generated values (motion.json's roles reference
 *      the duration scale the theme's motion seed produces).
 *
 * @param {{root: string, theme: {name: string, tokens: object}}} options
 */
export async function resolveTheme({ root, theme }) {
  const primitives = await readPrimitives(root);
  const semantics = await readSemantics(root);

  const resolvedBase = resolve(primitives, primitives);
  const { light, dark } = splitScheme(theme.tokens);

  const resolvedLight = resolve(light, deepMergeTree(resolvedBase, light));
  const resolvedDark = resolve(dark, deepMergeTree(resolvedBase, dark));

  const semanticSource = deepMergeTree(resolvedBase, resolvedLight);
  for (const [targetKey, group] of Object.entries(semantics)) {
    resolvedBase[targetKey] = {
      ...(resolvedBase[targetKey] ?? {}),
      ...resolve(group, semanticSource, [], targetKey),
    };
  }

  const flatBase = flatten(resolvedBase);
  const flatLight = flatten(resolvedLight);
  const flatDark = flatten(resolvedDark);

  const darkByPath = new Map(flatDark.map((t) => [t.path, t.value]));
  const variantPaths = new Set(
    flatLight.filter((t) => darkByPath.get(t.path) !== t.value).map((t) => t.path),
  );

  return {
    resolvedBase,
    resolvedLight,
    resolvedDark,
    flatBase,
    flatLight,
    flatDark,
    variantPaths,
    flatVariantDark: flatDark.filter((t) => variantPaths.has(t.path)),
    /** Every resolved value per scheme, keyed by dotted path. */
    themeValues: {
      light: Object.fromEntries([...flatBase, ...flatLight].map((t) => [t.path, t.value])),
      dark: Object.fromEntries([...flatBase, ...flatDark].map((t) => [t.path, t.value])),
    },
  };
}
