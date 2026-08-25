import {
  defaultDiaryContent,
  defaultNoteContent,
  defaultUntitledNoteContent,
  extractNoteTitle,
  extractTagsFromContent,
  HIDDEN_VAULT_PATHS,
  NOTES_HIDDEN_PATHS,
  VAULT_FOLDERS,
  isDiaryPath,
  isValidDiaryDate,
  diaryDateFromPath,
  resolveDiaryPath,
  sanitizeNoteName,
  stripFileTypeLine,
  stripTagsBlock,
  UNTITLED_NOTE,
} from '@cortex/core'
import type { AttachmentEntry, TreeNode } from '@cortex/core'
import { dialog } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { getVaultPath } from './vault-manager'
import { vaultFs } from './node-vault-fs'
import { encryptEnvelope, decryptEnvelope, isEncryptedPath, toEncryptedPath, fromEncryptedPath } from './crypto-envelope'

export function getDataPath(): string {
  return getVaultPath()
}

export async function readVaultFile(relativePath: string): Promise<string> {
  try {
    return await vaultFs.readFile(relativePath)
  } catch {
    return ''
  }
}

export async function writeVaultFile(relativePath: string, content: string): Promise<void> {
  const normalizedPath = normalizeRelative(relativePath)
  await vaultFs.writeFile(normalizedPath, normalizeDiaryContent(normalizedPath, content))
}

// --- Optional per-file encryption ---
// Envelope format/crypto lives in ./crypto-envelope.ts. The envelope itself
// is a JSON/base64 text blob, so it round-trips fine through vaultFs's
// string-based readFile/writeFile — no separate binary file API needed.

/** Decrypts an already-encrypted note (`path.md.enc`) in place, without
 *  removing the encrypted file — used for viewing/editing an encrypted
 *  note that stays encrypted on disk (the note's own password is cached
 *  in memory by the renderer for the session, not re-derived from this
 *  call each time). Throws DecryptionError on a wrong password. */
export async function readEncryptedNote(relativePath: string, password: string): Promise<string> {
  const normalizedPath = normalizeRelative(relativePath)
  const raw = await vaultFs.readFile(normalizedPath)
  const decrypted = decryptEnvelope(Buffer.from(raw, 'utf-8'), password)
  return decrypted.toString('utf-8')
}

/** Re-encrypts and overwrites an already-encrypted note with new content,
 *  using the same password it was opened with (no re-derivation of a new
 *  salt-per-save would be wrong here — a fresh salt/IV *is* generated each
 *  call via encryptEnvelope, only the password is reused). */
export async function writeEncryptedNote(relativePath: string, content: string, password: string): Promise<void> {
  const normalizedPath = normalizeRelative(relativePath)
  const envelope = encryptEnvelope(Buffer.from(normalizeDiaryContent(normalizedPath, content), 'utf-8'), password)
  await vaultFs.writeFile(normalizedPath, envelope.toString('utf-8'))
}

/** Converts a plain `path.md` note to `path.md.enc`, deleting the plaintext
 *  original. Returns the new encrypted path. Caller (CenterPanel) must
 *  close the note *before* calling this — same "close first" ordering the
 *  existing delete flows use, so autosave can't write the plaintext file
 *  back after it's gone. */
export async function encryptNote(relativePath: string, password: string): Promise<string> {
  const normalizedPath = normalizeRelative(relativePath)
  const plaintext = await vaultFs.readFile(normalizedPath)
  const envelope = encryptEnvelope(Buffer.from(plaintext, 'utf-8'), password)
  const encryptedPath = toEncryptedPath(normalizedPath)
  await vaultFs.writeFile(encryptedPath, envelope.toString('utf-8'))
  await vaultFs.remove(normalizedPath)
  return encryptedPath
}

/** Converts `path.md.enc` back to a plain `path.md`, deleting the
 *  encrypted file. Throws DecryptionError if `password` is wrong — nothing
 *  is written or deleted in that case. Returns the restored plain path. */
