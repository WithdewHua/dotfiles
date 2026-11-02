import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const MARKER = "sameModelIdentityKey";

const SAME_MODEL_PATTERN =
  /var sameModelAdvisorDisabled = \(ctx, model = ctx\.model, advisorModelRef = advisorRef\) => \{[\s\S]*?\n\};/m;

const buildReplacement = () => `// Same-model guard compares the underlying model, not the literal \`provider/id\`
// ref. A gateway can expose one model through several routes
// (\`auto/<id>\`, \`agentrouter/<id>\`, \`group/<id>\`, bare \`<id>\`), and the same
// model can be reachable through several providers (\`company/glm-5.3\` vs
// \`magpie/glm-5.3\`), so model identity is the id without its routing prefixes:
// its last path segment, compared provider-independently.
var ${MARKER} = (modelId) => {
  const segments = modelId.split("/").filter(Boolean);
  return (segments.at(-1) ?? "").toLowerCase();
};
var sameModelAdvisorDisabled = (ctx, model = ctx.model, advisorModelRef = advisorRef) => {
  const selectedAdvisorRef = advisorModelRef ?? advisorRef;
  if (!(advisorDisableSameModelRef && selectedAdvisorRef && model)) {
    return false;
  }
  const executorKey = ${MARKER}(model.id);
  const advisorKey = ${MARKER}(splitRef(selectedAdvisorRef)[1] ?? "");
  return Boolean(executorKey) && executorKey === advisorKey;
};`;

export function patchPiAdvisorFlow() {
  const distPath = join(
    homedir(),
    ".pi",
    "agent",
    "npm",
    "node_modules",
    "pi-advisor-flow",
    "dist",
    "index.js"
  );

  if (!existsSync(distPath)) {
    console.log(
      "[pi-packages] pi-advisor-flow is not installed; skipping patch"
    );
    return;
  }

  const code = readFileSync(distPath, "utf8");

  if (code.includes(MARKER)) {
    console.log(
      "[pi-packages] pi-advisor-flow is already patched (same-model guard matches route-prefixed model ids)"
    );
    return;
  }

  const target = SAME_MODEL_PATTERN.exec(code);
  const targetText = target?.[0];

  if (
    !targetText ||
    !targetText.includes("provider === model.provider && id === model.id")
  ) {
    console.warn(
      "[pi-packages] Target same-model guard not found in pi-advisor-flow/dist/index.js; skipping patch"
    );
    return;
  }

  writeFileSync(
    distPath,
    code.replace(targetText, buildReplacement()),
    "utf8"
  );
  console.log(
    "[pi-packages] Successfully patched pi-advisor-flow (same-model guard matches route-prefixed model ids)"
  );
}

if (process.argv[1] && process.argv[1].endsWith("patch-pi-advisor-flow.mjs")) {
  patchPiAdvisorFlow();
}
