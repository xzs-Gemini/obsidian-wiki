#!/usr/bin/env node

import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { parseDocument } from "yaml"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDir, "..")
const localConfigPath = path.join(projectRoot, ".publish.local.json")
const selectionPath = path.join(projectRoot, "publish-selection.json")
const contentRoot = path.join(projectRoot, "content")
const stagingRoot = path.join(projectRoot, ".publish-staging")
const homeTemplate = path.join(projectRoot, "site-home", "index.md")
const reportPath = path.join(projectRoot, ".publish-report.json")

const allowedAttachmentExtensions = new Set([
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

const blockedDirectoryNames = new Set([".obsidian", ".git", ".claudian", ".trash"])

function normalizeRelative(value) {
  return value.split(path.sep).join("/").replace(/^\.\//, "")
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate)
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

async function walkFiles(root, current = root, files = []) {
  const entries = await fs.readdir(current, { withFileTypes: true })
  for (const entry of entries) {
    if (blockedDirectoryNames.has(entry.name)) continue
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

function readFrontmatter(text, relativePath) {
  const match = text.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!match) return null
  if (!/^publish\s*:/m.test(match[1])) return null
  const document = parseDocument(match[1], { logLevel: "silent" })
  if (document.errors.length > 0) {
    throw new Error(
      `Frontmatter YAML 无法解析：${relativePath}\n${document.errors.map((error) => error.message).join("\n")}`,
    )
  }
  return document.toJS() ?? {}
}

async function readPublicationSelection(enabled) {
  if (!enabled) return new Set()
  const raw = await fs.readFile(selectionPath, "utf8").catch((error) => {
    if (error?.code === "ENOENT") return null
    throw error
  })
  if (raw === null) return new Set()

  const selection = JSON.parse(raw)
  if (!Array.isArray(selection.paths)) {
    throw new Error("publish-selection.json 必须包含 paths 数组")
  }

  const paths = new Set()
  for (const value of selection.paths) {
    if (typeof value !== "string") throw new Error("发布清单路径必须是字符串")
    const normalized = value.replaceAll("\\", "/").replace(/^\.\//, "")
    if (
      normalized === "" ||
      normalized.startsWith("/") ||
      /^[a-z]:\//i.test(normalized) ||
      path.posix.normalize(normalized).startsWith("../") ||
      path.posix.extname(normalized).toLocaleLowerCase("en-US") !== ".md"
    ) {
      throw new Error(`发布清单包含不安全路径：${value}`)
    }
    paths.add(normalized.toLocaleLowerCase("en-US"))
  }
  return paths
}

function createPublishedCopy(text, relativePath) {
  const match = text.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  const fallbackTitle = JSON.stringify(path.basename(relativePath, ".md"))
  if (!match) {
    return `---\ntitle: ${fallbackTitle}\npublish: true\n---\n\n${text.replace(/^\uFEFF/, "")}`
  }

  const body = text.slice(match[0].length)
  if (/\{\{[^}]+\}\}/.test(match[1])) {
    return `---\ntitle: ${fallbackTitle}\npublish: true\n---\n\n${body}`
  }
  const document = parseDocument(match[1], { logLevel: "silent" })
  const parsed = document.errors.length > 0 ? null : document.toJS()
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return `---\ntitle: ${fallbackTitle}\npublish: true\n---\n\n${body}`
  }
  document.set("publish", true)
  return `---\n${document.toString().trimEnd()}\n---\n\n${body}`
}

function sanitizeReference(raw) {
  let value = raw.trim()
  if (value.startsWith("<") && value.endsWith(">")) value = value.slice(1, -1)
  value = value.replace(/\s+["'][^"']*["']\s*$/, "")
  value = value.split("|")[0].trim()
  value = value.split("#")[0].split("?")[0].trim()
  try {
    value = decodeURIComponent(value)
  } catch {
    // Keep the original literal path when percent decoding is invalid.
  }
  return value
}

function isExternalReference(value) {
  if (/^[a-z]:[\\/]/i.test(value)) return false
  return (
    value === "" ||
    value.startsWith("#") ||
    value.startsWith("//") ||
    /^[a-z][a-z0-9+.-]*:/i.test(value)
  )
}

function extractReferences(markdown) {
  const references = []
  const wikiPattern = /!?\[\[([^\]]+)\]\]/g
  const markdownPattern = /!?\[[^\]]*\]\(([^)]+)\)/g
  const htmlPattern = /(?:src|href)\s*=\s*["']([^"']+)["']/gi
  for (const pattern of [wikiPattern, markdownPattern, htmlPattern]) {
    for (const match of markdown.matchAll(pattern)) references.push(match[1])
  }
  return references
}

