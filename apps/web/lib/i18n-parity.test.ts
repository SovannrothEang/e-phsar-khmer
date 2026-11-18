import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

type Json = Record<string, unknown>;

const read = (locale: string): Json =>
  JSON.parse(
    readFileSync(
      new URL(`../messages/${locale}.json`, import.meta.url),
      "utf8",
    ),
  ) as Json;

/** Flattens the message tree to `namespace.key` paths. */
function flatten(value: Json, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, entry] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      for (const [nestedKey, nestedValue] of flatten(entry as Json, path)) {
        out.set(nestedKey, nestedValue);
      }
    } else {
      assert.equal(typeof entry, "string", `${path} must be a string`);
      out.set(path, entry as string);
    }
  }
  return out;
}

/**
 * Top-level ICU arguments only. Nested plural/select branches (`{No unread
 * messages}`) are not arguments and must not be compared as keys.
 */
function icuArgs(message: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let capturing = false;
  let buffer = "";

  for (const char of message) {
    if (char === "{") {
      if (depth === 0) {
        capturing = true;
        buffer = "";
      }
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0 && capturing) {
        const match = buffer.match(/^\s*([A-Za-z_]\w*)/);
        if (match) args.push(match[1]);
        capturing = false;
      }
    } else if (capturing) {
      buffer += char;
    }
  }

  return args.sort();
}

const en = flatten(read("en"));
const km = flatten(read("km"));

describe("messages/en.json ↔ km.json", () => {
  it("has the same key set", () => {
    assert.deepEqual([...en.keys()].sort(), [...km.keys()].sort());
  });

  it("uses the same top-level ICU arguments for every key", () => {
    for (const [key, value] of en) {
      const other = km.get(key);
      if (other === undefined) continue; // the key-set test owns this case
      assert.deepEqual(icuArgs(other), icuArgs(value), key);
    }
  });

  it("has no empty strings", () => {
    for (const [locale, messages] of [
      ["en", en],
      ["km", km],
    ] as const) {
      for (const [key, value] of messages) {
        assert.notEqual(value.trim(), "", `${locale}:${key}`);
      }
    }
  });
});
