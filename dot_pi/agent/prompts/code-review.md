---
description: 多档深度代码评审（workflow，low/medium/high/xhigh/max）— 多角度扫描 + 独立验证；可带参数指定目标/档位/模型
argument-hint: "[target: uncommitted | <commit> | <range> | <path>] [low|medium|high|xhigh|max] [model]"
---

用 code-review workflow 做一次多 agent 深度代码评审（风格对齐 Claude Code /code-review：finder 多角度扫描 + verifier 逐条独立反驳式验证，只报能给出具体出错场景的真 bug，不报风格/性能/缺测试类噪音）。

直接调用 SubagentWorkflow 工具，`name: "code-review"`。**若当前会话没有 SubagentWorkflow 工具**（该项目未启用 workflows——全局默认关闭，这是正常情况而非故障），不要排查原因、不要读源码——直接回退：用 Agent 工具 spawn `code-review` agent（单遍 CC 式评审，无多角度+验证），并把目标/档位语义传给它；如果用户要的是深度多 agent 评审，提示在项目里建 `.pi/subagents.json` 写 `{"workflowsEnabled": true}` 后重启会话。先解析，再调用——用户的话可能同时含目标/档位/模型，也可能只有一个：

1. 目标 → `args.target`：commit / 区间 / 路径 / "未提交改动"等
2. 档位 → `args.effort`：出现 **low / medium / high / xhigh / max**（或"快速/仔细/深度/最深"）时填
3. 模型 → `args.model`：出现模型名（sol/terra/luna/astra/grok/deepseek/claude/fable/glm/qwen 或"用X""X跑"）时填；拿不准存在性就 read `~/.pi/agent/models.json` 核对，不要硬编

⚠ 硬性规则：
- 绝不能把这些词整句塞进 `args.target`（如 "/code-review 用 sol 评审" 的 target 只能是"评审"或"未提交"，模型词必须拆进 args.model）
- 调用前自查：args.target 不应含 effort/模型词；每个字段归属正确
- 纯对话触发（非斜杠）时同样解析，规则一致

默认评审目标：${@:-当前未提交改动}（没输参数时即评审未提交改动）。

## 目标语义
不带参数 = 只看未提交改动（`git diff HEAD`，staged + unstaged）；指定 commit / 区间 / 文件路径（如 a1b2c3d、main...HEAD、src/db.py）则评审对应目标。

## 档位
| effort | 角度数（上限） | 验证 | gap sweep | 报告上限 |
|---|---|---|---|---|
| `low` | 1（单遍，无验证） | — | — | 4 |
| `medium` | ≤4 | 三态（普通校准） | — | 8 |
| `high` | ≤6 | 三态（召回偏置） | — | 10 |
| `xhigh` | ≤8 | 三态（召回偏置） | 有 | 15 |
| `max` | ≤8（与 xhigh 同形） | 三态（召回偏置） | 有 | 15 |

`xhigh` 与 `max` 结构完全相同，只差 verifier 的推理档（xhigh vs max）。

**实际角度数会按 diff 规模自动收敛**：workflow 先跑一个廉价 preflight 拿 `--numstat`，排除 lock/生成/vendor 文件后，按 ⌈可评审行数 / 200⌉ 决定跑几个角度，并按 effort 设下限（medium 3 / high 4 / xhigh·max 4）。小改动不会白烧 8 个 agent；`noScale: true` 可强制跑满。

**成本控制（默认已启用）**：未点名模型时，finder + preflight 默认跑便宜快速模型（gpt-5.6-luna），**verifier 始终继承会话强模型**（验证是质量决策点）。想全部继承会话模型传 `args.model: "inherit"`。finder 带硬性阅读预算（`-U10` 内联上下文、±40 行窗口、≤10 次开文件），防止 context 无限膨胀。

## 可选参数（按需，通常都省略）
- `args.repo`：仅当当前会话工作目录不在目标仓库内、或目标文本里包含仓库路径时才填（绝对路径）
- `args.model`：指定 finder 模型；**不填时默认 gpt-5.6-luna（便宜），不会继承会话模型**，传 `"inherit"` 才继承；`args.verifyModel` 只改 verifier + gap sweep（默认继承会话模型）；`args.scopeModel` 只改 preflight（默认随 finder 的便宜模型；显式 `args.model` 不会传给 preflight——claude-opus/fable 这类只有 xhigh/max 档的模型会把“最低档”抬成 xhigh，让一次 numstat 变得很贵）
- `args.finderEffort` / `args.verifyEffort`：单独覆盖两阶段推理档（`off|minimal|low|medium|high|xhigh|max|inherit`）
- `args.compact`：精简返回载荷（去掉 verifier 的 evidence，保留 scenario）
- `args.noScale`：关闭按 diff 规模收敛角度数
- `args.linesPerAngle`（默认 200）、`args.verifyChunk`（默认 25）、`args.maxGapFiles`（默认 12）、`args.plausibleCap`（默认 8）

可用模型随 models.json 变化，以现场查询为准，模板不维护清单。未点名模型时全部子代理继承会话模型。

## 拿到结果后
工作流在后台运行，完成后返回结构化结果。用中文出报告，**直接按 payload 渲染，不要逐条扩写**：

- `findings`（已确认）按严重度排成表格：`file:line` / 严重度 / 一句话结论（`short_summary`）/ 出错场景（`scenario`）。有 `evidence` 时附在场景后。
- `plausible`（机理成立但触发条件未坐实）单独一小节，每条一行，注明"需要进一步确认"。
- `confirmed` 为 0 时如实说明"没有发现达标问题"，**不要凑数**。
- 必须如实披露以下削弱结论的情况（有才说）：
  - `failedAngles` 非空 → 这些角度本次**零覆盖**（agent 失败/超限），不等于这些方向没问题
  - `confirmedTotal > confirmed` → 有确认的问题因报告上限被截断，建议提高档位或缩小目标范围
  - `excludedFiles` 非空 → 这些生成/锁文件被有意跳过
  - `empty: true` → 按 `reason` 说明为什么无可评审内容

评审全程只读，workflow 不会修改任何文件。
