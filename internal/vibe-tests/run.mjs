#!/usr/bin/env node
// Measures whether the token docs actually change what a coding agent writes.
//
//   node internal/vibe-tests/run.mjs tasks [--out <dir>]   scaffold a run for an agent to fill in
//   node internal/vibe-tests/run.mjs score --dir <dir>     score the candidates in a run
//   node internal/vibe-tests/run.mjs check <file...>       lint any file against the token rules
//   node internal/vibe-tests/run.mjs fixtures              score the committed A/B fixtures
//
// Generation is deliberately not automated here: point whichever agent you are
// evaluating at the task files, with and without the docs in context, and score
// both arms. See README.md.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadTokenModel, scoreCandidate, evaluateSource } from "./rules.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const { prompts } = JSON.parse(readFileSync(path.join(here, "prompts.json"), "utf8"));
const byId = new Map(prompts.map((p) => [p.id, p]));

const args = process.argv.slice(2);
const command = args[0] ?? "fixtures";
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};

const rel = (p) => path.relative(repoRoot, p) || ".";

function writeTasks(outDir) {
  mkdirSync(path.join(outDir, "candidates"), { recursive: true });
  for (const p of prompts) {
    writeFileSync(
      path.join(outDir, `${p.id}.task.md`),
      `# ${p.id}\n\n${p.prompt}\n\nWrite the CSS only. Save it as \`candidates/${p.id}.css\`.\n`
    );
  }
  writeFileSync(
    path.join(outDir, "README.md"),
    `Answer each *.task.md into candidates/<id>.css, then:\n\n    node internal/vibe-tests/run.mjs score --dir ${rel(outDir)}\n`
  );
  console.log(`Wrote ${prompts.length} tasks to ${rel(outDir)}`);
  console.log(`Answer them into ${rel(path.join(outDir, "candidates"))}, then score the run.`);
}

const BAR_WIDTH = 24;
function bar(pass, total) {
  const filled = total === 0 ? 0 : Math.round((pass / total) * BAR_WIDTH);
  return `${"█".repeat(filled)}${"░".repeat(BAR_WIDTH - filled)}`;
}

function scoreDir(dir, model, { label } = {}) {
  const candidateDir = existsSync(path.join(dir, "candidates")) ? path.join(dir, "candidates") : dir;
  if (!existsSync(candidateDir)) throw new Error(`No such directory: ${rel(candidateDir)}`);
  const files = readdirSync(candidateDir).filter((f) => /\.(css|tsx|jsx|ts)$/.test(f));
  if (files.length === 0) throw new Error(`No candidate files in ${rel(candidateDir)}`);

  const results = [];
  for (const file of files) {
    const id = file.replace(/\.[^.]+$/, "");
    const prompt = byId.get(id) ?? { id, mustUse: [] };
    const source = readFileSync(path.join(candidateDir, file), "utf8");
    results.push(scoreCandidate(source, prompt, model, { filename: file }));
  }
  results.sort((a, b) => a.id.localeCompare(b.id));

  const passed = results.filter((r) => r.pass).length;
  const totalErrors = results.reduce((n, r) => n + r.errors, 0);
  const totalWarnings = results.reduce((n, r) => n + r.warnings, 0);

  return { label, results, passed, total: results.length, totalErrors, totalWarnings };
}

function printRun(run, { verbose = true } = {}) {
  if (run.label) console.log(`\n${run.label}`);
  console.log(`${bar(run.passed, run.total)}  ${run.passed}/${run.total} clean` +
    `  ·  ${run.totalErrors} error${run.totalErrors === 1 ? "" : "s"}` +
    `  ·  ${run.totalWarnings} warning${run.totalWarnings === 1 ? "" : "s"}\n`);
  for (const r of run.results) {
    const mark = r.pass ? "✓" : "✗";
    console.log(`  ${mark} ${r.id.padEnd(20)} ${r.errors} error(s), ${r.warnings} warning(s)`);
    if (verbose) {
      for (const v of r.violations) {
        console.log(`      ${v.severity === "error" ? "!" : "·"} [${v.rule}] ${v.message}`);
      }
    }
  }
}

