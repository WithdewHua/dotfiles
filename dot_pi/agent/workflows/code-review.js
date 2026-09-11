export const meta = {
  name: 'code-review',
  description: 'CC-style multi-agent code review: effort-graded (low/medium/high/xhigh/max), finder angles surface candidates, ONE verifier pass classifies each (confirmed/plausible/refuted), report confirmed findings',
  phases: [
    { title: 'Scope', detail: 'cheap preflight reads the diff size and file list, drops generated/lock files, and scales the finder fleet to what is left' },
    { title: 'Scan', detail: 'finder agents scan the target diff from different angles, passing through half-believed candidates' },
    { title: 'Verify', detail: 'a single verifier pass classifies every candidate three-state, quoting the proving line' },
  ],
}

// ---- schemas ---------------------------------------------------------------
const CATEGORIES = [
  'correctness', 'simplification', 'efficiency', 'reuse', 'altitude', 'conventions', 'test-coverage',
]

// maxItems is deliberately LOOSE (2x the prompt cap, not the cap itself). A hard
// maxItems turns "the model returned one extra candidate" into a schema failure,
// which after retries yields null — and a null finder is indistinguishable from a
// finder that found nothing, so an entire angle disappears silently. The cap is
// stated in the prompt and re-applied in JS with a log line instead.
function findingsSchema(cap) {
  return {
    type: 'object',
    required: ['findings'],
    properties: {
      findings: {
        type: 'array',
        maxItems: Math.max(cap * 2, cap + 4),
        items: {
          type: 'object',
          required: ['file', 'line', 'severity', 'category', 'short_summary', 'claim', 'scenario'],
          properties: {
            file: { type: 'string' },
            line: { type: 'integer' },
            severity: { type: 'string', enum: ['critical', 'major', 'minor'] },
            category: { type: 'string', enum: CATEGORIES },
            short_summary: { type: 'string', maxLength: 60, description: 'headline compressed to ≤60 chars, no rationale or consequence' },
            claim: { type: 'string' },
            scenario: { type: 'string' },
          },
        },
      },
    },
  }
}

// minItems is deliberately 1, not n: a verifier that returns a partial answer must
// still validate, so the missing idx values can be recovered as `plausible` below.
// Requiring exactly n made one omitted verdict fail the whole chunk's schema and
// silently demote every candidate in it to `refuted` (lost findings, no warning).
// maxItems is loose for the mirror-image reason: an over-eager verifier that emits
// a duplicate idx must not fail the whole chunk into an unverified fallback.
function verdictsSchema(n) {
  return {
    type: 'object',
    required: ['verdicts'],
    properties: {
      verdicts: {
        type: 'array',
        minItems: 1,
        maxItems: n * 2 + 4,
        items: {
          type: 'object',
          required: ['idx', 'state', 'evidence', 'note'],
          properties: {
            idx: { type: 'integer' },
            state: { type: 'string', enum: ['confirmed', 'plausible', 'refuted'] },
            evidence: { type: 'string', description: 'quote the code line that proves or refutes it (file:line + short quote)' },
            note: { type: 'string', description: 'one line: what would confirm it (plausible), or why it is wrong / the overstatement (refuted), or the concrete trigger (confirmed)' },
          },
        },
      },
    },
  }
}

const PREFLIGHT_SCHEMA = {
  type: 'object',
  required: ['files', 'changedLines'],
  properties: {
    files: {
      type: 'array',
      description: 'one entry per changed path in the target',
      items: {
        type: 'object',
        required: ['path', 'churn'],
        properties: {
          path: { type: 'string' },
          churn: { type: 'integer', description: 'added + removed lines for this file, from --numstat (use 0 for binary files)' },
        },
      },
    },
    changedLines: { type: 'integer', description: 'total added + removed lines across the target, from --numstat' },
  },
}

// ---- scope & effort ---------------------------------------------------------
const rawTarget = (args && args.target) || 'uncommitted'
const repo = (args && args.repo) || ''
const compact = Boolean(args && args.compact) // drop verifier evidence from returned entries when set
const effort = String((args && args.effort) || 'medium').toLowerCase()
if (!['low', 'medium', 'high', 'xhigh', 'max'].includes(effort)) throw new Error(`unknown effort "${effort}" (low|medium|high|xhigh|max)`)
const repoNote = repo
  ? `The repository to review is at ${repo}. Run every git command as \`git -C ${repo} …\` and read files via their absolute path under ${repo}. Ignore the current working directory — it is not the repo.`
  : ''
const t = String(rawTarget).trim().toLowerCase()
const onlyUncommitted =
  t === 'uncommitted' || t === 'staged' || t === 'working tree' ||
  t.includes('未提交') || t.includes('unstaged')
const targetText = onlyUncommitted
  ? 'Review only the uncommitted working-tree changes: `git diff HEAD` (staged + unstaged). Do not review committed code.'
  : `Review exactly this target and nothing else: ${rawTarget}. Run the matching git operation (git diff for a range, git show for a commit, etc.).`

