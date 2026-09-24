/**
 * AnyRouter Provider Extension for Pi (Single-file self-contained version)
 *
 * Designed for easy dotfiles/chezmoi management.
 * Adapts requests for AnyRouter's Claude Code and Codex Responses routes.
 */

import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  type Api,
  type AssistantMessage,
  type AssistantMessageEventStream,
  type Context,
  createAssistantMessageEventStream,
  type ImageContent,
  type Message,
  type Model,
  type SimpleStreamOptions,
  type StopReason,
  type TextContent,
  type ThinkingContent,
  type Tool,
  type ToolResultMessage,
  calculateCost,
} from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// ── Configuration & Constants ───────────────────────────────────────────────

const PROVIDER_NAME = "anyrouter";
const API_ID = "anyrouter-messages" as Api;
const DEFAULT_CONFIG_PATH = join(homedir(), ".pi", "agent", "anyrouter.json");

const CLAUDE_CODE_VERSION = "2.1.280";
const STAINLESS_PACKAGE_VERSION = "0.112.1";
const STAINLESS_OS = "Linux";
const STAINLESS_ARCH = "x64";
const STAINLESS_RUNTIME = "node";
const STAINLESS_RUNTIME_VERSION = "v26.3.0";

const ANTHROPIC_BETA = [
  "claude-code-20250219",
  "context-1m-2025-08-07",
  "interleaved-thinking-2025-05-14",
  "thinking-token-count-2026-05-13",
  "context-management-2025-06-27",
  "prompt-caching-scope-2026-01-05",
  "mid-conversation-system-2026-04-07",
  "per-turn-control-2026-07-01",
  "mid-conversation-tool-changes-2026-07-01",
  "effort-2025-11-24",
  "fallback-credit-2026-06-01",
].join(",");

const CODEX_VERSION = "0.153.4";
const CODEX_INSTALLATION_ID = randomUUID();

const CLAUDE_STUB_NAMES = [
  "Agent", "Bash", "CronCreate", "CronDelete", "CronList", "Edit",
  "EnterWorktree", "ExitWorktree", "ListAgents", "NotebookEdit", "Read",
  "ReportFindings", "ScheduleWakeup", "SendMessage", "Skill", "TaskStop",
  "WebFetch", "WebSearch", "Workflow", "Write"
];

const NAME_MAP: Record<string, string> = {
  read: "Read",
  write: "Write",
  edit: "Edit",
  bash: "Bash",
  grep: "Grep",
  find: "Glob",
  glob: "Glob",
  ls: "LS",
  todowrite: "TodoWrite",
  webfetch: "WebFetch",
  websearch: "WebSearch",
  google_search: "Google_Search",
};

interface ProviderConfigFile {
  baseUrl?: string;
  apiKey?: string;
  models?: Array<{
    id: string;
    name?: string;
    api?: string;
    reasoning?: boolean;
    input?: ("text" | "image")[];
    cost?: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number };
    contextWindow?: number;
    maxTokens?: number;
    promptCache?: { short?: number; long?: number };
  }>;
}

function getClaudeDeviceId(): string {
  try {
    const claudeJson = join(homedir(), ".claude.json");
    if (existsSync(claudeJson)) {
      const parsed = JSON.parse(readFileSync(claudeJson, "utf8"));
      if (parsed.userID) return String(parsed.userID);
    }
  } catch {}
  return randomBytes(32).toString("hex");
}

const CLAUDE_DEVICE_ID = getClaudeDeviceId();

function loadConfig(): { baseUrl: string; apiKey: string; models: NonNullable<ProviderConfigFile["models"]> } {
  const configPath = process.env.PI_ANYROUTER_CC_CONFIG || DEFAULT_CONFIG_PATH;
  let parsed: ProviderConfigFile = {};
  if (existsSync(configPath)) {
    try {
      parsed = JSON.parse(readFileSync(configPath, "utf8"));
    } catch (e) {
      console.error(`[anyrouter] Failed to parse ${configPath}:`, e);
    }
  }

  const baseUrl = (process.env.PI_ANYROUTER_CC_BASE_URL || parsed.baseUrl || "https://anyrouter.top").replace(/\/+$/, "");
  const apiKey = process.env.PI_ANYROUTER_CC_API_KEY || parsed.apiKey || "";
  const models = parsed.models || [
    { id: "claude-opus-5-5", name: "Claude Opus 5.5", reasoning: true, contextWindow: 1000000, maxTokens: 128000 },
    { id: "gpt-6-astra", name: "GPT-6 Astra", reasoning: true, contextWindow: 1050000, maxTokens: 128000 }
  ];

  return { baseUrl, apiKey, models };
}

