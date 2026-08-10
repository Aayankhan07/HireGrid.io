#!/usr/bin/env node
/**
 * Fails on accessibility and correctness lint rules.
 *
 * `eslint src` also reports ~45 unrelated pre-existing errors (no-explicit-any,
 * unescaped entities, and similar). Gating CI on the whole run would bury the
 * signal in noise that predates this work, so this filters to the rules that
 * indicate a real defect.
 *
 * `rules-of-hooks` is in this list because it is not a style rule: a hook after
 * a conditional return changes the hook count between renders and crashes the
 * component at runtime. An a11y-only filter let exactly that ship — the drawer
 * threw "Rendered more hooks than during the previous render" while CI was
 * green.
 *
 * Delete this and gate on `npm run lint` once the rest of the lint debt is paid.
 *
 * Usage:  node scripts/check-a11y.mjs
 * Exit:   0 clean, 1 violations found
 */

/**
 * Rule prefixes that indicate a defect rather than a style preference.
 *
 * Deliberately excluded: `react-hooks/set-state-in-effect`. It has three
 * pre-existing hits (AuthContext, dashboard, CandidateDrawer) that are
 * behaviourally fine — they hydrate state from storage or props — and gating on
 * it today would fail CI on unrelated debt. Add it once those are refactored.
 */
const GATED_RULES = [
  "jsx-a11y/",
  "react-hooks/rules-of-hooks",
  "no-undef",
  "no-dupe-keys",
  "no-unreachable",
];

import { execSync } from "node:child_process";

let raw;
try {
  // shell:true via execSync — spawning npx.cmd directly throws EINVAL on
  // Windows under Node's child_process.
  raw = execSync("npx eslint src -f json", {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (err) {
  // ESLint exits non-zero when it reports any error, including the pre-existing
  // ones we filter out. Its JSON still lands on stdout.
  raw = err.stdout ?? "";
  if (!raw.trim()) {
    console.error("check-a11y: eslint produced no output");
    console.error(err.stderr ?? err.message);
    process.exit(1);
  }
}

let results;
try {
  results = JSON.parse(raw);
} catch {
  console.error("check-a11y: could not parse eslint JSON output");
  process.exit(1);
}

const findings = [];
for (const file of results) {
  for (const msg of file.messages) {
    const rule = String(msg.ruleId ?? "");
    if (!GATED_RULES.some((prefix) => rule.startsWith(prefix))) continue;
    findings.push({
      file: file.filePath.split(/[\\/]/).slice(-1)[0],
      line: msg.line,
      rule: msg.ruleId,
      message: msg.message,
    });
  }
}

if (findings.length === 0) {
  console.log("check-a11y: no accessibility or correctness violations");
  process.exit(0);
}

console.error(`check-a11y: ${findings.length} violation(s)\n`);
for (const f of findings) {
  console.error(`  ${f.file}:${f.line}  [${f.rule}]`);
  console.error(`      ${f.message}`);
}
process.exit(1);
