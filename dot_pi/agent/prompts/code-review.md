---
description: 多档深度代码评审（workflow，low/medium/high/max）— 多角度扫描 + 独立验证；可带参数指定目标/档位/模型
argument-hint: "[target: uncommitted | <commit> | <range> | <path>]"
---

用 code-review workflow 做一次多 agent 深度代码评审（风格对齐 Claude Code /code-review：finder 多角度扫描 + verifier 逐条独立反驳式验证，只报能给出具体出错场景的真 bug，不报风格/性能/缺测试类噪音）。

直接调用 SubagentWorkflow 工具。**先解析，再调用**——用户的话可能同时含目标/档位/模型，也可能只有一个：

1. 目标 → `args.target`：commit / 区间 / 路径 / "未提交改动"等
2. 档位 → `args.effort`：出现 low/medium/high/max（或"快速/仔细/深度"）时填
3. 模型 → `args.model`：出现模型名（sol/terra/luna/grok/deepseek/claude/glm 或"用X""X跑"）时填；拿不准存在性就 read `~/.pi/agent/models.json` 核对，不要硬编

⚠ 硬性规则：
- 绝不能把这些词整句塞进 `args.target`（如 "/code-review 用 sol 评审" 的 target 只能是"评审"或"未提交"，模型词必须拆进 args.model）
- 调用前自查：args.target 不应含 effort/模型词；每个字段归属正确
- 纯对话触发（非斜杠）时同样解析，规则一致

- `args.repo`: 仅当当前会话工作目录不在目标仓库内、或目标文本里包含仓库路径时才填（绝对路径）；通常省略。
- `name: "code-review"`

默认评审目标：${@:-当前未提交改动}（没输参数时即评审未提交改动）。

目标语义：不带参数 = 只看未提交改动（`git diff HEAD`，staged + unstaged）；指定 commit / 区间 / 文件路径（如 a1b2c3d、main...HEAD、src/db.py）则评审对应目标。effort 档位：low = 单遍无验证 ≤4 条（快）；medium = 3 角度 + 验证 ≤8；high = 5 角度 + 验证 ≤10；max = 5 角度 + 验证 + gap sweep ≤15（慢但召回最高，适合大改动）。模型：未点名则全部子代理继承会话模型；点名后（args.model）所有 finder/verifier 统一用该模型；可用模型随 models.json 变化，以现场查询为准，模板不维护清单。

工作流会在后台运行，完成后把结构化结果（findings 数组，含 candidates/confirmed 统计）返回本会话。拿到后整理成最终报告用中文转述：按严重度排序，每条带 file:line 与出错场景；confirmed 为 0 时如实说明"没有发现达标问题"，不要凑数。评审全程只读。
