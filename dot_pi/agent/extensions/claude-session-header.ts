/**
 * Claude Code Session ID Extension for Pi
 *
 * Dynamically injects `X-Claude-Code-Session-Id` header into outbound LLM requests
 * that mimic the Claude Code CLI client, ensuring AI gateways (like company gateways
 * and reverse proxies) correctly attribute requests to header-based sessions.
 */

import { createHash, randomUUID } from "node:crypto";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

/**
 * Validates whether an ID matches a standard UUID format (UUIDv4 or UUIDv7).
 */
function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Converts any arbitrary session identifier (e.g. custom name or label)
 * deterministically into a valid RFC 4122 UUID.
 */
function toDeterministicUUID(identifier: string): string {
  const hash = createHash("sha256").update("claude-code-session:" + identifier).digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "4" + hash.slice(13, 16), // version 4
    ((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0") + hash.slice(18, 20), // variant RFC 4122
    hash.slice(20, 32),
  ].join("-");
}

export default function (pi: ExtensionAPI) {
  let fallbackSessionUUID = randomUUID();

  function getSessionUUID(ctx?: ExtensionContext): string {
    try {
      const rawId = ctx?.sessionManager?.getSessionId?.();
      if (rawId && typeof rawId === "string" && rawId.trim().length > 0) {
        if (isValidUUID(rawId)) {
          return rawId;
        }
        return toDeterministicUUID(rawId.trim());
      }
    } catch {
      // Ignore errors when sessionManager is not ready or inactive
    }
    return fallbackSessionUUID;
  }

  // Refresh fallback UUID whenever a new session starts
  pi.on("session_start", () => {
    fallbackSessionUUID = randomUUID();
  });

  pi.on("before_provider_headers", (event, ctx) => {
    const headers = event.headers;
    if (!headers || typeof headers !== "object") return;

    // Detect if this request identifies as a Claude Code client
    const hasClaudeCodeIdentity = Object.entries(headers).some(([key, value]) => {
      if (typeof value !== "string") return false;
      const lowerKey = key.toLowerCase();
      if (lowerKey === "user-agent" && value.toLowerCase().includes("claude-cli")) {
        return true;
      }
      if (lowerKey === "anthropic-beta" && value.includes("claude-code")) {
        return true;
      }
      return false;
    });

    if (!hasClaudeCodeIdentity) return;

    // Check if X-Claude-Code-Session-Id is already present (case-insensitive)
    const alreadyHasSessionHeader = Object.keys(headers).some(
      (key) => key.toLowerCase() === "x-claude-code-session-id"
    );

    if (!alreadyHasSessionHeader) {
      headers["X-Claude-Code-Session-Id"] = getSessionUUID(ctx);
    }
  });
}