export async function decryptNote(relativePath: string, password: string): Promise<string> {
  const normalizedPath = normalizeRelative(relativePath)
  const raw = await vaultFs.readFile(normalizedPath)
  const decrypted = decryptEnvelope(Buffer.from(raw, 'utf-8'), password) // throws before any write/delete if wrong
  const plainPath = fromEncryptedPath(normalizedPath)
  await vaultFs.writeFile(plainPath, decrypted.toString('utf-8'))
  await vaultFs.remove(normalizedPath)
  return plainPath
}

function normalizeRelative(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^\.\//, '')
}

function vaultBasename(relativePath: string, ext?: string): string {
  const normalized = normalizeRelative(relativePath)
  return ext ? path.posix.basename(normalized, ext) : path.posix.basename(normalized)
}

function vaultDirname(relativePath: string): string {
  return path.posix.dirname(normalizeRelative(relativePath))
}

function vaultJoin(dir: string, fileName: string): string {
  const normalizedDir = normalizeRelative(dir)
  if (!normalizedDir || normalizedDir === '.') return fileName
  return `${normalizedDir}/${fileName}`
}

/** Vault-relative equivalent of `path.relative(basePath, fullPath)` — both
 *  arguments are already vault-relative strings, so this is just prefix
 *  stripping rather than real path arithmetic. */
function relativeToBase(basePath: string, fullPath: string): string {
  const normalizedBase = normalizeRelative(basePath)
  if (!normalizedBase || normalizedBase === '.') return fullPath
  return fullPath.startsWith(`${normalizedBase}/`) ? fullPath.slice(normalizedBase.length + 1) : fullPath
}

function isHiddenPath(relativePath: string): boolean {
  const top = relativePath.split('/')[0]
  return HIDDEN_VAULT_PATHS.has(top)
}

function isNotesPath(relativePath: string): boolean {
  const normalized = normalizeRelative(relativePath)
  return normalized === VAULT_FOLDERS.NOTES || normalized.startsWith(`${VAULT_FOLDERS.NOTES}/`)
}

function normalizeDiaryContent(relativePath: string, content: string): string {
  if (!isDiaryPath(relativePath)) return content
  const expectedDate = diaryDateFromPath(relativePath)
  if (!expectedDate) return content
  const title = extractNoteTitle(content)
  if (isValidDiaryDate(title)) return content

  if (/^#{1,6}\s+.*$/m.test(content)) {
    return content.replace(/^#{1,6}\s+.*$/m, `# ${expectedDate}`)
  }
  return `# ${expectedDate}\n\n${content}`
}

export async function buildVaultTree(dir: string, basePath: string): Promise<TreeNode[]> {
  return buildVaultTreeWithHidden(dir, basePath, HIDDEN_VAULT_PATHS)
}

export async function buildNotesTree(basePath: string): Promise<TreeNode[]> {
  const notesDir = vaultJoin(basePath, VAULT_FOLDERS.NOTES)
  try { await vaultFs.mkdir(notesDir) } catch { /* ok */ }
  return buildVaultTreeWithHidden(notesDir, basePath, NOTES_HIDDEN_PATHS, false)
}

export async function buildDiaryTree(basePath: string): Promise<TreeNode[]> {
  const diaryDir = vaultJoin(basePath, VAULT_FOLDERS.DIARY)
  try { await vaultFs.mkdir(diaryDir) } catch { /* ok */ }
  return buildVaultTreeWithHidden(diaryDir, basePath, new Set<string>(), true)
}

async function buildVaultTreeWithHidden(dir: string, basePath: string, hidden: Set<string>, sortDesc = false): Promise<TreeNode[]> {
  const nodes: TreeNode[] = []
  let entries
  try {
    entries = await vaultFs.readdir(dir)
  } catch {
    return nodes
  }

  const sorted = entries.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    // Files: sort ascending for notes, descending for diary (newest first)
    const cmp = a.name.localeCompare(b.name)
    return sortDesc ? -cmp : cmp
  })

  for (const entry of sorted) {
    if (entry.name.startsWith('.')) continue
    const fullPath = vaultJoin(dir, entry.name)
    const relativePath = relativeToBase(basePath, fullPath)
    const topLevel = relativePath.split('/')[0]
    if (hidden.has(topLevel)) continue

    if (entry.isDirectory) {
      const children = await buildVaultTreeWithHidden(fullPath, basePath, hidden, sortDesc)
      nodes.push({
        name: entry.name,
        path: relativePath,
        type: 'folder',
        children,
      })
    } else {
      const stat = await vaultFs.stat(fullPath)
      const isMarkdown = entry.name.endsWith('.md')
      const isEncryptedMarkdown = entry.name.endsWith('.md.enc')
      const displayName = isEncryptedMarkdown
        ? entry.name.replace(/\.md\.enc$/, '')
        : isMarkdown
          ? entry.name.replace(/\.md$/, '')
          : entry.name
      nodes.push({
        name: displayName,
        path: relativePath,
        type: 'file',
        modified: stat.mtime,
        ...(isEncryptedPath(relativePath) ? { encrypted: true } : {}),
      })
    }
  }

  return nodes
}

