#!/usr/bin/env node
/**
 * Helper for the hand-written Khmer category names in `categories.km.tsv`.
 *
 *   node edit-translate/apply-km.mjs --init    generate the TSV skeleton from the seed
 *   node edit-translate/apply-km.mjs --check   validate the filled TSV (writes nothing)
 *   node edit-translate/apply-km.mjs --apply   merge the km values into the seed
 *
 * The TSV is the captain's hand-edited file: columns are slug, parent, en, km.
 * `parent` is empty for the 12 categories and the category slug for subcategories.
 * Only the km column should be edited; the other three are generated from the seed.
 *
 * `--apply` anchors every write to a detected entity slug and rewrites only that
 * entity's `name` object, so the ~1,600 field-schema `label` objects are untouched.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SEED = path.join(
  ROOT,
  "apps/backend/src/categories/seeds/categories.seed.ts",
);
const TSV = path.join(HERE, "categories.km.tsv");

const HEADER = "slug\tparent\ten\tkm";
const EXPECTED_CATEGORIES = 12;
const EXPECTED_SUBCATEGORIES = 146;
const NAME_MAX = 200;

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

function decodeLiteral(token) {
  const quote = token[0];
  const body = token.slice(1, -1);
  return body.replace(/\\(.)/g, (_, ch) => {
    if (ch === "n") return "\n";
    if (ch === "t") return "\t";
    if (ch === "r") return "\r";
    if (ch === quote || ch === "\\") return ch;
    return ch;
  });
}

function encodeSingleQuoted(value) {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

/** Locate the `name: { ... }` object that follows a slug line. */
function parseNameObject(lines, start, indent) {
  const line = lines[start];
  const open = new RegExp(`^${indent}name: \\{`).exec(line);
  if (!open) {
    return null;
  }

  let end = start;
  if (!line.includes("}", line.indexOf("{"))) {
    const close = new RegExp(`^${indent}\\},?\\s*$`);
    end = -1;
    for (let i = start + 1; i < lines.length; i++) {
      if (close.test(lines[i])) {
        end = i;
        break;
      }
    }
    if (end === -1) {
      return null;
    }
  }

  const block = lines.slice(start, end + 1).join("\n");
  const en = /\ben:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/.exec(block);
  if (!en) {
    return null;
  }
  const km = /\bkm:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/.exec(block);

  return {
    start,
    end,
    indent,
    enToken: en[1],
    en: decodeLiteral(en[1]),
    km: km ? decodeLiteral(km[1]) : null,
  };
}

function parseSeed(source) {
  const lines = source.split("\n");
  const entities = [];
  let category = null;

  for (let i = 0; i < lines.length; i++) {
    const cat = /^ {4}slug: (?:"([^"]+)"|'([^']+)'),$/.exec(lines[i]);
    if (cat) {
      const slug = cat[1] ?? cat[2];
      const name = parseNameObject(lines, i + 1, "    ");
      if (!name) fail(`cannot parse the name object after category "${slug}" (line ${i + 1})`);
      category = slug;
      entities.push({
        type: "category",
        parent: "",
        slug,
        ...name,
      });
      continue;
    }

    const sub = /^ {8}slug: (?:"([^"]+)"|'([^']+)'),$/.exec(lines[i]);
    if (sub) {
      const slug = sub[1] ?? sub[2];
      if (!category) fail(`subcategory "${slug}" has no parent category (line ${i + 1})`);
      const name = parseNameObject(lines, i + 1, "        ");
      if (!name) fail(`cannot parse the name object after subcategory "${slug}" (line ${i + 1})`);
      entities.push({
        type: "subcategory",
        parent: category,
        slug,
        ...name,
      });
    }
  }

  return { lines, entities };
}

function readSeed() {
  let source;
  try {
    source = fs.readFileSync(SEED, "utf8");
  } catch {
    fail(`cannot read the seed at ${SEED}`);
  }
  const parsed = parseSeed(source);
  const categories = parsed.entities.filter((e) => e.type === "category");
  const subcategories = parsed.entities.filter((e) => e.type === "subcategory");
  if (categories.length !== EXPECTED_CATEGORIES) {
    fail(`expected ${EXPECTED_CATEGORIES} categories, found ${categories.length}`);
  }
  if (subcategories.length !== EXPECTED_SUBCATEGORIES) {
    fail(`expected ${EXPECTED_SUBCATEGORIES} subcategories, found ${subcategories.length}`);
  }
  return { ...parsed, source, categories, subcategories };
}

function writeSkeleton(seed) {
  if (fs.existsSync(TSV)) {
    fail(`${path.relative(ROOT, TSV)} already exists — refusing to overwrite`);
  }
  const rows = seed.entities.map((e) => `${e.slug}\t${e.parent}\t${e.en}\t`);
  fs.writeFileSync(TSV, [HEADER, ...rows, ""].join("\n"), "utf8");
  console.log(
    `wrote ${path.relative(ROOT, TSV)} — ${seed.categories.length} categories, ` +
      `${seed.subcategories.length} subcategories, ${seed.entities.length} rows`,
  );
  console.log("Fill the km column (D), leave the other columns untouched, then run --check.");
}

