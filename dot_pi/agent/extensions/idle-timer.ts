/**
 * Idle Timer Extension for Pi
 *
 * Displays the time elapsed since the last agent message until now in Pi's status bar / footer.
 * Features:
 * - Real-time seconds/minutes/hours elapsed counter (e.g. ⏳ 12s, ⏳ 2m 15s, ⏳ 1h 30m).
 * - Automatically pauses and clears when the agent starts working.
 * - Resumes on agent_settled when the agent completes its turn.
 * - Automatically picks up the last assistant message timestamp on session load / resume.
 * - Cleans up intervals on session shutdown.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const STATUS_KEY = "idle-timer";

function formatDuration(ms: number): string {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const days = Math.floor(totalSeconds / 86400);
	const hours = Math.floor((totalSeconds % 86400) / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	if (days > 0) return `${days}d ${hours}h`;
	if (hours > 0) return `${hours}h ${minutes}m`;
	if (minutes > 0) return `${minutes}m ${seconds}s`;
	return `${seconds}s`;
}

function findLastAssistantMessageTimestamp(ctx: ExtensionContext): number | undefined {
	const sessionManager = ctx.sessionManager as {
		getEntries?: () => readonly any[];
		getBranch?: () => readonly any[];
	};
	const entries =
		typeof sessionManager.getEntries === "function"
			? sessionManager.getEntries()
			: typeof sessionManager.getBranch === "function"
				? sessionManager.getBranch()
				: [];

	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		if (entry?.type === "message" && entry.message?.role === "assistant") {
			const rawTs = entry.timestamp;
			const ts =
				typeof rawTs === "number"
					? rawTs
					: typeof rawTs === "string"
						? Date.parse(rawTs)
						: undefined;
			if (ts !== undefined && !Number.isNaN(ts) && ts > 0) {
				return ts;
			}
		}
	}
	return undefined;
}

export default function (pi: ExtensionAPI) {
	let lastAgentSettledAt: number | undefined;
	let timer: ReturnType<typeof setInterval> | null = null;

	function stopTimer(ctx?: ExtensionContext) {
		if (timer) {
			clearInterval(timer);
			timer = null;
		}
		if (ctx?.hasUI) {
			ctx.ui.setStatus(STATUS_KEY, undefined);
		}
	}

	function updateStatus(ctx: ExtensionContext) {
		if (!ctx.hasUI) return;
		if (lastAgentSettledAt === undefined) {
			ctx.ui.setStatus(STATUS_KEY, undefined);
			return;
		}
		const elapsed = Math.max(0, Date.now() - lastAgentSettledAt);
		ctx.ui.setStatus(STATUS_KEY, `⏳ ${formatDuration(elapsed)}`);
	}

	function startTimer(ctx: ExtensionContext) {
		if (timer) {
			clearInterval(timer);
			timer = null;
		}
		updateStatus(ctx);
		timer = setInterval(() => {
			updateStatus(ctx);
		}, 1000);
	}

	pi.on("agent_start", async (_event, ctx) => {
		lastAgentSettledAt = undefined;
		stopTimer(ctx);
	});

	pi.on("agent_settled", async (_event, ctx) => {
		lastAgentSettledAt = Date.now();
		if (ctx.hasUI) {
			startTimer(ctx);
		}
	});

	pi.on("session_start", async (_event, ctx) => {
		stopTimer(ctx);
		if (!ctx.hasUI) return;

		// When resuming or reloading, pick up timestamp of the last assistant message if idle
		const lastTs = findLastAssistantMessageTimestamp(ctx);
		if (lastTs !== undefined && ctx.isIdle()) {
			lastAgentSettledAt = lastTs;
			startTimer(ctx);
		} else {
			lastAgentSettledAt = undefined;
		}
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		lastAgentSettledAt = undefined;
		stopTimer(ctx);
	});
}
