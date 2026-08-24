#!/usr/bin/env node
// ds CLI — v0: resolves components from the local monorepo registry.
// Later: fetch manifests over HTTPS from the hosted registry, with license
// auth (`ds login`) gating pro-tier components.
//
// `list` / `add` are the copy-paste distribution tool for consumer repos.
// `props` / `tokens` / `pages` are the agent-lookup surface described in
// agent-workflow.md's Layer 1 — the thing that makes checking cheaper than
// guessing, aliased at the repo root as `npm run ui -- <subcommand>`.
import { mkdir, readFile, copyFile } from "node:fs/promises";
import path from "node:path";
import {
  repoRoot,
  loadRegistry,
  sortedEntries,
  getComponentProps,
  getTokens,
  getPages,
  getExamples,
} from "../lib/index.mjs";

function usage() {
  console.log(`ds — design system CLI

Distribution:
  ds list                 List every component and its status
  ds add <name...>        Copy component source (and dependencies) into ./ds
    --dir <path>          Target directory (default: ./ds)

Agent lookup (also \`npm run ui -- <subcommand>\` from the repo root):
  ds props <name>          Props for one component, read straight from source
    --example              Include a real usage snippet from apps/
  ds tokens [filter]        Flat --ds-* token reference; filter is a substring match
  ds pages                  Page shells already in this repo (find the precedent)

  --dense                  Compact, token-efficient output for any of the above
`);
}

async function list(dense) {
  const registry = await loadRegistry();
  for (const entry of sortedEntries(registry)) {
    if (dense) {
      console.log(entry.name);
      continue;
    }
    const css = entry.status?.css?.state ?? "tbd";
    const react = entry.status?.react?.state ?? "tbd";
    console.log(
      `${entry.name.padEnd(16)} ${entry.family.padEnd(12)} css:${css.padEnd(12)} react:${react.padEnd(12)} [${entry.tier ?? "free"}]`
    );
  }
}

async function add(names, targetDir) {
  const registry = await loadRegistry();

  // Resolve transitive dependencies, depth-first, deduped.
  const queue = [...names];
  const resolved = new Set();
  while (queue.length) {
    const name = queue.shift();
    if (resolved.has(name)) continue;
    const entry = registry[name];
    if (!entry) {
      console.error(`Unknown component: ${name}`);
      process.exitCode = 1;
      return;
    }
    resolved.add(name);
    queue.push(...(entry.dependencies ?? []));
  }

  let copied = 0;
  for (const name of resolved) {
    const entry = registry[name];
    if (!entry.files?.length) {
      console.warn(`- ${name}: no files yet (status: ${entry.status?.react?.state ?? "tbd"}), skipped`);
      continue;
    }
    for (const file of entry.files) {
      const from = path.join(repoRoot, file.source);
      const to = path.join(targetDir, file.target);
      await mkdir(path.dirname(to), { recursive: true });
      await copyFile(from, to);
      console.log(`+ ${path.relative(process.cwd(), to)}`);
      copied++;
    }
  }
  console.log(`\nAdded ${resolved.size} component(s), ${copied} file(s).`);
  console.log(`Remember to import @ds/tokens/css (or copy tokens.css) once at your app root.`);
}

async function props(name, { dense, example }) {
  if (!name) {
    console.error("Usage: ds props <name> [--example]");
    process.exitCode = 1;
    return;
  }
  const registry = await loadRegistry();
  const result = await getComponentProps(name, registry);

  if (result.error) {
    console.error(result.error);
    process.exitCode = 1;
    return;
  }
  if (!result.implemented) {
    console.log(dense ? `${name}: ${result.note}` : `${result.title ?? name}\n\n${result.note}`);
    return;
  }

  if (dense) {
    for (const prop of result.props) {
      const def = prop.default !== undefined ? ` = ${prop.default}` : "";
      console.log(`${prop.name}${prop.optional ? "?" : ""}: ${prop.type}${def}`);
    }
    if (example && result.example) console.log(result.example);
    return;
  }

  console.log(`${result.title} (${result.importPath})`);
  if (result.extends) console.log(`extends: ${result.extends}`);
  console.log("");
  for (const prop of result.props) {
    const def = prop.default !== undefined ? `  default: ${prop.default}` : "";
    console.log(`  ${prop.name}${prop.optional ? "?" : ""}: ${prop.type}${def}`);
    if (prop.description) console.log(`    — ${prop.description}`);
  }
  if (example) {
    console.log(`\nExample (real usage, from apps/):`);
    console.log(result.example ? `  ${result.example.split("\n").join("\n  ")}` : "  (none found in apps/)");
  }
}

async function tokensCmd(filter, dense) {
  const tokens = await getTokens();
  if (!tokens) {
    console.error("Tokens haven't been built yet — run `npm run build -w @ds/tokens` (or `npm run build`) first.");
    process.exitCode = 1;
    return;
  }
  const keys = Object.keys(tokens)
    .filter((key) => !filter || key.includes(filter))
    .sort();
  for (const key of keys) {
    console.log(dense ? `--ds-${key}` : `--ds-${key}: ${tokens[key]}`);
  }
}

async function pagesCmd(dense) {
  const pages = await getPages();
  if (!pages.length) {
    console.log("No page entry-points found under apps/*/src.");
    return;
  }
  for (const page of pages) {
    console.log(dense ? page.path : `${page.path}\n  shell: ${page.shell}`);
  }
}

const [, , command, ...rest] = process.argv;
const dense = rest.includes("--dense");
const example = rest.includes("--example");
const dirFlag = rest.indexOf("--dir");
const targetDir =
  dirFlag !== -1 ? path.resolve(rest[dirFlag + 1] ?? "ds") : path.resolve("ds");
const positional = rest.filter(
  (arg, i) => !arg.startsWith("--") && (dirFlag === -1 || i !== dirFlag + 1)
);

if (command === "list") await list(dense);
else if (command === "add" && positional.length) await add(positional, targetDir);
else if (command === "props") await props(positional[0], { dense, example });
else if (command === "tokens") await tokensCmd(positional[0], dense);
else if (command === "pages") await pagesCmd(dense);
else usage();