// Breadth config. Level shapes follow CC's built-in code review: low = one inline
// pass (no verify), medium = 4 angles, high = 6, xhigh/max = 8 with a gap sweep.
// CC's xhigh and max are structurally IDENTICAL — they differ only in reasoning
// effort — and the same holds here, so `xhigh` and `max` share a shape on purpose
// and only THINK separates them.
//
// The angle set carries CC's Efficiency angle (medium and up) plus CC's
// language-pitfall and wrapper/proxy specialists at xhigh/max. Per-angle caps match
// CC's values (6 at medium/high, 8 at xhigh/max) so the richer angle set does not
// inflate the candidate ceiling: medium 4x6=24, high 6x6=36, xhigh/max 8x8=64.
// (CC runs 8 angles at medium/high and 10 at xhigh/max for an 80 ceiling; this
// workflow deliberately runs fewer, broader angles — see ANGLE_PRIORITY.)
const CONF = {
  low:    { finderCaps: { lowpass: 4 },                                                                                                  verify: false, reportCap: 4,  sweep: false },
  medium: { finderCaps: { correctness: 6, regression: 6, cleanup: 6, efficiency: 6 },                                                      verify: true,  reportCap: 8,  sweep: false },
  high:   { finderCaps: { correctness: 6, regression: 6, cleanup: 6, efficiency: 6, conventions: 6, altitude: 6 },                          verify: true,  reportCap: 10, sweep: false },
  xhigh:  { finderCaps: { correctness: 8, regression: 8, cleanup: 8, efficiency: 8, conventions: 8, altitude: 8, pitfall: 8, wrapper: 8 },   verify: true,  reportCap: 15, sweep: true },
  max:    { finderCaps: { correctness: 8, regression: 8, cleanup: 8, efficiency: 8, conventions: 8, altitude: 8, pitfall: 8, wrapper: 8 },   verify: true,  reportCap: 15, sweep: true },
}
const conf = CONF[effort]

// CC uses a plain 3-state verify at medium and a recall-biased variant only at
// high and above. Matching that keeps the levels distinguishable: a recall-biased
// verifier at every level drags medium's cost and noise toward high's.
const recallBiased = effort === 'high' || effort === 'xhigh' || effort === 'max'

// Depth config: how much *reasoning* each stage gets, independent of how many
// angles run. Finders are breadth (they over-report; verification filters), so
// they stay shallow; the verifier is the decision point and gets the deepest
// budget. Levels absent from a model's thinkingLevelMap are clamped by pi
// (e.g. claude-opus-5 only has xhigh/max, grok-4.6 has no max, deepseek-v4-flash
// has no medium), so treat these as requests, not guarantees. Override per run
// with args.finderEffort / args.verifyEffort; "inherit" omits the field entirely
// and falls back to the model's configured level.
const THINK = {
  low:    { finder: 'low',    verify: 'high'  },
  medium: { finder: 'low',    verify: 'high'  },
  high:   { finder: 'medium', verify: 'high'  },
  xhigh:  { finder: 'medium', verify: 'xhigh' },
  max:    { finder: 'high',   verify: 'max'   },
}
const THINK_VALUES = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'inherit']
const pickEffort = (raw, fallback, label) => {
  const v = raw ? String(raw).trim().toLowerCase() : fallback
  if (!THINK_VALUES.includes(v)) throw new Error(`unknown ${label} "${v}" (${THINK_VALUES.join('|')})`)
  return v
}
const finderEffort = pickEffort(args && args.finderEffort, THINK[effort].finder, 'args.finderEffort')
const verifyEffort = pickEffort(args && args.verifyEffort, THINK[effort].verify, 'args.verifyEffort')

// Optional model overrides. `model` applies to the finders (including the
// gap-sweep hunter, which is a finder); `verifyModel` overrides just the verifier
// passes (main verify + the gap-sweep verification). Splitting them is the only way
// to get cheap finders on models whose thinkingLevelMap has a single cell
// (claude-opus-5, claude-fable-5-1 accept only xhigh/max, so effort alone cannot
// make them cheap). Omit → agents inherit the session model. Accepts a
// provider/modelId like "kekulv/gpt-5.6-luna" or a fuzzy name like "luna".
//
// The preflight deliberately does NOT inherit `model`: it runs a single numstat
// and wants the cheapest thing available, but `effort: 'minimal'` is clamped UP on
// models that only expose xhigh/max — so pointing `model` at claude-opus-5 would
// run `git diff --numstat` with xhigh reasoning. Set args.scopeModel to steer it.
const model = (args && args.model) ? String(args.model).trim() : ''
const verifyModel = (args && args.verifyModel) ? String(args.verifyModel).trim() : ''
const scopeModel = (args && args.scopeModel) ? String(args.scopeModel).trim() : ''
const optsFor = (kind) => {
  const e = kind === 'verify' ? verifyEffort : finderEffort
  const m = kind === 'verify' ? (verifyModel || model) : model
  return { ...(m ? { model: m } : {}), ...(e !== 'inherit' ? { effort: e } : {}) }
}

// Guard: warn when effort/model words were left inside the target (the classic
// `/code-review 用 sol 评审…` trap — the whole phrase becomes the target and
// the option is never parsed out).
if (String(rawTarget).match(/\b(low|medium|high|xhigh|max|sol|terra|luna|grok|deepseek|flash|glm|opus|claude)\b/i)) {
  log(`⚠ args.target 疑似混入档位/模型词（target="${rawTarget}"，effort=${effort}${model ? ` model=${model}` : ' model=未指定'})——请确认这些词已被拆进 args.effort/args.model 而不是留在 target 里`)
}

