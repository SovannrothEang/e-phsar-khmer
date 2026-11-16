#!/usr/bin/env node
/**
 * Raw-CDP driver for headless Chromium.
 *
 * This is the repo's own documented recipe (ARCHITECTURE.md → "Browser
 * verification (headless Chromium + raw CDP)") turned into commands, so a
 * verification run does not need Playwright or any npm dependency: it uses
 * only Node's built-in `fetch` and `WebSocket` (Node >= 22).
 *
 * Usage:
 *   cdp.mjs open <url> [--wait-for <css>] [--hydrate-ms <n>]
 *   cdp.mjs eval "<js expression>"
 *   cdp.mjs click  --role <role> --name <accessible name> [--wait-for <css>]
 *   cdp.mjs fill   --role <role> --name <accessible name> --value <text>
 *   cdp.mjs fill   --selector <css> --value <text>   # unnamed inputs (OTP box)
 *   cdp.mjs press  --key <Enter|Escape|Tab|/|Space|ArrowDown|...> [--selector <css>]
 *   cdp.mjs press  --text <text>            # types into the focused element
 *   cdp.mjs aria   [--path <file>]          # accessibility tree snapshot
 *   cdp.mjs shot   [--path <file>] [--full]
 *   cdp.mjs reset                          # clear cookies + web storage (start anonymous)
 *   cdp.mjs state                          # browser process/port as JSON
 *   cdp.mjs close                          # kill only what this driver started
 *
 * Every command prints a one-line result on stdout and exits non-zero with a
 * reason on failure. Proof artifacts (aria/screenshot) are written where
 * --path says; nothing is written unless --path is given except `state`.
 */

import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

const RUN_DIR = process.env.VERIFY_RUN_DIR || "/tmp/opencode/verify-phsarkhmer";
const STATE_FILE = join(RUN_DIR, "cdp-state.json");
const PORT = Number(process.env.VERIFY_CDP_PORT || 9333);
const CHROMIUM = process.env.VERIFY_CHROMIUM || "chromium";
// Radix dropdown triggers open on pointerdown, not click (ARCHITECTURE.md), so
// every click holds the button down this long before releasing.
const POINTER_HOLD_MS = 350;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function parseFlags(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) flags[key] = true;
      else {
        flags[key] = next;
        i++;
      }
    } else positional.push(a);
  }
  return { flags, positional };
}

async function httpJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

function readState() {
  if (!existsSync(STATE_FILE)) return null;
  return JSON.parse(readFileSync(STATE_FILE, "utf8"));
}

function browserAlive(port) {
  return fetch(`http://127.0.0.1:${port}/json/version`, {
    signal: AbortSignal.timeout(2000),
  })
    .then((r) => r.ok)
    .catch(() => false);
}

async function ensureBrowser() {
  const state = readState();
  if (state && (await browserAlive(state.port))) return state;

  if (state) rmSync(STATE_FILE, { force: true }); // stale record

  if (!(await browserAlive(PORT))) {
    const userDataDir = join(RUN_DIR, "chromium-profile");
    rmSync(userDataDir, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 300,
    });
    mkdirSync(userDataDir, { recursive: true });
    const args = [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--no-default-browser-check",
      // Force (hover: hover): plain headless reports hover:none and silently
      // kills every hover:* utility in the UI (ARCHITECTURE.md).
      "--blink-settings=primaryPointerType=2,availablePointerTypes=2,primaryHoverType=2,availableHoverTypes=2",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${userDataDir}`,
      "--window-size=1440,1000",
      "about:blank",
    ];
    const child = spawn(CHROMIUM, args, {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    for (let i = 0; i < 60; i++) {
      if (await browserAlive(PORT)) break;
      if (i === 59) fail(`${CHROMIUM} did not expose CDP on :${PORT}`);
      await sleep(250);
    }
    const fresh = { pid: child.pid, port: PORT, userDataDir, startedAt: new Date().toISOString() };
    writeFileSync(STATE_FILE, JSON.stringify(fresh, null, 2));
    return fresh;
  }
  // Port owned by a browser this driver has no record of: never hijack it.
  fail(
    `CDP port ${PORT} is already served by a browser this driver does not own. ` +
      `Run scripts/cleanup.sh, or set VERIFY_CDP_PORT.`,
  );
}

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", () => reject(new Error("CDP websocket error")), {
      once: true,
    });
  });

  const pending = new Map();
  const eventWaiters = [];
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message}`));
      else resolve(msg.result);
    } else if (msg.method) {
      for (const waiter of [...eventWaiters]) {
        if (waiter.method === msg.method && waiter.check(msg.params)) {
          eventWaiters.splice(eventWaiters.indexOf(waiter), 1);
          waiter.resolve(msg.params);
        }
      }
    }
  });

  let id = 0;
  const cdp = {
    ws,
    send(method, params = {}, timeoutMs = 45000) {
      const msgId = ++id;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(msgId);
          reject(new Error(`CDP timeout on ${method}`));
        }, timeoutMs);
        pending.set(msgId, {
          resolve: (v) => {
            clearTimeout(timer);
            resolve(v);
          },
          reject: (e) => {
            clearTimeout(timer);
            reject(e);
          },
        });
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    },
    once(method, check = () => true, timeoutMs = 60000) {
      return new Promise((resolve, reject) => {
        const waiter = { method, check, resolve };
        eventWaiters.push(waiter);
        setTimeout(() => {
          const i = eventWaiters.indexOf(waiter);
          if (i >= 0) {
            eventWaiters.splice(i, 1);
            reject(new Error(`timeout waiting for ${method}`));
          }
        }, timeoutMs);
      });
    },
  };
  return cdp;
}

