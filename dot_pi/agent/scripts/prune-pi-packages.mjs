// Prune Pi npm/git packages that are no longer listed in settings.json.
//
// Shared by the macOS/Linux bash script and the Windows PowerShell script so the
// prune rules stay identical on every platform. Reads ~/.pi/agent/settings.json.
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { homedir } from "node:os";

const agentDir = join(homedir(), ".pi", "agent");
const settingsPath = join(agentDir, "settings.json");
if (!existsSync(settingsPath)) process.exit(0);

const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
const configuredPackages = settings.packages || [];

const sourceOf = (pkg) => (typeof pkg === "string" ? pkg : pkg.source);

// Prune unneeded npm packages
const npmDir = join(agentDir, "npm");
const npmPackageJsonPath = join(npmDir, "package.json");
if (existsSync(npmPackageJsonPath)) {
  const npmPkg = JSON.parse(readFileSync(npmPackageJsonPath, "utf8"));
  const installedDeps = Object.keys(npmPkg.dependencies || {});
  const configuredNpm = new Set();
  for (const p of configuredPackages) {
    const s = sourceOf(p);
    if (s.startsWith("npm:")) {
      const spec = s.slice(4);
      if (spec.startsWith("@")) {
        configuredNpm.add("@" + spec.slice(1).split("@")[0]);
      } else {
        configuredNpm.add(spec.split("@")[0]);
      }
    }
  }
  const toRemove = installedDeps.filter((d) => !configuredNpm.has(d));
  for (const pkg of toRemove) {
    console.log(`[pi-packages] Pruning unneeded npm package: ${pkg}`);
    try {
      execSync(`npm rm ${pkg} --legacy-peer-deps --no-audit --no-fund`, {
        cwd: npmDir,
        stdio: "inherit",
      });
    } catch (e) {
      console.error(`[pi-packages] Failed to remove ${pkg}:`, e.message);
    }
  }
  if (toRemove.length === 0) {
    console.log("[pi-packages] No unneeded npm packages to prune");
  }
}

// Prune unneeded git packages
const gitDir = join(agentDir, "git");
if (existsSync(gitDir)) {
  const configuredGitPaths = new Set();
  for (const p of configuredPackages) {
    const s = sourceOf(p);
    if (s.startsWith("git:")) {
      const cleaned = s
        .slice(4)
        .replace(/^https?:\/\//, "")
        .replace(/\.git$/, "")
        .split("@")[0];
      configuredGitPaths.add(cleaned.toLowerCase());
    }
  }
  let pruned = 0;
  try {
    for (const host of readdirSync(gitDir)) {
      const hostDir = join(gitDir, host);
      if (!statSync(hostDir).isDirectory()) continue;
      for (const owner of readdirSync(hostDir)) {
        const ownerDir = join(hostDir, owner);
        if (!statSync(ownerDir).isDirectory()) continue;
        for (const repo of readdirSync(ownerDir)) {
          const repoDir = join(ownerDir, repo);
          if (!statSync(repoDir).isDirectory()) continue;
          const repoPath = `${host}/${owner}/${repo}`.toLowerCase();
          if (!configuredGitPaths.has(repoPath)) {
            console.log(`[pi-packages] Pruning unneeded git package: ${host}/${owner}/${repo}`);
            rmSync(repoDir, { recursive: true, force: true });
            pruned += 1;
          }
        }
      }
    }
  } catch (err) {
    console.error("[pi-packages] Git prune scan failed:", err.message);
  }
  if (pruned === 0) {
    console.log("[pi-packages] No unneeded git packages to prune");
  }
}