// ---- finder prompts (CC: pass through half-believed candidates) ------------
// `verify` says whether a verification pass runs after this finder. It must: the
// recall-biased "pass through what you half-believe" instruction is only safe when
// something downstream filters. At low effort nothing does, and telling the single
// finder both "don't self-filter" and "only report what you're sure of" produced
// exactly the false positives low effort is supposed to avoid.
function suffix(cap, opts) {
  const verify = !opts || opts.verify !== false
  const calibration = verify
    ? `You are the FINDER phase of a two-phase review: a separate verification pass will judge every candidate you return. So do NOT silently drop a candidate you half-believe — if you can name a plausible trigger scenario for it, include it. Self-filtering finders are the #1 cause of missed bugs; verification decides, not you. Still never invent: every candidate needs at least a plausible scenario.`
    : `No verification pass runs after you — whatever you return is reported to the user as-is. Report only findings you are confident in: you must be able to name the concrete input or state that breaks the code. When in doubt, leave it out.`
  return `
Scope for this run:
${targetText}
${repoNote}
${scopeNote}

${calibration}

Return up to ${cap} candidates through the findings tool. Every candidate needs: file path, 1-based line, severity (critical/major/minor), category (one of: correctness, simplification, efficiency, reuse, altitude, conventions, test-coverage), short_summary (headline compressed to ≤60 characters — the claim only, no rationale or consequence), a one-line claim, and a concrete scenario (which input/state/timing/platform makes the code misbehave). Fewer or none is fine. Do not modify files; stay read-only.`
}

// Angle names are semantic on purpose. They used to be lettered A–H, which collided
// with CC's own A–E labels (CC: A line-by-line, B removed-behavior, C cross-file,
// D language-pitfall, E wrapper/proxy) and made the two impossible to compare.
const FINDER = {
  correctness: `Line-by-line diff scan. Read every hunk of the target diff line by line, then open the enclosing function for each hunk: bugs in unchanged lines of a touched function are in scope (the diff re-exposes or fails to fix them). For every changed line ask what input, state, timing, or platform makes it wrong. Hunt: inverted or wrong conditions, off-by-one, null/undefined dereferences (where adjacent lines show the value can be absent), removed guards or validation, falsy-zero checks, missing await, wrong-variable copy-paste, errors swallowed in a catch that should propagate. Do not report style, performance, or missing tests.`,

  regression: `Removed behavior and broken callers — the two highest-yield regression classes.
(1) REMOVED BEHAVIOR: read the \`-\` lines of the diff as carefully as the \`+\` lines. For every deleted or shortened line ask what it was protecting against and whether anything still protects against it: a validation or guard clause that is gone, a branch/else/default case that no longer exists, a catch or cleanup (close/unlock/rollback/clearTimeout) that was dropped, a retry or fallback that was removed, a default value that changed, a log or metric whose absence hides a failure. Deleted safety is invisible in the after-state of the file — it exists only in the diff, so work from the diff.
(2) BROKEN CALLERS: a change is a contract change if it alters signatures, return values, error behavior, defaults, ordering, or state lifecycle. Grep for symbols the diff touches and check their callers/consumers: callers not updated to a new signature or semantics, a changed function no longer satisfying an assumption its callers make, renamed symbols still referenced under the old name, config keys changed without migrating readers, duplicated logic the diff now contradicts.
Report only concrete breakages of the target diff. Do not report style, performance, or missing tests.`,

  cleanup: `Reuse, simplification, and dead code introduced by the diff. Report only concrete, low-risk cleanups of code the diff itself introduces: new code duplicating an existing helper or utility visible in the repo (name the helper and where it lives), a variable/function/branch the diff makes permanently dead, an obviously redundant wrapper around an existing API, or a clearly simpler equivalent of newly added logic. Do not flag pre-existing code, style, naming, or micro-optimizations.`,

  conventions: `Conventions and project rules. Check the target diff against the repository's documented conventions and architecture rules: read AGENTS.md / CLAUDE.md / CONTRIBUTING / README if present, and compare against established sibling-code patterns. Flag new code in the diff that violates a documented rule or convention, or that re-implements a well-established local pattern it should follow/reuse. Only flag deviations a maintainer would act on; do not invent rules or flag undocumented style preferences.`,

  altitude: `Altitude / layering. Flag changes the diff makes at the wrong level of abstraction or layer: logic placed in the wrong layer (view / service / model), work repeated per-call that belongs in one shared lower layer, a fix applied at a call site when the invariant belongs at the definition, a change broader or narrower than the invariant it enforces, duplicated error handling or validation that should be centralized. Only when the diff introduces the problem; do not report pre-existing architecture debt.`,

  efficiency: `Efficiency regressions introduced by the diff (category: efficiency). Flag wasted work the diff introduces: redundant computation or repeated I/O, independent operations run sequentially, blocking work added to startup or hot paths. Also flag long-lived objects built from closures or captured environments — they keep the entire enclosing scope alive for the object's lifetime (a memory leak when that scope holds large values); prefer a class/struct that copies only the fields it needs. Name the cheaper alternative. Only when the diff introduces the waste — never pre-existing performance debt, and never micro-optimizations that do not change the asymptotic cost.`,

  pitfall: `Language/framework pitfall specialist (category: correctness). Scan for the classic pitfalls of the diff's language and framework — for example: JS falsy-zero, \`==\` coercion, closure-captured loop variable, \`this\` binding loss, unhandled promise; Python mutable default arguments, late-binding closures, integer division, shadowed builtins; Go nil-map write, range-variable capture, unchecked type assertion; Java/Rust/C++ equivalents; SQL string interpolation, path traversal, unsafe deserialization; timezone/DST drift, float equality, locale/Unicode case folding. Flag any instance the diff introduces, with the concrete input that trips it.`,

  wrapper: `Wrapper/proxy correctness (category: correctness). When the diff adds or modifies a type that wraps another (cache, proxy, decorator, adapter, forwarder): check that every method routes to the wrapped instance and not back through a registry/session/global — e.g. a caching provider holding a \`delegate\` field that resolves IDs via \`session.get(...)\` instead of \`delegate.get(...)\` will re-enter the cache or recurse. Also check that the wrapper forwards every method the callers actually use, with unchanged semantics (return shape, error behavior, mutation, identity), and that it does not silently drop or double-apply an operation. Only when the diff touches such a type; return nothing otherwise.`,

  lowpass: `Low-effort single pass (mirrors CC low effort). Read the unified diff under review once. Skip test/fixture hunks entirely (test/, spec/, __tests__/, *_test.*, *.test.*, fixtures/, testdata/) — test-file changes are not reviewed at this level. Flag runtime-correctness bugs visible from the hunk alone: inverted/wrong condition, off-by-one, null/undefined deref where adjacent lines show the value can be absent, removed guard, falsy-zero check, missing await, wrong-variable copy-paste, error swallowed in a catch that should propagate. Also flag — still from the hunk alone — new code duplicating an existing helper visible in the diff context, and dead code the diff leaves behind. Do NOT flag style, naming, perf, missing tests, or anything outside the hunk.`,
}