async function pageTarget() {
  const list = await httpJson(`http://127.0.0.1:${PORT}/json/list`);
  const page = list.find((t) => t.type === "page");
  if (!page) fail("no page target in the browser");
  return page.webSocketDebuggerUrl;
}

async function withPage(fn) {
  const state = await ensureBrowser();
  const cdp = await connect(await pageTarget());
  try {
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("DOM.enable");
    await cdp.send("Network.enable");
    await cdp.send("Accessibility.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-color-scheme", value: "light" }],
    });
    return await fn(cdp, state);
  } finally {
    cdp.ws.close();
  }
}

async function evaluate(cdp, expression) {
  const { result, exceptionDetails } = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails)
    throw new Error(exceptionDetails.exception?.description || "page eval failed");
  return result.value;
}

/** Wait until the document is complete, then network-quiet, then hydrated. */
async function settle(cdp, { waitFor, hydrateMs }) {
  for (let i = 0; i < 240; i++) {
    const ready = await evaluate(cdp, "document.readyState");
    if (ready === "complete") break;
    await sleep(250);
  }
  // Hydration: React only wires handlers after this, so a click before it is a
  // silent no-op. Network quiet is the best available signal without a
  // framework hook; --hydrate-ms adds a fixed cushion on top.
  let inflight = 0;
  const onReq = () => inflight++;
  const onDone = () => {
    inflight = Math.max(0, inflight - 1);
  };
  cdp.ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === "Network.requestWillBeSent") onReq();
    if (
      msg.method === "Network.loadingFinished" ||
      msg.method === "Network.loadingFailed"
    )
      onDone();
  });
  const quietSince = Date.now();
  while (Date.now() - quietSince < 8000) {
    if (inflight === 0 && Date.now() - quietSince > 400) break;
    await sleep(200);
  }
  await sleep(hydrateMs);
  if (waitFor) await waitForSelector(cdp, waitFor, 30000);
}

async function waitForSelector(cdp, selector, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = await evaluate(
      cdp,
      `Boolean(document.querySelector(${JSON.stringify(selector)}))`,
    );
    if (found) return;
    await sleep(200);
  }
  throw new Error(`timed out waiting for selector ${selector}`);
}

function nameMatches(actual, wanted) {
  if (actual == null) return false;
  const a = String(actual).trim();
  return a === wanted || a.includes(wanted);
}

/**
 * Locate an element by accessible name (preferred, stable across layout
 * changes) or by CSS selector, scroll it into view and return its centre in
 * viewport coordinates.
 */
