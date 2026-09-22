import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";

export function patchAft() {
  const aftIndex = join(
    homedir(),
    ".pi",
    "agent",
    "npm",
    "node_modules",
    "@cortexkit",
    "aft-pi",
    "dist",
    "index.js"
  );
  if (!existsSync(aftIndex)) {
    console.log("[pi-packages] @cortexkit/aft-pi is not installed; skipping patch");
    return;
  }

  const originalCode = readFileSync(aftIndex, "utf8");

  // 1. Check if already fully patched
  const checks = {
    canonicalKeys: originalCode.includes('"then_run"])'),
    editParamsSchema: /then_run:\s*Type\w*\.Optional\(Type\w*\.Object\(/.test(originalCode),
    writeParamsSchema: /var\s+WriteParams\s*=\s*Type\w*\.Object\([\s\S]*?then_run:/.test(originalCode),
    executeThenRunHelper: originalCode.includes("async function executeThenRun("),
    editExecThenRun:
      originalCode.includes('callToolCall(bridge, "edit", rawArgs, extCtx)') &&
      originalCode.includes("const mutationResult = buildMutationResult(response);"),
    writeExecThenRun:
      originalCode.includes('callToolCall(bridge, "write", rawArgs, extCtx)') &&
      originalCode.includes("const mutationResult = buildMutationResult(response);"),
    solPiBanner:
      originalCode.includes("context.args?.then_run") &&
      originalCode.includes("Money saved · 1 model round-trip avoided"),
    toolNameLabels: originalCode.includes("return renderMutationCall(editName,"),
    expandedDiff: originalCode.includes("expanded: true,\n    context\n  });\n}\nfunction shortenPath"),
  };

  const isAlreadyFullyPatched = Object.values(checks).every(Boolean);
  if (process.argv.includes("--check")) {
    if (isAlreadyFullyPatched) {
      console.log("[pi-packages] @cortexkit/aft-pi is already fully patched (all 9 features verified)");
    } else {
      console.log("[pi-packages] @cortexkit/aft-pi is NOT fully patched. Status:", checks);
    }
    return;
  }
  if (isAlreadyFullyPatched) {
    console.log("[pi-packages] @cortexkit/aft-pi is already fully patched (all 9 features verified)");
    return;
  }

  // 2. Pre-flight check for unpatched upstream structure
  // Detect bundler mangled identifiers dynamically from local scopes
  const typeMatch = originalCode.match(/var\s+WriteParams\s*=\s*(Type\w*)\.Object\(/);
  const typeIdent = typeMatch ? typeMatch[1] : "Type2";

  // Match renderMutationCall to extract local Text/reuseText/shortenPath identifiers
  const renderMutationMatch = originalCode.match(
    /function\s+renderMutationCall\s*\(\s*toolName\s*,\s*filePath\s*,\s*theme\s*,\s*context\s*\)\s*\{([\s\S]*?)\n\}/
  );

  let reuseTextIdent = "reuseText2";
  let shortenPathIdent = "shortenPath3";
  let textIdent = "Text2";
  let reuseContainerIdent = "reuseContainer2";

  if (renderMutationMatch) {
    const fnBody = renderMutationMatch[1];
    const rtMatch = fnBody.match(/const\s+text\s*=\s*(\w+)\s*\(/);
    if (rtMatch) reuseTextIdent = rtMatch[1];

    const spMatch = fnBody.match(/(\w+)\s*\(\s*filePath\s*\)/);
    if (spMatch) shortenPathIdent = spMatch[1];
  }

  // Find container helper from adjacent definition preceding renderMutationCall
  const rmcIdx = originalCode.indexOf("function renderMutationCall(");
  if (rmcIdx !== -1) {
    const preceding = originalCode.slice(Math.max(0, rmcIdx - 2000), rmcIdx);
    const containerMatch = preceding.match(
      /function\s+(reuseContainer\w*)\s*\(\s*last\s*\)\s*\{[\s\S]*?new\s+(\w+)/
    );
    if (containerMatch) {
      reuseContainerIdent = containerMatch[1];
      textIdent = containerMatch[2].replace("Container", "Text");
    }
  }

  // Key anchors that MUST exist for safe atomic patching
  const anchorChecks = {
    canonicalKeys: originalCode.includes(
      'var EDIT_ROOT_CANONICAL_KEYS = new Set(["path", "appendContent", "edits", "symbol", "content"'
    ),
    editParams: originalCode.includes("var EditParams = "),
    writeParams: originalCode.includes("var WriteParams = "),
    renderMutationCall: originalCode.includes("function renderMutationCall("),
    editExec: originalCode.includes('callToolCall(bridge, "edit", rawArgs, extCtx);'),
    writeExec: originalCode.includes('callToolCall(bridge, "write", rawArgs, extCtx);'),
    renderReadCall: originalCode.includes("function renderReadCall("),
  };

  const criticalAnchorsOk = Object.values(anchorChecks).every(Boolean);
  if (!criticalAnchorsOk) {
    console.warn("[pi-packages] WARNING: @cortexkit/aft-pi upstream source has drifted!");
    console.warn(`[pi-packages] Anchor validation results:`, anchorChecks);
    console.warn(
      "[pi-packages] Aborting patch to prevent code corruption. Please inspect upstream changes."
    );
    return;
  }

  // 3. Apply atomic replacements
  let code = originalCode;
  let modified = false;

  // 1. Allow then_run in canonical root keys
  if (!code.includes('"then_run"])')) {
    code = code.replace(
      'var EDIT_ROOT_CANONICAL_KEYS = new Set(["path", "appendContent", "edits", "symbol", "content"]);',
      'var EDIT_ROOT_CANONICAL_KEYS = new Set(["path", "appendContent", "edits", "symbol", "content", "then_run"]);'
    );
    modified = true;
  }

  // 2. Add then_run schema to EditParams using detected typeIdent
  const oldEditParamsSuffix = [
    '    description: "Batch edits — non-empty array of { oldString, newString }, { oldString, newString, replaceAll: true }, or { startLine, endLine, content } objects applied atomically."',
    "  }))",
    "});",
  ].join("\n");
  const newEditParamsSuffix = [
    '    description: "Batch edits — non-empty array of { oldString, newString }, { oldString, newString, replaceAll: true }, or { startLine, endLine, content } objects applied atomically."',
    "  })),",
    `  then_run: ${typeIdent}.Optional(${typeIdent}.Object({`,
    `    command: ${typeIdent}.String({ description: "Bash command to execute" }),`,
    `    timeout: ${typeIdent}.Optional(${typeIdent}.Number({ description: "Timeout in seconds (optional, no default timeout)" }))`,
    '  }, { description: "Command to run next on this file after the edit succeeds — e.g. run, build, start/restart, install, or check it; optional timeout in seconds. Skipped if the edit fails; a non-zero exit is reported but keeps the edit." }))',
    "});",
  ].join("\n");
  if (code.includes(oldEditParamsSuffix) && !code.includes("then_run: " + typeIdent)) {
    code = code.replace(oldEditParamsSuffix, newEditParamsSuffix);
    modified = true;
  }

  // 3. Add then_run schema to WriteParams
  const oldWriteParams = [
    `var WriteParams = ${typeIdent}.Object({`,
    `  path: ${typeIdent}.String({`,
    '    description: "Path to the file to write (absolute or relative to project root)"',
    "  }),",
    `  content: ${typeIdent}.String({ description: "Full file contents to write" })`,
    "});",
  ].join("\n");
  const newWriteParams = [
    `var WriteParams = ${typeIdent}.Object({`,
    `  path: ${typeIdent}.String({`,
    '    description: "Path to the file to write (absolute or relative to project root)"',
    "  }),",
    `  content: ${typeIdent}.String({ description: "Full file contents to write" }),`,
    `  then_run: ${typeIdent}.Optional(${typeIdent}.Object({`,
    `    command: ${typeIdent}.String({ description: "Bash command to execute" }),`,
    `    timeout: ${typeIdent}.Optional(${typeIdent}.Number({ description: "Timeout in seconds (optional, no default timeout)" }))`,
    '  }, { description: "Command to run next on this file after the edit succeeds — e.g. run, build, start/restart, install, or check it; optional timeout in seconds. Skipped if the edit fails; a non-zero exit is reported but keeps the edit." }))',
    "});",
  ].join("\n");
  if (code.includes(oldWriteParams)) {
    code = code.replace(oldWriteParams, newWriteParams);
    modified = true;
  }

  // 4. Inject executeThenRun helper
  if (!code.includes("async function executeThenRun")) {
    const helper = `
async function executeThenRun(thenRun, extCtx, toolCallId) {
  if (!thenRun || typeof thenRun !== "object" || !thenRun.command) return null;
  try {
    const { createBashToolDefinition } = await import("@earendil-works/pi-coding-agent");
    const bash = createBashToolDefinition(extCtx.cwd);
    const bashResult = await bash.execute(\`\${toolCallId}:then_run\`, thenRun, undefined, undefined, extCtx);
    const bashText = bashResult.content.filter((c) => c.type === "text").map((c) => c.text).join("\\n");

    if (extCtx?.mode === "tui" && extCtx.ui) {
      try {
        extCtx.ui.notify("⚡ SoL-Pi · Action Fusion\\nMoney saved · 1 model round-trip avoided", "info");
        extCtx.ui.setStatus("sol-pi", "⚡ Action Fusion · 1 model round-trip avoided");
        setTimeout(() => {
          extCtx.ui.setStatus("sol-pi", undefined);
        }, 5000);
      } catch {}
    }

    return bashText ? \`[then_run:succeeded]\\n\${bashText}\` : "[then_run:succeeded]";
  } catch (err) {
    return \`[then_run:failed]\\n\${err instanceof Error ? err.message : String(err)}\`;
  }
}
`;
    code = code.replace("function renderMutationCall(", helper + "\nfunction renderMutationCall(");
    modified = true;
  }

  // 5 & 6. Edit & Write execute hooks
  const oldWriteExec = [
    '        const response = await callToolCall(bridge, "write", rawArgs, extCtx);',
    "        if (response.success === false) {",
    '          throw toolErrorFromResponse("write", response);',
    "        }",
    "        return buildMutationResult(response);",
  ].join("\n");
  const newWriteExec = [
    '        const response = await callToolCall(bridge, "write", rawArgs, extCtx);',
    "        if (response.success === false) {",
    '          throw toolErrorFromResponse("write", response);',
    "        }",
    "        const mutationResult = buildMutationResult(response);",
    "        if (params.then_run && response.rolled_back !== true) {",
    "          const thenRunOutput = await executeThenRun(params.then_run, extCtx, _toolCallId);",
    "          if (thenRunOutput) {",
    '            mutationResult.content.push({ type: "text", text: thenRunOutput });',
    "          }",
    "        }",
    "        return mutationResult;",
  ].join("\n");
  if (code.includes(oldWriteExec)) {
    code = code.replace(oldWriteExec, newWriteExec);
    modified = true;
  }

  const oldEditExec = [
    '        const response = await callToolCall(bridge, "edit", rawArgs, extCtx);',
    "        if (response.success === false) {",
    '          throw toolErrorFromResponse("edit", response);',
    "        }",
    "        return buildMutationResult(response);",
  ].join("\n");
  const newEditExec = [
    '        const response = await callToolCall(bridge, "edit", rawArgs, extCtx);',
    "        if (response.success === false) {",
    '          throw toolErrorFromResponse("edit", response);',
    "        }",
    "        const mutationResult = buildMutationResult(response);",
    "        if (params.then_run && response.rolled_back !== true) {",
    "          const thenRunOutput = await executeThenRun(params.then_run, extCtx, _toolCallId);",
    "          if (thenRunOutput) {",
    '            mutationResult.content.push({ type: "text", text: thenRunOutput });',
    "          }",
    "        }",
    "        return mutationResult;",
  ].join("\n");
  if (code.includes(oldEditExec)) {
    code = code.replace(oldEditExec, newEditExec);
    modified = true;
  }

  // 7. Render SoL-Pi banner badge using detected UI identifiers
  if (!code.includes("context.args?.then_run")) {
    const oldRenderCall = [
      "function renderMutationCall(toolName, filePath, theme, context) {",
      `  const text = ${reuseTextIdent}(context.lastComponent);`,
      `  const pathDisplay = filePath ? theme.fg("accent", ${shortenPathIdent}(filePath)) : theme.fg("toolOutput", "...");`,
      '  text.setText(`${theme.fg("toolTitle", theme.bold(toolName))} ${pathDisplay}`);',
      "  return text;",
      "}",
    ].join("\n");
    const newRenderCall = [
      "function renderMutationCall(toolName, filePath, theme, context) {",
      `  const pathDisplay = filePath ? theme.fg("accent", ${shortenPathIdent}(filePath)) : theme.fg("toolOutput", "...");`,
      '  const baseTitle = `${theme.fg("toolTitle", theme.bold(toolName))} ${pathDisplay}`;',
      "  if (context.args?.then_run) {",
      `    const container = ${reuseContainerIdent}(context.lastComponent);`,
      "    container.clear();",
      `    container.addChild(new ${textIdent}(\`\${theme.fg("warning", "⚡")} \${theme.fg("accent", theme.bold("SoL-Pi · Action Fusion"))}\`, 0, 0));`,
      `    container.addChild(new ${textIdent}(theme.fg("success", "Money saved · 1 model round-trip avoided"), 0, 0));`,
      `    container.addChild(new ${textIdent}(baseTitle, 0, 0));`,
      "    return container;",
      "  }",
      `  const text = ${reuseTextIdent}(context.lastComponent);`,
      "  text.setText(baseTitle);",
      "  return text;",
      "}",
    ].join("\n");
    if (code.includes(oldRenderCall)) {
      code = code.replace(oldRenderCall, newRenderCall);
      modified = true;
    }
  }

  // 8. Tool name labels
  if (
    code.includes(
      'return renderMutationCall("edit", mutationFilePathArg(args ?? {}), theme, context);'
    )
  ) {
    code = code.replace(
      'return renderMutationCall("edit", mutationFilePathArg(args ?? {}), theme, context);',
      "return renderMutationCall(editName, mutationFilePathArg(args ?? {}), theme, context);"
    );
    modified = true;
  }
  if (
    code.includes(
      'return renderMutationCall("write", mutationFilePathArg(args ?? {}), theme, context);'
    )
  ) {
    code = code.replace(
      'return renderMutationCall("write", mutationFilePathArg(args ?? {}), theme, context);',
      "return renderMutationCall(writeName, mutationFilePathArg(args ?? {}), theme, context);"
    );
    modified = true;
  }
  if (code.includes("return renderReadCall(args, theme, context);")) {
    code = code.replace(
      "return renderReadCall(args, theme, context);",
      "return renderReadCall(readName, args, theme, context);"
    );
    code = code.replace(
      "function renderReadCall(args, theme, context) {\n  const text = " +
        reuseTextIdent +
        '(context.lastComponent);\n  const filePath = args ? readPathArg(args) : undefined;\n  const pathDisplay = filePath ? theme.fg("accent", ' +
        shortenPathIdent +
        '(filePath)) : theme.fg("toolOutput", "...");\n  text.setText(`${theme.fg("toolTitle", theme.bold("read"))} ${pathDisplay}`);\n  return text;\n}',
      'function renderReadCall(toolName, args, theme, context) {\n  const text = ' +
        reuseTextIdent +
        '(context.lastComponent);\n  const filePath = args ? readPathArg(args) : undefined;\n  const pathDisplay = filePath ? theme.fg("accent", ' +
        shortenPathIdent +
        '(filePath)) : theme.fg("toolOutput", "...");\n  text.setText(`${theme.fg("toolTitle", theme.bold(typeof toolName === "string" ? toolName : "read"))} ${pathDisplay}`);\n  return text;\n}'
    );
    modified = true;
  }

  // 9. Expanded diff
  const oldDiffPattern =
    /expanded:\s*options\.expanded,\s*context\s*\n\s*\}\);\s*\n\}\s*\nfunction\s+shortenPath/;
  if (oldDiffPattern.test(code)) {
    code = code.replace(
      /expanded:\s*options\.expanded,\s*context\s*\n\s*\}\);\s*\n\}\s*\nfunction\s+shortenPath/,
      "expanded: true,\n    context\n  });\n}\nfunction shortenPath"
    );
    modified = true;
  }

  // 4. Save and Validate
  if (modified) {
    writeFileSync(aftIndex, code);
    try {
      execSync(`node -c "${aftIndex}"`, { stdio: "pipe" });
      console.log(
        "[pi-packages] Successfully patched @cortexkit/aft-pi with then_run, toolName labels, and expanded diffs (syntax validated)"
      );
    } catch (err) {
      console.error(
        "[pi-packages] FATAL: Syntax check failed after patching @cortexkit/aft-pi! Rolling back...",
        err.message
      );
      writeFileSync(aftIndex, originalCode);
    }
  } else {
    console.warn(
      "[pi-packages] WARNING: @cortexkit/aft-pi patch attempted, but no replacements took place (check if code has drifted)"
    );
  }
}

patchAft();