// ---- verifier prompt (CC three-state, one shared pass) ----------------------
function verifierPrompt(candidates) {
  const list = candidates
    .map(
      (c) =>
        `[${c.idx}] ${c.file}:${c.line} (${c.severity}, ${c.category}, from ${c.angle} angle)\n  short: ${c.short_summary}\n  claim: ${c.claim}\n  scenario: ${c.scenario}`
    )
    .join('\n')
  const files = [...new Set(candidates.map((c) => c.file))]
  // CC hands its verifier the diff alongside the files. This workflow cannot pass
  // the diff through the script, so the verifier is told to pull it itself —
  // scoped to the files it is judging, not the whole target. Without this a
  // candidate about deleted code gets refuted for "the code does not say that",
  // because the current file only shows the after-state.
  const calibration = recallBiased
    ? `Calibration (recall-biased): do NOT refute a candidate merely for being "speculative" or "depends on runtime state" when the state is realistic: concurrency races, nil/undefined on a rare-but-reachable path (error handler, cold cache, missing optional field), falsy-zero treated as missing, off-by-one on a boundary the code does not exclude, retry storms / partial failures. These stay plausible or confirmed. REFUTED only when you can construct the refutation from the code itself.`
    : `Calibration: judge each candidate on the code as written. Refute what the code contradicts or what is already guarded elsewhere, and quote the line that settles it. Keep as plausible anything whose mechanism is real but whose trigger you cannot pin down from the code — do not confirm on the strength of a story alone, and do not refute just because you did not find the trigger.`
  return `You are the VERIFICATION phase of a code-review pipeline — a single shared pass. Judge EVERY candidate below independently against the actual code. Do not re-run your own full diff review; verify only these candidates.

${list}

How to read the evidence:
- Open each file around the cited line (grep/blame as needed). The line numbers are 1-based and may be slightly off — if the cited code is a few lines away, judge the code, not the offset.
- For any candidate about REMOVED or CHANGED behavior (a deleted guard, a dropped branch or catch, a changed default, code the diff made dead), the before-state exists ONLY in the diff. Pull the target's diff scoped to that file before judging — e.g. \`git diff HEAD -- ${files[0] || '<file>'}\` — for these ${files.length} file(s): ${files.join(', ')}. Reading only the current file shows you the after-state and will make you refute real regressions.

Classify each candidate (return one verdict per idx, all of them):
- confirmed — you can name the inputs/state that trigger it and the wrong output or crash. Quote the line.
- plausible — the mechanism is real but the trigger is uncertain (timing, env, config). Say what would confirm it.
- refuted — factually wrong (the code does not say that) or guarded elsewhere. Quote the line that proves it.

${calibration}

Duplicates: several candidates may describe the SAME defect at the same line, surfaced by different angles in different words. Confirm the one whose scenario is most concrete, and mark the others \`refuted\` with note "duplicate of [idx N]". Do not merge two genuinely different defects that merely share a line.

Impact check: also judge whether the candidate's claimed user-visible impact is supported by the code. If the bug mechanism is real but the claimed impact (e.g. "alert can never display") cannot be substantiated from code you can see, mark it plausible rather than confirmed, and say which layer would need checking.

Review context:
${targetText}
${repoNote}

Read-only. Respond through the verdicts tool: one object per candidate idx — state, evidence (file:line + short code quote), note.`
}

function gapSweepPrompt(files, known) {
  const already = known.length
    ? `\nAlready reported by the earlier passes — do NOT repeat any of these file:line locations:\n${known.slice(0, 80).map((k) => `- ${k.file}:${k.line} — ${k.short_summary}`).join('\n')}\n`
    : ''
  return `You are the GAP-SWEEP phase of a max-effort code review. The finder + verification passes above found nothing confirmable in these files of the target diff, or only refuted/plausible items:

${files.map((f) => `- ${f}`).join('\n')}
${already}
${targetText}
${repoNote}

Hunt missed bugs in exactly these files — read their changed hunks carefully (correctness first: wrong conditions, off-by-one, null/undefined deref, missing await, removed guards, swallowed errors; then broken callers of changed functions; then new-code duplication/dead code). Report only findings with a concrete scenario. Focus on what the earlier passes missed; a defect already listed above will be discarded.

Return up to 8 candidates through the findings tool with the same field rules (file, line, severity, category, short_summary ≤60, claim, scenario). Read-only.`
}

// ---- stages ----------------------------------------------------------------
const rank = { critical: 0, major: 1, minor: 2 }
const WORKER = 'code-review-worker'

log(`code-review workflow — effort=${effort} finder=${finderEffort} verify=${verifyEffort}${model ? ` model=${model}` : ' model=inherit'}${verifyModel ? ` verifyModel=${verifyModel}` : ''} target: ${targetText}${compact ? ' (compact output)' : ''}`)

