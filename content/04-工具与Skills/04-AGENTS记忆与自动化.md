---
tags: [ codex, AGENTS, memory, automation ]
publish: true
---


# AGENTS、记忆与自动化

## AGENTS.md：项目的长期工作协议

Codex 会在开始工作前读取适用的 `AGENTS.md`。全局规则适合个人通用偏好，项目根目录适合仓库约定，子目录文件适合更具体的局部规则。越接近当前工作目录的规则越具体。

官方说明： [Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)。

推荐内容：

```markdown
# 项目工作约定

- 修改前先运行：`npm run check`
- 不修改：生成数据源与历史迁移
- 编辑 TypeScript 后运行：`npm run typecheck`
- UI 变更必须在移动与桌面视口验证
- 交付时列出未验证项
```

不要把一次性任务、密码、Token、完整客户数据放进 `AGENTS.md`。

## Memory：跨任务的上下文

适合记录稳定偏好、长期项目断点和已确认事实。Memory 不是最新外部事实来源；遇到版本、价格、法律、当前账号状态等内容仍需重新核验。

你的记忆记录适合采用：

```text
时间 | 任务 | 状态 | 进展 | 下一步 | 邮件状态
```

## Automation：定时与重复执行

适合：定期检查、提醒、监控、等待外部状态变化。监控在状态不变时应保持安静，只在完成、失败、需要用户操作或发生重要变化时通知。

## 选择关系

| 需求 | 放在哪里 |
|---|---|
| 本次任务的范围 | Prompt |
| 项目长期规则 | 项目 `AGENTS.md` |
| 个人跨项目偏好 | 全局指导/Memory |
| 可重复专业流程 | Skill |
| 周期性执行 | Automation |

## 注意

- 站立偏好不等于对某次高风险动作的确认。
- 自动化不会扩大原任务授权。
- 长期记录要避免秘密信息，并定期清理过期事实。