function parseTsv(seed) {
  let raw;
  try {
    raw = fs.readFileSync(TSV, "utf8");
  } catch {
    fail(`cannot read ${path.relative(ROOT, TSV)} — run --init first`);
  }

  const lines = raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n").split("\n");
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  if (lines.length === 0) fail("the TSV is empty");

  if (lines[0] !== HEADER) {
    fail(`bad header — expected "${HEADER.replace(/\t/g, "\\t")}", got "${lines[0].replace(/\t/g, "\\t")}"`);
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = lines[i].split("\t");
    const rowNumber = i + 1;
    if (fields.length !== 4) {
      fail(
        `row ${rowNumber} has ${fields.length} columns, expected 4 — keep the trailing tab ` +
          `even when the km cell is empty`,
      );
    }
    const [slug, parent, en, km] = fields;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      fail(`row ${rowNumber}: invalid slug "${slug}"`);
    }
    rows.push({ rowNumber, slug, parent, en, km });
  }

  if (rows.length !== seed.entities.length) {
    fail(`expected ${seed.entities.length} data rows, found ${rows.length}`);
  }

  const seenSlugs = new Set();
  const seenKeys = new Set();
  const byKey = new Map();
  for (const row of rows) {
    const key = `${row.parent}\t${row.slug}`;
    if (seenSlugs.has(row.slug)) fail(`row ${row.rowNumber}: duplicate slug "${row.slug}"`);
    if (seenKeys.has(key)) fail(`row ${row.rowNumber}: duplicate (parent, slug) "${key}"`);
    seenSlugs.add(row.slug);
    seenKeys.add(key);
    byKey.set(key, row);
  }

  const categories = rows.filter((r) => r.parent === "");
  const subcategories = rows.filter((r) => r.parent !== "");
  if (categories.length !== EXPECTED_CATEGORIES) {
    fail(`expected ${EXPECTED_CATEGORIES} categories (empty parent), found ${categories.length}`);
  }
  if (subcategories.length !== EXPECTED_SUBCATEGORIES) {
    fail(`expected ${EXPECTED_SUBCATEGORIES} subcategories, found ${subcategories.length}`);
  }
  const categorySlugs = new Set(categories.map((r) => r.slug));
  for (const sub of subcategories) {
    if (!categorySlugs.has(sub.parent)) {
      fail(`row ${sub.rowNumber}: parent "${sub.parent}" is not a category slug`);
    }
  }

  const errors = [];
  for (const entity of seed.entities) {
    const key = `${entity.parent}\t${entity.slug}`;
    const row = byKey.get(key);
    if (!row) {
      errors.push(`missing TSV row for (parent="${entity.parent}", slug="${entity.slug}")`);
      continue;
    }
    if (row.en !== entity.en) {
      errors.push(
        `row ${row.rowNumber}: English name changed — expected "${entity.en}", got "${row.en}"`,
      );
    }
    const km = row.km.trim();
    if (!km) {
      errors.push(`row ${row.rowNumber}: empty km for "${entity.slug}"`);
    } else if (km.length > NAME_MAX) {
      errors.push(`row ${row.rowNumber}: km for "${entity.slug}" is ${km.length} chars (max ${NAME_MAX})`);
    }
    row.km = km;
  }

  if (errors.length > 0) {
    console.error(`error: ${errors.length} invalid row(s):`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }

  return { rows, byKey };
}

function check() {
  const seed = readSeed();
  const { rows } = parseTsv(seed);
  console.log(
    `ok: ${rows.length}/${seed.entities.length} rows valid — ` +
      `${seed.categories.length} categories, ${seed.subcategories.length} subcategories, 0 empty km`,
  );
  return { seed, rows };
}

function apply({ seed, rows }) {
  const replacements = seed.entities.map((entity) => {
    const row = rows.find(
      (r) => r.slug === entity.slug && r.parent === entity.parent,
    );
    if (!row) fail(`no TSV row for "${entity.slug}"`);
    return {
      start: entity.start,
      end: entity.end,
      text: `${entity.indent}name: { en: ${entity.enToken}, km: ${encodeSingleQuoted(row.km)} },`,
    };
  });

  const output = [];
  let cursor = 0;
  for (const { start, end, text } of replacements) {
    output.push(...seed.lines.slice(cursor, start), text);
    cursor = end + 1;
  }
  output.push(...seed.lines.slice(cursor));

  const next = output.join("\n");
  const parsed = parseSeed(next);
  const withKm = parsed.entities.filter((e) => e.km !== null);
  if (withKm.length !== seed.entities.length) {
    fail(`post-write check failed: ${withKm.length}/${seed.entities.length} entities have km`);
  }
  const labelCount = (next.match(/label: \{/g) ?? []).length;
  if (labelCount !== 1601) {
    fail(`post-write check failed: expected 1601 label objects, found ${labelCount}`);
  }
  const zhCount = (next.match(/\bzh:/g) ?? []).length;
  if (zhCount !== 0) {
    fail(`post-write check failed: unexpected zh: key in the seed`);
  }

  const temp = `${SEED}.tmp`;
  fs.writeFileSync(temp, next, "utf8");
  fs.renameSync(temp, SEED);
  console.log(
    `applied ${replacements.length} km values to ${path.relative(ROOT, SEED)}`,
  );
  console.log("now run: pnpm exec prettier --write apps/backend/src/categories/seeds/categories.seed.ts");
}

const mode = process.argv[2] ?? "--apply";
if (mode === "--init") {
  writeSkeleton(readSeed());
} else if (mode === "--check") {
  check();
} else if (mode === "--apply") {
  apply(check());
} else {
  fail(`unknown mode "${mode}" — use --init, --check or --apply`);
}