async function locate(cdp, { role, name, selector }) {
  if (selector) {
    const box = await evaluate(
      cdp,
      `(() => {
         const el = document.querySelector(${JSON.stringify(selector)});
         if (!el) return null;
         el.scrollIntoView({ block: "center", inline: "nearest" });
         const r = el.getBoundingClientRect();
         return { x: r.x, y: r.y, w: r.width, h: r.height, tag: el.tagName };
       })()`,
    );
    if (!box || box.w === 0 || box.h === 0)
      throw new Error(`selector not visible: ${selector}`);
    return { x: box.x + box.w / 2, y: box.y + box.h / 2, label: selector };
  }
  if (!role) throw new Error("pass --role/--name or --selector");

  const { nodes } = await cdp.send("Accessibility.getFullAXTree");
  const candidates = nodes.filter(
    (n) =>
      !n.ignored &&
      n.backendDOMNodeId &&
      n.role?.value === role &&
      (name == null || nameMatches(n.name?.value, name)),
  );
  if (candidates.length === 0)
    throw new Error(
      name == null
        ? `no ${role} in the accessibility tree`
        : `no ${role} named "${name}" in the accessibility tree`,
    );

  // Prefer an exact accessible-name match, then the first visible candidate.
  const exact = name == null ? [] : candidates.filter((n) => String(n.name?.value).trim() === name);
  for (const node of [...exact, ...candidates]) {
    const { object } = await cdp.send("DOM.resolveNode", {
      backendNodeId: node.backendDOMNodeId,
    });
    const box = await cdp.send("Runtime.callFunctionOn", {
      objectId: object.objectId,
      returnByValue: true,
      functionDeclaration: `function () {
        const el = this;
        if (el.disabled || el.getAttribute("aria-disabled") === "true") return null;
        el.scrollIntoView({ block: "center", inline: "nearest" });
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return null;
        return { x: r.x, y: r.y, w: r.width, h: r.height, tag: el.tagName };
      }`,
    });
    if (box.result.value) {
      const b = box.result.value;
      return {
        x: b.x + b.w / 2,
        y: b.y + b.h / 2,
        label: `${role} "${name ?? ""}" (${b.tag})`,
      };
    }
  }
  throw new Error(`${role} "${name}" exists but is not visible/interactive`);
}

async function pointerClick(cdp, x, y) {
  const base = { x, y, pointerType: "mouse" };
  await cdp.send("Input.dispatchMouseEvent", {
    ...base,
    type: "mouseMoved",
    button: "none",
    buttons: 0,
  });
  await cdp.send("Input.dispatchMouseEvent", {
    ...base,
    type: "mousePressed",
    button: "left",
    buttons: 1,
    clickCount: 1,
  });
  await sleep(POINTER_HOLD_MS); // Radix triggers open on pointerdown
  await cdp.send("Input.dispatchMouseEvent", {
    ...base,
    type: "mouseReleased",
    button: "left",
    buttons: 0,
    clickCount: 1,
  });
}

const KEYS = {
  Enter: { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 },
  Escape: { key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 },
  Tab: { key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 },
  Space: { key: " ", code: "Space", windowsVirtualKeyCode: 32, text: " " },
  "/": { key: "/", code: "Slash", windowsVirtualKeyCode: 191, text: "/" },
  ArrowDown: { key: "ArrowDown", code: "ArrowDown", windowsVirtualKeyCode: 40 },
  ArrowUp: { key: "ArrowUp", code: "ArrowUp", windowsVirtualKeyCode: 38 },
  Backspace: {
    key: "Backspace",
    code: "Backspace",
    windowsVirtualKeyCode: 8,
    text: "\b",
  },
};

/* ------------------------------------------------------------------ commands */

async function cmdOpen(positional, flags) {
  const url = positional[0];
  if (!url) fail("open needs a URL");
  await withPage(async (cdp) => {
    const loaded = cdp.once("Page.loadEventFired", () => true, 90000).catch(() => null);
    await cdp.send("Page.navigate", { url });
    await loaded;
    await settle(cdp, {
      waitFor: typeof flags["wait-for"] === "string" ? flags["wait-for"] : undefined,
      hydrateMs: Number(flags["hydrate-ms"] ?? 2500),
    });
    const info = await evaluate(
      cdp,
      "({ title: document.title, url: location.href, ready: document.readyState })",
    );
    console.log(JSON.stringify(info));
  });
}

async function cmdEval(positional) {
  const expression = positional.join(" ");
  if (!expression) fail("eval needs an expression");
  await withPage(async (cdp) => {
    const value = await evaluate(cdp, expression);
    console.log(JSON.stringify(value ?? null, null, 2));
  });
}

