---
description: 多档深度代码评审（workflow，low/medium/high/max）— 多角度扫描 + 独立验证；可带参数指定目标/档位/模型
argument-hint: "[target: uncommitted | <commit> | <range> | <path>]"
---

用 code-review workflow 做一次多 agent 深度代码评审（风格对齐 Claude Code /code-review：finder 多角度扫描 + verifier 逐条独立反驳式验证，只报能给出具体出错场景的真 bug，不报风格/性能/缺测试类噪音）。

直接调用 SubagentWorkflow 工具：

- `name: "code-review"`
- `args`: 把"评审目标"填进 `args.target`。评审目标：${@:-当前未提交改动}
- `args.effort`（可选）：若用户要求快速/低档用 `low`，默认 `medium`，要求仔细/深度用 `high` 或 `max`
- `args.model`（可选）：仅当用户在请求中点名要用某个模型时才填（如"用 luna 跑"、"用 claude 评"）。取值用**当前环境实际可用的模型**：id 或模糊名皆可（workflow 对模型是透传，不维护白名单）。若用户点名的模型你无法确认存在，先用 read 工具读 `~/.pi/agent/models.json`（含各 provider 的模型 id）核对，不要凭空猜测或硬编；确实查不到就省略 args.model。省略则全部子代理继承当前会话模型。
- `args.repo`: 仅当当前会话工作目录不在目标仓库内、或目标文本里包含仓库路径时才填（绝对路径）；通常省略。

目标语义（原样作为 args.target 传给 workflow）：不带参数 = 只看未提交改动（`git diff HEAD`，staged + unstaged）；指定 commit / 区间 / 文件路径（如 a1b2c3d、main...HEAD、src/db.py）则评审对应目标。effort 档位：low = 单遍无验证 ≤4 条（快）；medium = 3 角度 + 验证 ≤8；high = 5 角度 + 验证 ≤10；max = 5 角度 + 验证 + gap sweep ≤15（慢但召回最高，适合大改动）。模型：未点名则全部子代理继承会话模型；点名后（args.model）所有 finder/verifier 统一用该模型；可用模型随 models.json 变化，以现场查询为准，模板不维护清单。

工作流会在后台运行，完成后把结构化结果（findings 数组，含 candidates/confirmed 统计）返回本会话。拿到后整理成最终报告用中文转述：按严重度排序，每条带 file:line 与出错场景；confirmed 为 0 时如实说明"没有发现达标问题"，不要凑数。评审全程只读。
