#!/usr/bin/env node
// ds CLI — v0: resolves components from the local monorepo registry.
// Later: fetch manifests over HTTPS from the hosted registry, with license
// auth (`ds login`) gating pro-tier components.
import { mkdir, readFile, writeFile, readdir, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const registryDir = path.join(repoRoot, "registry/components");

async function loadRegistry() {
  const entries = {};
  for (const file of await readdir(registryDir)) {
    if (!file.endsWith(".json")) continue;
    const manifest = JSON.parse(await readFile(path.join(registryDir, file), "utf8"));
    entries[manifest.name] = manifest;
  }
  return entries;
}

function usage() {
  console.log(`ds — design system CLI

Usage:
  ds list                 List available components and their status
  ds add <name...>        Copy component source (and dependencies) into ./ds
    --dir <path>          Target directory (default: ./ds)
`);
}

async function list() {
  const registry = await loadRegistry();
  const rows = Object.values(registry).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of rows) {
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

const [, , command, ...rest] = process.argv;
const dirFlag = rest.indexOf("--dir");
const targetDir =
  dirFlag !== -1 ? path.resolve(rest[dirFlag + 1] ?? "ds") : path.resolve("ds");
const names = rest.filter((a, i) => a !== "--dir" && i !== dirFlag + 1);

if (command === "list") await list();
else if (command === "add" && names.length) await add(names, targetDir);
else usage();
