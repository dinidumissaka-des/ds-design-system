// Shared logic behind `ds` (bin/ds.mjs) and the root ui-context generator
// (scripts/generate-ui-context.mjs). Kept here, once, so the CLI an agent
// runs interactively and the file an agent reads passively can never say two
// different things about the same component.
//
// Everything below reads straight from source (registry manifests, @ds/react
// .tsx files, @ds/tokens' build output) rather than a hand-maintained
// description. If it's wrong, the source is wrong — not a doc that drifted.
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, "../../..");
const registryDir = path.join(repoRoot, "registry/components");

export async function loadRegistry() {
  const entries = {};
  for (const file of await readdir(registryDir)) {
    if (!file.endsWith(".json")) continue;
    const manifest = JSON.parse(await readFile(path.join(registryDir, file), "utf8"));
    entries[manifest.name] = manifest;
  }
  return entries;
}

export function sortedEntries(registry) {
  return Object.values(registry).sort((a, b) => a.name.localeCompare(b.name));
}

function toPascalCase(kebab) {
  return kebab
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

function findMatchingBrace(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// Parses `export interface <interfaceName> [extends ...] { ... }` — every
// prop the component actually declares, plus its leading `/** doc */` if any.
// Deliberately line-based rather than a full TS parse: the props interfaces
// in this repo are flat and single-line-per-field, and staying dependency-free
// matches every other build script in this monorepo.
function parsePropsInterface(source, interfaceName) {
  const header = source.match(new RegExp(`export interface ${interfaceName}\\b([^{]*)\\{`));
  if (!header) return null;
  const openIndex = header.index + header[0].length - 1;
  const closeIndex = findMatchingBrace(source, openIndex);
  const body = source.slice(openIndex + 1, closeIndex);
  const extendsMatch = header[1].match(/extends\s+([^\n{]+)/);

  const props = [];
  let pendingDoc = null;
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("/**")) {
      pendingDoc = line.replace(/^\/\*\*|\*\/$/g, "").trim();
      continue;
    }
    if (line.startsWith("*") || line.startsWith("//")) continue;
    const propMatch = line.match(/^(\w+)(\?)?:\s*(.+?);?$/);
    if (propMatch) {
      props.push({
        name: propMatch[1],
        optional: Boolean(propMatch[2]),
        type: propMatch[3],
        description: pendingDoc,
      });
      pendingDoc = null;
    }
  }
  return { extends: extendsMatch ? extendsMatch[1].trim() : null, props };
}

// Defaults live in the destructured parameter list of the component function
// itself, e.g. `variant = "primary"` — not in the interface, so they need a
// second pass over the function signature.
function parseDefaults(source, componentName) {
  const fnMatch = source.match(new RegExp(`function ${componentName}\\s*\\(\\s*\\{`));
  if (!fnMatch) return {};
  const openIndex = source.indexOf("{", fnMatch.index);
  const closeIndex = findMatchingBrace(source, openIndex);
  const body = source.slice(openIndex + 1, closeIndex);
  const defaults = {};
  for (const match of body.matchAll(/(\w+)\s*=\s*("(?:[^"\\]|\\.)*"|[^,\n]+)/g)) {
    defaults[match[1]] = match[2].trim();
  }
  return defaults;
}

async function walkFiles(dir, exts, out = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walkFiles(full, exts, out);
    else if (exts.some((ext) => entry.name.endsWith(ext))) out.push(full);
  }
  return out;
}

// Best-effort JSX usage extraction: real snippets from the repo, never
// synthesized. Handles the common cases (self-closing, single same-tag pair);
// it is not a JSX parser, so a deeply nested same-tag usage can over-match.
function extractTagUsages(source, tagName) {
  const usages = [];
  const selfClosing = new RegExp(`<${tagName}(?:\\s[^>]*)?/>`, "g");
  const container = new RegExp(`<${tagName}(?:\\s[^>]*)?>[\\s\\S]*?</${tagName}>`, "g");
  for (const re of [selfClosing, container]) {
    let match;
    while ((match = re.exec(source))) usages.push(match[0]);
  }
  return usages;
}