// Phase 0 — scope. CC gathers the diff once in its orchestrator and hands it to the
// subagents. A pi workflow script cannot run git, and routing a whole diff back
// through a structured-output tool would be paid at output-token prices, so the
// preflight returns only the cheap facts: per-file churn and the total. Those buy
// four things — an early exit on an empty diff, a central list of generated/lock
// files to exclude (otherwise every finder reads the same lockfile), a finder fleet
// sized to the real reviewable churn, and gap-sweep coverage of files no finder
// happened to mention. Skipped at low effort, where it would double the cost of the
// single cheap pass.
//
// NOTE: the fleet sizing below is this workflow's own idea, NOT ported from CC.
// CC fixes its angle count by effort level (8 at medium/high, 10 at xhigh/max) and
// has no diff-size formula anywhere in its prompts.
let changedLines = 0
let reviewableFiles = null
let excludedFiles = []
let preflightOk = false

// Generated / vendored / lock artifacts. A single pnpm-lock.yaml is thousands of
// lines that every finder would read in full for exactly zero findings, so these
// are cut centrally and the finders are given a pathspec that excludes them.
const NOISE = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|npm-shrinkwrap\.json|poetry\.lock|Pipfile\.lock|Cargo\.lock|go\.sum|composer\.lock|Gemfile\.lock|uv\.lock|flake\.lock)$|\.min\.(js|css)$|\.(map|lock)$|(^|\/)(dist|build|out|vendor|node_modules|__snapshots__|testdata|__pycache__)\/|\.(pb|generated|g)\.(go|ts|js|py|dart|rs)$|_pb2\.py$/

if (effort !== 'low') {
  const pre = await agent(
    `Gather review scope only — do NOT review or read any code.

${targetText}
${repoNote}

Run the matching git command with \`--numstat\` (e.g. \`git diff HEAD --numstat\`, \`git diff --numstat <range>\`, \`git show --numstat <commit>\`) and return one entry per changed file with its added+removed line count, plus the overall total. Return an empty file list when the target has no changes. Do not open or read any of the files.`,
    { label: 'scope:preflight', phase: 'Scope', agentType: WORKER, schema: PREFLIGHT_SCHEMA, ...(scopeModel ? { model: scopeModel } : {}), effort: 'minimal' }
  )
  if (pre) {
    preflightOk = true
    const all = (Array.isArray(pre.files) ? pre.files : [])
      .map((f) => (typeof f === 'string'
        ? { path: f, churn: 0 }
        : { path: String((f && f.path) || ''), churn: Number((f && f.churn) || 0) }))
      .filter((f) => f.path)
    excludedFiles = all.filter((f) => NOISE.test(f.path))
    reviewableFiles = all.filter((f) => !NOISE.test(f.path))
    // Prefer churn summed over the reviewable files — a lockfile must not inflate
    // the diff size and talk the fleet sizer into running every angle. When the
    // model returned no per-file churn, prorate the reported total by the share of
    // files that survived exclusion; falling back to the raw total would both
    // oversize the fleet and, on a lockfile-only diff, defeat the early exit below
    // (reviewable is empty but the total is thousands of lines).
    const churnSum = reviewableFiles.reduce((a, f) => a + f.churn, 0)
    changedLines = churnSum > 0
      ? churnSum
      : Math.round((Number(pre.changedLines) || 0) * (reviewableFiles.length / Math.max(1, all.length)))
    if (excludedFiles.length) {
      const noiseChurn = excludedFiles.reduce((a, f) => a + f.churn, 0)
      log(`scope: excluded ${excludedFiles.length} generated/lock file(s) (${noiseChurn} churned lines) — ${excludedFiles.slice(0, 6).map((f) => f.path).join(', ')}${excludedFiles.length > 6 ? ', …' : ''}`)
    }
  } else {
    log('scope: preflight failed — falling back to the unscaled finder budget, no noise exclusion, and the files finders happen to mention')
  }
}

// Empty diff → nothing to review. Without this every finder still spawns and
// independently discovers an empty diff.
const emptyPayload = (why) => {
  log(`scope: ${why}`)
  return { target: targetText, effort, empty: true, reason: why, candidates: 0, verifying: 0, stats: { confirmed: 0, plausible: 0, refuted: 0 }, confirmed: 0, reportCap: conf.reportCap, failedAngles: [], excludedFiles: excludedFiles.map((f) => f.path), findings: [], plausible: [] }
}
if (preflightOk && changedLines === 0 && (!reviewableFiles || !reviewableFiles.length)) {
  return emptyPayload(excludedFiles.length
    ? `the target only touches generated/lock files (${excludedFiles.map((f) => f.path).join(', ')}) — nothing to review`
    : 'no changes in the target — nothing to review')
}

