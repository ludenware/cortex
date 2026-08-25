export type FontCategory = 'sans-serif' | 'serif' | 'monospace'

export interface FontOption {
  id: string
  label: string
  /** Full CSS font-family stack, including graceful fallbacks for
   *  platforms that don't have the named font installed. */
  family: string
  category: FontCategory
}

export type FontWeightLevel = 'thin' | 'medium' | 'strong'

export interface FontWeightOption {
  id: FontWeightLevel
  label: string
  weight: number
}

// Deliberately system/near-universal fonts rather than bundled web fonts —
// no font files are embedded, so a name only renders as itself on
// platforms that actually have it installed; everywhere else it falls
// back to the next name in its stack. Bodoni 72 in particular ships with
// macOS but not Windows/Linux, hence its serif fallback.
export const FONT_OPTIONS: FontOption[] = [
  { id: 'system-sans', label: 'System Default', family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', category: 'sans-serif' },
  { id: 'arial', label: 'Arial', family: 'Arial, Helvetica, sans-serif', category: 'sans-serif' },
  { id: 'helvetica', label: 'Helvetica', family: 'Helvetica, Arial, sans-serif', category: 'sans-serif' },
  { id: 'verdana', label: 'Verdana', family: 'Verdana, Geneva, sans-serif', category: 'sans-serif' },
  { id: 'segoe-ui', label: 'Segoe UI', family: '"Segoe UI", Tahoma, sans-serif', category: 'sans-serif' },
  { id: 'roboto', label: 'Roboto', family: 'Roboto, Arial, sans-serif', category: 'sans-serif' },

  { id: 'system-serif', label: 'System Serif', family: 'Georgia, "Times New Roman", serif', category: 'serif' },
  { id: 'georgia', label: 'Georgia', family: 'Georgia, serif', category: 'serif' },
  { id: 'times-new-roman', label: 'Times New Roman', family: '"Times New Roman", Times, serif', category: 'serif' },
  { id: 'palatino', label: 'Palatino', family: 'Palatino, "Palatino Linotype", serif', category: 'serif' },
  { id: 'bodoni-72', label: 'Bodoni 72', family: '"Bodoni 72", Didot, "Bodoni MT", serif', category: 'serif' },

  { id: 'system-mono', label: 'System Mono', family: '"SF Mono", "Fira Code", "Cascadia Code", monospace', category: 'monospace' },
  { id: 'courier-new', label: 'Courier New', family: '"Courier New", Courier, monospace', category: 'monospace' },
  { id: 'consolas', label: 'Consolas', family: 'Consolas, monospace', category: 'monospace' },
  { id: 'menlo', label: 'Menlo', family: 'Menlo, monospace', category: 'monospace' },
  { id: 'fira-code', label: 'Fira Code', family: '"Fira Code", monospace', category: 'monospace' },
]

// 100/400/700 rather than a narrower band like 200/500/1000 — measured
// against the actual system-sans stack, weight is not linear: from 100 to
// 400 rendered glyph width grows only ~2px per 100 units (light weights
// barely diverge from Regular in this typeface, by design — body text
// shouldn't look anemic), then roughly doubles to ~4.3px per 100 units
// above 400. That asymmetry is why the previous 200/500 pairing looked
// identical: both landed in the shallow part of the curve. 100 is the
// lowest valid CSS font-weight, maximizing whatever separation the font
// actually offers on the light side; 700 is the conventional, universally-
// supported "Bold" weight, which measurably diverges from Regular in every
// tested font. 1000 is dropped — non-standard, and 900 already reads as
// clearly bold, so nothing above 700 was buying real distinctness.
export const FONT_WEIGHT_OPTIONS: FontWeightOption[] = [
  { id: 'thin', label: 'Thin', weight: 100 },
  { id: 'medium', label: 'Medium', weight: 400 },
  { id: 'strong', label: 'Strong', weight: 700 },
]

export const DEFAULT_FONT_ID = 'system-sans'
export const DEFAULT_FONT_WEIGHT_ID: FontWeightLevel = 'medium'

export function getFontFamily(id: string): string {
  return FONT_OPTIONS.find((f) => f.id === id)?.family ?? FONT_OPTIONS[0].family
}

export function getFontWeightValue(id: string): number {
  return FONT_WEIGHT_OPTIONS.find((w) => w.id === id)?.weight ?? 400
}

export function isValidFontId(id: string): boolean {
  return FONT_OPTIONS.some((f) => f.id === id)
}

export function isValidFontWeightId(id: string): id is FontWeightLevel {
  return FONT_WEIGHT_OPTIONS.some((w) => w.id === id)
}
