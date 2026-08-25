import { useState, useCallback, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import LeftPanel from './components/LeftPanel'
import CenterPanel from './components/CenterPanel'
import RightPanel, { type FeatureZone } from './components/RightPanel'
import VaultSetup from './components/VaultSetup'
import SearchPalette from './components/SearchPalette'
import SettingsView from './components/SettingsView'
import CreateEventView from './components/CreateEventView'
import OpenEncryptedFileModal from './components/OpenEncryptedFileModal'
import { ThemeProvider } from './context/ThemeContext'
import { TextSizeProvider } from './context/TextSizeContext'
import { FontProvider } from './context/FontContext'
import { parseFileType, isDiaryPath, resolveDiaryPath } from '@cortex/core'
import type { AppZone, CalendarEvent, Contact, SearchResult, VaultStatus } from './types'
import './App.css'

export default function App() {
  const [vaultStatus, setVaultStatus] = useState<VaultStatus | null>(null)
  const [vaultReady, setVaultReady] = useState(false)
  const [zone, setZone] = useState<AppZone>('notes')
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [focusedCalendarEvent, setFocusedCalendarEvent] = useState<CalendarEvent | null>(null)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [diaryRefreshKey, setDiaryRefreshKey] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [openInEditMode, setOpenInEditMode] = useState(false)
  const [isNewNote, setIsNewNote] = useState(false)
  const [featureZone, setFeatureZone] = useState<FeatureZone>('calendar')
  const [openNoteContent, setOpenNoteContent] = useState('')
  const [showSearchPalette, setShowSearchPalette] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsCategory, setSettingsCategory] = useState<string | null>(null)
  const [settingsRequestId, setSettingsRequestId] = useState(0)
  const [openEncryptedFileModal, setOpenEncryptedFileModal] = useState(false)
  const [creatingEventDate, setCreatingEventDate] = useState<Date | null>(null)
  const skipFlushRef = useRef(false)
  const selectedPathRef = useRef<string | null>(null)
  const [navHistory, setNavHistory] = useState<string[]>([])

  selectedPathRef.current = selectedPath

  const loadVaultStatus = useCallback(async () => {
    const status = await window.cortex.vault.getStatus()
    setVaultStatus(status)
    setVaultReady(status.configured)
  }, [])

  useEffect(() => {
    loadVaultStatus()
  }, [loadVaultStatus])

  const handleError = useCallback((msg: string) => setError(msg), [])
  const dismissError = useCallback(() => setError(null), [])
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  const handleVaultComplete = useCallback(async () => {
    await loadVaultStatus()
    setRefreshKey((k) => k + 1)
  }, [loadVaultStatus])

  const handleCloseVault = useCallback(async () => {
    try {
      const status = await window.cortex.vault.close()
      setVaultStatus(status)
      setVaultReady(false)
      setZone('notes')
      setNavHistory([])
      setSelectedPath(null)
      setSelectedName(null)
      setSelectedContact(null)
      setSelectedEvent(null)
      setFocusedCalendarEvent(null)
      setActiveTag(null)
      setCreatingEventDate(null)
    } catch {
      handleError('Failed to close vault')
    }
  }, [handleError])

  const handleNoteRenamed = useCallback((path: string, name: string) => {
    setSelectedPath(path)
    setSelectedName(name)
    setIsNewNote(false)
  }, [])

  const handleNoteSaved = useCallback(() => {
    setIsNewNote(false)
  }, [])

  const handleCloseOpenFile = useCallback(() => {
    skipFlushRef.current = true
    setNavHistory([])
    setSelectedPath(null)
    setSelectedName(null)
    setSelectedContact(null)
    setSelectedEvent(null)
    setFocusedCalendarEvent(null)
    setOpenInEditMode(false)
    setIsNewNote(false)
    setOpenNoteContent('')
    setCreatingEventDate(null)
  }, [])

  const handleGoToVaultRoot = useCallback(() => {
    setNavHistory([])
    setSelectedPath(null)
    setSelectedName(null)
    setSelectedEvent(null)
    setFocusedCalendarEvent(null)
    setOpenInEditMode(false)
    setIsNewNote(false)
    setOpenNoteContent('')
    setCreatingEventDate(null)
  }, [])

  const openNoteAtPath = useCallback(async (path: string, name: string, opts?: { isNew?: boolean }) => {
    setSettingsOpen(false)
    setCreatingEventDate(null)
    if (!opts?.isNew) {
      try {
        const raw = await window.cortex.storage.readFile(path)
        const fileType = parseFileType(raw)
        if (fileType === 'contact' || path.startsWith('.contacts/')) {
          const contact = await window.cortex.contacts.getByPath(path)
          if (contact) {
            setZone('contacts')
            setSelectedContact(contact)
            setSelectedEvent(null)
            setSelectedPath(null)
            setSelectedName(null)
            setOpenInEditMode(false)
            return
          }
        }
        if (fileType === 'calendar' || path.startsWith('.calendar/')) {
          const event = await window.cortex.calendar.getByPath(path)
          if (event) {
            setSelectedEvent(event)
            setFocusedCalendarEvent(event)
            setSelectedPath(null)
            setSelectedName(null)
            setSelectedContact(null)
            setOpenInEditMode(false)
            return
          }
        }
      } catch {
        // fall through to note view
      }
    }
    // Auto-switch zone based on path type
    if (isDiaryPath(path)) {
      setZone('diary')
      setDiaryRefreshKey((k) => k + 1)
    } else if (path.startsWith('notes/') || path.startsWith('notes\\')) {
      setZone('notes')
    }
    setSelectedPath(path)
    setSelectedName(name)
    setOpenInEditMode(opts?.isNew ?? false)
    setIsNewNote(opts?.isNew ?? false)
    setSelectedContact(null)
    setSelectedEvent(null)
    setFocusedCalendarEvent(null)
  }, [])

  const handleSelectPath = useCallback(async (
    path: string,
    name: string,
    opts?: { isNew?: boolean; fromLink?: boolean }
  ) => {
    const currentPath = selectedPathRef.current
    if (opts?.fromLink && currentPath && currentPath !== path) {
      setNavHistory((history) => [...history, currentPath])
    } else if (!opts?.fromLink) {
      setNavHistory([])
    }
    await openNoteAtPath(path, name, opts)
  }, [openNoteAtPath])

  // Left panel's contacts list (both clicking an existing contact and
  // creating a new one via "+ Contact" route through here) — needs the same
  // "close whatever else is open" treatment as every other navigation
  // entry point, otherwise selecting/creating a contact while Settings (or
  // a note/event) is open just updates selectedContact in the background
  // without ever navigating there. `contact` is only null for the
  // delete-cleanup case (ContactsList clearing its own selection after
  // deleting the active contact), which shouldn't disturb anything else.
  const handleSelectContact = useCallback((contact: Contact | null) => {
    if (contact) {
      setSettingsOpen(false)
      setNavHistory([])
      setSelectedEvent(null)
      setFocusedCalendarEvent(null)
      setSelectedPath(null)
      setSelectedName(null)
      setIsNewNote(false)
      setOpenNoteContent('')
      setCreatingEventDate(null)
    }
    setSelectedContact(contact)
  }, [])

  const handleOpenContactFromMention = useCallback((contact: Contact) => {
    const currentPath = selectedPathRef.current
    setNavHistory((history) => (currentPath ? [...history, currentPath] : history))
    setSettingsOpen(false)
    setZone('contacts')
    setSelectedContact(contact)
    setSelectedEvent(null)
    setSelectedPath(null)
    setSelectedName(null)
    setFocusedCalendarEvent(null)
    setIsNewNote(false)
    setOpenNoteContent('')
    setCreatingEventDate(null)
  }, [])

  const handleOpenCalendarEvent = useCallback((event: CalendarEvent) => {
    const currentPath = selectedPathRef.current
    setNavHistory((history) => (currentPath ? [...history, currentPath] : history))
    setSettingsOpen(false)
    setSelectedEvent(event)
    setFocusedCalendarEvent(event)
    setSelectedContact(null)
    setSelectedPath(null)
    setSelectedName(null)
    setIsNewNote(false)
    setOpenNoteContent('')
    setCreatingEventDate(null)
  }, [])

  const handleOpenCreateEvent = useCallback((date: Date) => {
    const currentPath = selectedPathRef.current
    setNavHistory((history) => (currentPath ? [...history, currentPath] : history))
    setSettingsOpen(false)
    setSelectedEvent(null)
    setFocusedCalendarEvent(null)
    setSelectedContact(null)
    setSelectedPath(null)
    setSelectedName(null)
    setIsNewNote(false)
    setOpenNoteContent('')
    setCreatingEventDate(date)
  }, [])

  // No skipFlushRef/unsaved-draft handling needed here — unlike closing a
  // note or contact, nothing is written to disk until Create is actually
  // clicked, so there's nothing to flush or lose by just discarding state.
  const handleCloseCreateEvent = useCallback(() => {
    setCreatingEventDate(null)
  }, [])

  const handleEventCreated = useCallback((_event: CalendarEvent) => {
    setCreatingEventDate(null)
    setRefreshKey((k) => k + 1)
  }, [])

  const handleEventDeleted = useCallback(() => {
    setNavHistory([])
    setSelectedEvent(null)
    setFocusedCalendarEvent(null)
  }, [])

  const handleOpenSettings = useCallback((category?: string) => {
    const currentPath = selectedPathRef.current
    setNavHistory((history) => (currentPath ? [...history, currentPath] : history))
    setSettingsOpen(true)
    setSettingsCategory(category ?? null)
    // Forces SettingsView to remount even if Settings is already open (e.g.
    // the native "About Cortex" menu item clicked while on a different
    // category) — SettingsView only reads `initialCategory` on mount, so
    // without this a same-value category (or an already-mounted instance)
    // would silently do nothing. The app autosaves everything immediately,
    // so a remount here never risks losing in-progress state.
    setSettingsRequestId((id) => id + 1)
    setSelectedContact(null)
    setSelectedEvent(null)
    setFocusedCalendarEvent(null)
    setSelectedPath(null)
    setSelectedName(null)
    setIsNewNote(false)
    setOpenNoteContent('')
    setCreatingEventDate(null)
  }, [])

  const handleCloseSettings = useCallback(() => {
    setSettingsOpen(false)
    setSettingsCategory(null)
  }, [])

  const handleNavBack = useCallback(() => {
    setNavHistory((history) => {
      if (history.length === 0) return history
      const next = [...history]
      const prev = next.pop()
      if (prev) {
        const prevName = prev.split('/').pop()?.replace(/\.md$/, '') ?? 'Note'
        void openNoteAtPath(prev, prevName)
      }
      return next
    })
  }, [openNoteAtPath])

  const handleZoneChange = useCallback(async (newZone: AppZone) => {
    setSettingsOpen(false)
    setZone(newZone)
    setSelectedContact(null)
    setSelectedEvent(null)
    setActiveTag(null)
    setFocusedCalendarEvent(null)
    setIsNewNote(false)
    setOpenNoteContent('')
    setNavHistory([])
    setCreatingEventDate(null)

    if (newZone === 'diary') {
      const today = format(new Date(), 'yyyy-MM-dd')
      try {
        const diaryPath = await window.cortex.storage.openDiaryEntry(today)
        setSelectedPath(diaryPath)
        setSelectedName(`${today}.md`)
        setOpenInEditMode(true)
        setDiaryRefreshKey((k) => k + 1)
      } catch {
        handleError("Failed to open today's diary")
      }
      return
    }

    setSelectedPath(null)
    setSelectedName(null)
  }, [handleError])

  const handleOpenDiaryEntry = useCallback(async (dateStr: string) => {
    setSettingsOpen(false)
    setZone('diary')
    setSelectedContact(null)
    setSelectedEvent(null)
    setActiveTag(null)
    setFocusedCalendarEvent(null)
    setIsNewNote(false)
    setOpenNoteContent('')
    setNavHistory([])
    setCreatingEventDate(null)
    try {
      const diaryPath = await window.cortex.storage.openDiaryEntry(dateStr)
      setSelectedPath(diaryPath)
      setSelectedName(`${dateStr}.md`)
      setOpenInEditMode(false)
      setDiaryRefreshKey((k) => k + 1)
    } catch {
      handleError(`Failed to open diary for ${dateStr}`)
    }
  }, [handleError])

  // Close the currently open file if it matches the diary entry being deleted,
  // so CenterPanel can't auto-save the file back to disk after deletion.
  const handleCloseDiaryEntry = useCallback((dateStr: string) => {
    const expectedPath = resolveDiaryPath(dateStr)
    if (selectedPathRef.current === expectedPath) {
      skipFlushRef.current = true
      setNavHistory([])
      setSelectedPath(null)
      setSelectedName(null)
      setOpenInEditMode(false)
      setIsNewNote(false)
      setOpenNoteContent('')
    }
  }, [])

  useEffect(() => {
    if (focusedCalendarEvent) setFeatureZone('calendar')
  }, [focusedCalendarEvent])

  useEffect(() => {
    return window.cortex.menu.onOpenSettings((category) => handleOpenSettings(category))
  }, [handleOpenSettings])

  useEffect(() => {
    return window.cortex.menu.onOpenEncryptedFile(() => setOpenEncryptedFileModal(true))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setShowSearchPalette((open) => !open)
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [])

  const handleSearchResultSelect = useCallback((result: SearchResult) => {
    if (result.type === 'tag') {
      setActiveTag(result.title.replace(/^#/, ''))
      return
    }
    if (result.path) {
      void handleSelectPath(result.path, result.title, { fromLink: true })
    }
  }, [handleSelectPath])

  useEffect(() => {
    if (!error) return
    const timer = setTimeout(dismissError, 8000)
    return () => clearTimeout(timer)
  }, [error, dismissError])

  if (vaultStatus === null) {
    return null
  }

  if (!vaultStatus.configured) {
    return (
      <ThemeProvider vaultReady={false}>
        <VaultSetup onComplete={handleVaultComplete} onError={handleError} />
        {error && (
          <div className="error-banner vault-error">
            <span>{error}</span>
            <button onClick={dismissError}>Dismiss</button>
          </div>
        )}
        <OpenEncryptedFileModal
          open={openEncryptedFileModal}
          onClose={() => setOpenEncryptedFileModal(false)}
        />
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider vaultReady={vaultReady}>
      <TextSizeProvider vaultReady={vaultReady}>
      <FontProvider vaultReady={vaultReady}>
      <div className="cortex-app">
        <LeftPanel
          zone={zone}
          onZoneChange={handleZoneChange}
          selectedPath={selectedPath}
          onSelectPath={handleSelectPath}
          onGoToVaultRoot={handleGoToVaultRoot}
          onCloseOpenFile={handleCloseOpenFile}
          selectedContact={selectedContact}
          onSelectContact={handleSelectContact}
          activeTag={activeTag}
          onTagSelect={setActiveTag}
          refreshKey={refreshKey}
          onRefresh={refresh}
          onError={handleError}
          vaultName={vaultStatus.name}
          onCloseVault={handleCloseVault}
          onSearchResultSelect={handleSearchResultSelect}
          onOpenSettings={() => handleOpenSettings()}
        />
        <div className="cortex-main">
          {error && (
            <div className="error-banner">
              <span>{error}</span>
              <button onClick={dismissError}>Dismiss</button>
            </div>
          )}
          {settingsOpen ? (
            <SettingsView
              key={settingsRequestId}
              initialCategory={settingsCategory}
              canGoBack={navHistory.length > 0}
              onNavBack={handleNavBack}
              onClose={handleCloseSettings}
              onError={handleError}
            />
          ) : creatingEventDate ? (
            <CreateEventView
              date={creatingEventDate}
              canGoBack={navHistory.length > 0}
              onNavBack={handleNavBack}
              onClose={handleCloseCreateEvent}
              onCreated={handleEventCreated}
              onError={handleError}
            />
          ) : (
            <CenterPanel
              zone={zone}
              selectedPath={selectedPath}
              selectedName={selectedName}
              selectedContact={selectedContact}
              selectedEvent={selectedEvent}
              openInEditMode={openInEditMode}
              isNewNote={isNewNote}
              skipFlushRef={skipFlushRef}
              canGoBack={navHistory.length > 0}
              onNavBack={handleNavBack}
              onNoteRenamed={handleNoteRenamed}
              onOpenNote={handleSelectPath}
              onNoteSaved={handleNoteSaved}
              onContactUpdated={setSelectedContact}
              onOpenContact={handleOpenContactFromMention}
              onOpenDiaryEntry={handleOpenDiaryEntry}
              onCloseDiaryEntry={handleCloseDiaryEntry}
              onEventDeleted={handleEventDeleted}
              onRefresh={refresh}
              onError={handleError}
              vaultName={vaultStatus.name}
              onCloseFile={handleCloseOpenFile}
              onContentChange={setOpenNoteContent}
            />
          )}
        </div>
        <RightPanel
          featureZone={featureZone}
          onFeatureZoneChange={setFeatureZone}
          selectedPath={selectedPath}
          noteContent={openNoteContent}
          onOpenNote={handleSelectPath}
          refreshKey={refreshKey}
          diaryRefreshKey={diaryRefreshKey}
          onError={handleError}
          onRefresh={refresh}
          focusEvent={focusedCalendarEvent}
          onClearFocusEvent={() => setFocusedCalendarEvent(null)}
          onOpenDiaryEntry={handleOpenDiaryEntry}
          onCloseDiaryEntry={handleCloseDiaryEntry}
          onOpenEvent={handleOpenCalendarEvent}
          onOpenContact={handleOpenContactFromMention}
          onCreateEvent={handleOpenCreateEvent}
          openEventId={selectedEvent?.id ?? null}
        />
      </div>
      <SearchPalette
        open={showSearchPalette}
        onClose={() => setShowSearchPalette(false)}
        onResultSelect={handleSearchResultSelect}
      />
      <OpenEncryptedFileModal
        open={openEncryptedFileModal}
        onClose={() => setOpenEncryptedFileModal(false)}
      />
      </FontProvider>
      </TextSizeProvider>
    </ThemeProvider>
  )
}
