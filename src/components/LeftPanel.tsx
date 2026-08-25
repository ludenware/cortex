import { StickyNote, BookOpen, Users, Settings, FolderOpen, FolderX, X } from 'lucide-react'
import { VAULT_FOLDERS } from '@cortex/core'
import FileBrowser from './FileBrowser'
import ContactsList from './ContactsList'
import AppLogo from './AppLogo'
import SearchBar from './SearchBar'
import type { AppZone, Contact, SearchResult } from '../types'
import '../styles/left-panel.css'

interface LeftPanelProps {
  zone: AppZone
  onZoneChange: (zone: AppZone) => void
  selectedPath: string | null
  onSelectPath: (path: string, name: string, opts?: { isNew?: boolean }) => void
  onGoToVaultRoot: () => void
  onCloseOpenFile: () => void
  selectedContact: Contact | null
  onSelectContact: (contact: Contact | null) => void
  activeTag: string | null
  onTagSelect: (tag: string | null) => void
  refreshKey: number
  onRefresh: () => void
  onError: (msg: string) => void
  vaultName: string | null
  onCloseVault: () => void
  onSearchResultSelect: (result: SearchResult) => void
  onOpenSettings: () => void
}

const ZONES: { id: AppZone; label: string; icon: typeof StickyNote }[] = [
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'diary', label: 'Diary', icon: BookOpen },
  { id: 'contacts', label: 'Contacts', icon: Users },
]

export default function LeftPanel({
  zone,
  onZoneChange,
  selectedPath,
  onSelectPath,
  onGoToVaultRoot,
  onCloseOpenFile,
  selectedContact,
  onSelectContact,
  activeTag,
  onTagSelect,
  refreshKey,
  onRefresh,
  onError,
  vaultName,
  onCloseVault,
  onSearchResultSelect,
  onOpenSettings,
}: LeftPanelProps) {
  return (
    <aside className="left-panel">
      <div className="left-panel-header">
        <div className="app-logo-row">
          <AppLogo variant="mark" size="md" />
          <span className="app-logo-label">Cortex</span>
        </div>
        <button className="settings-button" onClick={onOpenSettings} title="Settings">
          <Settings size={18} />
        </button>
      </div>

      <SearchBar onResultSelect={onSearchResultSelect} />

      <div className="app-zone">
        <div className="app-zone-label">Application</div>
        <div className="app-zone-tabs">
          {ZONES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`zone-tab ${zone === id ? 'active' : ''}`}
              onClick={() => onZoneChange(id)}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTag && (
        <div className="active-tag-banner">
          <span>Filtering by <strong>#{activeTag}</strong></span>
          <button onClick={() => onTagSelect(null)} title="Clear tag filter">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="browser-zone">
        {zone === 'contacts' ? (
          <ContactsList
            selected={selectedContact}
            onSelect={onSelectContact}
            refreshKey={refreshKey}
            onRefresh={onRefresh}
            onError={onError}
            activeTag={activeTag}
          />
        ) : (
          <FileBrowser
            zone={zone}
            selectedPath={selectedPath}
            vaultName={vaultName}
            onSelect={onSelectPath}
            onGoToVaultRoot={onGoToVaultRoot}
            onCloseOpenFile={onCloseOpenFile}
            onRefresh={onRefresh}
            refreshKey={refreshKey}
            tagFilter={activeTag}
            onError={onError}
          />
        )}
      </div>

      <div className="vault-footer">
        <div className="vault-footer-info">
          <FolderOpen size={16} className="vault-footer-icon" />
          <span className="vault-footer-name">{vaultName ?? 'Vault'}</span>
        </div>
        <button className="vault-action-btn" onClick={onCloseVault} title="Close vault">
          <FolderX size={16} />
          Close vault
        </button>
      </div>
    </aside>
  )
}

export { VAULT_FOLDERS }
