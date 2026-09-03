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

默认情况下，只有 YAML 中真正的布尔值 `publish: true` 才会公开。正文中出现这段文字、`publish: false`、缺少 `publish` 或写成字符串 `publish: "true"` 都不会公开。

当前用户已明确授权发布创建清单时存在的全部教学笔记。这些精确路径记录在 `publish-selection.json`，同步时只在 Quartz 副本中注入 `publish: true`，不会改写原 Vault。以后新建的笔记不会自动加入清单，仍须使用上述 Frontmatter 才会公开。

## 如何取消发布

把 Frontmatter 改为：

```yaml
---
publish: false
---
```

也可以删除 `publish: true`。下一次同步会从 Quartz 的 `content/` 中清除旧页面和不再被公开笔记引用的附件。

对于已经列入 `publish-selection.json` 的全量教学笔记，原笔记中明确写入布尔值 `publish: false` 会优先取消发布；也可以从清单中删除对应相对路径。字符串 `"false"` 不作为取消标记。

## 如何更新 Wiki

在 PowerShell 中进入本项目后运行：

```powershell
.\publish-wiki.ps1
```

该脚本会同步白名单内容、执行隐私扫描、构建 Quartz、提交并 Push。没有 Git 仓库、远程仓库或上游分支时会安全停止，不会猜测账号信息。

如果 Windows 已启用系统网络代理，脚本会在本次运行中自动读取并临时传给 Git/npm；代理地址和登录凭据不会写入仓库。

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

<https://xzs-gemini.github.io/obsidian-wiki/>

## GitHub Repository

<https://github.com/xzs-Gemini/obsidian-wiki>

## 隐私保护

- 不提交 `.publish.local.json`、`.env`、日志、缓存、密钥或凭据文件。
- Push 前扫描公开内容和 Git 候选文件。
- 命中疑似 Token、API Key、密码、私钥、Cookie、账号邮箱或本机用户路径时停止。
- Quartz 的 `ExplicitPublish` 是第二道过滤；第一道过滤发生在内容复制之前。