function buildFileIndexes(files) {
  const byRelative = new Map()
  const byBasename = new Map()
  for (const file of files) {
    const relativeKey = file.relative.toLocaleLowerCase("en-US")
    byRelative.set(relativeKey, file)
    const basenameKey = path.basename(file.relative).toLocaleLowerCase("en-US")
    const matches = byBasename.get(basenameKey) ?? []
    matches.push(file)
    byBasename.set(basenameKey, matches)
  }
  return { byRelative, byBasename }
}

function resolveVaultFile(reference, noteFile, vaultRoot, indexes) {
  const clean = sanitizeReference(reference)
  if (isExternalReference(clean)) return { kind: "external" }

  const extension = path.extname(clean).toLocaleLowerCase("en-US")
  const windowsAbsoluteReference = /^[a-z]:[\\/]/i.test(clean)
  const vaultRootReference = !windowsAbsoluteReference && /^[\\/](?![\\/])/.test(clean)
  const candidates = []

  if (windowsAbsoluteReference) {
    const absolute = path.resolve(clean)
    if (!isInside(vaultRoot, absolute)) {
      return { kind: "error", message: `引用越出 Vault：${reference}` }
    }
    candidates.push(normalizeRelative(path.relative(vaultRoot, absolute)))
  } else if (vaultRootReference) {
    candidates.push(normalizeRelative(clean.replace(/^[\\/]+/, "")))
  } else {
    candidates.push(
      normalizeRelative(path.join(path.dirname(noteFile.relative), clean)),
      normalizeRelative(clean),
    )
  }

  const candidateVariants = [...new Set(candidates)].flatMap((candidate) =>
    extension === "" ? [candidate, `${candidate}.md`] : [candidate],
  )
  for (const candidate of [...new Set(candidateVariants)]) {
    const found = indexes.byRelative.get(candidate.toLocaleLowerCase("en-US"))
    if (found) return { kind: "file", file: found, extension: path.extname(found.relative) }
  }

  const basename = path.basename(clean)
  const basenameKeys = extension === "" ? [basename, `${basename}.md`] : [basename]
  const basenameMatches = basenameKeys.flatMap(
    (key) => indexes.byBasename.get(key.toLocaleLowerCase("en-US")) ?? [],
  )
  if (basenameMatches.length === 1) {
    return { kind: "file", file: basenameMatches[0], extension }
  }
  if (basenameMatches.length > 1) {
    return {
      kind: "error",
      message: `附件引用有多个同名候选：${reference}（来自 ${noteFile.relative}）`,
    }
  }
  return { kind: "missing", extension, reference }
}

async function copyPreservingPath(source, destinationRoot, relative) {
  const destination = path.resolve(destinationRoot, relative)
  if (!isInside(destinationRoot, destination)) {
    throw new Error(`拒绝复制到发布目录之外：${relative}`)
  }
  await fs.mkdir(path.dirname(destination), { recursive: true })
  await fs.copyFile(source, destination)
}

async function writePreservingPath(text, destinationRoot, relative) {
  const destination = path.resolve(destinationRoot, relative)
  if (!isInside(destinationRoot, destination)) {
    throw new Error(`拒绝写入发布目录之外：${relative}`)
  }
  await fs.mkdir(path.dirname(destination), { recursive: true })
  await fs.writeFile(destination, text, "utf8")
}

