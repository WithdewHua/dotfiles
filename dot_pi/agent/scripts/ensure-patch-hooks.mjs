// Make sure ~/.pi/agent/npm/package.json runs the extension patches after every
// dependency change.
//
// Pi updates packages with `npm install <package> --prefix ...`, which skips the
// root postinstall. The "dependencies" hook runs after node_modules actually
// changes, so keep it together with postinstall (plain npm install/ci) and patch
// (manual recovery). Shared by the macOS/Linux and Windows apply scripts.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const pkgPath = join(homedir(), ".pi", "agent", "npm", "package.json");
if (!existsSync(pkgPath)) process.exit(0);

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.scripts = pkg.scripts || {};
let modified = false;
for (const hook of ["dependencies", "postinstall", "patch"]) {
  if (pkg.scripts[hook] !== "node ../scripts/patch-all.mjs") {
    pkg.scripts[hook] = "node ../scripts/patch-all.mjs";
    modified = true;
  }
}

if (modified) {
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
  console.log("[pi-packages] Configured auto-patch dependencies/postinstall hooks in npm package.json");
}
