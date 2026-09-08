export const meta = {
  name: 'code-review',
  description: 'CC-style multi-agent code review: effort-graded (low/medium/high/max), finder angles surface candidates, ONE verifier pass classifies each (confirmed/plausible/refuted), report confirmed findings',
  phases: [
    { title: 'Scan', detail: 'finder agents scan the target diff from different angles, passing through half-believed candidates' },
    { title: 'Verify', detail: 'a single verifier pass classifies every candidate three-state, quoting the proving line' },
  ],
}

// ---- schemas ---------------------------------------------------------------
const CATEGORIES = [
  'correctness', 'simplification', 'efficiency', 'reuse', 'altitude', 'conventions', 'test-coverage',
]

function findingsSchema(cap) {
  return {
    type: 'object',
    required: ['findings'],
    properties: {
      findings: {
        type: 'array',
        maxItems: cap,
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

function verdictsSchema(n) {
  return {
    type: 'object',
    required: ['verdicts'],
    properties: {
      verdicts: {
        type: 'array',
        minItems: n,
        maxItems: n,
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

// ---- scope & effort ---------------------------------------------------------
const rawTarget = (args && args.target) || 'uncommitted'
const repo = (args && args.repo) || ''
const compact = Boolean(args && args.compact) // strip prose from returned entries when set
const effort = String((args && args.effort) || 'medium').toLowerCase()
if (!['low', 'medium', 'high', 'max'].includes(effort)) throw new Error(`unknown effort "${effort}" (low|medium|high|max)`)
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

// effort config — mirrors CC: low = 1 pass, no verify, ≤4; medium = 3 angles,
// verify, ≤8; high = 5 angles, verify, ≤10; max = 5 angles + gap sweep, ≤15.
const CONF = {
  low:    { finderCaps: { lowpass: 4 },                         verify: false, reportCap: 4,  sweep: false },
  medium: { finderCaps: { correctness: 8, regression: 8, cleanup: 8 }, verify: true, reportCap: 8,  sweep: false },
  high:   { finderCaps: { correctness: 8, regression: 8, cleanup: 8, conventions: 8, altitude: 8 }, verify: true, reportCap: 10, sweep: false },
  max:    { finderCaps: { correctness: 10, regression: 10, cleanup: 10, conventions: 10, altitude: 10 }, verify: true, reportCap: 15, sweep: true },
}
const conf = CONF[effort]

// optional model override — applied to every spawned agent (finders, verifier,
// gap sweep). Omit → agents inherit the session model. Accepts a provider/modelId
// like "kekulv/gpt-5.6-luna" or a fuzzy name like "luna".
const model = (args && args.model) ? String(args.model).trim() : ''
const optsModel = model ? { model } : {}

// ---- finder prompts (CC: pass through half-believed candidates) ------------
function suffix(cap, extra) {
  return `
Scope for this run:
${targetText}
${repoNote}
${extra || ''}

You are the FINDER phase of a two-phase review: a separate verification pass will judge every candidate you return. So do NOT silently drop a candidate you half-believe — if you can name a plausible trigger scenario for it, include it. Self-filtering finders are the #1 cause of missed bugs; verification decides, not you. Still never invent: every candidate needs at least a plausible scenario.

Return up to ${cap} candidates through the findings tool. Every candidate needs: file path, 1-based line, severity (critical/major/minor), category (one of: correctness, simplification, efficiency, reuse, altitude, conventions, test-coverage), short_summary (headline compressed to ≤60 characters — the claim only, no rationale or consequence), a one-line claim, and a concrete scenario (which input/state/timing/platform makes the code misbehave). Fewer or none is fine. Do not modify files; stay read-only.`
}

const FINDER = {
  correctness: `Angle A — line-by-line diff scan. Read every hunk of the target diff line by line, then open the enclosing function for each hunk: bugs in unchanged lines of a touched function are in scope (the diff re-exposes or fails to fix them). For every changed line ask what input, state, timing, or platform makes it wrong. Hunt: inverted or wrong conditions, off-by-one, null/undefined dereferences (where adjacent lines show the value can be absent), removed guards or validation, falsy-zero checks, missing await, wrong-variable copy-paste, errors swallowed in a catch that should propagate. Do not report style, performance, or missing tests.`,

  regression: `Angle B — regressions and broken callers. A change is a contract change if it alters signatures, return values, error behavior, defaults, ordering, or state lifecycle. Grep for symbols the diff touches and check their callers/consumers: callers not updated to a new signature or semantics, removed handling a caller relied on, a changed function no longer satisfying an assumption its callers make, renamed symbols still referenced under the old name, config keys changed without migrating readers, duplicated logic the diff now contradicts. Report only concrete breakages of the target diff. Do not report style, performance, or missing tests.`,

  cleanup: `Angle C — reuse, simplification, and dead code introduced by the diff. Report only concrete, low-risk cleanups of code the diff itself introduces: new code duplicating an existing helper or utility visible in the repo (name the helper and where it lives), a variable/function/branch the diff makes permanently dead, an obviously redundant wrapper around an existing API, or a clearly simpler equivalent of newly added logic. Do not flag pre-existing code, style, naming, or micro-optimizations.`,

  conventions: `Angle D — conventions and project rules. Check the target diff against the repository's documented conventions and architecture rules: read AGENTS.md / CLAUDE.md / CONTRIBUTING / README if present, and compare against established sibling-code patterns. Flag new code in the diff that violates a documented rule or convention, or that re-implements a well-established local pattern it should follow/reuse. Only flag deviations a maintainer would act on; do not invent rules or flag undocumented style preferences.`,

  altitude: `Angle E — altitude / layering. Flag changes the diff makes at the wrong level of abstraction or layer: logic placed in the wrong layer (view / service / model), work repeated per-call that belongs in one shared lower layer, a fix applied at a call site when the invariant belongs at the definition, a change broader or narrower than the invariant it enforces, duplicated error handling or validation that should be centralized. Only when the diff introduces the problem; do not report pre-existing architecture debt.`,

  lowpass: `Low-effort single pass (mirrors CC low effort). Read the unified diff under review once. Skip test/fixture hunks entirely (test/, spec/, __tests__/, *_test.*, *.test.*, fixtures/, testdata/) — test-file changes are not reviewed at this level. Flag runtime-correctness bugs visible from the hunk alone: inverted/wrong condition, off-by-one, null/undefined deref where adjacent lines show the value can be absent, removed guard, falsy-zero check, missing await, wrong-variable copy-paste, error swallowed in a catch that should propagate. Also flag — still from the hunk alone — new code duplicating an existing helper visible in the diff context, and dead code the diff leaves behind. Do NOT flag style, naming, perf, missing tests, or anything outside the hunk. No verify pass runs after you: report only findings you are confident in.`,
}

// ---- verifier prompt (CC three-state, one shared pass) ----------------------
function verifierPrompt(candidates) {
  const list = candidates
    .map(
      (c) =>
        `[${c.idx}] ${c.file}:${c.line} (${c.severity}, ${c.category}, from ${c.angle} angle)\n  short: ${c.short_summary}\n  claim: ${c.claim}\n  scenario: ${c.scenario}`
    )
    .join('\n')
  return `You are the VERIFICATION phase of a code-review pipeline — a single shared pass. Judge EVERY candidate below independently against the actual code. Read the file around each file:line (grep/blame as needed). Do not re-run your own full diff review; verify only these candidates.

${list}

Classify each candidate (return one verdict per idx, all of them):
- confirmed — you can name the inputs/state that trigger it and the wrong output or crash. Quote the line.
- plausible — the mechanism is real but the trigger is uncertain (timing, env, config). Say what would confirm it.
- refuted — factually wrong (the code does not say that) or guarded elsewhere. Quote the line that proves it.

Calibration (recall-biased): do NOT refute a candidate merely for being "speculative" or "depends on runtime state" when the state is realistic: concurrency races, nil/undefined on a rare-but-reachable path (error handler, cold cache, missing optional field), falsy-zero treated as missing, off-by-one on a boundary the code does not exclude, retry storms / partial failures. These stay plausible or confirmed. REFUTED only when you can construct the refutation from the code itself.

Impact check: also judge whether the candidate's claimed user-visible impact is supported by the code. If the bug mechanism is real but the claimed impact (e.g. "alert can never display") cannot be substantiated from code you can see, mark it plausible rather than confirmed, and say which layer would need checking.

Review context:
${targetText}
${repoNote}

Read-only. Respond through the verdicts tool: one object per candidate idx — state, evidence (file:line + short code quote), note.`
}

function gapSweepPrompt(files) {
  return `You are the GAP-SWEEP phase of a max-effort code review. The finder + verification passes above found nothing confirmable in these files of the target diff, or only refuted/plausible items:

${files.map((f) => `- ${f}`).join('\n')}

${targetText}
${repoNote}

Hunt missed bugs in exactly these files — read their changed hunks carefully (correctness first: wrong conditions, off-by-one, null/undefined deref, missing await, removed guards, swallowed errors; then broken callers of changed functions; then new-code duplication/dead code). Report only findings with a concrete scenario. Do not restate what other passes already reported if you cannot see it — focus on what they missed.

Return up to 6 candidates through the findings tool with the same field rules (file, line, severity, category, short_summary ≤60, claim, scenario). Read-only.`
}

// ---- stages ----------------------------------------------------------------
const rank = { critical: 0, major: 1, minor: 2 }

log(`code-review workflow — effort=${effort}${model ? ` model=${model}` : ''} target: ${targetText}${compact ? ' (compact output)' : ''}`)

function runFinder(key, cap) {
  const extra = key === 'lowpass'
    ? '\nNo verify pass runs after you — only report findings you are confident in.'
    : ''
  return agent(`${FINDER[key]}${suffix(cap, extra)}`, {
    label: `scan:${key}`,
    phase: 'Scan',
    agentType: 'code-review',
    schema: findingsSchema(cap),
    ...optsModel,
  }).then((r) => ({
    angle: key,
    candidates: (r && r.findings ? r.findings : []).map((f) => ({ ...f, angle: key })),
  }))
}

// Phase 1 — find candidates (CC: finders over-report; verification filters)
const finderKeys = Object.keys(conf.finderCaps)
const scanResults = await parallel(finderKeys.map((key) => () => runFinder(key, conf.finderCaps[key])))
const found = (scanResults || []).filter(Boolean).flatMap((r) => r.candidates || [])
log(`scan (${finderKeys.length} angles): ${found.length} raw candidates`)

// Dedupe. CC: never let one angle's conclusion suppress another's — same
// file:line flagged by DIFFERENT angles for different reasons is kept twice;
// only exact (file, line, angle) repeats collapse.
const seen = new Set()
const candidates = []
for (const f of found) {
  const key = `${f.file}:${f.line}:${f.angle}`
  if (seen.has(key)) continue
  seen.add(key)
  candidates.push(f)
}
candidates.sort((a, b) => rank[a.severity] - rank[b.severity])
candidates.forEach((c, i) => { c.idx = i })
log(`after dedupe: ${candidates.length} candidates`)

// Phase 2 — verify (skipped at low effort, mirroring CC)
let verified = []
if (conf.verify && candidates.length) {
  const CHUNK = 20
  const chunks = []
  for (let i = 0; i < candidates.length; i += CHUNK) chunks.push(candidates.slice(i, i + CHUNK))
  if (chunks.length > 1) log(`verify: ${candidates.length} candidates in ${chunks.length} chunks of ≤${CHUNK}`)
  const verdictRuns = await parallel(
    chunks.map((chunk, ci) => () =>
      agent(verifierPrompt(chunk), {
        label: `verify:pass${ci + 1}/${chunks.length}`,
        phase: 'Verify',
        agentType: 'code-review',
        schema: verdictsSchema(chunk.length),
        ...optsModel,
      }).then((r) => (r && r.verdicts) || [])
    )
  )
  const allVerdicts = (verdictRuns || []).flat().filter(Boolean)
  const byIdx = new Map(allVerdicts.map((v) => [v.idx, v]))
  verified = candidates.map((c) => {
    const v = byIdx.get(c.idx) || { state: 'refuted', evidence: '', note: 'no verdict returned' }
    return { ...c, ...v }
  })
} else if (conf.verify) {
  log('verify: nothing to verify (0 candidates)')
} else {
  // low effort: no verification — candidates are the findings
  verified = candidates.map((c) => ({ ...c, state: 'direct', evidence: '', note: '' }))
}
const tally = (s) => verified.filter((v) => v.state === s).length
const stats = { confirmed: tally('confirmed') + tally('direct'), plausible: tally('plausible'), refuted: tally('refuted') }
log(`verify: confirmed=${stats.confirmed} plausible=${stats.plausible} refuted=${stats.refuted}`)

// Gap sweep (max effort): re-hunt files with no confirmed finding
if (conf.sweep) {
  const confirmedFiles = new Set(verified.filter((v) => v.state === 'confirmed').map((v) => v.file))
  const dirtyFiles = new Set(candidates.map((c) => c.file))
  const gapFiles = [...dirtyFiles].filter((f) => !confirmedFiles.has(f))
  if (gapFiles.length) {
    log(`gap sweep: re-hunting ${gapFiles.length} files with no confirmed finding`)
    const gap = await agent(gapSweepPrompt(gapFiles), { label: 'scan:gap-sweep', phase: 'Scan', agentType: 'code-review', schema: findingsSchema(6), ...optsModel })
    const gapCands = ((gap && gap.findings) || []).map((f) => ({ ...f, angle: 'gap' }))
    const fresh = gapCands.filter((f) => !seen.has(`${f.file}:${f.line}:${f.angle}`))
    if (fresh.length) {
      fresh.sort((a, b) => rank[a.severity] - rank[b.severity])
      const idx0 = verified.length
      fresh.forEach((c, i) => { c.idx = idx0 + i })
      const vr = await agent(verifierPrompt(fresh), { label: 'verify:gap-sweep', phase: 'Verify', agentType: 'code-review', schema: verdictsSchema(fresh.length), ...optsModel })
      const byIdx2 = new Map(((vr && vr.verdicts) || []).map((v) => [v.idx, v]))
      const gapVerified = fresh.map((c) => {
        const v = byIdx2.get(c.idx) || { state: 'refuted', evidence: '', note: 'no verdict returned' }
        return { ...c, ...v }
      })
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
const bySeverity = (a, b) => rank[a.severity] - rank[b.severity] || `${a.file}:${a.line}`.localeCompare(`${b.file}:${b.line}`)
const findings = verified.filter((v) => v.state === 'confirmed' || v.state === 'direct').sort(bySeverity).slice(0, conf.reportCap)
const plausible = verified.filter((v) => v.state === 'plausible').sort(bySeverity).splice(0, 8)

// CC minimal-mode restatement: one line per finding so the list survives
// sessions that do not render (or truncate) the full payload.
for (const f of findings) log(`✓ [${f.severity}] ${f.file}:${f.line} — ${f.short_summary}`)
for (const p of plausible) log(`? [${p.severity}] ${p.file}:${p.line} — ${p.short_summary}`)
log(`report: ${findings.length} confirmed findings (+ ${plausible.length} plausible kept aside)`)

const pick = (f) =>
  compact
    ? { file: f.file, line: f.line, severity: f.severity, category: f.category, state: f.state, short_summary: f.short_summary }
    : { file: f.file, line: f.line, severity: f.severity, category: f.category, short_summary: f.short_summary, claim: f.claim, scenario: f.scenario, state: f.state, evidence: f.evidence, note: f.note }

return {
  target: targetText,
  effort,
  model: model || 'inherit',
  angles: finderKeys.length,
  candidates: candidates.length,
  stats,
  confirmed: findings.length,
  reportCap: conf.reportCap,
  findings: findings.map(pick),
  plausible: plausible.map(pick),
}
