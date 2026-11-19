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

// ---------------------------------------------------------------- image tokens
// Pi sends images as parts whose `data` is the whole base64 payload (a screenshot
// is ~300KB). Magic Context bills such a part PI_IMAGE_TOKENS (1200) in
// tokenizePiMessages(), but two other places re-price it from the base64 JSON:
//
//  1. estimatePiOverflowRecoveryInputTokens():
//       const delta = estimateTokens(JSON.stringify(part)) - PI_IMAGE_TOKENS;
//     which ADDS the full payload to the already-counted 1200, so each image
//     costs ~74k tokens instead of 1200 (~62x).
//
//  2. piFitMessageBytes(): returns JSON.stringify length including `data`, used as
//     the byte upper bound for outgoing fit.
//
// Measured damage: a 46-message tail holding 11 screenshots was 172,472 tokens by
// the provider but 1,606,057 by estimate 1), so the request always exceeded the
// overflow window and every turn failed closed with "still summarizing older
// history" — send refused, provider-visible usage never moved, emergency reclaim
// dropped a handful of tags each attempt and reclaimed almost nothing. Estimate 2)
// kept classifying the fit as `upper-estimate-pressure`, which kept triggering
// those pointless emergency drops.
//
// An image is billed PI_IMAGE_TOKENS in every bound: the base64 payload is a wire
// detail, not prose.
const IMAGE_DELTA_MARKER = "magic-context patch: image delta counts overhead only";
const IMAGE_FIT_MARKER = "magic-context patch: image fit bytes capped";

const IMAGE_TRANSFORMS = [
  {
    label: "overflow-recovery image delta",
    applied: IMAGE_DELTA_MARKER,
    target: "const delta = estimateTokens(JSON.stringify(part)) - PI_IMAGE_TOKENS;",
    replacement: `// ${IMAGE_DELTA_MARKER} — tokenizePiMessages already charged PI_IMAGE_TOKENS
        const delta = estimateTokens(JSON.stringify({ ...part, data: "" }));`,
  },
  {
    label: "image fit-byte accounting",
    applied: IMAGE_FIT_MARKER,
    target: "function piFitMessageBytes(raw) {\n  const message = raw;",
    replacement: `function piFitContentWithoutImageData(raw) {
  // ${IMAGE_FIT_MARKER}: replace the base64 payload with its PI_IMAGE_TOKENS cost
  // in bytes (1200 tokens * 4 bytes) so byte-derived token bounds stay sane.
  const content = raw?.content;
  if (!Array.isArray(content)) return { value: raw, imageBytes: 0 };
  let imageCount = 0;
  const mapped = content.map((part) => {
    if (!part || typeof part !== "object" || part.type !== "image" || typeof part.data !== "string")
      return part;
    imageCount += 1;
    return { ...part, data: "" };
  });
  if (imageCount === 0) return { value: raw, imageBytes: 0 };
  return { value: { ...raw, content: mapped }, imageBytes: imageCount * PI_IMAGE_TOKENS * 4 };
}

function piFitMessageBytes(rawInput) {
  const prepared = piFitContentWithoutImageData(rawInput);
  const raw = prepared.value;
  const imageBytes = prepared.imageBytes;
  const message = raw;`,
  },
  {
    label: "fit byte return",
    applied: "return imageBytes + Buffer.byteLength(JSON.stringify(raw));",
    target: "    return Buffer.byteLength(JSON.stringify(raw));",
    replacement: "    return imageBytes + Buffer.byteLength(JSON.stringify(raw));",
  },
  {
    label: "fit byte return (signed-thinking branch)",
    applied: "return imageBytes + bytes + (opaque ? 4 * opaqueThinkingCost(",
    target: "  return bytes + (opaque ? 4 * opaqueThinkingCost(",
    replacement: "  return imageBytes + bytes + (opaque ? 4 * opaqueThinkingCost(",
  },
];

function patchImageTokenFile(path) {
  if (!existsSync(path)) {
    console.error(`[pi-packages] magic-context dist file missing: ${path}`);
    process.exitCode = 1;
    return;
  }
  let code = readFileSync(path, "utf8");
  const applied = [];
  const missing = [];
  for (const transform of IMAGE_TRANSFORMS) {
    if (code.includes(transform.applied)) continue;
    const hits = code.split(transform.target).length - 1;
    if (hits !== 1) {
      missing.push(`${transform.label} (expected 1 occurrence, found ${hits})`);
      continue;
    }
    code = code.split(transform.target).join(transform.replacement);
    applied.push(transform.label);
  }
  if (missing.length > 0) {
    console.error(
      `[pi-packages] magic-context image accounting unrecognised in ${path}: ${missing.join("; ")}; upstream dist changed, update patch-pi-magic-context.mjs`
    );
    process.exitCode = 1;
    return;
  }
  if (applied.length === 0) {
    console.log(`[pi-packages] magic-context image token accounting already patched (${path})`);
    return;
  }
  writeFileSync(path, code, "utf8");
  console.log(
    `[pi-packages] Patched magic-context image token accounting (${applied.join(", ")}): ${path}`
  );
}

function findImageTokenFiles(dir) {
  const found = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".js")) continue;
    const code = readFileSync(join(dir, name), "utf8");
    if (
      code.includes("function piFitMessageBytes(") ||
      code.includes(IMAGE_DELTA_MARKER) ||
      code.includes(IMAGE_TRANSFORMS[0].target)
    ) {
      found.push(join(dir, name));
    }
  }
  if (found.length === 0) {
    console.error(
      `[pi-packages] no dist file holds the image token accounting in ${dir}; cannot apply image token patch`
    );
    process.exitCode = 1;
  }
  return found;
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
  // Image parts must be billed at PI_IMAGE_TOKENS, not as their base64 payload.
  for (const file of findImageTokenFiles(dir)) patchImageTokenFile(file);
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