// ── Utility Helpers ─────────────────────────────────────────────────────────

function sanitizeText(text: string): string {
  return (text || "").replace(/[\uD800-\uDFFF]/g, "\uFFFD");
}

function normalizeToolCall(toolCall: { name: string; arguments: Record<string, any> }) {
  if (!toolCall) return;

  const lowerName = (toolCall.name || "").toLowerCase();
  if (lowerName === "read") toolCall.name = "read";
  else if (lowerName === "write") toolCall.name = "write";
  else if (lowerName === "edit") toolCall.name = "edit";
  else if (lowerName === "bash") toolCall.name = "bash";
  else if (lowerName === "grep") toolCall.name = "grep";
  else if (lowerName === "glob") toolCall.name = "find";
  else if (fromClaudeCodeName(toolCall.name)) toolCall.name = fromClaudeCodeName(toolCall.name);

  const args = toolCall.arguments;
  if (!args || typeof args !== "object") return;

  // Normalize file_path -> path for read, write, edit
  if (args.file_path && !args.path) {
    args.path = args.file_path;
    delete args.file_path;
  }

  // Normalize old_string / new_string -> edits for edit
  if (toolCall.name === "edit" && args.old_string !== undefined && args.new_string !== undefined && !args.edits) {
    args.edits = [{ oldString: args.old_string, newString: args.new_string }];
    delete args.old_string;
    delete args.new_string;
  }
}

function toClaudeCodeName(name?: string | null): string {
  if (!name || typeof name !== "string") return name || "";
  return NAME_MAP[name.toLowerCase()] ?? name;
}

function fromClaudeCodeName(name?: string | null): string {
  if (!name || typeof name !== "string") return name ?? "";
  const lower = name.toLowerCase();
  for (const [from, to] of Object.entries(NAME_MAP)) {
    if (to.toLowerCase() === lower) return from;
  }
  return name;
}

function isCodexModel(modelId: string, configuredApi?: string): boolean {
  if (configuredApi) return configuredApi === "openai-codex-responses";
  return /(?:^|[-_.])(gpt|codex)(?:[-_.]|$)/i.test(modelId) || /^o\d(?:[-_.]|$)/i.test(modelId);
}

function mapReasoningEffort(level?: SimpleStreamOptions["reasoning"]): string {
  switch (level) {
    case "minimal":
    case "low":
      return "low";
    case "medium":
      return "medium";
    case "high":
    case "xhigh":
    case "max":
      return level;
    default:
      return "high";
  }
}

function mapStopReason(reason: string): StopReason {
  switch (reason) {
    case "end_turn":
    case "pause_turn":
    case "stop_sequence":
      return "stop";
    case "max_tokens":
      return "length";
    case "tool_use":
      return "toolUse";
    default:
      return "stop";
  }
}

function createEmptyUsage() {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    reasoning: undefined as number | undefined,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}

function updateUsageFromAnthropic(output: AssistantMessage, usage: any, model: Model<Api>) {
  if (usage?.input_tokens != null) output.usage.input = usage.input_tokens;
  if (usage?.output_tokens != null) output.usage.output = usage.output_tokens;
  if (usage?.cache_read_input_tokens != null) output.usage.cacheRead = usage.cache_read_input_tokens;
  if (usage?.cache_creation_input_tokens != null) output.usage.cacheWrite = usage.cache_creation_input_tokens;
  if (usage?.thinking_tokens != null) output.usage.reasoning = usage.thinking_tokens;
  output.usage.totalTokens = output.usage.input + output.usage.output + output.usage.cacheRead + output.usage.cacheWrite;
  calculateCost(model, output.usage);
}

// ── Claude Code Payload & Tools ─────────────────────────────────────────────

function convertContentBlocks(content: (TextContent | ImageContent)[]) {
  const hasImages = content.some((c) => c.type === "image");
  if (!hasImages) return sanitizeText(content.map((c) => (c as TextContent).text).join("\n"));

  const blocks = content.map((block) => {
    if (block.type === "text") return { type: "text", text: sanitizeText(block.text) };
    return { type: "image", source: { type: "base64", media_type: block.mimeType, data: block.data } };
  });
  if (!blocks.some((b) => b.type === "text")) blocks.unshift({ type: "text", text: "(see attached image)" });
  return blocks;
}

