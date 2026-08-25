import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect, type MutableRefObject, type ReactNode } from 'react'
import { FileDown, Paperclip, Hash, Lock } from 'lucide-react'
import MarkdownEditor, { type MarkdownEditorHandle } from './MarkdownEditor'
import MarkdownPreview from './MarkdownPreview'
import MarkdownToolbar from './MarkdownToolbar'
import ModeToggle from './ModeToggle'
import TagsPopup from './TagsPopup'
import ActionRow from './ActionRow'
import ActionButton from './ActionButton'
import ConfirmDialog from './ConfirmDialog'
import PasswordPrompt from './PasswordPrompt'
import { UNTITLED_CONTACT, UNTITLED_NOTE, diaryDateFromPath, isDiaryPath, isEncryptedPath, isValidDiaryDate } from '@cortex/core'
import { buildPdfHtml } from '../utils/pdf'
import { attachmentMarkdown } from '../utils/markdown'
import NotePathHeader from './NotePathHeader'
import AppLogo from './AppLogo'
import { extractNoteTitle } from '../utils/note-meta'
import { stripTagsBlock, withTagsBlock } from '../utils/note-tags'
import { formatEncryptionError } from '../utils/encryption-error'
import { pathDir } from './FileBrowser'
import { resolveWikiLinkPath } from '../utils/wiki-links'
import { resolveContactMentionName } from '../utils/contact-mentions'
import CalendarEventView from './CalendarEventView'
import type { AppZone, CalendarEvent, EditorMode, Contact } from '../types'
import type { MarkdownAction } from '../utils/markdown'
import '../styles/center-panel.css'

/**
 * Strip the `# YYYY-MM-DD` heading from diary body content so the editor
 * only shows the writable body. The heading is re-injected on save.
 */