// Ranks by "cleanest" — fewest interpolations, then shortest — so a loop
// variable like `{variant}` loses to a literal, real usage.
export async function getExamples(tagName, limit = 1) {
  const files = await walkFiles(path.join(repoRoot, "apps"), [".tsx", ".jsx"]);
  const usages = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    usages.push(...extractTagUsages(source, tagName));
  }
  usages.sort(
    (a, b) => (a.match(/\{/g)?.length ?? 0) - (b.match(/\{/g)?.length ?? 0) || a.length - b.length
  );
  return usages.slice(0, limit);
}

export async function getComponentProps(name, registry) {
  const entry = registry[name];
  if (!entry) return { error: `Unknown component: "${name}". Run \`ds list\` — don't guess.` };

  const reactFile = entry.files?.find((f) => f.source.startsWith("packages/react/src/"));
  if (!reactFile) {
    const state = entry.status?.react?.state ?? "tbd";
    return {
      name,
      title: entry.title,
      implemented: false,
      note:
        state === "na"
          ? `No standalone React component — "${entry.title}" is CSS-only (see registry description), composed onto other components' className.`
          : `No React implementation yet (status: ${state}). There is nothing to look up — don't invent props for this one.`,
    };
  }

  const source = await readFile(path.join(repoRoot, reactFile.source), "utf8");
  const pascal = toPascalCase(name);
  const parsed = parsePropsInterface(source, `${pascal}Props`);
  const defaults = parseDefaults(source, pascal);
  const props = (parsed?.props ?? []).map((prop) => ({
    ...prop,
    default: defaults[prop.name],
  }));
  const [example] = await getExamples(pascal, 1);

  return {
    name,
    title: entry.title,
    importPath: "@ds/react",
    implemented: true,
    extends: parsed?.extends ?? null,
    props,
    example: example ?? null,
  };
}

// Flat resolved token map, e.g. { "color-accent-500": "#3b82f6", "space-4": "16px" }.
// Reads @ds/tokens' own build output rather than re-resolving base+theme JSON
// a second time — one resolver (packages/tokens/build.mjs), two readers.
export async function getTokens() {
  const distPath = path.join(repoRoot, "packages/tokens/dist/index.js");
  let mod;
  try {
    mod = await import(pathToFileURL(distPath).href);
  } catch {
    return null; // not built yet
  }
  const flatten = (node, prefix = []) => {
    const out = {};
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === "string") out[[...prefix, key].join("-")] = value;
      else Object.assign(out, flatten(value, [...prefix, key]));
    }
    return out;
  };
  return flatten(mod.tokens);
}

const LANDMARKS = ["header", "nav", "main", "aside", "footer"];

function describeShell(source) {
  const present = LANDMARKS.filter((tag) => new RegExp(`<${tag}[\\s>]`).test(source));
  const sectionCount = (source.match(/<section[\s>]/g) ?? []).length;
  const parts = [...present];
  if (sectionCount) parts.push(`section×${sectionCount}`);
  return parts.length ? parts.join(" → ") : "no structural landmarks detected";
}

// Existing page shells, for the "find the precedent" step of the pre-write
// ritual — one entry per app entry-point found under apps/*/src.
export async function getPages() {
  const appsDir = path.join(repoRoot, "apps");
  let appDirs;
  try {
    appDirs = await readdir(appsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const pages = [];
  for (const dirent of appDirs) {
    if (!dirent.isDirectory()) continue;
    const files = await walkFiles(path.join(appsDir, dirent.name, "src"), [".tsx", ".jsx"]);
    for (const file of files) {
      const source = await readFile(file, "utf8");
      if (!/export function App\b|export default function/.test(source)) continue;
      pages.push({ path: path.relative(repoRoot, file), shell: describeShell(source) });
    }
  }
  return pages;
}