function convertClaudeMessages(messages: Message[]): any[] {
  const params: any[] = [];
  const appendUserBlocks = (newBlocks: any[]) => {
    if (newBlocks.length === 0) return;
    if (params.length > 0 && params[params.length - 1].role === "user") {
      params[params.length - 1].content.push(...newBlocks);
    } else {
      params.push({ role: "user", content: newBlocks });
    }
  };

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === "user") {
      if (typeof msg.content === "string") {
        const text = sanitizeText(msg.content);
        if (text.trim()) appendUserBlocks([{ type: "text", text }]);
      } else {
        const blocks = msg.content.map((item) =>
          item.type === "text"
            ? { type: "text", text: sanitizeText(item.text) }
            : { type: "image", source: { type: "base64", media_type: item.mimeType, data: item.data } }
        );
        appendUserBlocks(blocks);
      }
      continue;
    }

    if (msg.role === "assistant") {
      const blocks: any[] = [];
      for (const block of msg.content) {
        if (block.type === "text" && block.text.trim()) {
          blocks.push({ type: "text", text: sanitizeText(block.text) });
        } else if (block.type === "thinking" && block.thinking.trim()) {
          if ((block as ThinkingContent).thinkingSignature) {
            blocks.push({
              type: "thinking",
              thinking: sanitizeText(block.thinking),
              signature: (block as ThinkingContent).thinkingSignature,
            });
          } else {
            blocks.push({ type: "text", text: sanitizeText(block.thinking) });
          }
        } else if (block.type === "toolCall") {
          blocks.push({
            type: "tool_use",
            id: block.id,
            name: toClaudeCodeName(block.name),
            input: block.arguments,
          });
        }
      }
      if (blocks.length > 0) params.push({ role: "assistant", content: blocks });
      continue;
    }

    if (msg.role === "toolResult") {
      const toolResults: any[] = [];
      const pushToolResult = (toolMsg: ToolResultMessage) => {
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolMsg.toolCallId,
          content: convertContentBlocks(toolMsg.content),
          is_error: toolMsg.isError,
        });
      };
      pushToolResult(msg as ToolResultMessage);
      let j = i + 1;
      while (j < messages.length && messages[j].role === "toolResult") {
        pushToolResult(messages[j] as ToolResultMessage);
        j++;
      }
      i = j - 1;
      params.push({ role: "user", content: toolResults });
    }
  }

  // Set ephemeral prompt cache marker on the last user message block
  if (params.length > 0) {
    const last = params[params.length - 1];
    if (last.role === "user" && Array.isArray(last.content) && last.content.length > 0) {
      last.content[last.content.length - 1].cache_control = { type: "ephemeral" };
    }
  }
  return params;
}

function extractToolsAndSystem(context: Context): { tools: Tool[]; systemPrompt: string } {
  const toolsMap = new Map<string, Tool>();

  if (Array.isArray(context.tools)) {
    for (const tool of context.tools) {
      if (tool && tool.name) toolsMap.set(tool.name, tool);
    }
  }

  const systemTexts: string[] = [];
  if (context.systemPrompt) {
    systemTexts.push(context.systemPrompt);
  }

  if (Array.isArray(context.messages)) {
    for (const msg of context.messages) {
      if ((msg as any).role === "system") {
        const sysMsg = msg as any;
        if (typeof sysMsg.content === "string" && sysMsg.content.trim()) {
          systemTexts.push(sysMsg.content);
        } else if (Array.isArray(sysMsg.content)) {
          for (const part of sysMsg.content) {
            if (part && typeof part.text === "string" && part.text.trim()) {
              systemTexts.push(part.text);
            }
          }
        }
        if (Array.isArray(sysMsg.toolsAdded)) {
          for (const tool of sysMsg.toolsAdded) {
            if (tool && tool.name) toolsMap.set(tool.name, tool);
          }
        }
        if (Array.isArray(sysMsg.toolsRemoved)) {
          for (const tool of sysMsg.toolsRemoved) {
            if (tool && tool.name) toolsMap.delete(tool.name);
          }
        }
      }
    }
  }

  return {
    tools: Array.from(toolsMap.values()),
    systemPrompt: systemTexts.join("\n\n"),
  };
}

