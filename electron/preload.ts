import { contextBridge, ipcRenderer, webFrame } from 'electron'
import type {
  AttachmentEntry,
  CalendarEvent,
  CloudProvider,
  Contact,
  CortexAPI,
  CreateEventInput,
  FileEntry,
  FontWeightLevel,
  SearchResult,
  StorageSection,
  TagIndex,
  TextSize,
  ThemeMode,
  TreeNode,
  VaultStatus,
} from '@cortex/core'

export type {
  AttachmentEntry,
  CalendarEvent,
  CloudProvider,
  Contact,
  CortexAPI,
  CreateEventInput,
  FileEntry,
  FontWeightLevel,
  SearchResult,
  StorageSection,
  TagIndex,
  TextSize,
  ThemeMode,
  TreeNode,
  VaultStatus,
}

const cortexAPI: CortexAPI = {
  vault: {
    getStatus: (): Promise<VaultStatus> => ipcRenderer.invoke('vault:getStatus'),
    createNew: (parentPath: string, vaultName: string): Promise<VaultStatus> =>
      ipcRenderer.invoke('vault:createNew', parentPath, vaultName),
    openExisting: (defaultPath?: string): Promise<VaultStatus | null> =>
      ipcRenderer.invoke('vault:openExisting', defaultPath),
    pickParentDirectory: (defaultPath?: string): Promise<string | null> =>
      ipcRenderer.invoke('vault:pickParentDirectory', defaultPath),
    getCloudBasePath: (provider: CloudProvider): Promise<string> =>
      ipcRenderer.invoke('vault:getCloudBasePath', provider),
    close: (): Promise<VaultStatus> => ipcRenderer.invoke('vault:close'),
  },
  settings: {
    getTheme: (): Promise<ThemeMode> => ipcRenderer.invoke('settings:getTheme'),
    setTheme: (theme: ThemeMode): Promise<void> => ipcRenderer.invoke('settings:setTheme', theme),
    getTextSize: (): Promise<TextSize> => ipcRenderer.invoke('settings:getTextSize'),
    setTextSize: (size: TextSize): Promise<void> => ipcRenderer.invoke('settings:setTextSize', size),
    getUIFont: (): Promise<string> => ipcRenderer.invoke('settings:getUIFont'),
    setUIFont: (fontId: string): Promise<void> => ipcRenderer.invoke('settings:setUIFont', fontId),
    getUIFontWeight: (): Promise<FontWeightLevel> => ipcRenderer.invoke('settings:getUIFontWeight'),
    setUIFontWeight: (weightId: FontWeightLevel): Promise<void> =>
      ipcRenderer.invoke('settings:setUIFontWeight', weightId),
    getComposeFont: (): Promise<string> => ipcRenderer.invoke('settings:getComposeFont'),
    setComposeFont: (fontId: string): Promise<void> => ipcRenderer.invoke('settings:setComposeFont', fontId),
    getComposeFontWeight: (): Promise<FontWeightLevel> => ipcRenderer.invoke('settings:getComposeFontWeight'),
    setComposeFontWeight: (weightId: FontWeightLevel): Promise<void> =>
      ipcRenderer.invoke('settings:setComposeFontWeight', weightId),
    exportSettings: (defaultName: string): Promise<string | null> =>
      ipcRenderer.invoke('settings:export', defaultName),
    resetSettings: (): Promise<void> => ipcRenderer.invoke('settings:reset'),
  },
  menu: {
    onOpenSettings: (callback: (category?: string) => void): (() => void) => {
      const listener = (_: unknown, category?: string) => callback(category)
      ipcRenderer.on('settings:open', listener)
      return () => ipcRenderer.removeListener('settings:open', listener)
    },
    onOpenEncryptedFile: (callback: () => void): (() => void) => {
      const listener = () => callback()
      ipcRenderer.on('menu:openEncryptedFile', listener)
      return () => ipcRenderer.removeListener('menu:openEncryptedFile', listener)
    },
  },
  encryption: {
    read: (relativePath: string, password: string): Promise<string> =>
      ipcRenderer.invoke('encryption:read', relativePath, password),
    write: (relativePath: string, content: string, password: string): Promise<void> =>
      ipcRenderer.invoke('encryption:write', relativePath, content, password),
    encrypt: (relativePath: string, password: string): Promise<string> =>
      ipcRenderer.invoke('encryption:encrypt', relativePath, password),
    decrypt: (relativePath: string, password: string): Promise<string> =>
      ipcRenderer.invoke('encryption:decrypt', relativePath, password),
    pickExternalFile: (): Promise<{ path: string; name: string } | null> =>
      ipcRenderer.invoke('encryption:pickExternalFile'),
    decryptExternalFile: (absolutePath: string, password: string): Promise<{ content: string; name: string }> =>
      ipcRenderer.invoke('encryption:decryptExternalFile', absolutePath, password),
    saveDecryptedCopy: (defaultName: string, content: string): Promise<string | null> =>
      ipcRenderer.invoke('encryption:saveDecryptedCopy', defaultName, content),
  },
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
  },
  window: {
    setZoomFactor: (factor: number): void => {
      webFrame.setZoomFactor(factor)
    },
  },
  storage: {
    getDataPath: (): Promise<string> => ipcRenderer.invoke('storage:getDataPath'),
    getVaultTree: (zone?: 'notes' | 'diary'): Promise<TreeNode[]> => ipcRenderer.invoke('storage:getVaultTree', zone),
    getTree: (section: StorageSection): Promise<TreeNode[]> =>
      ipcRenderer.invoke('storage:getTree', section),
    listFiles: (section: StorageSection): Promise<FileEntry[]> =>
      ipcRenderer.invoke('storage:listFiles', section),
    readFile: (path: string): Promise<string> => ipcRenderer.invoke('storage:readFile', path),
    writeFile: (path: string, content: string): Promise<boolean> =>
      ipcRenderer.invoke('storage:writeFile', path, content),
    deleteFile: (path: string): Promise<boolean> =>
      ipcRenderer.invoke('storage:deleteFile', path),
    createNote: (folder?: string): Promise<FileEntry> =>
      ipcRenderer.invoke('storage:createNote', folder),
    createNoteWithTitle: (folder: string, title: string): Promise<FileEntry & { created: boolean }> =>
      ipcRenderer.invoke('storage:createNoteWithTitle', folder, title),
    createFolder: (folderPath: string): Promise<string> =>
      ipcRenderer.invoke('storage:createFolder', folderPath),
    rename: (oldPath: string, newPath: string): Promise<string> =>
      ipcRenderer.invoke('storage:rename', oldPath, newPath),
    movePath: (fromPath: string, toFolder: string): Promise<string> =>
      ipcRenderer.invoke('storage:movePath', fromPath, toFolder),
    syncNoteFilename: (notePath: string, content: string): Promise<string> =>
      ipcRenderer.invoke('storage:syncNoteFilename', notePath, content),
    openDiaryEntry: (dateStr: string): Promise<string> =>
      ipcRenderer.invoke('storage:openDiaryEntry', dateStr),
    getDiaryPath: (dateStr: string): Promise<string> =>
      ipcRenderer.invoke('storage:getDiaryPath', dateStr),
    listDiaryDates: (): Promise<string[]> =>
      ipcRenderer.invoke('storage:listDiaryDates'),
  },
  attachments: {
    list: (relativeFolder: string): Promise<AttachmentEntry[]> =>
      ipcRenderer.invoke('attachments:list', relativeFolder),
    add: (relativeFolder: string): Promise<AttachmentEntry | null> =>
      ipcRenderer.invoke('attachments:add', relativeFolder),
    delete: (relativePath: string): Promise<boolean> =>
      ipcRenderer.invoke('attachments:delete', relativePath),
  },
  tags: {
    index: (): Promise<TagIndex[]> => ipcRenderer.invoke('tags:index'),
  },
  search: {
    query: (term: string): Promise<SearchResult[]> => ipcRenderer.invoke('search:query', term),
  },
  calendar: {
    listEvents: (start: string, end: string): Promise<CalendarEvent[]> =>
      ipcRenderer.invoke('calendar:listEvents', start, end),
    createEvent: (event: CreateEventInput): Promise<CalendarEvent> =>
      ipcRenderer.invoke('calendar:createEvent', event),
    updateEvent: (id: string, updates: Partial<CreateEventInput>): Promise<CalendarEvent | null> =>
      ipcRenderer.invoke('calendar:updateEvent', id, updates),
    deleteEvent: (id: string): Promise<boolean> =>
      ipcRenderer.invoke('calendar:deleteEvent', id),
    getByPath: (relativePath: string): Promise<CalendarEvent | null> =>
      ipcRenderer.invoke('calendar:getByPath', relativePath),
  },
  contacts: {
    list: (): Promise<Contact[]> => ipcRenderer.invoke('contacts:list'),
    create: (contact: Omit<Contact, 'id' | 'created' | 'modified'>): Promise<Contact> =>
      ipcRenderer.invoke('contacts:create', contact),
    update: (id: string, updates: Partial<Omit<Contact, 'id' | 'created'>>): Promise<Contact | null> =>
      ipcRenderer.invoke('contacts:update', id, updates),
    delete: (id: string): Promise<boolean> => ipcRenderer.invoke('contacts:delete', id),
    getByPath: (relativePath: string): Promise<Contact | null> =>
      ipcRenderer.invoke('contacts:getByPath', relativePath),
  },
  export: {
    pdf: (html: string, defaultName: string): Promise<string | null> =>
      ipcRenderer.invoke('export:pdf', html, defaultName),
  },
}

contextBridge.exposeInMainWorld('cortex', cortexAPI)