export async function buildTree(dir: string, basePath: string): Promise<TreeNode[]> {
  return buildVaultTree(dir, basePath)
}

export async function listMarkdownFiles(
  dir: string,
  basePath: string,
  options: { skipHiddenPaths?: boolean } = {}
): Promise<{ name: string; path: string; modified: string }[]> {
  // skipHiddenPaths defaults to true — callers scoping to a single visible
  // section (e.g. "notes") rely on this to keep contacts/diary/attachments
  // out of the results. indexAllTags explicitly opts out since it must
  // scan every record type.
  const { skipHiddenPaths = true } = options
  const files: { name: string; path: string; modified: string }[] = []

  async function walk(currentDir: string) {
    let entries
    try {
      entries = await vaultFs.readdir(currentDir)
    } catch {
      return
    }
    for (const entry of entries) {
      // Dot-prefixed entries are skipped by default (editor/OS/cloud-sync
      // cruft like .git, .DS_Store, .obsidian) — except .calendar, which is
      // a real content folder that just happens to be dot-hidden from the
      // notes browser. A full-vault walk (skipHiddenPaths: false, used by
      // indexAllTags and search) needs to see inside it; scoped walks still
      // exclude it via the isHiddenPath check below, same as before.
      const isCalendarDir = entry.name === VAULT_FOLDERS.CALENDAR
      if (entry.name.startsWith('.') && !(isCalendarDir && !skipHiddenPaths)) continue
      const fullPath = vaultJoin(currentDir, entry.name)
      if (entry.isDirectory) {
        await walk(fullPath)
      } else if (entry.name.endsWith('.md')) {
        try {
          const stat = await vaultFs.stat(fullPath)
          const rel = relativeToBase(basePath, fullPath)
          // The hidden-section check must be relative to the walk root
          // (dir), not basePath — otherwise scoping the walk to e.g.
          // "diary/" (itself a hidden top-level folder) would flag every
          // file inside it as hidden and filter out the whole section.
          if (skipHiddenPaths) {
            const relFromDir = relativeToBase(dir, fullPath)
            if (isHiddenPath(relFromDir)) continue
          }
          files.push({
            name: entry.name.replace('.md', ''),
            path: rel,
            modified: stat.mtime,
          })
        } catch {
          // File removed between readdir and stat
        }
      }
    }
  }

  await walk(dir)
  return files
}

export async function createFolder(relativePath: string): Promise<string> {
  if (!isNotesPath(relativePath)) {
    throw new Error('Folders can only be created inside notes')
  }
  await vaultFs.mkdir(relativePath)
  return normalizeRelative(relativePath)
}

function noteRelativePath(relativeDir: string, fileName: string): string {
  const safeName = `${fileName}.md`
  if (!relativeDir || relativeDir === '.' || relativeDir === '/') return safeName
  return vaultJoin(relativeDir, safeName)
}

export async function createNote(
  relativeDir = ''
): Promise<{ name: string; path: string; modified: string }> {
  // Default to the notes root when no folder is specified
  const dir = !relativeDir || relativeDir === '' ? VAULT_FOLDERS.NOTES : relativeDir
  if (!isNotesPath(dir)) {
    throw new Error('Notes can only be created inside the notes folder')
  }
  let label = UNTITLED_NOTE
  let counter = 2
  let relativePath = noteRelativePath(dir, label)

  while (await vaultFs.exists(relativePath)) {
    label = `${UNTITLED_NOTE} ${counter++}`
    relativePath = noteRelativePath(dir, label)
  }

  await vaultFs.writeFile(relativePath, defaultUntitledNoteContent())
  const stat = await vaultFs.stat(relativePath)
  return { name: label, path: relativePath, modified: stat.mtime }
}

