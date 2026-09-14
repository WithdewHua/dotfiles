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

  let code = readFileSync(fffIndex, "utf8");
  let modified = false;

  // 1. Add lifecycleId to fffExtension closure
  if (!code.includes("let lifecycleId = 0;")) {
    const target = "let activeCwd = process.cwd();";
    const replacement = [
      "let activeCwd = process.cwd();",
      "  // Bumped on every session_start / session_shutdown so an async warmup",
      "  // started for a previous session can detect that it's stale and bail out",
      "  // before touching `finder` / notifying a destroyed UI.",
      "  let lifecycleId = 0;",
    ].join("\n");
    if (code.includes(target)) {
      code = code.replace(target, replacement);
      modified = true;
    }
  }

  // 2. Ensure ensureFinder returns the local handle safely
  if (!code.includes("const created = await pickers.create({")) {
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
    const newEnsure = [
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
    ].join("\n");
    if (code.includes(oldEnsure)) {
      code = code.replace(oldEnsure, newEnsure);
      modified = true;
    }
  }

  // 3. Make session_start non-blocking
  if (!code.includes("const sessionLifecycleId = ++lifecycleId;")) {
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

    const newSessionStart = [
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
    ].join("\n");

    if (code.includes(oldSessionStart)) {
      code = code.replace(oldSessionStart, newSessionStart);
      modified = true;
    }
  }

  // 4. Bump lifecycleId on session_shutdown
  if (!code.includes("lifecycleId++;\n    destroyFinder();")) {
    const oldShutdown = [
      '  pi.on("session_shutdown", async () => {',
      "    destroyFinder();",
      "  });",
    ].join("\n");
    const newShutdown = [
      '  pi.on("session_shutdown", async () => {',
      "    lifecycleId++;",
      "    destroyFinder();",
      "  });",
    ].join("\n");
    if (code.includes(oldShutdown)) {
      code = code.replace(oldShutdown, newShutdown);
      modified = true;
    }
  }

  if (modified) {
    writeFileSync(fffIndex, code);
    console.log(
      "[pi-packages] Successfully patched @ff-labs/pi-fff with non-blocking session_start warmup"
    );
  } else {
    console.log("[pi-packages] @ff-labs/pi-fff is already fully patched");
  }
}

if (process.argv[1] && process.argv[1].endsWith("patch-pi-fff.mjs")) {
  patchPiFff();
}
