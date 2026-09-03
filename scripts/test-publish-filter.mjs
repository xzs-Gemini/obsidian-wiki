#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDir, "..")
const syncScript = path.join(scriptDir, "sync-publish.mjs")
const contentRoot = path.join(projectRoot, "content")
const localConfig = JSON.parse(
  await fs.readFile(path.join(projectRoot, ".publish.local.json"), "utf8"),
)
const realVault = path.resolve(localConfig.vaultPath)
const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "obsidian-publish-filter-"))

function runSync(vault) {
  execFileSync(process.execPath, [syncScript, "--vault", vault], {
    cwd: projectRoot,
    stdio: "ignore",
  })
}

async function exists(relative) {
  return fs
    .access(path.join(contentRoot, relative))
    .then(() => true)
    .catch(() => false)
}

try {
  await fs.mkdir(path.join(fixtureRoot, ".obsidian"), { recursive: true })
  await fs.mkdir(path.join(fixtureRoot, "assets"), { recursive: true })
  await fs.writeFile(
    path.join(fixtureRoot, "公开.md"),
    "---\ntitle: 公开测试\npublish: true\n---\n\n![[assets/used.png]]\n[[私人]]\n",
    "utf8",
  )
  await fs.writeFile(path.join(fixtureRoot, "私人.md"), "# 私人内容\n", "utf8")
  await fs.writeFile(
    path.join(fixtureRoot, "字符串真值.md"),
    '---\npublish: "true"\n---\n\n# 不应公开\n',
    "utf8",
  )
  await fs.writeFile(path.join(fixtureRoot, "assets", "used.png"), Buffer.from("fixture"))
  await fs.writeFile(path.join(fixtureRoot, "assets", "unused.json"), '{"private":true}\n', "utf8")

  runSync(fixtureRoot)

  const expectations = new Map([
    ["公开.md", true],
    ["assets/used.png", true],
    ["私人.md", false],
    ["字符串真值.md", false],
    ["assets/unused.json", false],
  ])
  const failures = []
  for (const [relative, expected] of expectations) {
    if ((await exists(relative)) !== expected) failures.push(relative)
  }
  if (failures.length > 0) {
    throw new Error(`发布过滤测试失败：${failures.join(", ")}`)
  }
  console.log("发布过滤测试通过：仅复制严格 publish: true 笔记及其引用附件。")
} finally {
  runSync(realVault)
  await fs.rm(fixtureRoot, { recursive: true, force: true })
}
