import { useState, type ComponentType } from 'react'
import ActionRow from './ActionRow'
import ActionButton from './ActionButton'
import ConfirmDialog from './ConfirmDialog'
import AppearanceSettings from './settings/AppearanceSettings'
import AboutSettings from './settings/AboutSettings'
import '../styles/settings.css'

interface SettingsCategoryDef {
  id: string
  label: string
  component: ComponentType
}

// Adding a new settings category is one entry here plus one component.
const SETTINGS_CATEGORIES: SettingsCategoryDef[] = [
  { id: 'appearance', label: 'Appearance', component: AppearanceSettings },
  { id: 'about', label: 'About Cortex', component: AboutSettings },
]

interface SettingsViewProps {
  initialCategory?: string | null
  canGoBack?: boolean
  onNavBack?: () => void
  onClose?: () => void
  onError: (msg: string) => void
}

export default function SettingsView({ initialCategory, canGoBack, onNavBack, onClose, onError }: SettingsViewProps) {
  const [activeCategoryId, setActiveCategoryId] = useState(
    initialCategory && SETTINGS_CATEGORIES.some((c) => c.id === initialCategory)
      ? initialCategory
      : SETTINGS_CATEGORIES[0].id
  )
  const [toast, setToast] = useState<string | null>(null)
  const [pendingReset, setPendingReset] = useState(false)

  const activeCategory = SETTINGS_CATEGORIES.find((c) => c.id === activeCategoryId) ?? SETTINGS_CATEGORIES[0]
  const ActiveComponent = activeCategory.component

  const flashToast = (message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 1500)
  }

  const handleSave = () => {
    // Every control in here already applies and persists immediately, so
    // there's nothing pending to flush — this is a lightweight confirmation
    // rather than a batching mechanism.
    flashToast('Saved')
  }

  const handleExport = async () => {
    try {
      const path = await window.cortex.settings.exportSettings('cortex-settings')
      if (path) flashToast('Exported')
    } catch {
      onError('Failed to export settings')
    }
  }

  const confirmReset = async () => {
    setPendingReset(false)
    try {
      await window.cortex.settings.resetSettings()
      // Simplest way to get every open context (theme, text size) back in
      // sync with the now-reset preferences file.
      window.location.reload()
    } catch {
      onError('Failed to reset settings')
    }
  }

  return (
    <main className="center-panel">
      <ActionRow
        left={<span className="center-title">Settings</span>}
        center={
          <>
            <ActionButton main="GO" sub="BACK" disabled={!canGoBack} onClick={() => onNavBack?.()} />
            <ActionButton main="SAVE" sub="SETTINGS" onClick={handleSave} />
            <ActionButton main="EXPORT" sub="SETTINGS" onClick={() => void handleExport()} />
            <span className="action-row-ghost" aria-hidden="true">
              <ActionButton main="GO" sub="BACK" disabled onClick={() => {}} />
            </span>
          </>
        }
        right={
          <>
            {onClose && <ActionButton main="CLOSE" sub="SETTINGS" onClick={onClose} />}
            <ActionButton main="RESET" sub="SETTINGS" variant="danger" onClick={() => setPendingReset(true)} />
          </>
        }
      />

      <div className="settings-view-outer">
        <div className="settings-body">
          <nav className="settings-categories">
            {SETTINGS_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`settings-category-item ${cat.id === activeCategoryId ? 'active' : ''}`}
                onClick={() => setActiveCategoryId(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </nav>
          <div className="settings-content">
            {toast && <div className="settings-toast">{toast}</div>}
            <ActiveComponent />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={pendingReset}
        title="Reset settings"
        message="Are you sure you want to reset all settings to their defaults? This cannot be undone."
        confirmLabel="Reset"
        onConfirm={confirmReset}
        onCancel={() => setPendingReset(false)}
      />
    </main>
  )
}
