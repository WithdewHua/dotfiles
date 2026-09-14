import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export function patchPiFff() {
  const fffIndex = join(
    homedir(),
    ".pi",
    "agent",
    "npm",
    "node_modules",
    "@ff-labs",
    "pi-fff",
    "src",
    "index.ts"
  );
  if (!existsSync(fffIndex)) {
    console.log("[pi-packages] @ff-labs/pi-fff is not installed; skipping patch");
    return;
  }

  const code = readFileSync(fffIndex, "utf8");

  // 1. Check if already patched by this script
  const isAlreadyPatched =
    code.includes("const sessionLifecycleId = ++lifecycleId;") &&
    code.includes("let lifecycleId = 0;");

  if (isAlreadyPatched) {
    console.log(
      "[pi-packages] @ff-labs/pi-fff is already fully patched (non-blocking warmup active)"
    );
    return;
  }

  // 2. Check if upstream has natively resolved the blocking scan (e.g. PR #599 merged)
  const hasBlockingEnsureFinderInSessionStart =
    /pi\.on\(\s*["']session_start["'][\s\S]*?await\s+ensureFinder\(/m.test(code);

  if (!hasBlockingEnsureFinderInSessionStart) {
    console.log(
      "[pi-packages] @ff-labs/pi-fff upstream does not contain blocking 'await ensureFinder' in session_start; skipping patch (upstream may have resolved it)"
    );
    return;
  }

  // Targets for atomic patch
  const target1 = "let activeCwd = process.cwd();";
  const oldEnsure = [
    '      if (!pickers) throw new Error("FFF picker factory is not initialized");',
    "      mainFinder = await pickers.create({",
    "        basePath: cwd,",
    "        enableHomeDirScanning,",
    "        enableFsRootScanning,",
    "        followSymlinks,",
    "      });",
    "      finderCwd = cwd;",
    "      return mainFinder;",
  ].join("\n");

  const oldSessionStart = [
    '  pi.on("session_start", async (_event, ctx) => {',
    "    try {",
    "      prepareSession(ctx);",
    "      registerAutocompleteProvider(ctx);",
    "      await ensureFinder(activeCwd);",
    "",
    "      // Warn when launched from $HOME with home scanning on: indexing a large",
    "      // home tree can run for a long time in the background (issue #743).",
    "      const atHome = enableHomeDirScanning && isHomeDir(activeCwd);",
    "      if (atHome) {",
    "        warnHomeDirScan(activeCwd);",
    "        ctx.ui.setStatus?.(",
    '          HOME_SCAN_STATUS_KEY,',
    '          "Agent is indexing $HOME, this can lead to high CPU",',
    "        );",
    "      }",
    "",
    "      // waitForScan() also resolves on timeout, so poll until the scan really",
    "      // settles before clearing the footer.",
    "      if (atHome) trackHomeScanStatus();",
    "    } catch (error: unknown) {",
    "      reportInitFailure(ctx, error);",
    "    }",
    "  });",
  ].join("\n");

  const oldShutdown = [
    '  pi.on("session_shutdown", async () => {',
    "    destroyFinder();",
    "  });",
  ].join("\n");

  // 3. Safety check: All 4 targets must match for atomic patching
  const canPatchT1 = code.includes(target1);
  const canPatchT2 = code.includes(oldEnsure);
  const canPatchT3 = code.includes(oldSessionStart);
  const canPatchT4 = code.includes(oldShutdown);

  if (!canPatchT1 || !canPatchT2 || !canPatchT3 || !canPatchT4) {
    console.warn(
      "[pi-packages] WARNING: @ff-labs/pi-fff upstream source structure has changed!"
    );
    console.warn(
      `[pi-packages] Match results: activeCwd=${canPatchT1}, pickersCreate=${canPatchT2}, sessionStart=${canPatchT3}, shutdown=${canPatchT4}`
    );
    console.warn(
      "[pi-packages] Aborting patch to prevent code corruption. Please review upstream changes."
    );
    return;
  }

  // 4. Perform atomic replacement
  let newCode = code;

  // Step 1: Add lifecycleId
  newCode = newCode.replace(
    target1,
    [
      "let activeCwd = process.cwd();",
      "  // Bumped on every session_start / session_shutdown so an async warmup",
      "  // started for a previous session can detect that it's stale and bail out",
      "  // before touching `finder` / notifying a destroyed UI.",
      "  let lifecycleId = 0;",
    ].join("\n")
  );

  // Step 2: Safe handle return in ensureFinder
  newCode = newCode.replace(
    oldEnsure,
    [
      '      if (!pickers) throw new Error("FFF picker factory is not initialized");',
      "      const created = await pickers.create({",
      "        basePath: cwd,",
      "        enableHomeDirScanning,",
      "        enableFsRootScanning,",
      "        followSymlinks,",
      "      });",
      "      mainFinder = created;",
      "      finderCwd = cwd;",
      "      // Return the local handle: a shutdown during warmup may null/replace",
      "      // `mainFinder`, but the caller still needs the instance they were promised.",
      "      return created;",
    ].join("\n")
  );

  // Step 3: Non-blocking session_start
  newCode = newCode.replace(
    oldSessionStart,
    [
      '  pi.on("session_start", async (_event, ctx) => {',
      "    try {",
      "      prepareSession(ctx);",
      "      registerAutocompleteProvider(ctx);",
      "      const sessionLifecycleId = ++lifecycleId;",
      "",
      "      // Warm the finder in the background — Pi /new and /resume must not",
      "      // wait on the initial scan. Subsequent tool calls / mention lookups",
      "      // share the same in-flight promise via ensureFinder().",
      "      setTimeout(() => {",
      "        if (sessionLifecycleId !== lifecycleId) return;",
      "        ensureFinder(activeCwd)",
      "          .then(() => {",
      "            if (sessionLifecycleId !== lifecycleId) return;",
      "            const atHome = enableHomeDirScanning && isHomeDir(activeCwd);",
      "            if (atHome) {",
      "              warnHomeDirScan(activeCwd);",
      "              ctx.ui.setStatus?.(",
      '                HOME_SCAN_STATUS_KEY,',
      '                "Agent is indexing $HOME, this can lead to high CPU",',
      "              );",
      "              trackHomeScanStatus();",
      "            }",
      "          })",
      "          .catch((error: unknown) => {",
      "            if (sessionLifecycleId !== lifecycleId) return;",
      "            reportInitFailure(ctx, error);",
      "          });",
      "      }, 0);",
      "    } catch (error: unknown) {",
      "      reportInitFailure(ctx, error);",
      "    }",
      "  });",
    ].join("\n")
  );

  // Step 4: Lifecycle bump on shutdown
  newCode = newCode.replace(
    oldShutdown,
    [
      '  pi.on("session_shutdown", async () => {',
      "    lifecycleId++;",
      "    destroyFinder();",
      "  });",
    ].join("\n")
  );

  writeFileSync(fffIndex, newCode);
  console.log(
    "[pi-packages] Successfully patched @ff-labs/pi-fff with non-blocking session_start warmup"
  );
}

if (process.argv[1] && process.argv[1].endsWith("patch-pi-fff.mjs")) {
  patchPiFff();
}