export async function createNoteWithTitle(
  relativeDir: string,
  title: string
): Promise<{ name: string; path: string; modified: string; created: boolean }> {
  const dir = !relativeDir || relativeDir === '' ? VAULT_FOLDERS.NOTES : relativeDir
  if (!isNotesPath(dir)) {
    throw new Error('Notes can only be created inside the notes folder')
  }
  const sanitized = sanitizeNoteName(title)
  const relativePath = noteRelativePath(dir, sanitized)

  if (await vaultFs.exists(relativePath)) {
    const stat = await vaultFs.stat(relativePath)
    return { name: sanitized, path: relativePath, modified: stat.mtime, created: false }
  }
  await vaultFs.writeFile(relativePath, defaultNoteContent(title.trim()))
  const stat = await vaultFs.stat(relativePath)
  return { name: sanitized, path: relativePath, modified: stat.mtime, created: true }
}

export async function syncNoteFilename(relativePath: string, content: string): Promise<string> {
  const normalizedPath = normalizeRelative(relativePath)
  if (isDiaryPath(normalizedPath)) {
    const { body } = stripTagsBlock(content)
    const date = extractNoteTitle(body)
    const currentDate = diaryDateFromPath(normalizedPath)
    if (!isValidDiaryDate(date)) {
      throw new Error('Diary titles must use YYYY-MM-DD')
    }
    if (date === currentDate) return normalizedPath

    const nextPath = resolveDiaryPath(date)
    if (await vaultFs.exists(nextPath)) {
      throw new Error(`A diary entry already exists for ${date}`)
    }
    return renamePath(normalizedPath, nextPath)
  }

  const { body } = stripTagsBlock(content)
  const title = extractNoteTitle(body)
  const sanitized = sanitizeNoteName(title)
  const currentBase = vaultBasename(normalizedPath, '.md')

  if (
    !title ||
    title.toLowerCase() === UNTITLED_NOTE.toLowerCase() ||
    sanitized.toLowerCase() === currentBase.toLowerCase()
  ) {
    return normalizedPath
  }

  const dir = vaultDirname(normalizedPath)
  let candidate = sanitized
  let counter = 2

  while (true) {
    const newRelative = dir === '.' ? `${candidate}.md` : vaultJoin(dir, `${candidate}.md`)

    if (newRelative === normalizedPath) return normalizedPath

    if (await vaultFs.exists(newRelative)) {
      candidate = `${sanitized} ${counter++}`
    } else {
      return await renamePath(normalizedPath, newRelative)
    }
  }
}

export async function movePath(fromRelative: string, toFolderRelative: string): Promise<string> {
  if (isDiaryPath(fromRelative)) {
    throw new Error('Diary entries are locked to their date')
  }
  // Empty means "the notes root" (dropping on the vault-name bar at the top
  // of the file tree), same convention createNote/createNoteWithTitle
  // already use — not "no folder prefix at all", which would move the file
  // outside notes/ entirely and fail the isNotesPath check below.
  const toFolder = !toFolderRelative ? VAULT_FOLDERS.NOTES : toFolderRelative
  if (!isNotesPath(fromRelative) || !isNotesPath(toFolder)) {
    throw new Error('Notes can only be moved inside the notes folder')
  }
  const entryName = vaultBasename(fromRelative)
  const dest = vaultJoin(toFolder, entryName)
  if (normalizeRelative(fromRelative) === normalizeRelative(dest)) {
    return normalizeRelative(fromRelative)
  }
  await vaultFs.rename(fromRelative, dest)
  return normalizeRelative(dest)
}

export async function deletePath(relativePath: string): Promise<boolean> {
  await vaultFs.remove(relativePath)
  return true
}

export async function renamePath(oldPath: string, newPath: string): Promise<string> {
  const normalizedOld = normalizeRelative(oldPath)
  const normalizedNew = normalizeRelative(newPath)
  await vaultFs.rename(normalizedOld, normalizedNew)
  return normalizedNew
}

