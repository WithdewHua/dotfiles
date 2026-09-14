import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export function patchAft() {
  const aftIndex = join(homedir(), ".pi", "agent", "npm", "node_modules", "@cortexkit", "aft-pi", "dist", "index.js");
  if (!existsSync(aftIndex)) return;

  let code = readFileSync(aftIndex, "utf8");
  let modified = false;

  // 1. Allow then_run in canonical root keys
  if (!code.includes('"then_run"])')) {
    code = code.replace(
      'var EDIT_ROOT_CANONICAL_KEYS = new Set(["path", "appendContent", "edits", "symbol", "content"]);',
      'var EDIT_ROOT_CANONICAL_KEYS = new Set(["path", "appendContent", "edits", "symbol", "content", "then_run"]);'
    );
    modified = true;
  }

  // 2. Add then_run schema to EditParams
  if (!code.includes('then_run: Type2.Optional(Type2.Object({\n    command: Type2.String({ description: "Bash command to execute" }')) {
    const oldEditParams = [
      'edits: Type2.Optional(Type2.Array(BatchEditParams, {',
      '    minItems: 1,',
      '    description: "Batch edits — non-empty array of { oldString, newString }, { oldString, newString, replaceAll: true }, or { startLine, endLine, content } objects applied atomically."',
      '  }))',
      '});'
    ].join('\n');
    const newEditParams = [
      'edits: Type2.Optional(Type2.Array(BatchEditParams, {',
      '    minItems: 1,',
      '    description: "Batch edits — non-empty array of { oldString, newString }, { oldString, newString, replaceAll: true }, or { startLine, endLine, content } objects applied atomically."',
      '  })),',
      '  then_run: Type2.Optional(Type2.Object({',
      '    command: Type2.String({ description: "Bash command to execute" }),',
      '    timeout: Type2.Optional(Type2.Number({ description: "Timeout in seconds (optional, no default timeout)" }))',
      '  }, { description: "Command to run next on this file after the edit succeeds — e.g. run, build, start/restart, install, or check it; optional timeout in seconds. Skipped if the edit fails; a non-zero exit is reported but keeps the edit." }))',
      '});'
    ].join('\n');
    code = code.replace(oldEditParams, newEditParams);
    modified = true;
  }

  // 3. Add then_run schema to WriteParams
  if (!code.includes('var WriteParams = Type2.Object({\n  path: Type2.String({\n    description: "Path to the file to write (absolute or relative to project root)"\n  }),\n  content: Type2.String({ description: "Full file contents to write" }),\n  then_run:')) {
    const oldWriteParams = [
      'var WriteParams = Type2.Object({',
      '  path: Type2.String({',
      '    description: "Path to the file to write (absolute or relative to project root)"',
      '  }),',
      '  content: Type2.String({ description: "Full file contents to write" })',
      '});'
    ].join('\n');
    const newWriteParams = [
      'var WriteParams = Type2.Object({',
      '  path: Type2.String({',
      '    description: "Path to the file to write (absolute or relative to project root)"',
      '  }),',
      '  content: Type2.String({ description: "Full file contents to write" }),',
      '  then_run: Type2.Optional(Type2.Object({',
      '    command: Type2.String({ description: "Bash command to execute" }),',
      '    timeout: Type2.Optional(Type2.Number({ description: "Timeout in seconds (optional, no default timeout)" }))',
      '  }, { description: "Command to run next on this file after the write succeeds — e.g. run, build, start/restart, install, or check it; optional timeout in seconds. Skipped if the write fails; a non-zero exit is reported but keeps the edit." }))',
      '});'
    ].join('\n');
    code = code.replace(oldWriteParams, newWriteParams);
    modified = true;
  }

  // 4. Inject executeThenRun helper with SoL-Pi savings notification
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

  // 5. In edit execute: run then_run if edit succeeded and was not rolled back
  if (!code.includes("argsRecord.then_run && response.rolled_back !== true")) {
    const oldEditExec = [
      'return buildMutationResult(response);',
      '      },',
      '      renderCall(args, theme, context) {'
    ].join('\n');
    const newEditExec = [
      'const mutationResult = buildMutationResult(response);',
      '        if (argsRecord.then_run && response.rolled_back !== true) {',
      '          const thenRunOutput = await executeThenRun(argsRecord.then_run, extCtx, _toolCallId);',
      '          if (thenRunOutput) {',
      '            mutationResult.content.push({ type: "text", text: thenRunOutput });',
      '          }',
      '        }',
      '        return mutationResult;',
      '      },',
      '      renderCall(args, theme, context) {'
    ].join('\n');
    code = code.replace(oldEditExec, newEditExec);
    modified = true;
  }

  // 6. In write execute: run then_run
  if (!code.includes("params.then_run && response.rolled_back !== true")) {
    const oldWriteExec = [
      'return buildMutationResult(response);',
      '      },',
      '      renderCall(args, theme, context) {'
    ].join('\n');
    const newWriteExec = [
      'const mutationResult = buildMutationResult(response);',
      '        if (params.then_run && response.rolled_back !== true) {',
      '          const thenRunOutput = await executeThenRun(params.then_run, extCtx, _toolCallId);',
      '          if (thenRunOutput) {',
      '            mutationResult.content.push({ type: "text", text: thenRunOutput });',
      '          }',
      '        }',
      '        return mutationResult;',
      '      },',
      '      renderCall(args, theme, context) {'
    ].join('\n');
    code = code.replace(oldWriteExec, newWriteExec);
    modified = true;
  }

  // 7. Render SoL-Pi banner badge on tool call
  if (!code.includes("⚡ SoL-Pi · Action Fusion")) {
    const oldRenderCall = [
      'function renderMutationCall(toolName, filePath, theme, context) {',
      '  const text = reuseText2(context.lastComponent);',
      '  const pathDisplay = filePath ? theme.fg("accent", shortenPath3(filePath)) : theme.fg("toolOutput", "...");',
      '  text.setText(`${theme.fg("toolTitle", theme.bold(toolName))} ${pathDisplay}`);',
      '  return text;',
      '}'
    ].join('\n');
    const newRenderCall = [
      'function renderMutationCall(toolName, filePath, theme, context) {',
      '  const pathDisplay = filePath ? theme.fg("accent", shortenPath3(filePath)) : theme.fg("toolOutput", "...");',
      '  const baseTitle = `${theme.fg("toolTitle", theme.bold(toolName))} ${pathDisplay}`;',
      '  if (context.args?.then_run) {',
      '    const container = reuseContainer2(context.lastComponent);',
      '    container.clear();',
      '    container.addChild(new Text2(`${theme.fg("warning", "⚡")} ${theme.fg("accent", theme.bold("SoL-Pi · Action Fusion"))}`, 0, 0));',
      '    container.addChild(new Text2(theme.fg("success", "Money saved · 1 model round-trip avoided"), 0, 0));',
      '    container.addChild(new Text2(baseTitle, 0, 0));',
      '    return container;',
      '  }',
      '  const text = reuseText2(context.lastComponent);',
      '  text.setText(baseTitle);',
      '  return text;',
      '}'
    ].join('\n');
    code = code.replace(oldRenderCall, newRenderCall);
    modified = true;
  }

  // 8. Ensure toolName in renderCall uses editName, writeName, and readName instead of hardcoded names
  if (code.includes('return renderMutationCall("edit", mutationFilePathArg(args ?? {}), theme, context);')) {
    code = code.replace(
      'return renderMutationCall("edit", mutationFilePathArg(args ?? {}), theme, context);',
      'return renderMutationCall(editName, mutationFilePathArg(args ?? {}), theme, context);'
    );
    modified = true;
  }
  if (code.includes('return renderMutationCall("write", mutationFilePathArg(args ?? {}), theme, context);')) {
    code = code.replace(
      'return renderMutationCall("write", mutationFilePathArg(args ?? {}), theme, context);',
      'return renderMutationCall(writeName, mutationFilePathArg(args ?? {}), theme, context);'
    );
    modified = true;
  }
  if (code.includes('return renderReadCall(args, theme, context);')) {
    code = code.replace(
      'return renderReadCall(args, theme, context);',
      'return renderReadCall(readName, args, theme, context);'
    );
    code = code.replace(
      'function renderReadCall(args, theme, context) {\n  const text = reuseText2(context.lastComponent);\n  const filePath = args ? readPathArg(args) : undefined;\n  const pathDisplay = filePath ? theme.fg("accent", shortenPath3(filePath)) : theme.fg("toolOutput", "...");\n  text.setText(`${theme.fg("toolTitle", theme.bold("read"))} ${pathDisplay}`);\n  return text;\n}',
      'function renderReadCall(toolName, args, theme, context) {\n  const text = reuseText2(context.lastComponent);\n  const filePath = args ? readPathArg(args) : undefined;\n  const pathDisplay = filePath ? theme.fg("accent", shortenPath3(filePath)) : theme.fg("toolOutput", "...");\n  text.setText(`${theme.fg("toolTitle", theme.bold(typeof toolName === "string" ? toolName : "read"))} ${pathDisplay}`);\n  return text;\n}'
    );
    modified = true;
  }

  // 9. Make diff default expanded
  if (code.includes('summary,\n    full: container,\n    expanded: options.expanded,\n    context\n  });\n}\nfunction shortenPath3')) {
    const oldRenderResult = [
      'summary,',
      '    full: container,',
      '    expanded: options.expanded,',
      '    context',
      '  });',
      '}',
      'function shortenPath3'
    ].join('\n');
    const newRenderResult = [
      'summary,',
      '    full: container,',
      '    expanded: true,',
      '    context',
      '  });',
      '}',
      'function shortenPath3'
    ].join('\n');
    code = code.replace(oldRenderResult, newRenderResult);
    modified = true;
  }

  if (modified) {
    writeFileSync(aftIndex, code);
    console.log("[pi-packages] Successfully patched @cortexkit/aft-pi with then_run, toolName labels, and expanded diffs");
  } else {
    console.log("[pi-packages] @cortexkit/aft-pi is already fully patched");
  }
}

patchAft();