// Scale the FLEET to the diff, not the per-angle candidate cap. Capping candidates
// only bounds output tokens; the cost of a review is (number of agents) x (bytes
// each one reads), so the only lever that moves the bill is how many angles run.
// FLOOR keeps an explicitly requested effort level meaningful: asking for xhigh on
// a 40-line diff should still get specialists, just not all eight.
const scaleToDiff = preflightOk && !(args && args.noScale)
const LINES_PER_ANGLE = Number((args && args.linesPerAngle) || 120)
const FLOOR = { low: 1, medium: 3, high: 4, xhigh: 5, max: 5 }
// Ordered by expected yield per token. Truncation takes a prefix of this list, so
// the diff-local, highest-signal angles survive the smallest diffs. Any angle key
// not listed here sorts LAST rather than vanishing, so adding a new CONF angle can
// never silently drop it from a scaled-down run.
const ANGLE_PRIORITY = ['correctness', 'regression', 'efficiency', 'cleanup', 'pitfall', 'wrapper', 'conventions', 'altitude']
const angleRank = (k) => { const i = ANGLE_PRIORITY.indexOf(k); return i === -1 ? ANGLE_PRIORITY.length : i }
function planFinders(baseCaps, lines) {
  const keys = Object.keys(baseCaps)
  if (keys.length <= 1) return baseCaps // lowpass: one angle, fixed cap
  const want = Math.min(keys.length, Math.max(FLOOR[effort] || 2, Math.ceil(lines / LINES_PER_ANGLE)))
  if (want >= keys.length) return baseCaps
  const kept = [...keys].sort((a, b) => angleRank(a) - angleRank(b)).slice(0, want)
  const dropped = keys.filter((k) => !kept.includes(k))
  log(`scope: ${lines} reviewable changed lines → running ${kept.length}/${keys.length} angles (dropped ${dropped.join(', ')}; coverage reduced on purpose — pass noScale:true to keep all angles)`)
  return Object.fromEntries(kept.map((k) => [k, baseCaps[k]]))
}
const finderCaps = scaleToDiff ? planFinders(conf.finderCaps, changedLines) : conf.finderCaps

// Tell the finders exactly which paths are in scope. This is not advice — it is a
// pathspec they must append to the git command, which is what actually keeps the
// excluded bytes out of eight separate agent contexts.
function buildScopeNote() {
  if (!preflightOk) return ''
  const paths = (reviewableFiles || []).map((f) => f.path)
  let spec = ''
  if (excludedFiles.length) {
    spec = paths.length && paths.length <= 40
      ? `\nScope the diff to these paths — append this pathspec to the git command above:\n  -- ${paths.map((p) => `'${p}'`).join(' ')}\n`
      : `\nExclude these generated/vendored paths — append this pathspec to the git command above:\n  -- . ${excludedFiles.map((f) => `':(exclude)${f.path}'`).join(' ')}\n`
    spec += `Those paths are generated, vendored, or lock artifacts. Do not read them and do not report on them.\n`
  }
  return `\nThis target is about ${changedLines} reviewable changed lines across ${paths.length} file(s)${excludedFiles.length ? ` (${excludedFiles.length} generated/lock file(s) already excluded)` : ''} — scale your investigation depth to it rather than running a fixed large sweep.\n${spec}`
}
const scopeNote = buildScopeNote()

function runFinder(key, cap) {
  return agent(`${FINDER[key]}${suffix(cap, { verify: conf.verify })}`, {
    label: `scan:${key}`,
    phase: 'Scan',
    agentType: WORKER,
    schema: findingsSchema(cap),
    ...optsFor('finder'),
  }).then((r) => {
    const all = (r && Array.isArray(r.findings)) ? r.findings : []
    const kept = all.slice(0, cap)
    if (all.length > kept.length) log(`scan:${key} returned ${all.length} candidates over its ${cap} budget — kept the first ${kept.length}`)
    // ok distinguishes "this angle ran and found nothing" from "this angle never
    // answered". Collapsing both to an empty list made a crashed or context-blown
    // finder read as a clean bill of health.
    return { angle: key, ok: r !== null && r !== undefined, candidates: kept.map((f) => ({ ...f, angle: key })) }
  })
}

// Phase 1 — find candidates (CC: finders over-report; verification filters)
const finderKeys = Object.keys(finderCaps).sort((a, b) => angleRank(a) - angleRank(b))
const scanResults = await parallel(finderKeys.map((key) => () => runFinder(key, finderCaps[key])))
const scans = (scanResults || []).filter(Boolean)
const found = scans.flatMap((r) => r.candidates || [])
const failedAngles = finderKeys.filter((k) => {
  const r = scans.find((s) => s.angle === k)
  return !r || !r.ok
})
log(`scan (${finderKeys.length} angles): ${found.length} raw candidates — ${finderKeys.map((k) => {
  const r = scans.find((s) => s.angle === k)
  return `${k}=${!r || !r.ok ? '✗' : r.candidates.length}`
}).join(' ')}`)
if (failedAngles.length) log(`⚠ scan: ${failedAngles.join(', ')} returned nothing at all (agent failed, was skipped, or blew its context) — those angles have ZERO coverage this run, which is not the same as finding nothing`)

// Dedupe pass 1. CC's Phase-1 rule: never let one angle's conclusion suppress
// another's — the same file:line flagged by DIFFERENT angles for different
// reasons is kept twice; only exact (file, line, angle) repeats collapse.
const seen = new Set()
const candidates = []
for (const f of found) {
  const key = `${f.file}:${f.line}:${f.angle}`
  if (seen.has(key)) continue
  seen.add(key)
  candidates.push(f)
}
candidates.sort((a, b) => rank[a.severity] - rank[b.severity])
log(`after dedupe: ${candidates.length} candidates`)

// Dedupe pass 2 — CC's Phase-2 rule. Candidates pointing at the same line AND the
// same mechanism collapse to the one with the most concrete failure scenario,
// BEFORE verification. CC lets a model judge "same line/mechanism"; with no model
// in the loop here the key also requires the ≤60-char headline to match, so two
// genuinely different bugs that share a line are never merged. That makes this
// filter conservative and easy to slip past with different wording — the verifier
// prompt carries an explicit duplicate rule as the second line of defence, and
// chunking by file (below) guarantees same-line siblings land in the same verifier.
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ').trim()
const byLineMech = new Map()
for (const c of candidates) {
  const key = `${c.file}:${c.line}:${c.category}:${norm(c.short_summary)}`
  const prev = byLineMech.get(key)
  if (!prev || String(c.scenario || '').length > String(prev.scenario || '').length) byLineMech.set(key, c)
}
const toVerify = [...byLineMech.values()].sort(
  (a, b) => rank[a.severity] - rank[b.severity] || `${a.file}:${a.line}`.localeCompare(`${b.file}:${b.line}`)
)
toVerify.forEach((c, i) => { c.idx = i })
if (candidates.length !== toVerify.length) log(`same-line/mechanism repeats collapsed: ${candidates.length} → ${toVerify.length} to verify`)

