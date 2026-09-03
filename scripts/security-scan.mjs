#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { parseDocument } from "yaml"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDir, "..")
const contentRoot = path.join(projectRoot, "content")
const reportPath = path.join(projectRoot, ".security-report.json")

const skippedDirectories = new Set([".git", "node_modules", ".quartz", ".quartz-cache", "public"])
const allowedContentExtensions = new Set([
  ".md",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".svg",
  ".pdf",
  ".mp3",
  ".mp4",
  ".zip",
  ".json",
  ".csv",
])
const textExtensions = new Set([
  ".md",
  ".txt",
  ".json",
  ".yaml",
  ".yml",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
  ".scss",
  ".html",
  ".xml",
  ".csv",
  ".toml",
  ".ps1",
])

const exactSensitiveNames = new Set([
  ".env",
  "id_rsa",
  "id_ed25519",
  "credentials",
  "credentials.json",
  "cookies",
  "cookies.txt",
])
const sensitiveExtensions = new Set([".pem", ".key", ".p12", ".pfx", ".kdbx"])

const fixedSecretPatterns = [
  ["GitHub Token", /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ["GitHub fine-grained Token", /\bgithub_pat_[A-Za-z0-9_]{40,}\b/],
  ["OpenAI API Key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
  ["AWS Access Key", /\bAKIA[0-9A-Z]{16}\b/],
  ["Private Key", /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/],
  ["Bearer Token", /\bAuthorization\s*:\s*Bearer\s+[A-Za-z0-9._~+/=-]{16,}/i],
  [
    "Credential URL",
    /\b(?:https?|postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s/:]+:[^\s/@]+@/i,
  ],
  ["Cookie Header", /\b(?:Cookie|Set-Cookie)\s*:\s*[^\r\n]{16,}/i],
]

const assignmentPattern =
  /\b(api[_-]?key|access[_-]?token|auth[_-]?token|refresh[_-]?token|password|passwd|client[_-]?secret|secret)\b\s*[:=]\s*["']?([^\s"'`,;]{8,})/gi
const placeholderPattern =
  /(?:example|placeholder|your[-_]|dummy|sample|mysecretpassword|changeme|replace[-_]|xxxx|\*\*\*|<|\{|\$\{|待填写|待补充|未配置)/i
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
const localUserPathPattern = /\b[A-Z]:\\Users\\[^\\\s]+/i

function normalizeRelative(value) {
  return value.split(path.sep).join("/")
}

async function walkFiles(root, current = root, files = []) {
  const entries = await fs.readdir(current, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) continue
    const absolute = path.join(current, entry.name)
    const relative = normalizeRelative(path.relative(root, absolute))
    if (entry.isSymbolicLink()) {
      files.push({ absolute, relative, symbolicLink: true })
    } else if (entry.isDirectory()) {
      await walkFiles(root, absolute, files)
    } else if (entry.isFile()) {
      files.push({ absolute, relative, symbolicLink: false })
    }
  }
  return files
}

function frontmatterPublishes(text) {
  const match = text.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!match) return false
  const document = parseDocument(match[1], { logLevel: "silent" })
  if (document.errors.length > 0) return false
  return document.toJS()?.publish === true
}

function manuallyIgnored(relative) {
  const normalized = relative.replaceAll("\\", "/")
  const basename = path.basename(normalized).toLocaleLowerCase("en-US")
  const extension = path.extname(basename)
  const segments = normalized.split("/")
  if (
    segments.some((segment) =>
      [".git", "node_modules", "public", ".quartz", ".quartz-cache", ".publish-staging"].includes(
        segment,
      ),
    )
  ) {
    return true
  }
  if (
    [
      ".ds_store",
      "tsconfig.tsbuildinfo",
      ".publish.local.json",
      ".publish-report.json",
      ".security-report.json",
    ].includes(basename)
  ) {
    return true
  }
  if (basename === ".env" || (basename.startsWith(".env.") && basename !== ".env.example")) {
    return true
  }
  if (
    [".log", ".tmp", ".temp", ".bak", ".pem", ".key", ".p12", ".pfx", ".kdbx"].includes(extension)
  ) {
    return true
  }
  return basename.startsWith("credentials") || basename.startsWith("cookies")
}

function isGitCandidate(relative) {
  if (!gitRepositoryPresent) return !manuallyIgnored(relative)
  try {
    execFileSync("git", ["check-ignore", "-q", "--", relative], {
      cwd: projectRoot,
      stdio: "ignore",
    })
    return false
  } catch (error) {
    return error?.status === 1
  }
}

let gitRepositoryPresent = false

async function main() {
  gitRepositoryPresent = await fs
    .access(path.join(projectRoot, ".git"))
    .then(() => true)
    .catch(() => false)
  const issues = []
  const allFiles = await walkFiles(projectRoot)
  const candidateFiles = allFiles.filter(
    (file) =>
      file.relative !== "scripts/security-scan.mjs" &&
      file.relative !== ".security-report.json" &&
      file.relative !== ".publish-report.json" &&
      file.relative !== ".publish.local.json" &&
      isGitCandidate(file.relative),
  )

  for (const file of candidateFiles) {
    const basename = path.basename(file.relative).toLocaleLowerCase("en-US")
    const extension = path.extname(basename)
    if (
      exactSensitiveNames.has(basename) ||
      basename.startsWith(".env.") ||
      sensitiveExtensions.has(extension)
    ) {
      issues.push({ file: file.relative, reason: "敏感文件名或密钥文件类型" })
    }
    if (file.symbolicLink) {
      issues.push({ file: file.relative, reason: "Git 候选中存在符号链接/重解析点" })
      continue
    }

    const stat = await fs.stat(file.absolute)
    if (!textExtensions.has(extension) || stat.size > 5 * 1024 * 1024) continue
    const text = await fs.readFile(file.absolute, "utf8")
    for (const [label, pattern] of fixedSecretPatterns) {
      if (pattern.test(text)) issues.push({ file: file.relative, reason: `疑似 ${label}` })
    }
    assignmentPattern.lastIndex = 0
    for (const match of text.matchAll(assignmentPattern)) {
      const value = match[2]
      if (!placeholderPattern.test(value)) {
        issues.push({ file: file.relative, reason: `疑似敏感赋值：${match[1]}` })
      }
    }
  }

  const contentFiles = (await walkFiles(contentRoot)).filter((file) => file.relative !== "")
  for (const file of contentFiles) {
    const segments = file.relative.split("/")
    const extension = path.extname(file.relative).toLocaleLowerCase("en-US")
    if (segments.some((segment) => segment.startsWith("."))) {
      issues.push({
        file: `content/${file.relative}`,
        reason: "公开 content 中存在隐藏文件或隐藏目录",
      })
    }
    if (!allowedContentExtensions.has(extension)) {
      issues.push({ file: `content/${file.relative}`, reason: "公开 content 中存在未授权文件类型" })
    }
    if (file.symbolicLink) {
      issues.push({
        file: `content/${file.relative}`,
        reason: "公开 content 中存在符号链接/重解析点",
      })
      continue
    }

    const stat = await fs.stat(file.absolute)
    const shouldRead = extension === ".md" || extension === ".json" || extension === ".csv"
    if (!shouldRead || stat.size > 5 * 1024 * 1024) continue
    const text = await fs.readFile(file.absolute, "utf8")
    if (extension === ".md" && !frontmatterPublishes(text)) {
      issues.push({
        file: `content/${file.relative}`,
        reason: "Markdown 不含严格布尔值 publish: true",
      })
    }
    if (emailPattern.test(text)) {
      issues.push({ file: `content/${file.relative}`, reason: "公开内容含邮箱地址，需人工确认" })
    }
    if (localUserPathPattern.test(text)) {
      issues.push({ file: `content/${file.relative}`, reason: "公开内容含本机用户目录" })
    }
  }

  const forbiddenCandidates = [
    ".publish.local.json",
    ".publish-report.json",
    ".security-report.json",
  ]
  for (const relative of forbiddenCandidates) {
    if (isGitCandidate(relative)) {
      issues.push({ file: relative, reason: "本地发布配置/报告未被 .gitignore 排除" })
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    checkedGitCandidateFiles: candidateFiles.length,
    checkedPublicFiles: contentFiles.length,
    issueCount: issues.length,
    issues,
  }
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8")

  if (issues.length > 0) {
    console.error(`隐私扫描失败：发现 ${issues.length} 个问题。`)
    for (const issue of issues) console.error(`- ${issue.file}: ${issue.reason}`)
    process.exitCode = 1
    return
  }

  console.log(
    `隐私扫描通过：Git 候选 ${candidateFiles.length} 个，公开文件 ${contentFiles.length} 个。`,
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
