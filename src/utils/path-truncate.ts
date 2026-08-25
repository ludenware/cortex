let measureCanvas: HTMLCanvasElement | null = null

/** Pixel width of `text` rendered in `font` (a CSS `font` shorthand string,
 *  e.g. from `getComputedStyle(el).font`) — used to decide how much of a
 *  path fits before falling back to character-level CSS ellipsis. */
export function measureTextWidth(text: string, font: string): number {
  if (!measureCanvas) measureCanvas = document.createElement('canvas')
  const ctx = measureCanvas.getContext('2d')
  if (!ctx) return text.length * 7
  ctx.font = font
  return ctx.measureText(text).width
}

/** Middle-elides a vault-relative directory path so the vault name, the
 *  first segment (the zone, e.g. "notes"), and as many trailing segments as
 *  fit stay visible — only the segments in between collapse to "...". The
 *  title (filename) is never touched: it's the whole point of "the file
 *  name will always be visible from the right".
 *
 *  Example: vaultName="cortex-vault", segments=["notes","muchos","gracias",
 *  "armageddon","isagreat","movie"], title="thats right" narrows through
 *  "cortex-vault/notes/.../gracias/.../thats right" down to e.g.
 *  "cortex-vault/notes/.../isagreat/movie/thats right" as available width
 *  shrinks, rather than a flat character-count cut that could as easily
 *  swallow the filename as a folder name.
 *
 *  `prefixFont`/`titleFont` are measured separately (not one string in one
 *  font) because the title renders bold (`.note-path-title`) while the
 *  prefix doesn't — bold glyphs measure wider, so a single shared font
 *  underestimates the title's real rendered width and the result overflows
 *  its budget. */
export function truncateMiddlePath(
  vaultName: string,
  segments: string[],
  title: string,
  availableWidth: number,
  prefixFont: string,
  titleFont: string
): { prefix: string; title: string } {
  const buildPrefix = (parts: string[]) => (parts.length > 0 ? `${parts.join('/')}/` : '')
  const titleWidth = measureTextWidth(title, titleFont)
  const fits = (prefixParts: string[]) =>
    measureTextWidth(buildPrefix(prefixParts), prefixFont) + titleWidth <= availableWidth

  const fullPrefixParts = [vaultName, ...segments]
  if (fits(fullPrefixParts)) {
    return { prefix: buildPrefix(fullPrefixParts), title }
  }

  const firstSeg = segments[0]
  // Try progressively fewer trailing segments, always anchored on
  // vaultName + firstSeg + "..." — skip tailCount values that would leave
  // no actual gap to elide (nothing to shorten with "...").
  for (let tailCount = segments.length - 2; tailCount >= 0; tailCount--) {
    const tail = tailCount > 0 ? segments.slice(segments.length - tailCount) : []
    const prefixParts = firstSeg !== undefined ? [vaultName, firstSeg, '...', ...tail] : [vaultName, '...', ...tail]
    if (fits(prefixParts)) {
      return { prefix: buildPrefix(prefixParts), title }
    }
  }

  // Deepest fallback: drop the first segment too, keep only vaultName + "...".
  // Used even if it *still* doesn't technically fit (e.g. the title alone,
  // which is never truncated, is already wider than the available space) —
  // it's provably the least-overflowing candidate, so it's always a better
  // choice than the full untruncated path. An earlier version fell all the
  // way back to `fullPrefixParts` here whenever this "fit" check failed,
  // which meant a sufficiently long *title* (nothing to do with the
  // directory depth at all) could make the whole path render completely
  // untruncated — the exact "runs through the buttons" bug this function
  // exists to prevent.
  if (segments.length > 0) {
    const minimalParts = [vaultName, '...']
    return { prefix: buildPrefix(minimalParts), title }
  }

  return { prefix: buildPrefix(fullPrefixParts), title }
}
