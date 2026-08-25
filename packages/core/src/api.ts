import type {
  AttachmentEntry,
  CalendarEvent,
  Contact,
  CreateEventInput,
  FileEntry,
  SearchResult,
  StorageSection,
  TagIndex,
  TreeNode,
} from './types'
import type { CloudProvider, TextSize, ThemeMode, VaultStatus } from './vault'
import type { FontWeightLevel } from './fonts'

export interface CortexStorageAPI {
  getDataPath(): Promise<string>
  getTree(section: StorageSection): Promise<TreeNode[]>
  getVaultTree(zone?: 'notes' | 'diary'): Promise<TreeNode[]>
  listFiles(section: StorageSection): Promise<FileEntry[]>
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<boolean>
  deleteFile(path: string): Promise<boolean>
  createNote(folder?: string): Promise<FileEntry>
  createNoteWithTitle(folder: string, title: string): Promise<FileEntry & { created: boolean }>
  createFolder(folderPath: string): Promise<string>
  rename(oldPath: string, newPath: string): Promise<string>
  movePath(fromPath: string, toFolder: string): Promise<string>
  syncNoteFilename(notePath: string, content: string): Promise<string>
  openDiaryEntry(dateStr: string): Promise<string>
  /** @deprecated use openDiaryEntry */
  getDiaryPath(dateStr: string): Promise<string>
  listDiaryDates(): Promise<string[]>
}

export interface CortexAttachmentsAPI {
  list(relativeFolder: string): Promise<AttachmentEntry[]>
  add(relativeFolder: string): Promise<AttachmentEntry | null>
  delete(relativePath: string): Promise<boolean>
}

export interface CortexTagsAPI {
  index(): Promise<TagIndex[]>
}

export interface CortexSearchAPI {
  query(term: string): Promise<SearchResult[]>
}

export interface CortexCalendarAPI {
  listEvents(start: string, end: string): Promise<CalendarEvent[]>
  createEvent(event: CreateEventInput): Promise<CalendarEvent>
  updateEvent(id: string, updates: Partial<CreateEventInput>): Promise<CalendarEvent | null>
  deleteEvent(id: string): Promise<boolean>
  getByPath(relativePath: string): Promise<CalendarEvent | null>
}

export interface CortexContactsAPI {
  list(): Promise<Contact[]>
  create(contact: Omit<Contact, 'id' | 'created' | 'modified'>): Promise<Contact>
  update(id: string, updates: Partial<Omit<Contact, 'id' | 'created'>>): Promise<Contact | null>
  delete(id: string): Promise<boolean>
  getByPath(relativePath: string): Promise<Contact | null>
}

export interface CortexExportAPI {
  pdf(html: string, defaultName: string): Promise<string | null>
}

export interface CortexVaultAPI {
  getStatus(): Promise<VaultStatus>
  createNew(parentPath: string, vaultName: string): Promise<VaultStatus>
  openExisting(defaultPath?: string): Promise<VaultStatus | null>
  pickParentDirectory(defaultPath?: string): Promise<string | null>
  getCloudBasePath(provider: CloudProvider): Promise<string>
  close(): Promise<VaultStatus>
}

export interface CortexSettingsAPI {
  getTheme(): Promise<ThemeMode>
  setTheme(theme: ThemeMode): Promise<void>
  getTextSize(): Promise<TextSize>
  setTextSize(size: TextSize): Promise<void>
  getUIFont(): Promise<string>
  setUIFont(fontId: string): Promise<void>
  getUIFontWeight(): Promise<FontWeightLevel>
  setUIFontWeight(weightId: FontWeightLevel): Promise<void>
  getComposeFont(): Promise<string>
  setComposeFont(fontId: string): Promise<void>
  getComposeFontWeight(): Promise<FontWeightLevel>
  setComposeFontWeight(weightId: FontWeightLevel): Promise<void>
  exportSettings(defaultName: string): Promise<string | null>
  resetSettings(): Promise<void>
}

export interface CortexAppAPI {
  getVersion(): Promise<string>
}

export interface CortexWindowAPI {
  /** Sets Chromium's native content zoom factor for this window (the same
   *  mechanism behind Cmd/Ctrl+=/-) — scales the whole rendered UI while
   *  keeping `vh`/`%`/`window.innerHeight` internally consistent, unlike a
   *  CSS `zoom` rule on a subtree. Does NOT touch `BrowserWindow` bounds or
   *  maximized state. */
  setZoomFactor(factor: number): void
}

export interface CortexMenuAPI {
  /** Fired when the native app menu's Preferences/About Cortex items are
   *  clicked — `category` is `'about'` for About Cortex, undefined for the
   *  plain Preferences entry (defaults to the first category). Returns an
   *  unsubscribe function. */
  onOpenSettings(callback: (category?: string) => void): () => void
  /** Fired when the native app menu's "Open Encrypted File…" item is
   *  clicked — the renderer should show the standalone decrypt flow
   *  (works with no vault open). */
  onOpenEncryptedFile(callback: () => void): () => void
}

/** Optional per-file encryption. All methods throw an Error whose
 *  `message` is exactly `"Incorrect password"` on a wrong password
 *  (electron/crypto-envelope.ts's DecryptionError) — check by message
 *  text, not `instanceof`, since thrown errors don't preserve their
 *  subclass identity across the IPC boundary. */
export interface CortexEncryptionAPI {
  /** Decrypts an in-vault encrypted note (`path.md.enc`, vault-relative)
   *  without removing it. */
  read(relativePath: string, password: string): Promise<string>
  /** Re-encrypts and overwrites an in-vault encrypted note in place, with
   *  the same password it was opened with. */
  write(relativePath: string, content: string, password: string): Promise<void>
  /** `path.md` -> `path.md.enc`, deleting the plaintext original. Returns
   *  the new encrypted path. */
  encrypt(relativePath: string, password: string): Promise<string>
  /** `path.md.enc` -> plain `path.md`, deleting the encrypted file.
   *  Returns the restored plain path. */
  decrypt(relativePath: string, password: string): Promise<string>

  /** Opens a native file picker (any file, anywhere — not vault-scoped)
   *  for the standalone "someone emailed me an encrypted file" flow.
   *  Returns null if canceled. Works with no vault open. */
  pickExternalFile(): Promise<{ path: string; name: string } | null>
  /** Decrypts an arbitrary file by absolute path — the counterpart to
   *  `pickExternalFile`, independent of any open vault. */
  decryptExternalFile(absolutePath: string, password: string): Promise<{ content: string; name: string }>
  /** Opens a native save dialog and writes `content` as plaintext —
   *  "Save Decrypted Copy As…" after viewing an externally-opened
   *  encrypted file. Returns the chosen path, or null if canceled. */
  saveDecryptedCopy(defaultName: string, content: string): Promise<string | null>
}

export interface CortexAPI {
  storage: CortexStorageAPI
  attachments: CortexAttachmentsAPI
  tags: CortexTagsAPI
  search: CortexSearchAPI
  calendar: CortexCalendarAPI
  contacts: CortexContactsAPI
  export: CortexExportAPI
  vault: CortexVaultAPI
  settings: CortexSettingsAPI
  menu: CortexMenuAPI
  app: CortexAppAPI
  window: CortexWindowAPI
  encryption: CortexEncryptionAPI
}

export type { CloudProvider, TextSize, ThemeMode, VaultStatus }