async function cmdClick(positional, flags) {
  await withPage(async (cdp) => {
    const target = await locate(cdp, flags);
    const before = await evaluate(cdp, "location.href");
    await pointerClick(cdp, target.x, target.y);
    // Client-side navigation commits when the RSC payload resolves, which can
    // take a second on a cold dev route; do not report the old URL.
    for (let i = 0; i < 50; i++) {
      if ((await evaluate(cdp, "location.href")) !== before) break;
      await sleep(100);
    }
    await sleep(400); // let a non-navigating click (button, menu item) land
    if (typeof flags["wait-for"] === "string")
      await waitForSelector(cdp, flags["wait-for"], 30000);
    const after = await evaluate(cdp, "location.href");
    console.log(`clicked ${target.label}; now at ${after}`);
  });
}

async function cmdFill(positional, flags) {
  if (flags.value === undefined) fail("fill needs --value");
  const value = String(flags.value);
  await withPage(async (cdp) => {
    if (typeof flags.selector === "string") {
      const outcome = await evaluate(
        cdp,
        `(() => {
          const el = document.querySelector(${JSON.stringify(flags.selector)});
          if (!el) return "missing";
          el.focus();
          if (el.isContentEditable) {
            document.execCommand("selectAll", false, null);
            document.execCommand("insertText", false, ${JSON.stringify(value)});
            return "contenteditable";
          }
          const proto =
            el.tagName === "TEXTAREA"
              ? window.HTMLTextAreaElement.prototype
              : window.HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
          if (!setter) return "unsupported:" + el.tagName;
          setter.call(el, ${JSON.stringify(value)});
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          return "value";
        })()`,
      );
      if (outcome === "missing")
        throw new Error(`selector not found: ${flags.selector}`);
      if (String(outcome).startsWith("unsupported"))
        throw new Error(`cannot fill: ${outcome}`);
      await sleep(300);
      console.log(`filled ${flags.selector} with ${JSON.stringify(value)}`);
      return;
    }
    const target = await locate(cdp, flags);
    // Re-resolve through the same path locate() used: AX tree → backend node id.
    const { nodes } = await cdp.send("Accessibility.getFullAXTree");
    const node = nodes.find(
      (n) =>
        !n.ignored &&
        n.backendDOMNodeId &&
        n.role?.value === flags.role &&
        nameMatches(n.name?.value, flags.name),
    );
    if (!node) throw new Error(`element vanished: ${flags.role} "${flags.name}"`);
    const resolved = await cdp.send("DOM.resolveNode", {
      backendNodeId: node.backendDOMNodeId,
    });
    const outcome = await cdp.send("Runtime.callFunctionOn", {
      objectId: resolved.object.objectId,
      returnByValue: true,
      arguments: [{ value: String(flags.value) }],
      functionDeclaration: `function (value) {
        const el = this;
        el.focus();
        if (el.isContentEditable) {
          document.execCommand("selectAll", false, null);
          document.execCommand("insertText", false, value);
          return "contenteditable";
        }
        const proto =
          el.tagName === "TEXTAREA"
            ? window.HTMLTextAreaElement.prototype
            : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
        if (!setter) return "unsupported:" + el.tagName;
        setter.call(el, value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return "value";
      }`,
    });
    if (String(outcome.result.value).startsWith("unsupported"))
      throw new Error(`cannot fill ${outcome.result.value}`);
    await sleep(300);
    console.log(`filled ${target.label} with ${JSON.stringify(String(flags.value))}`);
  });
}

async function cmdPress(positional, flags) {
  if (!flags.key && !flags.text) fail("press needs --key or --text");
  await withPage(async (cdp) => {
    if (flags.selector)
      await evaluate(
        cdp,
        `document.querySelector(${JSON.stringify(flags.selector)})?.focus()`,
      );
    if (flags.text) {
      await cdp.send("Input.insertText", { text: String(flags.text) });
      console.log(`typed ${JSON.stringify(String(flags.text))}`);
      return;
    }
    const spec = KEYS[flags.key];
    if (!spec)
      fail(`unknown key "${flags.key}"; known: ${Object.keys(KEYS).join(", ")}`);
    const down = {
      type: "keyDown",
      key: spec.key,
      code: spec.code,
      windowsVirtualKeyCode: spec.windowsVirtualKeyCode,
    };
    await cdp.send("Input.dispatchKeyEvent", down);
    if (spec.text) await cdp.send("Input.insertText", { text: spec.text });
    await cdp.send("Input.dispatchKeyEvent", {
      ...down,
      type: "keyUp",
      text: "",
    });
    await sleep(400);
    console.log(`pressed ${spec.key}`);
  });
}

