---
tags: [ codex, skills ]
publish: true
---


# Skills 使用方法

## Skill 是什么

Skill 是针对某类任务的可复用流程包，可以包含 `SKILL.md` 指令、脚本、参考资料和模板资源。它解决的是“每次都要按同一套专业步骤做”的问题。

官方说明： [Skills & Plugins](https://learn.chatgpt.com/docs/skills-and-plugins)、[Build skills](https://learn.chatgpt.com/docs/build-skills)。

## 两种触发方式

### 显式触发

在 Codex 中使用 `$skill-name`，适合你明确知道要用哪个流程时。

```text
$presentations 请把这些材料整理成 12 页路演 PPT，并完成渲染验收。
```

### 隐式触发

直接描述任务。当请求与 Skill 的 `description` 匹配时，Codex 会自动选择。为了避免选错，任务里应写明文件类型、目标动作和成品要求。

## 怎样使用一个 Skill

1. 说明任务与输入材料。
2. 指定必须保留和禁止项。
3. 说明输出位置和验收标准。
4. 若需要特定 Skill，显式 `$` 提及。
5. 让 Codex 先读取 Skill 的完整规则，再执行。

## 何时做成 Skill

满足三项中的两项即可考虑：

- 同类任务已经重复至少三次；
- 成功依赖固定步骤、模板或检查工具；
- 结果经常因为漏步骤而不一致。

适合你的候选个人 Skills：

- Unity 场景修改与 Play Mode 验收；
- 大批量事实研究与证据入库；
- Expo 移动预览完整预检；
- 项目交接文档生成；
- Obsidian 项目复盘归档。

## 创建 Skill

在 Codex 中调用：

```text
$skill-creator 请把“Unity 修改后的编译、Play Mode、Console、场景验证、测试状态清理”做成一个个人 Skill。
```

一个最小 Skill 目录：

```text
my-skill/
├─ SKILL.md          # 必需：名称、描述、流程
├─ scripts/          # 可选：可复用自动检查
├─ references/       # 可选：规则与文档
└─ assets/           # 可选：模板与资源
```

## 使用原则

- 一个 Skill 聚焦一种工作，不做“万能 Skill”。
- `description` 要写清何时触发、何时不要触发。
- 流程规则与内容素材分开。
- 有成熟脚本就复用脚本，不让模型每次重写。
- 新 Skill 必须用真实任务试跑并复盘。
- 任务临时要求优先于一般偏好；若与 Skill 冲突，应在提示词里明确本次例外。

## Skill、AGENTS.md、Plugin 的区别

| 能力 | 适合什么 |
|---|---|
| Skill | 某类任务的专业流程 |
| `AGENTS.md` | 一个项目每次都要遵守的规则 |
| Plugin | 可安装分发的 Skill + Connector/MCP 能力包 |
| Prompt | 本次任务的一次性目标与约束 |