function sanitizeInputSchema(parameters: any, toolName: string): any {
  const props = { ...((parameters as any)?.properties || {}) };
  const required = [...((parameters as any)?.required || [])];

  const lower = toolName.toLowerCase();
  // Provide file_path alias for tools expecting path to avoid model hallucination errors
  if ((lower === "read" || lower === "edit" || lower === "write") && props.path && !props.file_path) {
    props.file_path = { type: "string", description: "Alias for path" };
  }

  return {
    type: "object",
    properties: props,
    ...(required.length > 0 ? { required } : {}),
  };
}

function buildClaudeCodeTools(customTools: Tool[] = []): any[] {
  const piToolsMap = new Map<string, Tool>();
  for (const t of customTools) {
    if (t && t.name) {
      piToolsMap.set(t.name.toLowerCase(), t);
    }
  }

  const result: any[] = [];

  // Iterate over the 20 standard Claude Code tools.
  // AnyRouter upstream strictly validates that the request tools match the Claude Code toolset.
  for (const ccName of CLAUDE_STUB_NAMES) {
    let matchedPiTool: Tool | undefined;
    for (const [piName, mappedCcName] of Object.entries(NAME_MAP)) {
      if (mappedCcName.toLowerCase() === ccName.toLowerCase() && piToolsMap.has(piName)) {
        matchedPiTool = piToolsMap.get(piName);
        break;
      }
    }
    if (!matchedPiTool && piToolsMap.has(ccName.toLowerCase())) {
      matchedPiTool = piToolsMap.get(ccName.toLowerCase());
    }

    if (matchedPiTool) {
      // Tool exists in Pi: keep CC name for gateway compatibility, but inject Pi's description & full schema
      result.push({
        name: ccName,
        description: matchedPiTool.description || `Claude Code ${ccName} tool`,
        input_schema: sanitizeInputSchema(matchedPiTool.parameters, ccName),
      });
    } else {
      // CC tool not in Pi: keep as empty placeholder stub to satisfy AnyRouter validation
      result.push({
        name: ccName,
        description: `Claude Code ${ccName} tool`,
        input_schema: { type: "object", properties: {} },
      });
    }
  }

  return result;
}

// ── Codex Responses Builder ─────────────────────────────────────────────────

function convertCodexMessages(context: Context, systemPrompt?: string): any[] {
  const input: any[] = [];
  const effectiveSystem = systemPrompt || context.systemPrompt;
  if (effectiveSystem) {
    input.push({
      type: "message",
      role: "developer",
      content: [{ type: "input_text", text: sanitizeText(effectiveSystem) }],
    });
  }

  for (const msg of context.messages) {
    if ((msg as any).role === "system") continue;
    if (msg.role === "user") {
      if (typeof msg.content === "string") {
        input.push({
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: sanitizeText(msg.content) }],
        });
      } else {
        const content = msg.content.map((item) =>
          item.type === "text"
            ? { type: "input_text", text: sanitizeText(item.text) }
            : { type: "input_image", detail: "auto", image_url: `data:${item.mimeType};base64,${item.data}` }
        );
        if (content.length) input.push({ type: "message", role: "user", content });
      }
      continue;
    }

    if (msg.role === "assistant") {
      for (const block of msg.content) {
        if (block.type === "text" && block.text.trim()) {
          input.push({
            type: "message",
            role: "assistant",
            status: "completed",
            content: [{ type: "output_text", text: sanitizeText(block.text), annotations: [] }],
          });
        } else if (block.type === "toolCall") {
          const [callId, itemId] = block.id.split("|");
          input.push({
            type: "function_call",
            ...(itemId ? { id: itemId } : {}),
            call_id: callId,
            name: block.name,
            arguments: JSON.stringify(block.arguments),
          });
        }
      }
      continue;
    }

    if (msg.role === "toolResult") {
      const toolMsg = msg as ToolResultMessage;
      const text = toolMsg.content
        .filter((item) => item.type === "text")
        .map((item) => (item as TextContent).text)
        .join("\n");
      input.push({
        type: "function_call_output",
        call_id: toolMsg.toolCallId.split("|")[0],
        output: sanitizeText(text || "(no tool output)"),
      });
    }
  }
  return input;
}

// ── SSE Stream Parsers ──────────────────────────────────────────────────────

