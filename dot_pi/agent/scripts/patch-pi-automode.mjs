import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export function patchPiAutomode() {
  const extensionPath = join(
    homedir(),
    ".pi",
    "agent",
    "npm",
    "node_modules",
    "@czottmann",
    "pi-automode",
    "extensions",
    "auto-mode",
    "extension.ts"
  );

  if (!existsSync(extensionPath)) {
    console.log(
      "[pi-packages] @czottmann/pi-automode is not installed; skipping patch"
    );
    return;
  }

  const code = readFileSync(extensionPath, "utf8");

  // 1. Check if already patched
  const patchedPattern =
    /ctx\.ui\.setStatus\(\s*["']pi-automode["'],\s*cfg\.enabled\s*\?\s*ctx\.ui\.theme\.fg\(["']accent["'],\s*text\)\s*:\s*undefined,\s*\);/m;
  if (patchedPattern.test(code)) {
    console.log(
      "[pi-packages] @czottmann/pi-automode is already patched (hidden from footer when disabled)"
    );
    return;
  }

  // 2. Check if target pattern exists
  const targetPattern =
    /ctx\.ui\.setStatus\(\s*["']pi-automode["'],\s*cfg\.enabled\s*\?\s*ctx\.ui\.theme\.fg\(["']accent["'],\s*text\)\s*:\s*ctx\.ui\.theme\.fg\(["']dim["'],\s*text\),\s*\);/m;

  if (!targetPattern.test(code)) {
    console.warn(
      "[pi-packages] Target setStatus pattern not found in @czottmann/pi-automode/extensions/auto-mode/extension.ts; skipping patch"
    );
    return;
  }

  // 3. Perform patch: hide status from footer by passing undefined when disabled
  const newCode = code.replace(
    targetPattern,
    `ctx.ui.setStatus(
        "pi-automode",
        cfg.enabled
          ? ctx.ui.theme.fg("accent", text)
          : undefined,
      );`
  );

  writeFileSync(extensionPath, newCode, "utf8");
  console.log(
    "[pi-packages] Successfully patched @czottmann/pi-automode (hidden from footer when disabled)"
  );
}

if (process.argv[1] && process.argv[1].endsWith("patch-pi-automode.mjs")) {
  patchPiAutomode();
}
