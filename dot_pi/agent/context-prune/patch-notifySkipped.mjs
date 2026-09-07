// Re-applies the notifySkipped guard that upstream pi-context-prune v1.4.0
// is missing on the automatic prune path (flushPending → oversized batches).
// Upstream bug: `notifySkipped: false` only gates the /pruner now manual path;
// the auto path (pruneOn: agent-message / every-turn) notifies unconditionally.
// Run after any `npm install`/upgrade of pi-context-prune:
//   node ~/.pi/agent/context-prune/patch-notifySkipped.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const indexPath =
  process.env.PI_CONTEXT_PRUNE_DIST ||
  join(homedir(), ".pi/agent/npm/node_modules/pi-context-prune/dist/index.js");

const OLD = [
  '        const batchSummaryLen = results[batches.indexOf(batch)]?.summaryText.length ?? 0;',
  '        safeNotify(',
  '          ctx,',
  '          `pruner: skipped pruning turn ${batch.turnIndex} (${batch.toolCalls.length} tool call${batch.toolCalls.length === 1 ? "" : "s"}) \\u2014 summary was ${batchSummaryLen} chars vs ${batchRaw} raw chars; frontier advanced past this range`,',
  '          "warning"',
  '        );',
].join("\n");

const NEW = [
  '        const batchSummaryLen = results[batches.indexOf(batch)]?.summaryText.length ?? 0;',
  '        if (currentConfig.value.notifySkipped) {',
  '          safeNotify(',
  '            ctx,',
  '            `pruner: skipped pruning turn ${batch.turnIndex} (${batch.toolCalls.length} tool call${batch.toolCalls.length === 1 ? "" : "s"}) \\u2014 summary was ${batchSummaryLen} chars vs ${batchRaw} raw chars; frontier advanced past this range`,',
  '            "warning"',
  '          );',
  '        }',
].join("\n");

const src = readFileSync(indexPath, "utf8");

if (src.includes(NEW)) {
  console.log("patch already applied — nothing to do");
  process.exit(0);
}
if (!src.includes(OLD)) {
  console.error(
    "pattern not found — pi-context-prune may have been updated upstream; review manually before re-patching."
  );
  process.exit(1);
}

writeFileSync(indexPath, src.replace(OLD, NEW), "utf8");
console.log("patched:", indexPath);