function attachmentDir(_relativeFolder: string): string {
  return VAULT_FOLDERS.ATTACHMENTS
}

export async function listAttachments(relativeFolder: string): Promise<AttachmentEntry[]> {
  const dir = attachmentDir(relativeFolder)
  try {
    const entries = await vaultFs.readdir(dir)
    const attachments: AttachmentEntry[] = []
    for (const entry of entries) {
      if (entry.isDirectory) continue
      if (entry.name.endsWith('.md')) continue
      const fullPath = vaultJoin(dir, entry.name)
      const stat = await vaultFs.stat(fullPath)
      const rel = relativeFolder ? normalizeRelative(vaultJoin(relativeFolder, entry.name)) : entry.name
      attachments.push({
        name: entry.name,
        path: rel,
        size: stat.size,
        modified: stat.mtime,
      })
    }
    return attachments.sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return []
  }
}

// Attachments are imported from an arbitrary external path chosen via a
// native file dialog, and copied in as binary data — outside VaultFS's
// text-only readFile/writeFile contract, so this one function keeps using
// Node's fs/dialog directly rather than going through the interface.
export async function addAttachment(
  relativeFolder: string,
  sourcePath?: string
): Promise<AttachmentEntry | null> {
  let filePath = sourcePath
  if (!filePath) {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
    })
    if (canceled || filePaths.length === 0) return null
    filePath = filePaths[0]
  }

  const originalName = path.basename(filePath)
  const ext = path.extname(originalName)
  const base = path.basename(originalName, ext)
  const safeName = `${base}-${uuidv4().slice(0, 8)}${ext}`
  const destDir = attachmentDir(relativeFolder)
  await vaultFs.mkdir(destDir)
  const destRelative = vaultJoin(destDir, safeName)
  const destAbsolute = path.join(getDataPath(), destRelative)
  await fs.copyFile(filePath, destAbsolute)
  const stat = await vaultFs.stat(destRelative)
  return {
    name: safeName,
    path: destRelative,
    size: stat.size,
    modified: stat.mtime,
  }
}

export async function deleteAttachment(relativePath: string): Promise<boolean> {
  await vaultFs.remove(relativePath)
  return true
}

export async function indexAllTags(): Promise<{ tag: string; count: number; paths: string[] }[]> {
  const files = await listMarkdownFiles('', '', { skipHiddenPaths: false })
  const tagMap = new Map<string, string[]>()

  for (const file of files) {
    try {
      const content = await vaultFs.readFile(file.path)
      // Contact files (and any other "typed" file) are prefixed with a
      // `// type = ... //` marker line, which breaks the frontmatter-tags
      // regex unless stripped first.
      const tags = extractTagsFromContent(stripFileTypeLine(content))
      for (const tag of tags) {
        const existing = tagMap.get(tag) ?? []
        existing.push(file.path)
        tagMap.set(tag, existing)
      }
    } catch {
      // Skip missing or unreadable files (e.g. stale tree entries)
    }
  }

  return Array.from(tagMap.entries())
    .map(([tag, paths]) => ({ tag, count: paths.length, paths }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

export async function openDiaryEntry(dateStr: string): Promise<string> {
  const relativePath = resolveDiaryPath(dateStr)
  if (!(await vaultFs.exists(relativePath))) {
    await vaultFs.writeFile(relativePath, defaultDiaryContent(dateStr))
  }
  return relativePath
}

export async function listDiaryDates(): Promise<string[]> {
  const diaryDir = VAULT_FOLDERS.DIARY
  const dates: string[] = []
  try {
    const years = await vaultFs.readdir(diaryDir)
    for (const year of years) {
      if (!year.isDirectory) continue
      const yearDir = vaultJoin(diaryDir, year.name)
      const months = await vaultFs.readdir(yearDir)
      for (const month of months) {
        if (!month.isDirectory) continue
        const files = await vaultFs.readdir(vaultJoin(yearDir, month.name))
        for (const file of files) {
          const m = file.name.match(/^(\d{4}-\d{2}-\d{2})\.md$/)
          if (m) dates.push(m[1])
        }
      }
    }
  } catch {
    // diary dir may not exist yet
  }
  return dates
}
