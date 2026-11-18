import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// Magic Context matches per-model config (execute_threshold_tokens, cache_ttl,
// output_reserve, keep_reasoning_tokens, ...) against the Pi model key
// "<provider>/<model id>" by walking dash-separated prefixes of the model id:
//
//   magpie/group/deepseek-flash -> magpie/group/deepseek-flash,
//                                  group/deepseek-flash,
//                                  magpie/group/deepseek, group/deepseek   (stop)
//
// A routing-group prefix therefore swallows the family key: "deepseek", "claude",
// "gpt-6-astra" are never produced, so prefixed ids silently fall back to
// `default` (measured: magpie/group/deepseek-flash got cache_ttl 5m instead of
// 45m while magpie/deepseek-flash got 45m).
//
// This patch makes the lookup routing-group aware: at every dash level it also
// tries the id with leading path segments stripped. Config keys written against
// bare model ids then apply to every routing group, including future ones.

const MARKER = "magic-context patch: routing-group aware";

function distDir() {
  return join(
    homedir(),
    ".pi",
    "agent",
    "npm",
    "node_modules",
    "@cortexkit",
    "pi-magic-context",
    "dist"
  );
}

// Extract `function <name>(` ... matching closing brace (string/regex aware).
function extractFunction(code, name, { generator = false } = {}) {
  const pattern = new RegExp(
    `function\\s*${generator ? "\\*\\s*" : ""}${name}\\s*\\(`,
    "g"
  );
  const match = pattern.exec(code);
  if (!match) return null;
  const start = match.index;
  const braceStart = code.indexOf("{", start);
  if (braceStart < 0) return null;

  let depth = 0;
  let quote = null;
  let inRegex = false;
  let escaped = false;
  for (let i = braceStart; i < code.length; i += 1) {
    const ch = code[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (inRegex) {
      if (ch === "/") inRegex = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "/" && code[i + 1] !== "/" && code[i + 1] !== "*") inRegex = true;
    else if (ch === "{" && !inRegex) depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return { start, end: i + 1, text: code.slice(start, i + 1) };
    }
  }
  return null;
}

const GENERATOR_PATCH = `function* modelKeyLookupOrder(modelKey) {
  // ${MARKER}
  const slash = modelKey.indexOf("/");
  const providerRefs = slash >= 0 ? modelRefLookupOrder(modelKey) : [];
  const providerPrefixes = providerRefs.map((ref) => {
    const providerSlash = ref.indexOf("/");
    return providerSlash > 0 ? ref.slice(0, providerSlash) : ref;
  });
  const yieldFor = (id) => {
    const out = [];
    for (const providerPrefix of providerPrefixes)
      out.push(\`\${providerPrefix}/\${id}\`);
    out.push(id);
    return out;
  };
  let modelId = slash >= 0 ? modelKey.slice(slash + 1) : modelKey;
  while (modelId.length > 0) {
    let routedId = modelId;
    while (routedId.length > 0) {
      yield* yieldFor(routedId);
      const routedSlash = routedId.indexOf("/");
      if (routedSlash <= 0 || routedSlash === routedId.length - 1)
        break;
      routedId = routedId.slice(routedSlash + 1);
    }
    const lastDash = modelId.lastIndexOf("-");
    if (lastDash <= 0)
      break;
    modelId = modelId.slice(0, lastDash);
  }
}`;

const ARRAY_CANDIDATE_PATCH_BLOCK = `    let routedID = modelID;
    while (routedID.length > 0) {
      for (const providerRef of providerRefs) {
        const providerSlash = providerRef.indexOf("/");
        const providerPrefix = providerRef.slice(0, providerSlash);
        candidates.push({ key: \`\${providerPrefix}/\${routedID}\`, source: "exact" });
      }
      candidates.push({ key: routedID, source: "bare" });
      const routedSlash = routedID.indexOf("/");
      if (routedSlash <= 0 || routedSlash === routedID.length - 1)
        break;
      routedID = routedID.slice(routedSlash + 1);
    }`;