/** Which rules fired, so a regression names the guidance that stopped working. */
function ruleBreakdown(run) {
  const counts = new Map();
  for (const r of run.results) {
    for (const v of r.violations) counts.set(v.rule, (counts.get(v.rule) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

// Operator errors (an empty run, a missing build) should read as a sentence,
// not a stack trace.
function fail(message) {
  console.error(message);
  process.exit(2);
}

let model;
try {
  model = loadTokenModel();
} catch (error) {
  fail(error.message);
}

try {
  main();
} catch (error) {
  fail(error.message);
}

function main() {
if (command === "tasks") {
  writeTasks(path.resolve(repoRoot, flag("out", `internal/vibe-tests/runs/${Date.now()}`)));
} else if (command === "score") {
  const dir = flag("dir");
  if (!dir) {
    console.error("Usage: run.mjs score --dir <dir>");
    process.exit(2);
  }
  const run = scoreDir(path.resolve(repoRoot, dir), model, { label: rel(path.resolve(repoRoot, dir)) });
  printRun(run);
  console.log("");
  for (const [rule, n] of ruleBreakdown(run)) console.log(`  ${String(n).padStart(3)}  ${rule}`);
  process.exit(run.totalErrors === 0 ? 0 : 1);
} else if (command === "check") {
  const files = args.slice(1).filter((a) => !a.startsWith("--"));
  if (files.length === 0) {
    console.error("Usage: run.mjs check <file...>");
    process.exit(2);
  }
  let errors = 0;
  for (const file of files) {
    const source = readFileSync(path.resolve(repoRoot, file), "utf8");
    const { violations } = evaluateSource(source, model, { filename: file });
    if (violations.length === 0) {
      console.log(`✓ ${file}`);
      continue;
    }
    console.log(`✗ ${file}`);
    for (const v of violations) {
      if (v.severity === "error") errors++;
      console.log(`    ${v.severity === "error" ? "!" : "·"} ${file}:${v.line} [${v.rule}] ${v.message}`);
    }
  }
  process.exit(errors === 0 ? 0 : 1);
} else if (command === "fixtures") {
  // The A/B the harness exists to run: the same prompts answered the way a model
  // answers them without the docs, and the way the docs say to answer them.
  const withoutDocs = scoreDir(path.join(here, "fixtures/no-docs"), model, { label: "Without the token docs" });
  const withDocs = scoreDir(path.join(here, "fixtures/with-docs"), model, { label: "Following the token docs" });

  printRun(withoutDocs, { verbose: false });
  printRun(withDocs, { verbose: false });

  console.log("\nRules that fired without the docs:\n");
  for (const [rule, n] of ruleBreakdown(withoutDocs)) console.log(`  ${String(n).padStart(3)}  ${rule}`);

  const delta = withDocs.passed - withoutDocs.passed;
  console.log(
    `\n${withoutDocs.passed}/${withoutDocs.total} → ${withDocs.passed}/${withDocs.total} clean ` +
      `(${delta >= 0 ? "+" : ""}${delta}), ${withoutDocs.totalErrors} → ${withDocs.totalErrors} errors.`
  );

  // The fixtures are a self-test of the checker: if the documented answers stop
  // scoring clean, or the naive ones stop being caught, the checker is wrong.
  const ok = withDocs.totalErrors === 0 && withoutDocs.totalErrors > 0;
  if (!ok) {
    console.error(
      "\nFixture self-test FAILED: the documented answers must score clean and the naive ones must not."
    );
    process.exit(1);
  }
  console.log("Fixture self-test passed: the checker separates the two arms.");
} else {
  fail(`Unknown command "${command}". Try: tasks | score | check | fixtures`);
}
}
