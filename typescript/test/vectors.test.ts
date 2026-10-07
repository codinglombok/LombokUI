import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { call, LombokUIError } from "../src/index.js";
import { readRepo, same } from "./helpers.js";

interface Case {
  name: string;
  fn: string;
  args: unknown[];
  expect: { result?: unknown; error?: string };
}

const text = readRepo("vectors/lombokui-vectors-v1.json");
const doc = JSON.parse(text) as { groups: { name: string; cases: Case[] }[] };

test("vector hash is recorded in SPEC", () => {
  const hash = createHash("sha256").update(text).digest("hex");
  assert.ok(readRepo("docs/SPEC_LombokUI_v0.1.0.md").includes(hash), `SPEC must contain ${hash}`);
});

test("vector file has at least 100 cases", () => {
  assert.ok(doc.groups.reduce((n, g) => n + g.cases.length, 0) >= 100);
});

for (const group of doc.groups) {
  test(`vectors: ${group.name}`, () => {
    const failures: string[] = [];
    for (const c of group.cases) {
      let got: { result?: unknown; error?: string };
      try {
        got = { result: call(c.fn, c.args) };
      } catch (e) {
        if (!(e instanceof LombokUIError)) throw e;
        got = { error: e.code };
      }
      if (!same(got, c.expect)) failures.push(`${c.name}\n  expect ${JSON.stringify(c.expect).slice(0, 300)}\n  got    ${JSON.stringify(got).slice(0, 300)}`);
    }
    assert.deepEqual(failures, []);
  });
}
