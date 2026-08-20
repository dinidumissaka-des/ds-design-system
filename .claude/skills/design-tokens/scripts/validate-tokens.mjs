#!/usr/bin/env node
/**
 * validate-tokens.mjs — checks the two-layer token contract.
 *
 * Usage: node validate-tokens.mjs <tokens-dir>
 *
 * Expects: <dir>/primitives.css, <dir>/semantic.css, <dir>/TOKENS.md
 *
 * Reports rather than fixes. Some findings are intentional (an orphan
 * primitive may be a scale step reserved by the generation rule), so the
 * call belongs to the person, not the script.
 */

import {readFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: node validate-tokens.mjs <tokens-dir>');
  process.exit(2);
}

const read = (name) => {
  const p = join(dir, name);
  if (!existsSync(p)) {
    console.error(`Missing: ${p}`);
    process.exit(2);
  }
  return readFileSync(p, 'utf8');
};

const primitivesCss = read('primitives.css');
const semanticCss = read('semantic.css');
const tokensMd = read('TOKENS.md');

// Strip comments so commented-out examples don't produce findings.
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const DECL = /(--[\w-]+)\s*:\s*([^;]+);/g;

const declarations = (css) => {
  const out = [];
  for (const m of strip(css).matchAll(DECL)) {
    out.push({name: m[1], value: m[2].trim()});
  }
  return out;
};

const primitives = declarations(primitivesCss);
const semantics = declarations(semanticCss);

const primitiveNames = new Set(primitives.map((d) => d.name));
const semanticNames = new Set(semantics.map((d) => d.name));

const findings = {error: [], warn: [], info: []};
const add = (level, msg) => findings[level].push(msg);

// --- 1. Primitives must not reference anything -------------------------
for (const {name, value} of primitives) {
  if (value.includes('var(')) {
    add('error', `${name} in primitives.css uses var() — primitives must be raw literals.`);
  }
}

// --- 2. Semantics must resolve to var(--primitive) ---------------------
// A semantic whose whole value is a literal will not retheme, and reads
// identically in source to one that will. That's the silent failure.
const LITERAL = /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\(|oklab\(|-?\d*\.?\d+(px|rem|em|%|ms|s|ch|vh|vw)?$)/i;

for (const {name, value} of semantics) {
  if (value.includes('var(')) continue;
  if (value === 'inherit' || value === 'currentColor' || value === 'transparent' || value === '0') continue;
  if (LITERAL.test(value)) {
    add('error', `${name} in semantic.css is a raw value (${value}) — point it at a primitive.`);
  }
}

// --- 3. Every var() must resolve --------------------------------------
const VARREF = /var\(\s*(--[\w-]+)/g;
const allDefined = new Set([...primitiveNames, ...semanticNames]);

for (const {name, value} of semantics) {
  for (const m of value.matchAll(VARREF)) {
    const ref = m[1];
    if (!allDefined.has(ref)) {
      add('error', `${name} references ${ref}, which is not defined in either file.`);
    } else if (semanticNames.has(ref) && !primitiveNames.has(ref)) {
      add('warn', `${name} references another semantic (${ref}). Chained semantics make retheming ambiguous — point at a primitive.`);
    }
  }
}

// --- 4. Every semantic must be documented -----------------------------
const FIELDS = ['Purpose', 'Use when', "Don't use for", 'Pairs with'];

for (const name of semanticNames) {
  const idx = tokensMd.indexOf(name);
  if (idx === -1) {
    add('error', `${name} is not documented in TOKENS.md.`);
    continue;
  }
  // Look at the block following the first mention.
  const block = tokensMd.slice(idx, idx + 900);
  const missing = FIELDS.filter((f) => !block.includes(f));
  if (missing.length) {
    add('warn', `${name} is missing description field(s): ${missing.join(', ')}.`);
  }
}

// --- 5. Orphan primitives ---------------------------------------------
// Informational only: a reserved scale step is a legitimate orphan.
const referenced = new Set();
for (const {value} of semantics) {
  for (const m of value.matchAll(VARREF)) referenced.add(m[1]);
}
const orphans = [...primitiveNames].filter((n) => !referenced.has(n));
if (orphans.length) {
  add('info', `${orphans.length} primitive(s) unused by any semantic: ${orphans.slice(0, 12).join(', ')}${orphans.length > 12 ? ', …' : ''}`);
}

// --- Report ------------------------------------------------------------
const label = {error: 'ERROR', warn: 'WARN ', info: 'INFO '};
let printed = 0;

for (const level of ['error', 'warn', 'info']) {
  for (const msg of findings[level]) {
    console.log(`${label[level]}  ${msg}`);
    printed++;
  }
}

console.log('');
console.log(`${primitives.length} primitives, ${semantics.length} semantics.`);
console.log(`${findings.error.length} error(s), ${findings.warn.length} warning(s), ${findings.info.length} note(s).`);

if (!printed) console.log('Contract holds.');

process.exit(findings.error.length ? 1 : 0);