async function* parseSseLines(response: Response): AsyncGenerator<{ event?: string; data?: string }> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let lineEnd = buffer.indexOf("\n");
    let currentEvent = "";
    let currentData = "";

    while (lineEnd !== -1) {
      const line = buffer.slice(0, lineEnd).trim();
      buffer = buffer.slice(lineEnd + 1);

      if (line.startsWith("event:")) {
        currentEvent = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        const dataPart = line.slice(5).trim();
        currentData = currentData ? `${currentData}\n${dataPart}` : dataPart;
      } else if (line === "") {
        if (currentData) {
          yield { event: currentEvent, data: currentData };
          currentEvent = "";
          currentData = "";
        }
      }
      lineEnd = buffer.indexOf("\n");
    }
  }
}

// ── Streaming Execution ─────────────────────────────────────────────────────

async function streamClaudeCode(
  baseUrl: string,
  apiKey: string,
  model: Model<Api>,
  context: Context,
  output: AssistantMessage,
  stream: AssistantMessageEventStream,
  options?: SimpleStreamOptions
) {
  const sessionId = options?.sessionId || randomUUID();
  const url = `${baseUrl}/v1/messages?beta=true`;
  const { tools: effectiveTools, systemPrompt: effectiveSystemPrompt } = extractToolsAndSystem(context);

  const headers = {
    "content-type": "application/json",
    accept: "application/json",
    authorization: `Bearer ${apiKey}`,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
    "anthropic-beta": ANTHROPIC_BETA,
    "user-agent": `claude-cli/${CLAUDE_CODE_VERSION} (external, sdk-cli)`,
    "x-app": "cli",
    "x-claude-code-session-id": sessionId,
    "x-stainless-retry-count": "0",
    "x-stainless-timeout": "600",
    "x-stainless-lang": "js",
    "x-stainless-package-version": STAINLESS_PACKAGE_VERSION,
    "x-stainless-os": STAINLESS_OS,
    "x-stainless-arch": STAINLESS_ARCH,
    "x-stainless-runtime": STAINLESS_RUNTIME,
    "x-stainless-runtime-version": STAINLESS_RUNTIME_VERSION,
  };

  const body: any = {
    model: model.id,
    messages: convertClaudeMessages(context.messages),
    max_tokens: options?.maxTokens || model.maxTokens || 128000,
    stream: true,
    metadata: {
      user_id: JSON.stringify({
        device_id: CLAUDE_DEVICE_ID,
        account_uuid: "",
        session_id: sessionId,
      }),
    },
    system: [
      {
        type: "text",
        text: "You are a Claude agent, built on Anthropic's Claude Agent SDK.",
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text: sanitizeText(effectiveSystemPrompt || "You are an expert coding assistant operating inside pi."),
        cache_control: { type: "ephemeral" },
      },
    ],
    context_management: {
      edits: [{ type: "clear_thinking_20251015", keep: "all" }],
    },
    tools: buildClaudeCodeTools(effectiveTools),
  };

  if (options?.reasoning && model.reasoning) {
    body.thinking = { type: "adaptive", display: "omitted" };
    body.output_config = { effort: mapReasoningEffort(options.reasoning) };
  }

  stream.push({ type: "start", partial: output });

  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: options?.signal,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${errText}`);
  }

  const blockIndexMap = new Map<number, number>();

  for await (const { data } of parseSseLines(resp)) {
    if (!data || data === "[DONE]") continue;
    let payload: any;
    try {
      payload = JSON.parse(data);
    } catch {
      continue;
    }

    if (payload.type === "message_start") {
      updateUsageFromAnthropic(output, payload.message?.usage, model);
    } else if (payload.type === "content_block_start") {
      const eventIndex = payload.index;
      const block = payload.content_block;
      if (block.type === "text") {
        output.content.push({ type: "text", text: "" });
        const contentIndex = output.content.length - 1;
        blockIndexMap.set(eventIndex, contentIndex);
        stream.push({ type: "text_start", contentIndex, partial: output });
      } else if (block.type === "thinking") {
        output.content.push({ type: "thinking", thinking: "", thinkingSignature: "" });
        const contentIndex = output.content.length - 1;
        blockIndexMap.set(eventIndex, contentIndex);
        stream.push({ type: "thinking_start", contentIndex, partial: output });
      } else if (block.type === "tool_use") {
        const toolCall = {
          type: "toolCall" as const,
          id: block.id,
          name: fromClaudeCodeName(block.name),
          arguments: {},
        };
        output.content.push(toolCall as any);
        const contentIndex = output.content.length - 1;
        blockIndexMap.set(eventIndex, contentIndex);
        stream.push({ type: "toolcall_start", contentIndex, partial: output });
      }
    } else if (payload.type === "content_block_delta") {
      const contentIndex = blockIndexMap.get(payload.index);
      if (contentIndex == null) continue;
      const delta = payload.delta;
      if (delta.type === "text_delta") {
        const blk = output.content[contentIndex] as TextContent;
        blk.text += delta.text;
        stream.push({ type: "text_delta", contentIndex, delta: delta.text, partial: output });
      } else if (delta.type === "thinking_delta") {
        const blk = output.content[contentIndex] as ThinkingContent;
        blk.thinking += delta.thinking;
        stream.push({ type: "thinking_delta", contentIndex, delta: delta.thinking, partial: output });
      } else if (delta.type === "input_json_delta") {
        (output.content[contentIndex] as any)._rawArgs =
          ((output.content[contentIndex] as any)._rawArgs || "") + delta.partial_json;
        stream.push({ type: "toolcall_delta", contentIndex, delta: delta.partial_json, partial: output });
      }
    } else if (payload.type === "content_block_stop") {
      const contentIndex = blockIndexMap.get(payload.index);
      if (contentIndex == null) continue;
      const blk = output.content[contentIndex];
      if (blk.type === "text") {
        stream.push({ type: "text_end", contentIndex, content: blk.text, partial: output });
      } else if (blk.type === "thinking") {
        stream.push({ type: "thinking_end", contentIndex, content: blk.thinking, partial: output });
      } else if (blk.type === "toolCall") {
        try {
          blk.arguments = JSON.parse((blk as any)._rawArgs || "{}");
        } catch {}
        delete (blk as any)._rawArgs;
        normalizeToolCall(blk);
        stream.push({ type: "toolcall_end", contentIndex, toolCall: blk, partial: output });
      }
    } else if (payload.type === "message_delta") {
      if (payload.delta?.stop_reason) {
        output.stopReason = mapStopReason(payload.delta.stop_reason);
      }
      updateUsageFromAnthropic(output, payload.usage, model);
    } else if (payload.type === "message_stop") {
      break;
    }
  }

  output.stopReason = output.stopReason === "pending" ? "stop" : output.stopReason;
  stream.push({ type: "done", reason: output.stopReason as any, message: output });
  stream.end();
}

async function streamCodex(
  baseUrl: string,
  apiKey: string,
  model: Model<Api>,
  context: Context,
  output: AssistantMessage,
  stream: AssistantMessageEventStream,
  options?: SimpleStreamOptions
) {
  const { tools: effectiveTools, systemPrompt: effectiveSystemPrompt } = extractToolsAndSystem(context);
  const sessionId = options?.sessionId || randomUUID();
  const turnId = randomUUID();
  const windowId = `${sessionId}:0`;

  const url = baseUrl.endsWith("/v1") ? `${baseUrl}/responses` : `${baseUrl}/v1/responses`;

  const headers = {
    authorization: `Bearer ${apiKey}`,
    accept: "text/event-stream",
    "content-type": "application/json",
    originator: "codex_exec",
    "user-agent": `codex_exec/${CODEX_VERSION} (Linux; x86_64) (codex_exec; ${CODEX_VERSION})`,
    "x-openai-internal-codex-responses-lite": "true",
    "x-codex-beta-features": "remote_compaction_v2",
    "x-codex-window-id": windowId,
    "x-client-request-id": sessionId,
    "session-id": sessionId,
    "thread-id": sessionId,
  };

  const body: any = {
    model: model.id,
    input: convertCodexMessages(context, effectiveSystemPrompt),
    tools: effectiveTools.map((t) => ({
      type: "function",
      name: t.name,
      description: t.description,
      parameters: t.parameters || { type: "object", properties: {} },
    })),
    tool_choice: "auto",
    parallel_tool_calls: false,
    reasoning: {
      effort: mapReasoningEffort(options?.reasoning),
      context: "all_turns",
    },
    store: false,
    stream: true,
    text: { verbosity: "low" },
    max_output_tokens: options?.maxTokens || model.maxTokens || 128000,
  };

  stream.push({ type: "start", partial: output });

  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: options?.signal,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${errText}`);
  }

  let textStarted = false;
  let contentIndex = 0;

  for await (const { data } of parseSseLines(resp)) {
    if (!data || data === "[DONE]") continue;
    let payload: any;
    try {
      payload = JSON.parse(data);
    } catch {
      continue;
    }

    if (payload.type === "response.output_text.delta") {
      const delta = payload.delta || "";
      if (!delta) continue;
      if (!textStarted) {
        output.content.push({ type: "text", text: "" });
        contentIndex = output.content.length - 1;
        textStarted = true;
        stream.push({ type: "text_start", contentIndex, partial: output });
      }
      (output.content[contentIndex] as TextContent).text += delta;
      stream.push({ type: "text_delta", contentIndex, delta, partial: output });
    } else if (payload.type === "response.output_text.done" || payload.type === "response.output_item.done") {
      if (textStarted) {
        const text = (output.content[contentIndex] as TextContent).text;
        stream.push({ type: "text_end", contentIndex, content: text, partial: output });
        textStarted = false;
      }
    } else if (payload.type === "response.completed") {
      const response = payload.response;
      if (output.content.length === 0 && response?.output?.length) {
        for (const item of response.output) {
          if (item?.type === "message" && Array.isArray(item.content)) {
            for (const part of item.content) {
              if (part?.type === "output_text" && part.text) {
                output.content.push({ type: "text", text: part.text });
                const idx = output.content.length - 1;
                stream.push({ type: "text_start", contentIndex: idx, partial: output });
                stream.push({ type: "text_delta", contentIndex: idx, delta: part.text, partial: output });
                stream.push({ type: "text_end", contentIndex: idx, content: part.text, partial: output });
              }
            }
          }
        }
      }
      if (response?.usage) {
        output.usage.input = response.usage.input_tokens || 0;
        output.usage.output = response.usage.output_tokens || 0;
        output.usage.totalTokens = output.usage.input + output.usage.output;
        calculateCost(model, output.usage);
      }
      output.stopReason = "stop";
      break;
    }
  }

  output.stopReason = output.stopReason === "pending" ? "stop" : output.stopReason;
  stream.push({ type: "done", reason: output.stopReason as any, message: output });
  stream.end();
}

