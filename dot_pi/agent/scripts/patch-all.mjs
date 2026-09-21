import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptsDir = existsSync(join(__dirname, "patch-aft-pi.mjs"))
  ? __dirname
  : join(homedir(), ".pi", "agent", "scripts");

const patches = [
  { name: "aft-pi", file: "patch-aft-pi.mjs" },
  { name: "pi-fff", file: "patch-pi-fff.mjs" },
];

console.log("[pi-packages] Running automated patches for Pi extensions...");

for (const patch of patches) {
  const scriptPath = join(scriptsDir, patch.file);
  if (!existsSync(scriptPath)) {
    console.warn(`[pi-packages] Patch script not found: ${scriptPath}`);
    continue;
  }
  try {
    execSync(`node "${scriptPath}"`, { stdio: "inherit" });
  } catch (error) {
    console.error(`[pi-packages] Failed to execute ${patch.name} patch:`, error.message);
  }
}