function stripDiaryHeading(body: string): string {
  return body.replace(/^#\s+\d{4}-\d{2}-\d{2}\s*\n?/, '')
}

/** Positions the Encrypt/Decrypt button at the true midpoint between the
 *  mode-toggle cluster and the Close/Delete group — not a CSS flex trick,
 *  because `.action-row-center` is `position: fixed` (viewport-anchored,
 *  see ActionRow.css) while `.action-row-right` is a normal-flow 50/50
 *  split of *this component's own* width. Those two coordinate systems
 *  disagree (same asymmetric-sidebar issue `.action-row-center` itself was
 *  built to dodge — see CLAUDE.md), and on a narrower window the naive
 *  50/50 split's left edge lands *before* the fixed cluster's real right
 *  edge, rendering this button underneath the (higher z-index) toggle
 *  instead of beside it. Measuring both edges directly, the same way
 *  NotePathHeader.tsx measures `.action-row-center`'s left edge, sidesteps
 *  the mismatch entirely. */
function EncryptMidpointAnchor({ children }: { children: ReactNode }) {
  const anchorRef = useRef<HTMLDivElement>(null)
  const recomputeRef = useRef<() => void>(() => {})
  recomputeRef.current = () => {
    const el = anchorRef.current
    if (!el) return
    const centerEl = document.querySelector('.action-row-center')
    const rightGroupEl = document.querySelector('.action-row-close-delete-group')
    const centerRect = centerEl?.getBoundingClientRect()
    const rightRect = rightGroupEl?.getBoundingClientRect()
    if (!centerRect || !rightRect) return
    // At larger Text Size settings the available gap can shrink to less
    // than this button's own width (the mode-toggle cluster is fixed-width
    // and centered on the *window*, while Close/Delete sit right-anchored
    // within the center-panel's own — zoom-shrinking — width, so the gap
    // between them isn't guaranteed to fit a centered button). Clamp so
    // the button never overlaps Close/Delete — and, symmetrically, never
    // overlaps the mode-toggle cluster — rather than always centering
    // exactly on the midpoint regardless of how little room is there.
    const halfWidth = el.getBoundingClientRect().width / 2 || 38
    // Matches --gap-sm (ui-sizing.css), the same token
    // `.action-row-close-delete-group`'s `gap` reads, so Encrypt→Close
    // reads the same as Close→Delete when this clamp is the thing
    // deciding the spacing (i.e. once space gets tight — at roomier sizes
    // the natural centered midpoint already clears this by a wide margin,
    // so this value only bites at larger Text Size settings). Can't read
    // the CSS variable directly here (this is a plain number used in
    // pixel math, not a style property), so keep in sync by hand if
    // --gap-sm ever changes.
    const minGap = 10
    const naturalMidpoint = (centerRect.right + rightRect.left) / 2
    const midpointMax = rightRect.left - minGap - halfWidth
    const midpointMin = centerRect.right + minGap + halfWidth
    const midpoint = Math.min(Math.max(naturalMidpoint, midpointMin), midpointMax)
    el.style.left = `${midpoint}px`
  }

  // Mount-only: a single, stable listener/observer pair for this anchor's
  // whole lifetime (mirrors NotePathHeader.tsx's same pattern, and for the
  // same reason — recreating it on every render would risk a stale
  // ResizeObserver callback overwriting a fresher recompute).
  useLayoutEffect(() => {
    const handleResize = () => recomputeRef.current()
    window.addEventListener('resize', handleResize)
    const rowEl = document.querySelector('.action-row')
    const resizeObserver = rowEl ? new ResizeObserver(handleResize) : null
    resizeObserver?.observe(rowEl as Element)
    return () => {
      window.removeEventListener('resize', handleResize)
      resizeObserver?.disconnect()
    }
  }, [])

  // Recompute on every render (children swap between ENCRYPT/DECRYPT, or
  // the note changes) — cheap, and avoids needing an exhaustive dep list.
  useLayoutEffect(() => {
    recomputeRef.current()
  })

  return (
    <div ref={anchorRef} className="encrypt-midpoint-anchor">
      {children}
    </div>
  )
}

/**
 * Re-inject the diary date heading before writing to disk so the file
 * always starts with `# YYYY-MM-DD` (required for syncNoteFilename).
 */
function injectDiaryHeading(notePath: string, body: string): string {
  const date = diaryDateFromPath(notePath)
  if (!date) return body
  // Don't double-inject if body already starts with the heading
  if (/^#\s+\d{4}-\d{2}-\d{2}/.test(body)) return body
  return `# ${date}\n\n${body}`
}

interface CenterPanelProps {
  zone: AppZone
  selectedPath: string | null
  selectedName: string | null
  selectedContact: Contact | null
  selectedEvent?: CalendarEvent | null
  openInEditMode: boolean
  isNewNote?: boolean
  skipFlushRef?: MutableRefObject<boolean>
  canGoBack?: boolean
  onNavBack?: () => void
  onNoteRenamed?: (path: string, name: string) => void
  onOpenNote?: (path: string, name: string, opts?: { isNew?: boolean; fromLink?: boolean }) => void
  onNoteSaved?: () => void
  onContactUpdated?: (contact: Contact) => void
  onOpenContact?: (contact: Contact) => void
  onOpenDiaryEntry?: (dateStr: string) => void
  onCloseDiaryEntry?: (dateStr: string) => void
  onEventDeleted?: () => void
  onRefresh: () => void
  onError: (msg: string) => void
  vaultName: string | null
  onCloseFile?: () => void
  onContentChange?: (content: string) => void
}

export default function CenterPanel({
  zone,
  selectedPath,
  selectedName,
  selectedContact,
  selectedEvent,
  openInEditMode,
  isNewNote = false,
  skipFlushRef,
  canGoBack = false,
  onNavBack,
  onNoteRenamed,
  onOpenNote,
  onNoteSaved,
  onContactUpdated,
  onOpenContact,
  onOpenDiaryEntry,
  onCloseDiaryEntry,
  onEventDeleted,
  onRefresh,
  onError,
  vaultName,
  onCloseFile,
  onContentChange,
}: CenterPanelProps) {
  const [content, setContent] = useState('')
  const [editorDocumentKey, setEditorDocumentKey] = useState(0)
  const [editorInitialValue, setEditorInitialValue] = useState('')
  const [noteTags, setNoteTagsState] = useState<string[]>([])
  const [mode, setMode] = useState<EditorMode>('read')
  const [activeFormatActions, setActiveFormatActions] = useState<MarkdownAction[]>([])
  const [showTagsPopup, setShowTagsPopup] = useState(false)
  const [contactMode, setContactMode] = useState<EditorMode>('read')
  const [pendingDeleteNote, setPendingDeleteNote] = useState(false)
  const [pendingDeleteContact, setPendingDeleteContact] = useState(false)
  // Optional per-file encryption (notes only). `lockedNotePath` is set when
  // the selected note is `.md.enc` and hasn't been unlocked this session —
  // the normal editor/preview don't render at all while it's set, see the
  // early-return branch below. `notePasswordRef` caches the verified
  // password for whichever encrypted note is currently unlocked, so
  // autosave (scheduleSave -> saveNote) can silently re-encrypt on every
  // save without re-prompting, and closing/switching notes clears it.
  const [lockedNotePath, setLockedNotePath] = useState<string | null>(null)
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [pendingEncryptNote, setPendingEncryptNote] = useState(false)
  const [pendingDecryptNote, setPendingDecryptNote] = useState(false)
  const [decryptNoteError, setDecryptNoteError] = useState<string | null>(null)
  const notePasswordRef = useRef<{ path: string; password: string } | null>(null)
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    notes: '',
    tags: '',
  })
  const editorRef = useRef<MarkdownEditorHandle>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const renameTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const displayTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRenameRef = useRef<{ path: string; content: string } | null>(null)
  const contactSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveLockRef = useRef<Promise<void> | null>(null)
  const skipLoadRef = useRef(false)
  const loadGenerationRef = useRef(0)
  const savingPathRef = useRef<string | null>(selectedPath)
  const selectedPathRef = useRef(selectedPath)
  const noteTagsRef = useRef(noteTags)
  const contentRef = useRef(content)
  const contactFormRef = useRef(contactForm)
  const contactModeRef = useRef<EditorMode>('read')
  const selectedContactRef = useRef(selectedContact)
  const loadedContactIdRef = useRef<string | null>(null)
  const newNoteInitPathRef = useRef<string | null>(null)
  const loadedNotePathRef = useRef<string | null>(null)
  const prevSelectedPathRef = useRef<string | null>(null)
  const preserveModeOnPathChangeRef = useRef(false)
  const [editorSessionKey, setEditorSessionKey] = useState<string | null>(null)
  const [pageContacts, setPageContacts] = useState<Contact[]>([])
  const pageContactsRef = useRef<Contact[]>([])

  selectedPathRef.current = selectedPath
  contentRef.current = content
  noteTagsRef.current = noteTags
  pageContactsRef.current = pageContacts

  useEffect(() => {
    savingPathRef.current = selectedPath
    selectedPathRef.current = selectedPath
  }, [selectedPath])

  useEffect(() => {
    if (zone === 'contacts') return
    let cancelled = false
    void window.cortex.contacts.list().then((data) => {
      if (!cancelled) setPageContacts(data)
    }).catch(() => {})
    return () => {
      cancelled = true
    }
  }, [zone, selectedPath])

  const contactNames = useMemo(() => pageContacts.map((c) => c.name), [pageContacts])

  const reportSaveError = useCallback(
    (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to save'
      onError(message.startsWith('Failed') ? message : `Failed to save: ${message}`)
    },
    [onError]
  )

  const applyLoadedContent = useCallback(
    (path: string, text: string) => {
      const { body, tags } = stripTagsBlock(text)
      // For diary notes, hide the date heading from the editor — it's shown
      // as a styled header in read mode and re-injected on save.
      const editorBody = isDiaryPath(path) ? stripDiaryHeading(body) : body
      loadedNotePathRef.current = path
      setNoteTagsState(tags)
      setContent(editorBody)
      contentRef.current = editorBody
      setEditorInitialValue(editorBody)
      setEditorDocumentKey((k) => k + 1)
      setEditorSessionKey(path)
      onContentChange?.(editorBody)
    },
    [onContentChange]
  )

  const loadNote = useCallback(async () => {
    const path = selectedPath
    if (!path) return
    if (loadedNotePathRef.current === path) return
    const generation = ++loadGenerationRef.current

    if (isEncryptedPath(path)) {
      const cached = notePasswordRef.current
      if (!cached || cached.path !== path) {
        setLockedNotePath(path)
        setUnlockError(null)
        return
      }
      try {
        const text = await window.cortex.encryption.read(path, cached.password)
        if (generation !== loadGenerationRef.current || selectedPathRef.current !== path) return
        setLockedNotePath(null)
        applyLoadedContent(path, text)
      } catch {
        // Cached password stopped working somehow (e.g. the file was
        // re-encrypted externally) — fall back to asking again rather
        // than silently failing.
        notePasswordRef.current = null
        setLockedNotePath(path)
      }
      return
    }

    setLockedNotePath(null)
    try {
      const text = await window.cortex.storage.readFile(path)
      if (generation !== loadGenerationRef.current || selectedPathRef.current !== path) return
      applyLoadedContent(path, text)
    } catch {
      onError('Failed to load note')
    }
  }, [selectedPath, onError, applyLoadedContent])

  useLayoutEffect(() => {
    if (prevSelectedPathRef.current === selectedPath) return
    prevSelectedPathRef.current = selectedPath
    // Session-cached unlock password is only valid for the note it was
    // verified against — navigating away (to a different note, or away
    // entirely) invalidates it, so the next visit always re-prompts.
    if (notePasswordRef.current && notePasswordRef.current.path !== selectedPath) {
      notePasswordRef.current = null
    }
    if (skipLoadRef.current) {
      skipLoadRef.current = false
      return
    }
    newNoteInitPathRef.current = null
    loadedNotePathRef.current = null
    setEditorSessionKey(null)
  }, [selectedPath])

  useLayoutEffect(() => {
    if (!selectedPath || !isNewNote) return
    if (newNoteInitPathRef.current === selectedPath) return
    newNoteInitPathRef.current = selectedPath
    loadedNotePathRef.current = selectedPath
    // Diary entries: start blank — the heading is stored on disk but hidden in edit mode
    const initial = isDiaryPath(selectedPath) ? '' : `# ${UNTITLED_NOTE}\n\n`
    setNoteTagsState([])
    setContent(initial)
    contentRef.current = initial
    setEditorInitialValue(initial)
    setEditorDocumentKey((k) => k + 1)
    setEditorSessionKey(selectedPath)
    onContentChange?.(initial)
  }, [selectedPath, isNewNote, onContentChange])

  useLayoutEffect(() => {
    if (!selectedPath) return
    if (preserveModeOnPathChangeRef.current) {
      preserveModeOnPathChangeRef.current = false
      return
    }
    setMode(openInEditMode ? 'edit' : 'read')
  }, [selectedPath, openInEditMode])

  const isNewNoteRef = useRef(isNewNote)
  isNewNoteRef.current = isNewNote

  const loadNoteRef = useRef(loadNote)
  loadNoteRef.current = loadNote

  useEffect(() => {
    if (!selectedPath) return
    if (skipLoadRef.current) {
      skipLoadRef.current = false
      return
    }
    if (isNewNoteRef.current) return
    if (loadedNotePathRef.current === selectedPath) return
    void loadNoteRef.current()
  }, [selectedPath])

  const saveNote = useCallback(
    async (val: string, tags: string[]) => {
      const flushRename = async (notePath: string, fullContent: string) => {
        try {
          const nextPath = await window.cortex.storage.syncNoteFilename(notePath, fullContent)
          if (nextPath !== notePath) {
            skipLoadRef.current = true
            preserveModeOnPathChangeRef.current = true
            savingPathRef.current = nextPath
            selectedPathRef.current = nextPath
            loadedNotePathRef.current = nextPath
            setEditorSessionKey(nextPath)
            const newName = nextPath.split('/').pop()?.replace(/\.md$/, '') ?? 'Note'
            onNoteRenamed?.(nextPath, newName)
            onRefresh()
          }
        } catch {
          // Content saved; filename sync can fail without blocking save
        }
      }

      const run = async () => {
        const notePath = savingPathRef.current
        if (!notePath) return

        // For diary notes, the editor content has the heading stripped — restore it
        const bodyToSave = isDiaryPath(notePath) ? injectDiaryHeading(notePath, val) : val
        const fullContent = withTagsBlock(bodyToSave, tags)

        if (isEncryptedPath(notePath)) {
          // Re-encrypts in place with the password cached from unlocking —
          // no filename-sync (there's no title to derive a name from
          // without decrypting, and the .md.enc name is fixed anyway).
          const cached = notePasswordRef.current
          if (cached && cached.path === notePath) {
            await window.cortex.encryption.write(notePath, fullContent, cached.password)
            onNoteSaved?.()
          }
          return
        }

        await window.cortex.storage.writeFile(notePath, fullContent)
        pendingRenameRef.current = { path: notePath, content: fullContent }
        if (renameTimer.current) clearTimeout(renameTimer.current)
        renameTimer.current = setTimeout(() => {
          const pending = pendingRenameRef.current
          if (!pending) return
          pendingRenameRef.current = null
          void flushRename(pending.path, pending.content)
        }, 2000)
        onNoteSaved?.()
      }

      while (saveLockRef.current) {
        await saveLockRef.current
      }
      const op = run()
      saveLockRef.current = op
      try {
        await op
      } finally {
        if (saveLockRef.current === op) saveLockRef.current = null
      }
    },
    [onRefresh, onNoteRenamed, onNoteSaved]
  )

  const saveNoteRef = useRef(saveNote)
  saveNoteRef.current = saveNote

  useEffect(() => {
    const notePath = selectedPath

    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        saveTimer.current = null
      }
      if (renameTimer.current) {
        clearTimeout(renameTimer.current)
        renameTimer.current = null
      }
      const pending = pendingRenameRef.current
      if (pending) {
        pendingRenameRef.current = null
        void window.cortex.storage.syncNoteFilename(pending.path, pending.content).catch(() => {})
      }
      if (skipFlushRef?.current) {
        skipFlushRef.current = false
        return
      }

      const val = contentRef.current
      const tags = noteTagsRef.current
      const hasContent = val.trim().length > 0
      if (!hasContent) return

      if (!notePath) return

      // Skip flush when the file was renamed — save already handled the new path
      if (savingPathRef.current !== null && savingPathRef.current !== notePath) {
        return
      }
      savingPathRef.current = notePath
      void saveNoteRef.current(val, tags).catch(reportSaveError)
    }
  }, [selectedPath, reportSaveError, skipFlushRef])

  useEffect(() => {
    if (!selectedPath && saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
  }, [selectedPath])

  const scheduleSave = useCallback(
    (val: string, tagsOverride?: string[]) => {
      contentRef.current = val
      onContentChange?.(val)
      if (displayTimer.current) clearTimeout(displayTimer.current)
      displayTimer.current = setTimeout(() => setContent(val), 150)
      const tags = tagsOverride ?? noteTagsRef.current
      if (tagsOverride) {
        noteTagsRef.current = tagsOverride
        setNoteTagsState(tagsOverride)
      }
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        void saveNoteRef.current(val, tags).catch(reportSaveError)
      }, 400)
    },
    [reportSaveError, onContentChange]
  )

  const handleModeChange = useCallback((next: EditorMode) => {
    if (next === 'read') {
      if (displayTimer.current) clearTimeout(displayTimer.current)
      setContent(contentRef.current)
    }
    setMode(next)
    if (next === 'edit') {
      requestAnimationFrame(() => {
        editorRef.current?.refreshDecorations()
        editorRef.current?.focus()
      })
    }
  }, [])

  useEffect(() => {
    if (!selectedContact) {
      loadedContactIdRef.current = null
      return
    }

    const idChanged = loadedContactIdRef.current !== selectedContact.id
    if (!idChanged) return

    loadedContactIdRef.current = selectedContact.id
    const isNew =
      selectedContact.name === UNTITLED_CONTACT &&
      !selectedContact.email &&
      !selectedContact.phone &&
      !selectedContact.company &&
      !selectedContact.notes &&
      selectedContact.tags.length === 0
    setContactForm({
      name: selectedContact.name,
      email: selectedContact.email ?? '',
      phone: selectedContact.phone ?? '',
      company: selectedContact.company ?? '',
      notes: selectedContact.notes ?? '',
      tags: selectedContact.tags.join(', '),
    })
    setContactMode(isNew ? 'edit' : 'read')
  }, [selectedContact])

  useEffect(() => {
    contactFormRef.current = contactForm
  }, [contactForm])

  useEffect(() => {
    contactModeRef.current = contactMode
  }, [contactMode])

  useEffect(() => {
    selectedContactRef.current = selectedContact
  }, [selectedContact])

  const saveContact = useCallback(
    async (form: typeof contactForm, contact = selectedContactRef.current) => {
      if (!contact) return null
      try {
        const updated = await window.cortex.contacts.update(contact.id, {
          name: form.name.trim() || UNTITLED_CONTACT,
          email: form.email || undefined,
          phone: form.phone || undefined,
          company:
            form.company.trim() && form.company.trim().toLowerCase() !== 'none'
              ? form.company.trim()
              : undefined,
          notes: form.notes || undefined,
          tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        })
        if (!updated) {
          onError('Failed to save contact')
          return null
        }
        selectedContactRef.current = updated
        onContactUpdated?.(updated)
        onRefresh()
        return updated
      } catch {
        onError('Failed to save contact')
        return null
      }
    },
    [onContactUpdated, onRefresh, onError]
  )

  useEffect(() => {
    return () => {
      if (contactSaveTimer.current) {
        clearTimeout(contactSaveTimer.current)
        contactSaveTimer.current = null
      }
      // Set by onCloseFile (App.tsx's handleCloseOpenFile) when the contact
      // was just deleted — without this, deleting a contact that's open in
      // edit mode still flushes a save to the now-gone file right after,
      // which fails and surfaces a false "Failed to save contact" error
      // even though the delete itself succeeded. Same guard the note-save
      // cleanup effect above already uses for the equivalent race.
      if (skipFlushRef?.current) {
        skipFlushRef.current = false
        return
      }
      const contact = selectedContactRef.current
      if (!contact || contactModeRef.current !== 'edit') return
      void saveContact(contactFormRef.current, contact)
    }
  }, [selectedContact?.id, saveContact, skipFlushRef])

  const scheduleContactSave = useCallback(
    (form: typeof contactForm) => {
      if (contactSaveTimer.current) clearTimeout(contactSaveTimer.current)
      contactSaveTimer.current = setTimeout(() => {
        void saveContact(form)
      }, 600)
    },
    [saveContact]
  )

  const handleWikiLinkNavigate = useCallback(
    async (title: string) => {
      if (!selectedPath) return
      try {
        if (saveTimer.current) {
          clearTimeout(saveTimer.current)
          saveTimer.current = null
        }
        await saveNoteRef.current(contentRef.current, noteTagsRef.current)

        // [[YYYY-MM-DD]] always refers to a diary entry — resolve/create it
        // directly rather than treating it as a plain note title.
        const trimmedTitle = title.trim()
        if (isValidDiaryDate(trimmedTitle)) {
          const diaryPath = await window.cortex.storage.openDiaryEntry(trimmedTitle)
          onRefresh()
          onOpenNote?.(diaryPath, trimmedTitle, { isNew: false, fromLink: true })
          return
        }

        // Search notes and diary for the link target
        const [notesFiles, diaryFiles] = await Promise.all([
          window.cortex.storage.listFiles('notes'),
          window.cortex.storage.listFiles('diary'),
        ])
        const allFiles = [...notesFiles, ...diaryFiles]

        const resolved = await resolveWikiLinkPath(
          title,
          allFiles,
          (path) => window.cortex.storage.readFile(path)
        )

        if (resolved) {
          const name = resolved.split('/').pop()?.replace(/\.md$/, '') ?? title
          // Zone is inferred in openNoteAtPath in App based on path prefix
          onOpenNote?.(resolved, name, { isNew: false, fromLink: true })
          return
        }

        // Create new note in notes (not diary — diary entries are date-locked)
        const createFolder = isDiaryPath(selectedPath) ? 'notes' : pathDir(selectedPath)
        const entry = await window.cortex.storage.createNoteWithTitle(createFolder, title)
        onRefresh()
        onOpenNote?.(entry.path, entry.name, { isNew: false, fromLink: true })
      } catch {
        onError('Failed to open linked note')
      }
    },
    [selectedPath, onOpenNote, onRefresh, onError]
  )

  const handleContactMentionClick = useCallback(
    async (name: string) => {
      const match = resolveContactMentionName(name, pageContactsRef.current)
      if (!match) return
      try {
        if (saveTimer.current) {
          clearTimeout(saveTimer.current)
          saveTimer.current = null
        }
        if (selectedPathRef.current) {
          await saveNoteRef.current(contentRef.current, noteTagsRef.current)
        }
        onOpenContact?.(match)
      } catch {
        onError('Failed to open contact')
      }
    },
    [onOpenContact, onError]
  )

  const handleWikiLinkEnsure = useCallback(
    async (title: string) => {
      if (!selectedPath) return
      try {
        const trimmedTitle = title.trim()
        if (isValidDiaryDate(trimmedTitle)) {
          await window.cortex.storage.openDiaryEntry(trimmedTitle)
          onRefresh()
          return
        }

        const [notesFiles, diaryFiles] = await Promise.all([
          window.cortex.storage.listFiles('notes'),
          window.cortex.storage.listFiles('diary'),
        ])
        const allFiles = [...notesFiles, ...diaryFiles]
        const resolved = await resolveWikiLinkPath(
          title,
          allFiles,
          (path) => window.cortex.storage.readFile(path)
        )
        if (resolved) return

        const createFolder = isDiaryPath(selectedPath) ? 'notes' : pathDir(selectedPath)
        const entry = await window.cortex.storage.createNoteWithTitle(createFolder, title)
        if (entry.created) onRefresh()
      } catch {
        onError('Failed to create linked note')
      }
    },
    [selectedPath, onRefresh, onError]
  )

  const handleExportPdf = async () => {
    const body = contentRef.current
    const diaryDate = selectedPath ? diaryDateFromPath(selectedPath) : null
    const title = diaryDate ?? (selectedPath ? extractNoteTitle(body) : selectedName ?? 'Note')
    // Notes' body already starts with its `# Title` line; diary entries
    // have that heading stripped for editing (see stripDiaryHeading), so
    // it needs adding back here — otherwise the export would have no
    // title at all instead of one printed twice.
    const markdownForExport = diaryDate ? `# ${title}\n\n${body}` : body
    try {
      await window.cortex.export.pdf(buildPdfHtml(markdownForExport), title.replace(/\s+/g, '-'))
    } catch {
      onError('Failed to export PDF')
    }
  }

  const handleAddAttachment = async () => {
    const folder = selectedPath ? pathDir(selectedPath) : ''
    try {
      const att = await window.cortex.attachments.add(folder)
      if (att) {
        const md = attachmentMarkdown(att.path, att.name)
        const current = contentRef.current
        scheduleSave(current + (current.endsWith('\n') ? '' : '\n') + md + '\n')
        editorRef.current?.focus()
      }
    } catch {
      onError('Failed to add attachment')
    }
  }

  const confirmDeleteNote = async () => {
    setPendingDeleteNote(false)
    const path = selectedPath
    if (!path) return
    const isDiary = isDiaryPath(path)
    try {
      if (isDiary) {
        const dateStr = diaryDateFromPath(path)
        if (dateStr) onCloseDiaryEntry?.(dateStr)
      } else {
        onCloseFile?.()
      }
      await window.cortex.storage.deleteFile(path)
      onRefresh()
    } catch {
      onError(`Failed to delete ${isDiary ? 'diary entry' : 'note'}`)
    }
  }

  const handleUnlockNote = async (password: string) => {
    const path = lockedNotePath
    if (!path) return
    try {
      const text = await window.cortex.encryption.read(path, password)
      notePasswordRef.current = { path, password }
      setUnlockError(null)
      setLockedNotePath(null)
      applyLoadedContent(path, text)
    } catch (err) {
      setUnlockError(formatEncryptionError(err))
    }
  }

  const confirmEncryptNote = async (password: string) => {
    const path = selectedPath
    if (!path) return
    try {
      onCloseFile?.()
      await window.cortex.encryption.encrypt(path, password)
      setPendingEncryptNote(false)
      onRefresh()
    } catch {
      onError('Failed to encrypt note')
    }
  }

  // Two entry points: the note is already unlocked this session (password
  // cached — just confirm, no need to re-ask for it) or it's still locked
  // (the PasswordPrompt IS the verification step, matching decryptNote's
  // "verify before mutating anything" behavior in storage.ts).
  const alreadyUnlockedPassword =
    selectedPath && notePasswordRef.current?.path === selectedPath ? notePasswordRef.current.password : null

  const confirmDecryptUnlocked = async () => {
    const path = selectedPath
    if (!path || !alreadyUnlockedPassword) return
    try {
      onCloseFile?.()
      await window.cortex.encryption.decrypt(path, alreadyUnlockedPassword)
      notePasswordRef.current = null
      setPendingDecryptNote(false)
      onRefresh()
    } catch {
      onError('Failed to decrypt note')
    }
  }

  const handleDecryptLocked = async (password: string) => {
    const path = selectedPath
    if (!path) return
    try {
      await window.cortex.encryption.decrypt(path, password)
      notePasswordRef.current = null
      setLockedNotePath(null)
      setDecryptNoteError(null)
      setPendingDecryptNote(false)
      onCloseFile?.()
      onRefresh()
    } catch (err) {
      setDecryptNoteError(formatEncryptionError(err))
    }
  }

  const confirmDeleteContact = async () => {
    setPendingDeleteContact(false)
    if (!selectedContact) return
    try {
      await window.cortex.contacts.delete(selectedContact.id)
      onCloseFile?.()
      onRefresh()
    } catch {
      onError('Failed to delete contact')
    }
  }

  const updateContactForm = (patch: Partial<typeof contactForm>) => {
    setContactForm((prev) => {
      const next = { ...prev, ...patch }
      if (contactMode === 'edit') scheduleContactSave(next)
      return next
    })
  }

  const handleApplyTags = (tags: string[]) => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    noteTagsRef.current = tags
    setNoteTagsState(tags)
    setShowTagsPopup(false)
    // Save immediately (skip the debounce) and refresh once it lands, so
    // the tag legend doesn't keep showing stale tags for the file.
    void saveNoteRef.current(contentRef.current, tags)
      .then(() => onRefresh())
      .catch(reportSaveError)
  }

  const contactTagList = contactForm.tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

  const handleApplyContactTags = (tags: string[]) => {
    if (contactSaveTimer.current) {
      clearTimeout(contactSaveTimer.current)
      contactSaveTimer.current = null
    }
    const next = { ...contactForm, tags: tags.join(', ') }
    setContactForm(next)
    setShowTagsPopup(false)
    // saveContact refreshes the tag legend internally once the write lands.
    void saveContact(next)
  }

  if (selectedEvent) {
    return (
      <CalendarEventView
        event={selectedEvent}
        canGoBack={canGoBack}
        onNavBack={onNavBack}
        onClose={onCloseFile}
        onOpenContact={onOpenContact ?? (() => {})}
        onOpenNote={onOpenNote ?? (() => {})}
        onOpenDiaryEntry={onOpenDiaryEntry ?? (() => {})}
        onError={onError}
        onRefresh={onRefresh}
        onEventDeleted={onEventDeleted ?? (() => {})}
      />
    )
  }

  if (zone === 'contacts') {
    if (!selectedContact) {
      return (
        <main className="center-panel">
          <ActionRow />
          <div className="empty-state">
            <AppLogo variant="mark" size="xxxl" className="empty-state-logo" />
            <p>Select or create a contact</p>
          </div>
        </main>
      )
    }

    return (
      <main className="center-panel">
        <ActionRow
          left={<span className="center-title">{contactForm.name.trim() || UNTITLED_CONTACT}</span>}
          center={
            <>
              <ActionButton main="GO" sub="BACK" disabled={!canGoBack} onClick={() => onNavBack?.()} />
              <ModeToggle mode={contactMode} onChange={setContactMode} />
              <span className="action-row-ghost" aria-hidden="true">
                <ActionButton main="GO" sub="BACK" disabled onClick={() => {}} />
              </span>
            </>
          }
          right={
            <>
              {onCloseFile && <ActionButton main="CLOSE" sub="CONTACT" onClick={onCloseFile} />}
              <ActionButton main="DELETE" sub="CONTACT" variant="danger" onClick={() => setPendingDeleteContact(true)} />
            </>
          }
        />

        {contactMode === 'read' ? (
          <div className="contact-view note-canvas">
            <div className="contact-view-body">
              <h1 className="contact-view-name">{contactForm.name.trim() || UNTITLED_CONTACT}</h1>
              {contactForm.company && (
                <p className="contact-view-company">{contactForm.company}</p>
              )}
              <div className="contact-view-details">
                {contactForm.email && (
                  <div className="contact-view-row">
                    <span className="contact-view-label">Email</span>
                    <span>{contactForm.email}</span>
                  </div>
                )}
                {contactForm.phone && (
                  <div className="contact-view-row">
                    <span className="contact-view-label">Phone</span>
                    <span>{contactForm.phone}</span>
                  </div>
                )}
                {contactTagList.length > 0 && (
                  <div className="contact-view-row">
                    <span className="contact-view-label">Tags</span>
                    <span className="contact-tags-row">
                      {contactTagList.map((tag) => (
                        <span key={tag} className="note-tag-chip">#{tag}</span>
                      ))}
                    </span>
                  </div>
                )}
              </div>
              {contactForm.notes && (
                <div className="contact-view-notes">
                  <span className="contact-view-label">Notes</span>
                  <p>{contactForm.notes}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="contact-form note-canvas">
            <div className="contact-form-body">
              <div className="form-group">
                <label>Name</label>
                <input
                  value={contactForm.name}
                  placeholder={UNTITLED_CONTACT}
                  onChange={(e) => updateContactForm({ name: e.target.value })}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Email</label>
                  <input value={contactForm.email} onChange={(e) => updateContactForm({ email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input value={contactForm.phone} onChange={(e) => updateContactForm({ phone: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Company</label>
                <input value={contactForm.company} onChange={(e) => updateContactForm({ company: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Tags</label>
                <div className="contact-tags-row">
                  {contactTagList.length > 0 ? (
                    contactTagList.map((tag) => (
                      <span key={tag} className="note-tag-chip">#{tag}</span>
                    ))
                  ) : (
                    <span className="contact-tags-empty">No tags yet</span>
                  )}
                  <button type="button" className="toolbar-btn" onClick={() => setShowTagsPopup(true)}>
                    <Hash size={13} /> Manage tags
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea rows={6} value={contactForm.notes} onChange={(e) => updateContactForm({ notes: e.target.value })} />
              </div>
            </div>
          </div>
        )}

        {showTagsPopup && (
          <TagsPopup
            tags={contactTagList}
            onApply={handleApplyContactTags}
            onClose={() => setShowTagsPopup(false)}
          />
        )}

        <ConfirmDialog
          open={pendingDeleteContact}
          title="Delete contact"
          message={`Are you sure you want to delete "${contactForm.name.trim() || UNTITLED_CONTACT}"? This cannot be undone.`}
          onConfirm={confirmDeleteContact}
          onCancel={() => setPendingDeleteContact(false)}
        />
      </main>
    )
  }

  if (!selectedPath) {
    return (
      <main className="center-panel">
        <ActionRow />
        <div className="empty-state">
          <AppLogo variant="mark" size="xxxl" className="empty-state-logo" />
          <p>{zone === 'diary' ? 'Select a diary entry' : 'Select a note or create a new one'}</p>
        </div>
      </main>
    )
  }

  const editorSessionReady = editorSessionKey === selectedPath
  const isDiary = isDiaryPath(selectedPath)
  const diaryDate = isDiary ? diaryDateFromPath(selectedPath) : null
  const noteNoun = isDiary ? 'PAGE' : 'NOTE'
  const isEncryptedNote = isEncryptedPath(selectedPath)

  if (lockedNotePath === selectedPath) {
    return (
      <main className="center-panel">
        <ActionRow
          left={<span className="center-title">{selectedName ?? 'Encrypted note'}</span>}
          right={
            <>
              <EncryptMidpointAnchor>
                <ActionButton main="DECRYPT" sub={noteNoun} variant="danger" onClick={() => setPendingDecryptNote(true)} />
              </EncryptMidpointAnchor>
              <span className="action-row-close-delete-group">
                {onCloseFile && <ActionButton main="CLOSE" sub={noteNoun} onClick={onCloseFile} />}
                <ActionButton main="DELETE" sub={noteNoun} variant="danger" onClick={() => setPendingDeleteNote(true)} />
              </span>
            </>
          }
        />
        <div className="empty-state">
          <Lock size={48} className="empty-state-logo" />
          <p>This {isDiary ? 'page' : 'note'} is encrypted</p>
        </div>
        <PasswordPrompt
          open
          mode="unlock"
          title="Enter password"
          actionLabel="Unlock"
          error={unlockError}
          onSubmit={handleUnlockNote}
          onCancel={() => onCloseFile?.()}
        />
        <PasswordPrompt
          open={pendingDecryptNote}
          mode="unlock"
          title="Decrypt note"
          actionLabel="Decrypt"
          error={decryptNoteError}
          onSubmit={handleDecryptLocked}
          onCancel={() => { setPendingDecryptNote(false); setDecryptNoteError(null) }}
        />
        <ConfirmDialog
          open={pendingDeleteNote}
          title={`Delete ${isDiary ? 'page' : 'note'}`}
          message={`Are you sure you want to delete this encrypted ${isDiary ? 'page' : 'note'}? This cannot be undone.`}
          onConfirm={confirmDeleteNote}
          onCancel={() => setPendingDeleteNote(false)}
        />
      </main>
    )
  }

  return (
    <main className="center-panel">
      <ActionRow
        left={
          <NotePathHeader
            content={content}
            vaultName={vaultName ?? 'Vault'}
            noteRelativePath={selectedPath}
            compact
          />
        }
        center={
          <>
            <ActionButton main="GO" sub="BACK" disabled={!canGoBack} onClick={() => onNavBack?.()} />
            <ModeToggle mode={mode} onChange={handleModeChange} />
            <span className="action-row-ghost" aria-hidden="true">
              <ActionButton main="GO" sub="BACK" disabled onClick={() => {}} />
            </span>
          </>
        }
        right={
          <>
            <EncryptMidpointAnchor>
              {isEncryptedNote ? (
                <ActionButton main="DECRYPT" sub={noteNoun} variant="danger" onClick={() => setPendingDecryptNote(true)} />
              ) : (
                <ActionButton main="ENCRYPT" sub={noteNoun} onClick={() => setPendingEncryptNote(true)} />
              )}
            </EncryptMidpointAnchor>
            <span className="action-row-close-delete-group">
              {onCloseFile && <ActionButton main="CLOSE" sub={noteNoun} onClick={onCloseFile} />}
              <ActionButton main="DELETE" sub={noteNoun} variant="danger" onClick={() => setPendingDeleteNote(true)} />
            </span>
          </>
        }
      />

      {mode === 'edit' && (
        <MarkdownToolbar
          activeActions={activeFormatActions}
          onAction={(action) => editorRef.current?.toggleAction(action)}
          beforeImage={
            <button className="md-toolbar-btn" onClick={() => setShowTagsPopup(true)} title="Manage tags">
              <Hash size={15} />
            </button>
          }
          trailingContent={
            <>
              <button className="md-toolbar-btn" onClick={handleAddAttachment} title="Attach file">
                <Paperclip size={15} />
              </button>
              <button className="md-toolbar-btn" onClick={handleExportPdf} title="Export PDF">
                <FileDown size={15} />
              </button>
            </>
          }
        />
      )}

      <div className="center-body">
        <div className="note-canvas">
          <div className="note-canvas-content note-canvas-scroll">
            <div className={mode === 'edit' ? 'note-editor-layer' : 'note-editor-layer note-editor-layer-hidden'}>
              {editorSessionReady && (
                <MarkdownEditor
                  documentKey={editorDocumentKey}
                  ref={editorRef}
                  initialValue={editorInitialValue}
                  onChange={scheduleSave}
                  selectTitleOnMount={isNewNote}
                  onActiveActionsChange={setActiveFormatActions}
                  onWikiLinkClick={handleWikiLinkNavigate}
                  onWikiLinkEnsure={handleWikiLinkEnsure}
                  onContactMentionClick={handleContactMentionClick}
                  wikiLinkEnabled
                />
              )}
            </div>
            <div className={mode === 'read' ? 'note-preview-layer' : 'note-preview-layer note-preview-layer-hidden'}>
              {diaryDate && (
                <div className="diary-date-heading">{diaryDate}</div>
              )}
              <MarkdownPreview
                content={content}
                tags={noteTags}
                onWikiLinkClick={handleWikiLinkNavigate}
                onTaskToggle={scheduleSave}
                contactNames={contactNames}
                onContactClick={handleContactMentionClick}
              />
            </div>
          </div>
        </div>
      </div>

      {showTagsPopup && (
        <TagsPopup
          tags={noteTags}
          onApply={handleApplyTags}
          onClose={() => setShowTagsPopup(false)}
        />
      )}

      <ConfirmDialog
        open={pendingDeleteNote}
        title={isDiary ? 'Delete diary entry' : 'Delete note'}
        message={`Are you sure you want to delete "${selectedName ?? 'this'}"? This cannot be undone.`}
        onConfirm={confirmDeleteNote}
        onCancel={() => setPendingDeleteNote(false)}
      />

      <PasswordPrompt
        open={pendingEncryptNote}
        mode="new"
        title={`Encrypt this ${isDiary ? 'page' : 'note'}`}
        actionLabel="Encrypt"
        onSubmit={confirmEncryptNote}
        onCancel={() => setPendingEncryptNote(false)}
      />

      <ConfirmDialog
        open={pendingDecryptNote}
        title={`Decrypt this ${isDiary ? 'page' : 'note'}`}
        message={`Remove encryption from "${selectedName ?? 'this'}"? It will be saved as plain, readable text.`}
        confirmLabel="Decrypt"
        onConfirm={confirmDecryptUnlocked}
        onCancel={() => setPendingDecryptNote(false)}
      />
    </main>
  )
}