function patchGeneratorFile(path) {
  if (!existsSync(path)) {
    console.error(`[pi-packages] magic-context dist file missing: ${path}`);
    process.exitCode = 1;
    return;
  }
  const code = readFileSync(path, "utf8");
  if (code.includes(MARKER)) {
    console.log(`[pi-packages] magic-context generator matcher already patched (${path})`);
    return;
  }
  const fn = extractFunction(code, "modelKeyLookupOrder", { generator: true });
  if (!fn) {
    console.error(
      `[pi-packages] modelKeyLookupOrder generator not found in ${path}; cannot apply routing-group patch`
    );
    process.exitCode = 1;
    return;
  }
  writeFileSync(path, code.slice(0, fn.start) + GENERATOR_PATCH + code.slice(fn.end), "utf8");
  console.log(
    `[pi-packages] Patched magic-context generator matcher (routing-group aware): ${path}`
  );
}

function patchArrayCandidateFile(path) {
  if (!existsSync(path)) {
    console.error(`[pi-packages] magic-context dist file missing: ${path}`);
    process.exitCode = 1;
    return;
  }
  const code = readFileSync(path, "utf8");
  if (code.includes(MARKER)) {
    console.log(`[pi-packages] magic-context candidate matcher already patched (${path})`);
    return;
  }
  const fn = extractFunction(code, "modelKeyLookupOrder");
  if (!fn) {
    console.error(
      `[pi-packages] modelKeyLookupOrder not found in ${path}; cannot apply routing-group patch`
    );
    process.exitCode = 1;
    return;
  }  const target = `    for (const providerRef of providerRefs) {
      const providerSlash = providerRef.indexOf("/");
      const providerPrefix = providerRef.slice(0, providerSlash);
      candidates.push({ key: \`\${providerPrefix}/\${modelID}\`, source: "exact" });
    }
    candidates.push({ key: modelID, source: "bare" });`;
  if (!fn.text.includes(target)) {
    console.error(
      `[pi-packages] candidate matcher body not recognised in ${path}; cannot apply routing-group patch`
    );
    process.exitCode = 1;
    return;
  }
  const patched = fn.text
    .replace(target, ARRAY_CANDIDATE_PATCH_BLOCK)
    .replace(
      "function modelKeyLookupOrder(modelKey) {",
      `function modelKeyLookupOrder(modelKey) {\n  // ${MARKER}`
    );
  writeFileSync(path, code.slice(0, fn.start) + patched + code.slice(fn.end), "utf8");
  console.log(
    `[pi-packages] Patched magic-context candidate matcher (routing-group aware): ${path}`
  );
}

export function patchPiMagicContext() {
  const dir = distDir();
  if (!existsSync(dir)) {
    console.log(
      "[pi-packages] @cortexkit/pi-magic-context is not installed; skipping patch"
    );
    return;
  }
  // Entry bundle: dash-prefix generator used for execute_threshold_tokens / cache_ttl.
  patchGeneratorFile(join(dir, "index.js"));
  // Shared chunk: array-of-candidate variant used by resolveModelConfigValue.
  for (const chunk of findArrayCandidateFiles(dir)) patchArrayCandidateFile(chunk);
}

function findArrayCandidateFiles(dir) {
  const found = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".js")) continue;
    const path = join(dir, name);
    const code = readFileSync(path, "utf8");
    if (code.includes("function modelKeyLookupOrder") && code.includes("candidates.push({ key:")) {
      found.push(path);
    }
  }
  if (found.length === 0) {
    console.error(
      `[pi-packages] shared chunk holding the array-candidate modelKeyLookupOrder not found in ${dir}; cannot apply routing-group patch`
    );
    process.exitCode = 1;
  }
  return found;
}

if (process.argv[1] && process.argv[1].endsWith("patch-pi-magic-context.mjs")) {
  patchPiMagicContext();
}
