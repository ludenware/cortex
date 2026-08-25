import fs from 'fs/promises'
import path from 'path'
import type { VaultFS, DirEntry, VaultStat } from '@cortex/core'
import { getVaultPath } from './vault-manager'

function normalizeRelative(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^\.\//, '')
}

function resolvePath(relativePath: string): string {
  const normalized = normalizeRelative(relativePath)
  if (normalized.includes('..')) {
    throw new Error(`Invalid vault path: ${relativePath}`)
  }
  // An empty (or ".") relative path means the vault root itself — used
  // throughout the store modules as the "basePath"/"dir" for a full-vault
  // walk, so it must resolve, not be rejected as invalid.
  if (!normalized || normalized === '.') return getVaultPath()
  return path.join(getVaultPath(), ...normalized.split('/'))
}

async function readFile(relativePath: string): Promise<string> {
  return fs.readFile(resolvePath(relativePath), 'utf-8')
}

async function writeFile(relativePath: string, content: string): Promise<void> {
  const fullPath = resolvePath(relativePath)
  await fs.mkdir(path.dirname(fullPath), { recursive: true })
  await fs.writeFile(fullPath, content, 'utf-8')
}

async function mkdir(relativePath: string): Promise<void> {
  await fs.mkdir(resolvePath(relativePath), { recursive: true })
}

async function readdir(relativePath: string): Promise<DirEntry[]> {
  const entries = await fs.readdir(resolvePath(relativePath), { withFileTypes: true })
  return entries.map((entry) => ({ name: entry.name, isDirectory: entry.isDirectory() }))
}

async function stat(relativePath: string): Promise<VaultStat> {
  const s = await fs.stat(resolvePath(relativePath))
  return { mtime: s.mtime.toISOString(), size: s.size, isDirectory: s.isDirectory() }
}

async function exists(relativePath: string): Promise<boolean> {
  try {
    await fs.access(resolvePath(relativePath))
    return true
  } catch {
    return false
  }
}

async function remove(relativePath: string): Promise<void> {
  await fs.rm(resolvePath(relativePath), { recursive: true })
}

async function rename(fromRelativePath: string, toRelativePath: string): Promise<void> {
  const fullFrom = resolvePath(fromRelativePath)
  const fullTo = resolvePath(toRelativePath)
  await fs.mkdir(path.dirname(fullTo), { recursive: true })
  await fs.rename(fullFrom, fullTo)
}

/** Desktop's VaultFS implementation — vault-relative paths resolved
 *  against the currently open vault's root on disk via Node's `fs`. */
export const vaultFs: VaultFS = { readFile, writeFile, mkdir, readdir, stat, exists, remove, rename }
