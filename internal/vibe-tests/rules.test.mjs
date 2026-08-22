// Tests for the checker. A scoring tool that is wrong is worse than no tool:
// it makes bad code look fine, or teaches contributors to ignore it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTokenModel, evaluateSource, scoreCandidate } from "./rules.mjs";

const model = loadTokenModel();
const rules = (css) => evaluateSource(css, model).violations.map((v) => v.rule);
const find = (css, rule) => evaluateSource(css, model).violations.find((v) => v.rule === rule);

test("flags a palette token used in a component", () => {
  assert.ok(rules(".a { color: var(--ds-color-neutral-900); }").includes("palette-token"));
});

test("does not mistake a role token for a palette token", () => {
  // Regression: `color.warning` (palette) is a name prefix of
  // `color.warning-role.subtle` (semantic), so prefix matching flagged both.
  for (const token of [
    "--ds-color-warning-role-subtle",
    "--ds-color-warning-role-fg",
    "--ds-color-accent-role-bg",
    "--ds-color-danger-role-fg",
    "--ds-color-success-role-subtle",
  ]) {
    assert.ok(
      !rules(`.a { color: var(${token}); }`).includes("palette-token"),
      `${token} must not be treated as a palette token`
    );
  }
});

test("flags an unknown token separately from a palette one", () => {
  const r = rules(".a { color: var(--ds-color-does-not-exist); }");
  assert.ok(r.includes("unknown-token"));
  assert.ok(!r.includes("palette-token"));
});

test("a pairing that fails in every theme is an error", () => {
  const v = find(
    ".notice { background: var(--ds-color-warning-role-bg); color: var(--ds-color-fg-on-accent); }",
    "forbidden-pairing"
  );
  assert.ok(v, "expected the white-on-warning-fill pairing to be caught");
  assert.equal(v.severity, "error");
});

test("a pairing verified in one theme is a warning, not an error", () => {
  // The primary button is the sanctioned pattern; the dark theme's accent ramp
  // is the thing at fault, so this must not read as a component defect.
  const v = find(
    ".button { background: var(--ds-color-accent-role-bg); color: var(--ds-color-fg-on-accent); }",
    "forbidden-pairing"
  );
  assert.ok(v);
  assert.equal(v.severity, "warn");
});

test("accepts the documented success and warning notice recipe", () => {
  const css = `.n { background: var(--ds-color-success-role-subtle); color: var(--ds-color-success-role-fg); }`;
  assert.deepEqual(rules(css), []);
});

test("flags hardcoded colors, dimensions, weights, and motion", () => {
  assert.ok(rules(".a { color: #ff0000; }").includes("hardcoded-color"));
  assert.ok(rules(".a { padding: 16px; }").includes("hardcoded-dimension"));
  assert.ok(rules(".a { font-weight: 500; }").includes("hardcoded-font-weight"));
  assert.ok(rules(".a { transition: all 0.2s ease-in-out; }").includes("hardcoded-motion"));
});

test("allows font-relative sizing", () => {
  // Regression: the spinner is deliberately 1em so it scales with its container.
  assert.ok(!rules(".spinner { width: 1em; height: 1em; }").includes("hardcoded-dimension"));
});

test("accepts scale tokens in place of raw values", () => {
  const css = `.a {
    padding: var(--ds-space-4);
    font-weight: var(--ds-font-weight-medium);
    transition: opacity var(--ds-motion-duration-fast) var(--ds-motion-easing-standard);
  }`;
  assert.deepEqual(rules(css), []);
});

test("requires a focus ring on a focusable control", () => {
  assert.ok(rules(".btn { cursor: pointer; }").includes("missing-focus-ring"));
  const ok = `.btn { cursor: pointer; }
    .btn:focus-visible { outline: var(--ds-focus-ring-width) solid var(--ds-color-focus-ring); }`;
  assert.ok(!rules(ok).includes("missing-focus-ring"));
});

test("does not demand a focus ring from a non-focusable overlay primitive", () => {
  // Regression: .ds-state-layer has :hover/:active rules but is never focused.
  const stateLayer = `.ds-state-layer::after { opacity: 0; pointer-events: none; }
    .ds-state-layer:hover::after { opacity: var(--ds-state-hover-opacity); }
    .ds-state-layer:active::after { opacity: var(--ds-state-press-opacity); }`;
  assert.ok(!rules(stateLayer).includes("missing-focus-ring"));
});

test("flags a removed focus ring", () => {
  assert.ok(rules(".btn:focus { outline: none; }").includes("focus-removed"));
});

test("warns on hand-rolled hover and native disabled styling", () => {
  assert.ok(
    rules(".btn:hover { background: var(--ds-color-accent-role-bg-hover); }").includes("hand-rolled-hover")
  );
  assert.ok(rules(".btn:disabled { opacity: 0.5; }").includes("native-disabled-styling"));
  assert.ok(
    !rules('.btn[aria-disabled="true"] { opacity: var(--ds-state-disabled-opacity); }').includes(
      "native-disabled-styling"
    )
  );
});

test("ds-allow records a deliberate exception", () => {
  const css = `/* ds-allow: hardcoded-motion — the spin cycle has no token */
    .spinner { animation: spin 0.8s linear infinite; }`;
  assert.ok(!rules(css).includes("hardcoded-motion"));
});

test("scoring reports a missing required token", () => {
  const prompt = { id: "x", mustUse: ["color.warning-role.subtle"] };
  const bad = scoreCandidate(".n { color: var(--ds-color-fg-primary); }", prompt, model);
  assert.equal(bad.pass, false);
  assert.ok(bad.violations.some((v) => v.rule === "missing-required-token"));

  const good = scoreCandidate(
    ".n { background: var(--ds-color-warning-role-subtle); color: var(--ds-color-warning-role-fg); }",
    prompt,
    model
  );
  assert.equal(good.pass, true);
});
