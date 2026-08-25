import { extractNoteTitle, diaryDateFromPath } from '@cortex/core'

export { extractNoteTitle }

/** Vault-relative directory segments (no vault name, no filename) plus the
 *  displayed title — the raw building blocks for both the plain-string
 *  header (`splitNoteHeaderPath`) and the width-aware middle-truncation in
 *  `path-truncate.ts`, which needs segments as an array to elide the middle
 *  ones rather than just cutting a joined string from one end. */
export function splitNoteHeaderSegments(
  noteRelativePath: string | null,
  content: string
): { segments: string[]; title: string } {
  if (noteRelativePath) {
    const diaryDate = diaryDateFromPath(noteRelativePath)
    if (diaryDate) {
      const withoutExt = noteRelativePath.replace(/\\/g, '/').replace(/\.md$/, '')
      const parts = withoutExt.split('/')
      parts.pop()
      return { segments: parts, title: diaryDate }
    }
  }

  const title = extractNoteTitle(content)

  if (!noteRelativePath) {
    return { segments: [], title }
  }

  const withoutExt = noteRelativePath.replace(/\\/g, '/').replace(/\.md$/, '')
  const parts = withoutExt.split('/')
  parts.pop()

  return { segments: parts, title }
}

export function splitNoteHeaderPath(
  vaultName: string,
  noteRelativePath: string | null,
  content: string
): { prefix: string; title: string } {
  const { segments, title } = splitNoteHeaderSegments(noteRelativePath, content)
  const dir = segments.length > 0 ? `${segments.join('/')}/` : ''
  return { prefix: `${vaultName}/${dir}`, title }
}

/** @deprecated use splitNoteHeaderPath */
export function buildNoteDisplayPath(
  vaultName: string,
  noteRelativePath: string | null,
  title: string
): string {
  const { prefix } = splitNoteHeaderPath(vaultName, noteRelativePath, `# ${title}\n`)
  return `${prefix}${title}`
}
