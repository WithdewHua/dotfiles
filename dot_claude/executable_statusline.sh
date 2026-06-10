#!/usr/bin/env bash
# Claude Code 状态栏 —— Starship 视觉风格 + 会话状态 (单行)
# 左组(我在哪): 目录(蓝, fish 风格) · git 分支(灰) · 脏标记(青) · venv(灰)
# 右组(会话状态): 模型(紫) effort · 上下文条 pct% · token · 改动行数 · 成本 · 时长 · 速率限制
# stdin 收到 Claude Code 注入的 JSON 上下文

input=$(cat)

# --- 颜色 (对齐 starship.toml: directory=blue, git_branch=bright-black, git_status=cyan, character=purple) ---
BLUE=$'\033[34m'; GRAY=$'\033[90m'; CYAN=$'\033[36m'; PURPLE=$'\033[35m'
GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; RESET=$'\033[0m'

# --- 一次性提取 JSON 字段 (jq 优先, 回退 python3) ---
# 每字段一行 → mapfile 读入数组 F。字段值不含换行, 且 mapfile 按行读会保留空字段,
# 不像 `IFS=$'\t' read` 会把连续 tab(空字段) 合并导致后续字段错位。
if command -v jq >/dev/null 2>&1; then
  mapfile -t F < <(printf '%s' "$input" | jq -r '[
    .model.display_name // "",
    (.workspace.current_dir // .cwd // ""),
    (.session_id // ""),
    (.context_window.used_percentage // 0),
    (.context_window.total_input_tokens // 0),
    (.cost.total_cost_usd // 0),
    (.effort.level // ""),
    (.cost.total_lines_added // 0),
    (.cost.total_lines_removed // 0),
    (.cost.total_duration_ms // 0),
    (.rate_limits.five_hour.used_percentage // ""),
    (.rate_limits.seven_day.used_percentage // "")
  ] | map(tostring) | join("\n")')
else
  mapfile -t F < <(printf '%s' "$input" | python3 -c '
import sys, json
d = json.load(sys.stdin)
cw = d.get("context_window") or {}
c  = d.get("cost") or {}
w  = d.get("workspace") or {}
rl = d.get("rate_limits") or {}
def rlp(k):
    v = (rl.get(k) or {}).get("used_percentage")
    return "" if v is None else v
print("\n".join(str(x) for x in [
    (d.get("model") or {}).get("display_name") or "",
    w.get("current_dir") or d.get("cwd") or "",
    d.get("session_id") or "",
    cw.get("used_percentage") or 0,
    cw.get("total_input_tokens") or 0,
    c.get("total_cost_usd") or 0,
    (d.get("effort") or {}).get("level") or "",
    c.get("total_lines_added") or 0,
    c.get("total_lines_removed") or 0,
    c.get("total_duration_ms") or 0,
    rlp("five_hour"),
    rlp("seven_day"),
]))')
fi
model="${F[0]}"; cwd="${F[1]}"; session_id="${F[2]}"
pct="${F[3]}"; tok="${F[4]}"; cost="${F[5]}"; effort="${F[6]}"
added="${F[7]}"; removed="${F[8]}"; dur_ms="${F[9]}"
rl5="${F[10]}"; rl7="${F[11]}"

[ -z "$cwd" ] && cwd="$PWD"
pct=${pct%%.*};         [ -z "$pct" ] && pct=0          # 去小数 → 整数
tok=${tok%%.*};         [ -z "$tok" ] && tok=0
added=${added%%.*};     [ -z "$added" ] && added=0
removed=${removed%%.*}; [ -z "$removed" ] && removed=0
dur_ms=${dur_ms%%.*};   [ -z "$dur_ms" ] && dur_ms=0

# --- 目录: HOME→~, fish 风格把父级目录截成首字符 (starship fish_style_pwd_dir_length=1) ---
dir="$cwd"
case "$dir" in
  "$HOME") dir="~" ;;
  "$HOME"/*) dir="~/${dir#"$HOME"/}" ;;
esac
if [ "$dir" != "~" ] && [ "$dir" != "/" ]; then
  IFS='/' read -ra parts <<< "$dir"
  last_idx=$((${#parts[@]} - 1))
  out=""
  for i in "${!parts[@]}"; do
    p="${parts[$i]}"
    [ -z "$p" ] && continue
    if [ "$i" -eq "$last_idx" ]; then out="$out/$p"
    elif [ "$p" = "~" ]; then out="~"
    else out="$out/${p:0:1}"; fi
  done
  out="${out#/}"
  case "$dir" in /*) dir="/$out" ;; *) dir="$out" ;; esac
fi

# --- git 分支与脏状态 (按 session_id 缓存 5s, 避免大仓库每条消息都跑 git status) ---
branch=""; dirty=""
cache="/tmp/cc-statusline-git-${session_id:-nosess}"
stale=1
if [ -f "$cache" ]; then
  mt=$(stat -c %Y "$cache" 2>/dev/null || stat -f %m "$cache" 2>/dev/null || echo 0)
  [ $(( $(date +%s) - mt )) -le 5 ] && stale=0
fi
if [ "$stale" -eq 1 ]; then
  if git -C "$cwd" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    b=$(git -C "$cwd" branch --show-current 2>/dev/null)
    [ -z "$b" ] && b=$(git -C "$cwd" rev-parse --short HEAD 2>/dev/null)
    d=""; [ -n "$(git -C "$cwd" status --porcelain 2>/dev/null)" ] && d="dirty"
    printf '%s\n%s\n' "$b" "$d" > "$cache"
  else
    printf '\n\n' > "$cache"
  fi
fi
mapfile -t G < "$cache" 2>/dev/null
branch="${G[0]}"; [ "${G[1]}" = "dirty" ] && dirty="●"

# --- python venv (starship $python 段) ---
venv=""; [ -n "$VIRTUAL_ENV" ] && venv=$(basename "$VIRTUAL_ENV")

# --- token 人类可读: 36234 → 36.2k, 1500000 → 1.5M ---
fmt_tok() {
  local n=$1
  if [ "$n" -ge 1000000 ]; then printf '%d.%dM' $((n/1000000)) $(((n%1000000)/100000))
  elif [ "$n" -ge 1000 ]; then printf '%d.%dk' $((n/1000)) $(((n%1000)/100))
  else printf '%d' "$n"; fi
}
tok_h=$(fmt_tok "$tok")

# --- 会话时长: 45000ms → 12m30s / 1h2m / 30s ---
fmt_dur() {
  local s=$(( $1/1000 ))
  if [ "$s" -ge 3600 ]; then printf '%dh%dm' $((s/3600)) $(((s%3600)/60))
  elif [ "$s" -ge 60 ]; then printf '%dm%ds' $((s/60)) $((s%60))
  else printf '%ds' "$s"; fi
}
dur_h=""; [ "$dur_ms" -gt 0 ] && dur_h=$(fmt_dur "$dur_ms")

# --- 阈值上色: <70 灰, 70-89 黄, ≥90 红 (用于速率限制) ---
thresh_color() {
  if   [ "$1" -ge 90 ]; then printf '%s' "$RED"
  elif [ "$1" -ge 70 ]; then printf '%s' "$YELLOW"
  else printf '%s' "$GRAY"; fi
}

# --- 上下文进度条(10 格) + 阈值色: <70 绿, 70-89 黄, ≥90 红 ---
if   [ "$pct" -ge 90 ]; then ctxcol="$RED"
elif [ "$pct" -ge 70 ]; then ctxcol="$YELLOW"
else ctxcol="$GREEN"; fi
filled=$((pct/10)); [ "$filled" -gt 10 ] && filled=10; empty=$((10-filled))
bar=""
[ "$filled" -gt 0 ] && { printf -v f "%${filled}s"; bar="${f// /▓}"; }
[ "$empty"  -gt 0 ] && { printf -v e "%${empty}s";  bar="${bar}${e// /░}"; }

# --- effort 推理强度: max/xhigh 红, high 黄, 其余灰 ---
ecol="$GRAY"
case "$effort" in max|xhigh) ecol="$RED" ;; high) ecol="$YELLOW" ;; esac

# --- 改动行数: +A/-R, 仅当有改动 ---
changes=""
if [ "$added" -gt 0 ] || [ "$removed" -gt 0 ]; then
  changes="${GREEN}+${added}${RESET}/${RED}-${removed}${RESET}"
fi

# --- 成本: 仅 >0 时显示 ---
cost_h=$(awk -v c="$cost" 'BEGIN{ if (c+0>0) printf "$%.2f", c }')

# --- 速率限制 5h/7d (仅 Pro/Max 订阅有此字段) ---
rl_seg=""
if [ -n "$rl5" ]; then p=${rl5%%.*}; [ -z "$p" ] && p=0; c=$(thresh_color "$p"); rl_seg="${GRAY}5h:${RESET}${c}${p}%${RESET}"; fi
if [ -n "$rl7" ]; then p=${rl7%%.*}; [ -z "$p" ] && p=0; c=$(thresh_color "$p"); s="${GRAY}7d:${RESET}${c}${p}%${RESET}"; [ -n "$rl_seg" ] && rl_seg="$rl_seg $s" || rl_seg="$s"; fi

# --- 组装: 左组(位置)   右组(会话状态, 各段用灰点 · 连接) ---
left="${BLUE}${dir}${RESET}"
[ -n "$branch" ] && left="$left ${GRAY}${branch}${RESET}"
[ -n "$dirty" ]  && left="$left ${CYAN}${dirty}${RESET}"
[ -n "$venv" ]   && left="$left ${GRAY}(${venv})${RESET}"

# 右组开头固定块: 模型 [effort] 进度条 百分比
right="${PURPLE}${model}${RESET}"
[ -n "$effort" ] && right="$right ${ecol}${effort}${RESET}"
right="$right ${ctxcol}${bar}${RESET} ${ctxcol}${pct}%${RESET}"

# 右组可选块: token(必有) · 改动 · 成本 · 时长 · 速率限制
extra=("${GRAY}${tok_h}${RESET}")
[ -n "$changes" ] && extra+=("$changes")
[ -n "$cost_h" ]  && extra+=("${YELLOW}${cost_h}${RESET}")
[ -n "$dur_h" ]   && extra+=("${GRAY}${dur_h}${RESET}")
[ -n "$rl_seg" ]  && extra+=("$rl_seg")
sep=" ${GRAY}·${RESET} "
joined="${extra[0]}"
for ((i=1; i<${#extra[@]}; i++)); do joined="$joined$sep${extra[i]}"; done
right="$right$sep$joined"

printf '%s   %s' "$left" "$right"