// Phase 2 — verify (skipped at low effort, mirroring CC)
// CHUNK is a token/quality trade-off, not a correctness one: a bigger batch means
// fewer agents re-reading the same diff (cheaper), while a smaller batch limits
// how much one candidate can anchor the next. Override with args.verifyChunk.
const CHUNK = Math.max(1, Number((args && args.verifyChunk) || 20))

// Pack candidates into chunks by FILE, not by severity rank. Severity-first
// ordering scattered a file's candidates across several chunks, so two or three
// verifier agents each opened (and paid for) the same file. Grouping by file means
// each file is read once, and every same-line sibling lands in one agent's context
// where the duplicate rule in the verifier prompt can actually see it.
function chunkByFile(cands, size) {
  const byFile = new Map()
  for (const c of cands) {
    if (!byFile.has(c.file)) byFile.set(c.file, [])
    byFile.get(c.file).push(c)
  }
  const groups = [...byFile.values()].sort((a, b) => b.length - a.length)
  const chunks = []
  for (const g of groups) {
    // A single file with more candidates than the chunk size gets its own
    // oversized chunk rather than being split — splitting it would reintroduce
    // exactly the duplicate-read problem this function exists to remove.
    if (g.length >= size) { chunks.push(g); continue }
    let target = chunks.find((ch) => ch.length + g.length <= size)
    if (!target) { target = []; chunks.push(target) }
    target.push(...g)
  }
  return chunks
}

const VERIFIER_GAP = { state: 'plausible', evidence: '', note: 'no verdict returned — kept as plausible (verifier gap, not a refutation)' }
let verified = []
if (conf.verify && toVerify.length) {
  const chunks = chunkByFile(toVerify, CHUNK)
  if (chunks.length > 1) log(`verify: ${toVerify.length} candidates in ${chunks.length} chunks grouped by file (≤${CHUNK} each, oversized files kept whole)`)
  const verdictRuns = await parallel(
    chunks.map((chunk, ci) => () =>
      agent(verifierPrompt(chunk), {
        label: `verify:pass${ci + 1}/${chunks.length}`,
        phase: 'Verify',
        agentType: WORKER,
        schema: verdictsSchema(chunk.length),
        ...optsFor('verify'),
      }).then((r) => (r && r.verdicts) || [])
    )
  )
  const byIdx = new Map()
  for (const v of (verdictRuns || []).flat().filter(Boolean)) {
    if (!byIdx.has(v.idx)) byIdx.set(v.idx, v) // first verdict per idx wins
  }
  // Fail OPEN. A missing verdict means the verifier failed to answer, not that the
  // candidate was disproved — demoting it to `refuted` would silently drop real
  // findings (an infra/schema failure would read as "nothing to report").
  const missing = toVerify.filter((c) => !byIdx.has(c.idx)).length
  if (missing) log(`⚠ verify: ${missing}/${toVerify.length} candidates got no verdict — kept as plausible, NOT counted as refuted`)
  verified = toVerify.map((c) => ({ ...c, ...(byIdx.get(c.idx) || VERIFIER_GAP) }))
} else if (conf.verify) {
  log('verify: nothing to verify (0 candidates)')
} else {
  // low effort: no verification — candidates are the findings
  verified = toVerify.map((c) => ({ ...c, state: 'direct', evidence: '', note: '' }))
}
const tally = (s) => verified.filter((v) => v.state === s).length
const stats = { confirmed: tally('confirmed') + tally('direct'), plausible: tally('plausible'), refuted: tally('refuted') }
log(`verify: confirmed=${stats.confirmed} plausible=${stats.plausible} refuted=${stats.refuted}`)

