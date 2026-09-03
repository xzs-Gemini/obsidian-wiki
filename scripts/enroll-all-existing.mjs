#!/usr/bin/env node

import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDir, "..")
const localConfig = JSON.parse(
  await fs.readFile(path.join(projectRoot, ".publish.local.json"), "utf8"),
)
const vaultRoot = path.resolve(localConfig.vaultPath)
const blockedDirectories = new Set([".obsidian", ".git", ".claudian", ".trash"])

async function walkMarkdown(current = vaultRoot, files = []) {
  for (const entry of await fs.readdir(current, { withFileTypes: true })) {
    if (entry.isDirectory() && blockedDirectories.has(entry.name)) continue
    const absolute = path.join(current, entry.name)
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory()) {
      await walkMarkdown(absolute, files)
    } else if (entry.isFile() && path.extname(entry.name).toLocaleLowerCase("en-US") === ".md") {
      files.push(path.relative(vaultRoot, absolute).split(path.sep).join("/"))
    }
  }
  return files
}

await fs.access(path.join(vaultRoot, ".obsidian"))
const paths = (await walkMarkdown()).sort((left, right) => left.localeCompare(right, "zh-CN"))
const selection = {
  version: 1,
  policy: "explicit-current-files",
  approvedAt: new Date().toISOString(),
  paths,
}
await fs.writeFile(
  path.join(projectRoot, "publish-selection.json"),
  `${JSON.stringify(selection, null, 2)}\n`,
  "utf8",
)
console.log(`已将当前 ${paths.length} 篇 Markdown 加入独立发布清单；原 Vault 未修改。`)
