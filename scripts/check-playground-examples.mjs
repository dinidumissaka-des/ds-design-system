#!/usr/bin/env node
// The playground's example demos are looked up by the contract's own `case`
// string: `EXAMPLES[contract.name]?.[item.case]`. So a key that does not match
// a real case is unreachable — and it fails SILENTLY, rendering "No live
// specimen for this case." on a card that looks otherwise finished. Nothing
// else catches it: the keys are plain strings, so `tsc` is happy, and the page
// still builds and renders.
//
// That is the same class of drift the contract cross-check exists for — two
// halves that must agree, with only one of them checked — so it gets the same
// treatment: the build fails.
//
// Renaming a usage case in a manifest is what usually breaks this, and the
// break is in a different file from the edit, which is exactly when a silent
// failure survives review.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = "apps/playground/src/component-page.tsx";

const contracts = JSON.parse(
  await readFile(path.join(repoRoot, "docs/components/contracts.json"), "utf8")
);
const casesByName = new Map(
  contracts.map((c) => [c.name, new Set((c.usage ?? []).map((u) => u.case))])
);

const source = await readFile(path.join(repoRoot, SOURCE), "utf8");

/** The `{ … }` starting at `start`, balanced. Strings here contain no braces. */
function braceBlock(text, start) {
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error(`Unbalanced braces from index ${start} in ${SOURCE}`);
}

/** Top-level component keys of a `const <name> = { … }` map, with their bodies. */
function componentMap(name) {
  const declared = source.indexOf(`const ${name}`);
  if (declared === -1) throw new Error(`Could not find \`const ${name}\` in ${SOURCE}`);
  // Anchored on the assignment rather than the name, because the type
  // annotation in between contains `=>` — matching "up to the first =" stops
  // inside `() => ReactNode` and finds nothing.
  const assignment = /=\s*\{/.exec(source.slice(declared));
  if (assignment === null) throw new Error(`\`const ${name}\` is not an object literal`);
  const block = braceBlock(source, declared + assignment.index + assignment[0].length - 1);

  const found = new Map();
  // Two-space indent is the map's own nesting level, which is what
  // distinguishes a component key from a case key four spaces in.
  const entry = /\n {2}(?:"([^"]+)"|([A-Za-z0-9_$-]+)):\s*\{/g;
  let match;
  while ((match = entry.exec(block)) !== null) {
    const component = match[1] ?? match[2];
    found.set(component, braceBlock(block, entry.lastIndex - 1));
  }
  return found;
}

const problems = [];

for (const [component, body] of componentMap("EXAMPLES")) {
  const cases = casesByName.get(component);
  if (cases === undefined) {
    problems.push(`EXAMPLES has "${component}", which is not a component in the registry`);
    continue;
  }
  for (const [, key] of body.matchAll(/\n {4}"([^"]+)":/g)) {
    if (!cases.has(key)) {
      problems.push(
        `EXAMPLES["${component}"]["${key}"] matches no usage case, so the card ` +
          `renders "No live specimen for this case."\n      ${component} has: ` +
          [...cases].map((c) => `"${c}"`).join(", ")
      );
    }
  }
}

for (const [component] of componentMap("INTERACTIVE")) {
  if (!casesByName.has(component)) {
    problems.push(`INTERACTIVE has "${component}", which is not a component in the registry`);
  }
}

if (problems.length) {
  console.error(`✖ ${SOURCE} disagrees with the contracts:\n`);
  for (const problem of problems) console.error(`  - ${problem}\n`);
  console.error("Match the key to the contract's `case` string, or remove the entry.");
  process.exit(1);
}

console.log("playground demos match the contracts — every example key resolves to a usage case.");