// Gap sweep (xhigh/max): re-hunt files with no confirmed finding. The preflight
// file list is what makes this real coverage — sweeping only files some finder
// mentioned would never look twice at a file every finder skipped. Kept to a
// handful of files: one agent asked to re-read forty files at six candidates of
// budget is a formality, not a sweep.
const MAX_GAP_FILES = Math.max(1, Number((args && args.maxGapFiles) || 12))
if (conf.sweep) {
  const confirmedFiles = new Set(verified.filter((v) => v.state === 'confirmed' || v.state === 'direct').map((v) => v.file))
  const mentioned = new Set(candidates.map((c) => c.file))
  const allChanged = (preflightOk && reviewableFiles && reviewableFiles.length)
    ? [...reviewableFiles].sort((a, b) => b.churn - a.churn).map((f) => f.path)
    : [...mentioned]
  let gapFiles = allChanged.filter((f) => !confirmedFiles.has(f))
  if (gapFiles.length > MAX_GAP_FILES) {
    log(`gap sweep: ${gapFiles.length} files have no confirmed finding — sweeping only the ${MAX_GAP_FILES} with the most churn; ${gapFiles.length - MAX_GAP_FILES} file(s) are NOT swept`)
    gapFiles = gapFiles.slice(0, MAX_GAP_FILES)
  }
  if (gapFiles.length) {
    const unflagged = gapFiles.filter((f) => !mentioned.has(f)).length
    log(`gap sweep: re-hunting ${gapFiles.length} files with no confirmed finding${unflagged ? ` (${unflagged} never mentioned by any finder)` : ''}`)
    const gap = await agent(gapSweepPrompt(gapFiles, candidates), { label: 'scan:gap-sweep', phase: 'Scan', agentType: WORKER, schema: findingsSchema(8), ...optsFor('finder') })
    const gapCands = ((gap && gap.findings) || []).slice(0, 8).map((f) => ({ ...f, angle: 'gap' }))
    // Drop anything the earlier passes already put on the same line — matching on
    // (file,line,angle) alone would let the sweep re-report an already-confirmed
    // finding under its own angle name.
    const knownLines = new Set(candidates.map((c) => `${c.file}:${c.line}`))
    const fresh = gapCands.filter((f) => !seen.has(`${f.file}:${f.line}:${f.angle}`) && !knownLines.has(`${f.file}:${f.line}`))
    const repeats = gapCands.length - fresh.length
    if (repeats) log(`gap sweep: dropped ${repeats} candidate(s) already reported at the same file:line`)
    if (fresh.length) {
      fresh.sort((a, b) => rank[a.severity] - rank[b.severity])
      const idx0 = verified.length
      fresh.forEach((c, i) => { c.idx = idx0 + i })
      const vr = await agent(verifierPrompt(fresh), { label: 'verify:gap-sweep', phase: 'Verify', agentType: WORKER, schema: verdictsSchema(fresh.length), ...optsFor('verify') })
      const byIdx2 = new Map()
      for (const v of ((vr && vr.verdicts) || [])) if (!byIdx2.has(v.idx)) byIdx2.set(v.idx, v)
      if (fresh.some((c) => !byIdx2.has(c.idx))) log(`⚠ verify(gap sweep): ${fresh.filter((c) => !byIdx2.has(c.idx)).length} candidates got no verdict — kept as plausible`)
      const gapVerified = fresh.map((c) => ({ ...c, ...(byIdx2.get(c.idx) || VERIFIER_GAP) }))
      const add = gapVerified.filter((v) => v.state !== 'refuted').length
      verified = verified.concat(gapVerified)
      stats.confirmed += gapVerified.filter((v) => v.state === 'confirmed').length
      stats.plausible += gapVerified.filter((v) => v.state === 'plausible').length
      stats.refuted += gapVerified.filter((v) => v.state === 'refuted').length
      log(`gap sweep: +${fresh.length} candidates, ${add} non-refuted`)
    } else {
      log('gap sweep: nothing new found')
    }
  }
}

// Phase 3 — report CONFIRMED findings; PLAUSIBLE kept aside for the caller
const PLAUSIBLE_CAP = Math.max(0, Number((args && args.plausibleCap) || 8))
const bySeverity = (a, b) => rank[a.severity] - rank[b.severity] || `${a.file}:${a.line}`.localeCompare(`${b.file}:${b.line}`)
const allConfirmed = verified.filter((v) => v.state === 'confirmed' || v.state === 'direct').sort(bySeverity)
const allPlausible = verified.filter((v) => v.state === 'plausible').sort(bySeverity)
const findings = allConfirmed.slice(0, conf.reportCap)
const plausible = allPlausible.slice(0, PLAUSIBLE_CAP)
// Never truncate silently: a dropped confirmed finding that nothing logs reads to
// the caller as a finding that was never made.
if (allConfirmed.length > findings.length) log(`⚠ report: ${allConfirmed.length} confirmed findings exceed the ${effort} cap of ${conf.reportCap} — ${allConfirmed.length - findings.length} least-severe were DROPPED from the report: ${allConfirmed.slice(conf.reportCap).map((f) => `${f.file}:${f.line}`).join(', ')}`)
if (allPlausible.length > plausible.length) log(`report: ${allPlausible.length - plausible.length} additional plausible item(s) not returned (cap ${PLAUSIBLE_CAP})`)

// CC minimal-mode restatement: one line per finding so the list survives
// sessions that do not render (or truncate) the full payload.
for (const f of findings) log(`✓ [${f.severity}] ${f.file}:${f.line} — ${f.short_summary}`)
for (const p of plausible) log(`? [${p.severity}] ${p.file}:${p.line} — ${p.short_summary}`)
log(`report: ${findings.length} confirmed findings (+ ${plausible.length} plausible kept aside)`)

// `claim` is dropped from the payload: short_summary is the same sentence under 60
// chars, and the caller writes its report from short_summary + scenario. `note` is
// only informative for plausible items ("what would confirm it") — on a confirmed
// finding it restates the scenario. Both used to ship on every entry.
const pick = (f) => ({
  file: f.file,
  line: f.line,
  severity: f.severity,
  category: f.category,
  state: f.state,
  short_summary: f.short_summary,
  scenario: f.scenario,
  ...(!compact && f.evidence ? { evidence: f.evidence } : {}),
  ...(f.state === 'plausible' && f.note ? { note: f.note } : {}),
})

return {
  target: targetText,
  effort,
  finderEffort,
  verifyEffort,
  model: model || 'inherit',
  verifyModel: verifyModel || model || 'inherit',
  angles: finderKeys.length,
  anglesRun: finderKeys,
  failedAngles,
  changedLines: preflightOk ? changedLines : null,
  excludedFiles: excludedFiles.map((f) => f.path),
  candidates: candidates.length,
  verifying: toVerify.length,
  stats,
  confirmed: findings.length,
  confirmedTotal: allConfirmed.length,
  reportCap: conf.reportCap,
  findings: findings.map(pick),
  plausible: plausible.map(pick),
}
