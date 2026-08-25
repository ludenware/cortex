import type { FontWeightLevel, TextSize, ThemeMode } from '@cortex/core'
import { VAULT_FOLDERS, DEFAULT_FONT_ID, DEFAULT_FONT_WEIGHT_ID, isValidFontId, isValidFontWeightId } from '@cortex/core'
import { dialog } from 'electron'
import fs from 'fs/promises'
import { vaultFs } from './node-vault-fs'
import { isVaultConfigured } from './vault-manager'

const DEFAULT_THEME: ThemeMode = 'dark'
const DEFAULT_TEXT_SIZE: TextSize = 'medium'
const VALID_THEMES: ThemeMode[] = ['light', 'dark', 'system']
const VALID_TEXT_SIZES: TextSize[] = ['small', 'medium', 'large']

function settingsPath(): string {
  return `${VAULT_FOLDERS.SETTINGS}/preferences.md`
}

function defaultSettingsContent(): string {
  return `---\ntheme: ${DEFAULT_THEME}\ntextSize: ${DEFAULT_TEXT_SIZE}\nuiFont: ${DEFAULT_FONT_ID}\nuiFontWeight: ${DEFAULT_FONT_WEIGHT_ID}\ncomposeFont: ${DEFAULT_FONT_ID}\ncomposeFontWeight: ${DEFAULT_FONT_WEIGHT_ID}\n---\n\n# Cortex Settings\n\nPreferences for this vault. Edit freely — everything here is plain markdown.\n`
}

function parseFrontmatter(raw: string): Record<string, string> {
  const match = raw.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const result: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    result[key] = value
  }
  return result
}

function updateFrontmatter(raw: string, updates: Record<string, string>): string {
  const match = raw.match(/^---\n([\s\S]*?)\n---([\s\S]*)$/)
  if (!match) {
    const lines = Object.entries(updates).map(([k, v]) => `${k}: ${v}`).join('\n')
    return `---\n${lines}\n---\n`
  }
  const fm = parseFrontmatter(raw)
  Object.assign(fm, updates)
  const lines = Object.entries(fm).map(([k, v]) => `${k}: ${v}`).join('\n')
  return `---\n${lines}\n---${match[2]}`
}

async function readSettingsFile(): Promise<string> {
  const file = settingsPath()
  if (await vaultFs.exists(file)) return vaultFs.readFile(file)
  const content = defaultSettingsContent()
  await vaultFs.writeFile(file, content)
  return content
}

export async function getTheme(): Promise<ThemeMode> {
  if (!isVaultConfigured()) return DEFAULT_THEME
  const raw = await readSettingsFile()
  const fm = parseFrontmatter(raw)
  return VALID_THEMES.includes(fm.theme as ThemeMode) ? (fm.theme as ThemeMode) : DEFAULT_THEME
}

export async function setTheme(theme: ThemeMode): Promise<void> {
  const raw = await readSettingsFile()
  const updated = updateFrontmatter(raw, { theme })
  await vaultFs.writeFile(settingsPath(), updated)
}

export async function getTextSize(): Promise<TextSize> {
  if (!isVaultConfigured()) return DEFAULT_TEXT_SIZE
  const raw = await readSettingsFile()
  const fm = parseFrontmatter(raw)
  return VALID_TEXT_SIZES.includes(fm.textSize as TextSize) ? (fm.textSize as TextSize) : DEFAULT_TEXT_SIZE
}

export async function setTextSize(size: TextSize): Promise<void> {
  const raw = await readSettingsFile()
  const updated = updateFrontmatter(raw, { textSize: size })
  await vaultFs.writeFile(settingsPath(), updated)
}

export async function getUIFont(): Promise<string> {
  if (!isVaultConfigured()) return DEFAULT_FONT_ID
  const raw = await readSettingsFile()
  const fm = parseFrontmatter(raw)
  return isValidFontId(fm.uiFont) ? fm.uiFont : DEFAULT_FONT_ID
}

export async function setUIFont(fontId: string): Promise<void> {
  const raw = await readSettingsFile()
  const updated = updateFrontmatter(raw, { uiFont: fontId })
  await vaultFs.writeFile(settingsPath(), updated)
}

export async function getUIFontWeight(): Promise<FontWeightLevel> {
  if (!isVaultConfigured()) return DEFAULT_FONT_WEIGHT_ID
  const raw = await readSettingsFile()
  const fm = parseFrontmatter(raw)
  return isValidFontWeightId(fm.uiFontWeight) ? fm.uiFontWeight : DEFAULT_FONT_WEIGHT_ID
}

export async function setUIFontWeight(weightId: FontWeightLevel): Promise<void> {
  const raw = await readSettingsFile()
  const updated = updateFrontmatter(raw, { uiFontWeight: weightId })
  await vaultFs.writeFile(settingsPath(), updated)
}

export async function getComposeFont(): Promise<string> {
  if (!isVaultConfigured()) return DEFAULT_FONT_ID
  const raw = await readSettingsFile()
  const fm = parseFrontmatter(raw)
  return isValidFontId(fm.composeFont) ? fm.composeFont : DEFAULT_FONT_ID
}

export async function setComposeFont(fontId: string): Promise<void> {
  const raw = await readSettingsFile()
  const updated = updateFrontmatter(raw, { composeFont: fontId })
  await vaultFs.writeFile(settingsPath(), updated)
}

export async function getComposeFontWeight(): Promise<FontWeightLevel> {
  if (!isVaultConfigured()) return DEFAULT_FONT_WEIGHT_ID
  const raw = await readSettingsFile()
  const fm = parseFrontmatter(raw)
  return isValidFontWeightId(fm.composeFontWeight) ? fm.composeFontWeight : DEFAULT_FONT_WEIGHT_ID
}

export async function setComposeFontWeight(weightId: FontWeightLevel): Promise<void> {
  const raw = await readSettingsFile()
  const updated = updateFrontmatter(raw, { composeFontWeight: weightId })
  await vaultFs.writeFile(settingsPath(), updated)
}

// Exports to an arbitrary external path chosen via a native save dialog —
// outside VaultFS's vault-relative contract, same exception as PDF export
// and the attachment copy-in step.
export async function exportSettings(defaultName: string): Promise<string | null> {
  const { filePath, canceled } = await dialog.showSaveDialog({
    defaultPath: `${defaultName}.md`,
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  })
  if (canceled || !filePath) return null
  const raw = await readSettingsFile()
  await fs.writeFile(filePath, raw, 'utf-8')
  return filePath
}

export async function resetSettings(): Promise<void> {
  await vaultFs.writeFile(settingsPath(), defaultSettingsContent())
}