// ── Extension Entry Point ───────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  const config = loadConfig();

  pi.registerProvider(PROVIDER_NAME, {
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    api: API_ID,
    models: config.models.map((m) => ({
      id: m.id,
      name: m.name ? `${m.name} (AnyRouter)` : `${m.id} (AnyRouter)`,
      api: API_ID,
      reasoning: m.reasoning ?? true,
      thinkingLevelMap:
        (m.reasoning ?? true)
          ? { off: "off", minimal: "minimal", low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: "max" }
          : undefined,
      input: m.input ?? ["text"],
      cost: {
        input: m.cost?.input ?? 0,
        output: m.cost?.output ?? 0,
        cacheRead: m.cost?.cacheRead ?? 0,
        cacheWrite: m.cost?.cacheWrite ?? 0,
      },
      contextWindow: m.contextWindow ?? 1000000,
      maxTokens: m.maxTokens ?? 128000,
      promptCache: m.promptCache,
    })),
    streamSimple: (model: Model<Api>, context: Context, options?: SimpleStreamOptions) => {
      const stream = createAssistantMessageEventStream();
      const output: AssistantMessage = {
        role: "assistant",
        content: [],
        api: model.api,
        provider: model.provider,
        model: model.id,
        usage: createEmptyUsage(),
        stopReason: "pending",
        timestamp: Date.now(),
      };

      (async () => {
        try {
          const cfg = loadConfig();
          const effectiveKey = options?.apiKey || cfg.apiKey;
          const effectiveBaseUrl = cfg.baseUrl;

          const configuredModel = cfg.models.find((item) => item.id === model.id);
          if (isCodexModel(model.id, configuredModel?.api)) {
            await streamCodex(effectiveBaseUrl, effectiveKey, model, context, output, stream, options);
          } else {
            await streamClaudeCode(effectiveBaseUrl, effectiveKey, model, context, output, stream, options);
          }
        } catch (error) {
          output.stopReason = options?.signal?.aborted ? "aborted" : "error";
          output.errorMessage = error instanceof Error ? `[anyrouter] ${error.message}` : String(error);
          stream.push({ type: "error", reason: output.stopReason, error: output });
          stream.end();
        }
      })();

      return stream;
    },
  });
}
