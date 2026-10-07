import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { CATALOGS, VERSION } from "../src/index.js";
import { readRepo, ROOT } from "./helpers.js";

const LIB = "LombokUI";
const version = readRepo("version.txt").trim();
const DOCS = ["changelog", "map", "structure_repo", "full_summary_project", "guide_how_to_use", "how_to_dist", "development_ide", "API", "Lang", "SPEC"];

test("doctor-lite: vector sha256 in SPEC and vectors/README", () => {
  const sha = createHash("sha256").update(readFileSync(join(ROOT, "vectors", "lombokui-vectors-v1.json"))).digest("hex");
  assert.ok(readRepo(`docs/SPEC_${LIB}_v${version}.md`).includes(sha), "SPEC hash");
  assert.ok(readRepo("vectors/README.md").includes(sha), "vectors/README hash");
});

test("doctor-lite: SPEC carries the mandatory normative sentence", () => {
  assert.ok(readRepo(`docs/SPEC_${LIB}_v${version}.md`).includes("This document is the normative cross-language contract. Every language port MUST produce byte-identical output for all specified inputs. Deviations from this specification are bugs."));
});

test("doctor-lite: versions agree and the 10 public documents exist", () => {
  assert.equal(JSON.parse(readRepo("typescript/package.json")).version, version);
  assert.equal(VERSION, version);
  assert.match(readRepo("python/pyproject.toml"), new RegExp(`^version = "${version.replace(/\./g, "\\.")}"`, "m"));
  assert.match(readRepo("python/src/lombokui/__init__.py"), new RegExp(`__version__ = "${version.replace(/\./g, "\\.")}"`));
  assert.match(readRepo("CHANGELOG.md"), new RegExp(`^## \\[${version.replace(/\./g, "\\.")}\\]`, "m"));
  for (const kind of DOCS) assert.ok(existsSync(join(ROOT, "docs", `${kind}_${LIB}_v${version}.md`)), kind);
});

test("doctor-lite: built-in catalogs equal locales/ and Lang_ lists every key", () => {
  const lang = readRepo(`docs/Lang_${LIB}_v${version}.md`);
  for (const [tag, cat] of Object.entries(CATALOGS)) {
    assert.deepEqual(JSON.parse(readRepo(`locales/${tag}/lombokui.json`)), cat, tag);
    for (const k of Object.keys(cat)) assert.ok(lang.includes(k), `Lang_ lists ${k}`);
  }
  assert.deepEqual(Object.keys(CATALOGS.id).sort(), Object.keys(CATALOGS.en).sort());
});

test("doctor-lite: licenses are real texts and match the SPDX expression", () => {
  for (const f of ["LICENSE-APACHE", "LICENSE-MIT", "python/LICENSE-APACHE", "python/LICENSE-MIT"]) assert.ok(readFileSync(join(ROOT, f)).length >= 1000, f);
  assert.equal(JSON.parse(readRepo("typescript/package.json")).license, "Apache-2.0 OR MIT");
  assert.match(readRepo("python/pyproject.toml"), /license = "Apache-2\.0 OR MIT"/);
});

test("doctor-lite (ADR-019): application names appear only in map_", () => {
  const files = ["README.md", "CHANGELOG.md", "SECURITY.md", "CONTRIBUTING.md", "vectors/README.md", "docs/TECH_DEBT.md", "python/README.md"];
  for (const d of DOCS) if (d !== "map") files.push(`docs/${d}_${LIB}_v${version}.md`);
  const apps = /Clarion|RAG[A-Za-z]*|DocFlow|LombokPDF|AgenticAuto|LombokMiner|DNSProxy/;
  for (const f of files) assert.ok(!apps.test(readRepo(f)), `application name in ${f}`);
});

test("doctor-lite (ADR-024): .gitignore lines and no internal documents tracked", () => {
  const g = readRepo(".gitignore").split("\n");
  for (const line of ["/map", "/docs/*architecture*.*", "/docs/*masterplan*.*"]) assert.ok(g.includes(line), line);
  let tracked: string;
  try {
    tracked = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" });
  } catch {
    return;
  }
  assert.ok(!/^docs\/[^/]*(architecture|masterplan)/im.test(tracked), tracked);
  assert.ok(!/^map\//m.test(tracked));
});

test("doctor-lite (style): every tracked text file is ASCII-only", () => {
  let tracked: string[];
  try {
    tracked = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter((f) => f !== "");
  } catch {
    return;
  }
  const text = /\.(md|ts|py|mjs|js|json|yml|yaml|toml|txt|sh)$|^\.git(ignore|attributes)$/;
  for (const f of tracked.filter((x) => text.test(x))) {
    const s = readFileSync(join(ROOT, f), "utf8");
    const m = /[^\x00-\x7f]/.exec(s);
    assert.equal(m, null, `${f}: non-ASCII character U+${m ? (m[0].codePointAt(0) as number).toString(16).toUpperCase() : ""}`);
  }
});
