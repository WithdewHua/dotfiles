#!/bin/sh
# Re-apply the notifySkipped guard for pi-context-prune after every `chezmoi apply`.
#
# Why: pi-context-prune v1.4.0 has a bug — `notifySkipped: false` only gates the
# manual `/pruner now` path; the automatic prune path (pruneOn: agent-message /
# every-turn) emits "skipped pruning turn" warnings unconditionally. We ship a
# local guard in patch-notifySkipped.mjs. npm upgrades of the extension silently
# revert it, so run the idempotent patcher here. It exits 0 with "already applied"
# when there is nothing to do, so this is cheap on every apply.
set -eu

PATCHER="${PI_CONTEXT_PRUNE_PATCHER:-$HOME/.pi/agent/context-prune/patch-notifySkipped.mjs}"
DIST="$HOME/.pi/agent/npm/node_modules/pi-context-prune/dist/index.js"

# Nothing to do when pi (or its pruner extension) is not installed.
[ -f "$PATCHER" ] || exit 0
[ -f "$DIST" ] || exit 0

exec node "$PATCHER"
