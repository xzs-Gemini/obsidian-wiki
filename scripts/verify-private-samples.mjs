#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDir, "..")
const localConfig = JSON.parse(
  await fs.readFile(path.join(projectRoot, ".publish.local.json"), "utf8"),
)
const publishReport = JSON.parse(
  await fs.readFile(path.join(projectRoot, ".publish-report.json"), "utf8"),
)
const vaultRoot = path.resolve(localConfig.vaultPath)
const published = new Set(
  publishReport.publishedRelativePaths.map((value) => value.toLocaleLowerCase("en-US")),
)

async function walkMarkdown(root, current = root, files = []) {
  const blocked = new Set([".obsidian", ".git", ".claudian", ".trash"])
  for (const entry of await fs.readdir(current, { withFileTypes: true })) {
    if (entry.isDirectory() && blocked.has(entry.name)) continue
    const absolute = path.join(current, entry.name)
    if (entry.isDirectory()) await walkMarkdown(root, absolute, files)
    else if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".md") {
      files.push(path.relative(root, absolute).split(path.sep).join("/"))
    }
  }
  return files
}

function digest(value) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

async function main() {
  const markdown = await walkMarkdown(vaultRoot)
  const privateNotes = markdown.filter(
    (relative) => !published.has(relative.toLocaleLowerCase("en-US")),
  )
  const samples = privateNotes.sort((a, b) => digest(a).localeCompare(digest(b))).slice(0, 3)
  const publicIndexPath = path.join(projectRoot, "public", "static", "contentIndex.json")
  const publicIndex = await fs.readFile(publicIndexPath, "utf8").catch(() => "")
  let tracked = ""
  try {
    tracked = execFileSync("git", ["ls-files"], {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
  } catch {
    tracked = ""
  }

  const failures = []
  for (const relative of samples) {
    const contentPath = path.join(projectRoot, "content", relative)
    const basename = path.basename(relative, ".md")
    const inContent = await fs
      .access(contentPath)
      .then(() => true)
      .catch(() => false)
    const inGit = tracked.split(/\r?\n/).includes(`content/${relative}`)
    const inSearch = publicIndex
      .toLocaleLowerCase("en-US")
      .includes(basename.toLocaleLowerCase("en-US"))
    if (inContent || inGit || inSearch) failures.push(digest(relative).slice(0, 12))
  }

  if (failures.length > 0) {
    console.error(
      `私人笔记抽样失败：${failures.length}/${samples.length}，样本哈希：${failures.join(", ")}`,
    )
    process.exitCode = 1
    return
  }
  console.log(
    `私人笔记抽样通过：${samples.length}/${samples.length} 不在 content、搜索索引或 Git 跟踪中。`,
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
