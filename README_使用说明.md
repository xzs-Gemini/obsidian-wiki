# Obsidian Wiki 发布使用说明

本项目是原 Obsidian Vault 的独立发布版本。同步方向始终是：

```text
Obsidian Vault → Quartz content → GitHub → GitHub Pages
```

脚本只读取原 Vault，不会反向写入、移动或删除原笔记。

## 如何发布一篇 Obsidian 笔记

在笔记最顶部加入 YAML Frontmatter：

```yaml
---
title: 页面标题
publish: true
---
```

只有 YAML 中真正的布尔值 `publish: true` 才会公开。正文中出现这段文字、`publish: false`、缺少 `publish` 或写成字符串 `publish: "true"` 都不会公开。

## 如何取消发布

把 Frontmatter 改为：

```yaml
---
publish: false
---
```

也可以删除 `publish: true`。下一次同步会从 Quartz 的 `content/` 中清除旧页面和不再被公开笔记引用的附件。

## 如何更新 Wiki

在 PowerShell 中进入本项目后运行：

```powershell
.\publish-wiki.ps1
```

该脚本会同步白名单内容、执行隐私扫描、构建 Quartz、提交并 Push。没有 Git 仓库、远程仓库或上游分支时会安全停止，不会猜测账号信息。

仅同步并本地验证、不提交或 Push：

```powershell
.\publish-wiki.ps1 -NoGit
```

## 如何只同步

```powershell
.\sync-obsidian-to-quartz.ps1
```

原 Vault 路径保存在不会提交的 `.publish.local.json`。换电脑时复制 `.publish.local.example.json` 为 `.publish.local.json`，再填写本机 Vault 绝对路径。

## 如何本地预览

先同步和安全检查：

```powershell
.\sync-obsidian-to-quartz.ps1
node .\scripts\security-scan.mjs
```

然后启动：

```powershell
npx quartz build --serve
```

默认访问：`http://localhost:8080`

## 附件规则

仅复制已公开 Markdown 实际引用的附件，并保留原目录结构。允许的类型为 PNG、JPG、JPEG、WEBP、GIF、SVG、PDF、MP3、MP4、ZIP、JSON、CSV。引用歧义、路径越界或不支持的本地文件类型会使同步失败。

## Wiki 链接

项目使用 Quartz 的 Obsidian 模板和 shortest 链接解析策略，支持 Wiki Links、标题链接、图片嵌入、标签、代码块、Callout 和 Frontmatter。链接指向未公开笔记时，目标不会被复制，公开页面中会保留为不可用链接或在同步报告中给出提示。

## 网站地址

计划地址：<https://xzs-gemini.github.io/obsidian-wiki/>。首次 GitHub Pages 部署成功后即可访问。

## GitHub Repository

计划仓库：<https://github.com/xzs-Gemini/obsidian-wiki>。仓库创建并推送后生效。

## 隐私保护

- 不提交 `.publish.local.json`、`.env`、日志、缓存、密钥或凭据文件。
- Push 前扫描公开内容和 Git 候选文件。
- 命中疑似 Token、API Key、密码、私钥、Cookie、账号邮箱或本机用户路径时停止。
- Quartz 的 `ExplicitPublish` 是第二道过滤；第一道过滤发生在内容复制之前。
