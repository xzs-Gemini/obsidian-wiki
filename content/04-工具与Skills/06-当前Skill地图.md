---
tags: [ codex, skills, inventory ]
publish: true
---


# 当前 Skill 地图

> 这是按当前 Codex 环境整理的能力地图。安装状态可能变化；使用前以任务中实际显示的 Skills 列表为准。

## 办公文件

- `documents`：创建、编辑、红线与渲染验收 DOCX。
- `presentations`：制作与编辑 PPTX/Slides，含渲染检查。
- `pdf`：读取、生成、渲染和验证 PDF。
- `spreadsheets`：创建与分析 XLSX/CSV/TSV。
- `excel-live-control`：控制已打开的 Excel 会话；不要与离线表格生成混用。
- `template-creator`：把参考成品转成可复用个人模板 Skill。

## 视觉与产品设计

- `imagegen`：生成或编辑位图。
- `creative-production:produce`：广告、品牌、社媒、视觉方案等创意生产。
- `product-design:audit`：基于截图审计产品流程。
- `product-design:ideate`：生成产品设计方向图。
- `product-design:image-to-code` / `url-to-code`：把视觉参考或网页实现为前端。
- `design-taste-frontend`、`redesign-existing-projects`、`minimalist-ui` 等：不同风格或改造型前端工作流。
- `brandkit`：品牌识别与品牌板。

## Figma

- `figma-use`：执行 Figma 文件内的读写操作；调用写入前必须先加载。
- `figma-generate-design`：从描述/代码创建页面、面板或多区块界面。
- `figma-generate-library`：设计变量、Token、组件与变体系统。
- `figma-design-to-code`：Figma 设计转代码的前置流程。
- `figma-generate-diagram`：在 FigJam 生成流程图、架构图、时序图等。
- SwiftUI、Motion、Slides、FigJam 另有专用 Skills。

## 网页与界面操作

- `browser:control-in-app-browser`：控制内置浏览器，适合网页和本地 Web 测试。
- `computer-use:computer-use`：控制 Windows 桌面应用。
- `sites:sites-building` / `sites-hosting`：构建与托管 Sites 项目。
- `visualize`：在对话中创建交互式图表、模拟或可视化。

## Codex 扩展与研究

- `openai-docs`：回答 Codex/OpenAI 产品与 API 的当前官方问题。
- `skill-creator`：创建/更新 Skill。
- `skill-installer`：从精选列表或 GitHub 安装 Skill。
- `plugin-creator`：创建 Codex Plugin。
- `plugin-management`：发现、检查和管理插件。
- `deep-research`：仅在明确请求“Deep research”时使用。
- `full-output-enforcement`：需要完整、无省略输出时使用。

## 其他专用能力

- `agently-mail`：邮件读取与发送，写操作需要两阶段确认。
- 各类风格型前端 Skill：按设计目标选择，不要同时叠加太多互相冲突的风格规则。

## 调用示例

```text
$documents 请基于这些材料更新 DOCX，保留原模板，渲染检查后另存。

$presentations 请制作 10 页汇报 PPT，先搭叙事，再做视觉，并检查溢出。

$imagegen 请生成一张透明背景的 2D 游戏道具图，不要文字。

$skill-creator 请把我的 Expo 发布前检查流程做成个人 Skill。
```

## 组合原则

一次任务使用覆盖目标所需的最小 Skill 集合。Skills 越多不一定越好；冲突的视觉规范、重复的验收流程和过长的上下文会降低稳定性。