async function main() {
  const localConfig = JSON.parse(await fs.readFile(localConfigPath, "utf8"))
  const argumentIndex = process.argv.indexOf("--vault")
  const configuredVault =
    argumentIndex >= 0 ? process.argv[argumentIndex + 1] : localConfig.vaultPath
  if (!configuredVault) throw new Error(".publish.local.json 中缺少 vaultPath")

  const vaultRoot = path.resolve(configuredVault)
  const vaultStat = await fs.stat(vaultRoot)
  if (!vaultStat.isDirectory()) throw new Error(`Vault 不是目录：${vaultRoot}`)
  await fs.access(path.join(vaultRoot, ".obsidian"))

  if (isInside(vaultRoot, projectRoot) || isInside(projectRoot, vaultRoot)) {
    throw new Error("Quartz 项目和原 Vault 不能互相嵌套")
  }
  if (path.dirname(contentRoot) !== projectRoot || path.basename(contentRoot) !== "content") {
    throw new Error("content 目录安全校验失败")
  }
  if (
    path.dirname(stagingRoot) !== projectRoot ||
    path.basename(stagingRoot) !== ".publish-staging"
  ) {
    throw new Error("staging 目录安全校验失败")
  }

  const allFiles = await walkFiles(vaultRoot)
  const markdownFiles = allFiles.filter(
    (file) =>
      !file.symbolicLink && path.extname(file.relative).toLocaleLowerCase("en-US") === ".md",
  )
  const selectedPaths = await readPublicationSelection(argumentIndex < 0)
  const availableMarkdownPaths = new Set(
    markdownFiles.map((file) => file.relative.toLocaleLowerCase("en-US")),
  )
  const missingSelectedPaths = [...selectedPaths].filter(
    (relative) => !availableMarkdownPaths.has(relative),
  )
  if (missingSelectedPaths.length > 0) {
    throw new Error(`发布清单中的文件不存在：\n- ${missingSelectedPaths.join("\n- ")}`)
  }
  const publishedNotes = []

  for (const file of markdownFiles) {
    const text = await fs.readFile(file.absolute, "utf8")
    const selectedByManifest = selectedPaths.has(file.relative.toLocaleLowerCase("en-US"))
    const frontmatter = readFrontmatter(text, file.relative)
    if (frontmatter?.publish === true || (selectedByManifest && frontmatter?.publish !== false)) {
      publishedNotes.push({
        ...file,
        text: selectedByManifest ? createPublishedCopy(text, file.relative) : text,
        selectedByManifest,
      })
    }
  }

  const indexes = buildFileIndexes(allFiles.filter((file) => !file.symbolicLink))
  const attachments = new Map()
  const linkWarnings = []
  const errors = []

  for (const note of publishedNotes) {
    for (const rawReference of extractReferences(note.text)) {
      const clean = sanitizeReference(rawReference)
      if (isExternalReference(clean)) continue
      const extension = path.extname(clean).toLocaleLowerCase("en-US")

      if (extension === "" || extension === ".md") {
        const resolvedNote = resolveVaultFile(rawReference, note, vaultRoot, indexes)
        if (resolvedNote.kind === "file") {
          const targetRelative = resolvedNote.file.relative.toLocaleLowerCase("en-US")
          const isPublished = publishedNotes.some(
            (published) => published.relative.toLocaleLowerCase("en-US") === targetRelative,
          )
          if (!isPublished) linkWarnings.push(`${note.relative} → ${rawReference}（目标未公开）`)
        } else if (resolvedNote.kind === "missing") {
          linkWarnings.push(`${note.relative} → ${rawReference}（目标不存在）`)
        }
        continue
      }

      if (!allowedAttachmentExtensions.has(extension)) {
        errors.push(`${note.relative} 引用了不允许公开的本地文件类型：${rawReference}`)
        continue
      }

      const resolved = resolveVaultFile(rawReference, note, vaultRoot, indexes)
      if (resolved.kind === "error") {
        errors.push(resolved.message)
      } else if (resolved.kind === "missing") {
        errors.push(`${note.relative} 的附件不存在：${rawReference}`)
      } else if (resolved.kind === "file") {
        attachments.set(resolved.file.relative.toLocaleLowerCase("en-US"), resolved.file)
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`发布同步已停止：\n- ${errors.join("\n- ")}`)
  }

  await fs.rm(stagingRoot, { recursive: true, force: true })
  await fs.mkdir(stagingRoot, { recursive: true })

  for (const note of publishedNotes) {
    if (note.selectedByManifest) {
      await writePreservingPath(note.text, stagingRoot, note.relative)
    } else {
      await copyPreservingPath(note.absolute, stagingRoot, note.relative)
    }
  }
  for (const attachment of attachments.values()) {
    await copyPreservingPath(attachment.absolute, stagingRoot, attachment.relative)
  }

  const hasPublishedRootIndex = publishedNotes.some(
    (note) => normalizeRelative(note.relative).toLocaleLowerCase("en-US") === "index.md",
  )
  if (!hasPublishedRootIndex) {
    await copyPreservingPath(homeTemplate, stagingRoot, "index.md")
  }

  await fs.rm(contentRoot, { recursive: true, force: true })
  await fs.rename(stagingRoot, contentRoot)

  const publicTopDirectories = [
    ...new Set(publishedNotes.map((note) => note.relative.split("/")[0])),
  ].sort()
  const report = {
    generatedAt: new Date().toISOString(),
    sourceMarkdownCount: markdownFiles.length,
    publishedNoteCount: publishedNotes.length,
    manifestSelectedNoteCount: publishedNotes.filter((note) => note.selectedByManifest).length,
    unpublishedNoteCount: markdownFiles.length - publishedNotes.length,
    copiedAttachmentCount: attachments.size,
    generatedHomePage: !hasPublishedRootIndex,
    publicTopDirectories,
    linkWarningCount: linkWarnings.length,
    linkWarnings,
    publishedRelativePaths: publishedNotes.map((note) => note.relative).sort(),
  }
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8")

  console.log(`源 Markdown：${report.sourceMarkdownCount}`)
  console.log(`公开笔记：${report.publishedNoteCount}`)
  console.log(`未公开笔记：${report.unpublishedNoteCount}`)
  console.log(`公开附件：${report.copiedAttachmentCount}`)
  console.log(`未公开/缺失 Wiki 链接提醒：${report.linkWarningCount}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