function renderAxTree(nodes) {
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  const depthOf = (node) => {
    let depth = 0;
    let current = node;
    while (current?.parentId && byId.has(current.parentId)) {
      depth++;
      current = byId.get(current.parentId);
      if (depth > 60) break;
    }
    return depth;
  };
  const skip = new Set(["none", "generic", "InlineTextBox", "LineBreak"]);
  const lines = [];
  for (const node of nodes) {
    if (node.ignored) continue;
    const role = node.role?.value;
    if (!role || skip.has(role)) continue;
    const name = node.name?.value?.replace(/\s+/g, " ").trim();
    if (!name && !["rootWebArea", "main", "navigation", "search"].includes(role))
      continue;
    lines.push(
      `${"  ".repeat(depthOf(node))}${role}${name ? ` "${name}"` : ""}`,
    );
  }
  return lines.join("\n") + "\n";
}

async function cmdAria(positional, flags) {
  await withPage(async (cdp) => {
    const { nodes } = await cdp.send("Accessibility.getFullAXTree");
    const text = renderAxTree(nodes);
    if (typeof flags.path === "string") {
      mkdirSync(dirname(flags.path), { recursive: true });
      writeFileSync(flags.path, text);
      console.log(
        `wrote ${flags.path} (${text.split("\n").length - 1} nodes)`,
      );
    } else {
      process.stdout.write(text);
    }
  });
}

async function cmdShot(positional, flags) {
  await withPage(async (cdp) => {
    const params = { format: "png" };
    if (flags.full) {
      const { cssContentSize } = await cdp.send("Page.getLayoutMetrics");
      params.captureBeyondViewport = true;
      params.clip = {
        x: 0,
        y: 0,
        width: Math.ceil(cssContentSize.width),
        height: Math.ceil(cssContentSize.height),
        scale: 1,
      };
    }
    const { data } = await cdp.send("Page.captureScreenshot", params);
    const path =
      typeof flags.path === "string"
        ? flags.path
        : join(RUN_DIR, "screenshot.png");
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, Buffer.from(data, "base64"));
    console.log(`wrote ${path}`);
  });
}

async function cmdReset() {
  await withPage(async (cdp) => {
    await cdp.send("Network.clearBrowserCookies");
    await evaluate(
      cdp,
      "try { localStorage.clear(); sessionStorage.clear(); } catch {}",
    );
    await cdp.send("Page.navigate", { url: "about:blank" });
    console.log("cleared cookies and web storage; page reset to about:blank");
  });
}

function cmdState() {
  const state = readState();
  console.log(JSON.stringify(state ?? { running: false }, null, 2));
}

async function cmdClose() {
  const state = readState();
  if (!state) {
    console.log("no browser record; nothing to close");
    return;
  }
  const alive = await browserAlive(state.port);
  if (alive && state.pid) {
    try {
      process.kill(state.pid, "SIGTERM");
    } catch {
      /* already gone */
    }
  }
  if (state.userDataDir)
    rmSync(state.userDataDir, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 300,
    });
  rmSync(STATE_FILE, { force: true });
  console.log(
    `closed ${CHROMIUM} pid ${state.pid ?? "?"} on :${state.port} (profile removed)`,
  );
}

const [command, ...rest] = process.argv.slice(2);
const { flags, positional } = parseFlags(rest);

const commands = {
  open: cmdOpen,
  eval: cmdEval,
  click: cmdClick,
  fill: cmdFill,
  press: cmdPress,
  aria: cmdAria,
  shot: cmdShot,
  reset: cmdReset,
  state: cmdState,
  close: cmdClose,
};

const handler = commands[command];
if (!handler) {
  fail(
    `unknown command "${command ?? ""}"; use one of: ${Object.keys(commands).join(", ")}`,
  );
}
try {
  await handler(positional, flags);
  process.exit(0);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
