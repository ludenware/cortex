import type { FontWeightLevel, TextSize, ThemeMode } from '@cortex/core'
import { FONT_OPTIONS, FONT_WEIGHT_OPTIONS } from '@cortex/core'
import { useTheme } from '../../context/ThemeContext'
import { useTextSize } from '../../context/TextSizeContext'
import { useFonts } from '../../context/FontContext'

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

const TEXT_SIZE_OPTIONS: { value: TextSize; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
]

const FONT_CATEGORY_LABELS: Record<string, string> = {
  'sans-serif': 'Sans-serif',
  serif: 'Serif',
  monospace: 'Monospace',
}
const FONT_CATEGORIES = ['sans-serif', 'serif', 'monospace'] as const

function FontPicker({ id, value, onChange }: { id: string; value: string; onChange: (id: string) => void }) {
  return (
    <select
      id={id}
      className="settings-font-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ fontFamily: FONT_OPTIONS.find((f) => f.id === value)?.family }}
    >
      {FONT_CATEGORIES.map((category) => (
        <optgroup key={category} label={FONT_CATEGORY_LABELS[category]}>
          {FONT_OPTIONS.filter((f) => f.category === category).map((font) => (
            <option key={font.id} value={font.id} style={{ fontFamily: font.family }}>
              {font.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

function FontWeightPicker({
  name,
  value,
  onChange,
}: {
  name: string
  value: FontWeightLevel
  onChange: (id: FontWeightLevel) => void
}) {
  return (
    <div className="settings-options settings-options-row">
      {FONT_WEIGHT_OPTIONS.map((opt) => (
        <label key={opt.id} className="settings-option">
          <input
            type="radio"
            name={name}
            checked={value === opt.id}
            onChange={() => onChange(opt.id)}
          />
          {opt.label}
        </label>
      ))}
    </div>
  )
}

export default function AppearanceSettings() {
  const { themePreference, setTheme } = useTheme()
  const { textSize, setTextSize } = useTextSize()
  const { uiFont, uiFontWeight, composeFont, composeFontWeight, setUIFont, setUIFontWeight, setComposeFont, setComposeFontWeight } =
    useFonts()

  return (
    <div className="settings-section-group">
      <section className="settings-section">
        <h2 className="settings-section-title">Theme</h2>
        <div className="settings-options">
          {THEME_OPTIONS.map((opt) => (
            <label key={opt.value} className="settings-option">
              <input
                type="radio"
                name="theme"
                checked={themePreference === opt.value}
                onChange={() => setTheme(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">Text Size</h2>
        <div className="settings-options">
          {TEXT_SIZE_OPTIONS.map((opt) => (
            <label key={opt.value} className="settings-option">
              <input
                type="radio"
                name="textSize"
                checked={textSize === opt.value}
                onChange={() => setTextSize(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">Fonts</h2>
        <div className="settings-font-group">
          <label className="settings-font-label" htmlFor="ui-font">UI Font</label>
          <FontPicker id="ui-font" value={uiFont} onChange={setUIFont} />

          <span className="settings-font-label">UI Font Strength</span>
          <FontWeightPicker name="uiFontWeight" value={uiFontWeight} onChange={setUIFontWeight} />

          <label className="settings-font-label" htmlFor="compose-font">Compose Font</label>
          <FontPicker id="compose-font" value={composeFont} onChange={setComposeFont} />

          <span className="settings-font-label">Compose Font Strength</span>
          <FontWeightPicker name="composeFontWeight" value={composeFontWeight} onChange={setComposeFontWeight} />
        </div>
      </section>
    </div>
  )
}
