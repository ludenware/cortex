import { app, BrowserWindow, ipcMain, dialog, nativeImage, nativeTheme, shell } from 'electron'
import { VAULT_FOLDERS, DEFAULT_FONT_ID, DEFAULT_FONT_WEIGHT_ID } from '@cortex/core'
import type { FontWeightLevel, TextSize, ThemeMode } from '@cortex/core'
import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { setApplicationMenu } from './app-menu'
import {
  getDataPath,
  buildNotesTree,
  buildDiaryTree,
  listMarkdownFiles,
  createFolder,
  createNote,
  deletePath,
  renamePath,
  syncNoteFilename,
  createNoteWithTitle,
  movePath,
  readVaultFile,
  writeVaultFile,
  listAttachments,
  addAttachment,
  deleteAttachment,
  indexAllTags,
  openDiaryEntry,
  listDiaryDates,
  readEncryptedNote,
  writeEncryptedNote,
  encryptNote,
  decryptNote,
} from './storage'
import { decryptEnvelope } from './crypto-envelope'
import { searchVault } from './search'
import {
  listStoredEvents,
  createStoredEvent,
  updateStoredEvent,
  deleteStoredEvent,
  getEventByRelativePath,
} from './calendar-store'
import {
  listContacts,
  createContact,
  updateContact,
  deleteContact,
  getContactByRelativePath,
} from './contacts-store'
import {
  initVault,
  getVaultStatus,
  createVaultAt,
  openVaultAt,
  pickParentDirectory,
  pickExistingVault,
  resolveCloudBasePath,
  isVaultConfigured,
  closeVault,
} from './vault-manager'
import {
  getTheme,
  setTheme,
  getTextSize,
  setTextSize,
  getUIFont,
  setUIFont,
  getUIFontWeight,
  setUIFontWeight,
  getComposeFont,
  setComposeFont,
  getComposeFontWeight,
  setComposeFontWeight,
  exportSettings,
  resetSettings,
} from './settings-store'
import type { CloudProvider } from '@cortex/core'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function resolveAppIconPath(): string {
  const macIconCandidates =
    process.platform === 'darwin'
      ? [
          ...(nativeTheme.shouldUseDarkColors
            ? [
                path.join(__dirname, '../dist/macos-app-icon-dark.png'),
                path.join(__dirname, '../public/macos-app-icon-dark.png'),
              ]
            : []),
          path.join(__dirname, '../dist/macos-app-icon.png'),
          path.join(__dirname, '../public/macos-app-icon.png'),
        ]
      : []
  const candidates = [
    ...macIconCandidates,
    path.join(__dirname, '../dist/cortex-icon.png'),
    path.join(__dirname, '../public/cortex-icon.png'),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return candidates[1]
}

function updateMacAppIcon() {
  if (process.platform !== 'darwin' || !app.dock) return
  app.dock.setIcon(nativeImage.createFromPath(resolveAppIconPath()))
}

let mainWindow: BrowserWindow | null = null

function createWindow() {
  const iconPath = resolveAppIconPath()
  const appIcon = nativeImage.createFromPath(iconPath)

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 650,
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#1a1a1f',
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.maximize()
    mainWindow?.show()
  })

  // Any link that would otherwise open a new Electron window (target="_blank",
  // window.open — GitHub/social links in About, external markdown links)
  // opens in the user's actual default browser instead, tab-reusing if it's
  // already open. Denying the action prevents the small popup BrowserWindow.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  await initVault()
  setApplicationMenu(
    (category) => mainWindow?.webContents.send('settings:open', category),
    () => mainWindow?.webContents.send('menu:openEncryptedFile')
  )
  updateMacAppIcon()
  nativeTheme.on('updated', updateMacAppIcon)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function requireVault() {
  if (!isVaultConfigured()) {
    throw new Error('No vault configured')
  }
}

// --- Vault ---

ipcMain.handle('vault:getStatus', () => getVaultStatus())

ipcMain.handle('vault:createNew', async (_, parentPath: string, vaultName: string) => {
  await createVaultAt(parentPath, vaultName)
  return getVaultStatus()
})

ipcMain.handle('vault:openExisting', async (_, defaultPath?: string) => {
  const selected = await pickExistingVault(defaultPath)
  if (!selected) return null
  await openVaultAt(selected)
  return getVaultStatus()
})

ipcMain.handle('vault:pickParentDirectory', async (_, defaultPath?: string) => {
  return pickParentDirectory(defaultPath)
})

ipcMain.handle('vault:getCloudBasePath', async (_, provider: CloudProvider) => {
  return resolveCloudBasePath(provider)
})

ipcMain.handle('vault:close', async () => {
  await closeVault()
  return getVaultStatus()
})

// --- Settings ---

ipcMain.handle('settings:getTheme', async () => {
  if (!isVaultConfigured()) return 'dark'
  return getTheme()
})

ipcMain.handle('settings:setTheme', async (_, theme: ThemeMode) => {
  requireVault()
  await setTheme(theme)
  return true
})

ipcMain.handle('settings:getTextSize', async () => {
  if (!isVaultConfigured()) return 'medium'
  return getTextSize()
})

ipcMain.handle('settings:setTextSize', async (_, size: TextSize) => {
  requireVault()
  await setTextSize(size)
  return true
})

ipcMain.handle('settings:getUIFont', async () => {
  if (!isVaultConfigured()) return DEFAULT_FONT_ID
  return getUIFont()
})

ipcMain.handle('settings:setUIFont', async (_, fontId: string) => {
  requireVault()
  await setUIFont(fontId)
  return true
})

ipcMain.handle('settings:getUIFontWeight', async () => {
  if (!isVaultConfigured()) return DEFAULT_FONT_WEIGHT_ID
  return getUIFontWeight()
})

ipcMain.handle('settings:setUIFontWeight', async (_, weightId: FontWeightLevel) => {
  requireVault()
  await setUIFontWeight(weightId)
  return true
})

ipcMain.handle('settings:getComposeFont', async () => {
  if (!isVaultConfigured()) return DEFAULT_FONT_ID
  return getComposeFont()
})

ipcMain.handle('settings:setComposeFont', async (_, fontId: string) => {
  requireVault()
  await setComposeFont(fontId)
  return true
})

ipcMain.handle('settings:getComposeFontWeight', async () => {
  if (!isVaultConfigured()) return DEFAULT_FONT_WEIGHT_ID
  return getComposeFontWeight()
})

ipcMain.handle('settings:setComposeFontWeight', async (_, weightId: FontWeightLevel) => {
  requireVault()
  await setComposeFontWeight(weightId)
  return true
})

ipcMain.handle('settings:export', async (_, defaultName: string) => {
  requireVault()
  return exportSettings(defaultName)
})

ipcMain.handle('settings:reset', async () => {
  requireVault()
  await resetSettings()
  return true
})

ipcMain.handle('app:getVersion', () => app.getVersion())

// --- Storage ---

ipcMain.handle('storage:getDataPath', () => {
  requireVault()
  return getDataPath()
})

ipcMain.handle('storage:getVaultTree', async (_, zone?: 'notes' | 'diary') => {
  requireVault()
  if (zone === 'diary') {
    return buildDiaryTree('')
  }
  return buildNotesTree('')
})

ipcMain.handle('storage:getTree', async (_, section: 'notes' | 'diary') => {
  requireVault()
  if (section === 'diary') {
    return buildDiaryTree('')
  }
  return buildNotesTree('')
})

ipcMain.handle('storage:listFiles', async (_, section: 'notes' | 'diary') => {
  requireVault()
  if (section === 'diary') {
    const files = await listMarkdownFiles(VAULT_FOLDERS.DIARY, '')
    return files.sort((a, b) => b.name.localeCompare(a.name))
  }
  const files = await listMarkdownFiles('', '')
  return files.sort((a, b) => a.name.localeCompare(b.name))
})

ipcMain.handle('storage:readFile', async (_, relativePath: string) => {
  requireVault()
  return readVaultFile(relativePath)
})

ipcMain.handle('storage:writeFile', async (_, relativePath: string, content: string) => {
  requireVault()
  try {
    await writeVaultFile(relativePath, content)
    return true
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`writeFile(${relativePath}): ${message}`)
  }
})

ipcMain.handle('storage:deleteFile', async (_, relativePath: string) => {
  requireVault()
  return deletePath(relativePath)
})

ipcMain.handle('storage:createNote', async (_, folder?: string) => {
  requireVault()
  return createNote(folder ?? '')
})

ipcMain.handle('storage:createNoteWithTitle', async (_, folder: string, title: string) => {
  requireVault()
  return createNoteWithTitle(folder ?? '', title)
})

ipcMain.handle('storage:movePath', async (_, fromPath: string, toFolder: string) => {
  requireVault()
  return movePath(fromPath, toFolder)
})

ipcMain.handle('storage:syncNoteFilename', async (_, notePath: string, content: string) => {
  requireVault()
  return syncNoteFilename(notePath, content)
})

ipcMain.handle('storage:createFolder', async (_, folderPath: string) => {
  requireVault()
  return createFolder(folderPath)
})

ipcMain.handle('storage:rename', async (_, oldPath: string, newPath: string) => {
  requireVault()
  return renamePath(oldPath, newPath)
})

ipcMain.handle('storage:listDiaryDates', async () => {
  requireVault()
  return listDiaryDates()
})

ipcMain.handle('storage:openDiaryEntry', async (_, dateStr: string) => {
  requireVault()
  return openDiaryEntry(dateStr)
})

ipcMain.handle('storage:getDiaryPath', async (_, dateStr: string) => {
  requireVault()
  return openDiaryEntry(dateStr)
})

// --- Attachments ---

ipcMain.handle('attachments:list', async (_, relativeFolder: string) => {
  requireVault()
  return listAttachments(relativeFolder)
})

ipcMain.handle('attachments:add', async (_, relativeFolder: string) => {
  requireVault()
  return addAttachment(relativeFolder)
})

ipcMain.handle('attachments:delete', async (_, relativePath: string) => {
  requireVault()
  return deleteAttachment(relativePath)
})

// --- Tags ---

ipcMain.handle('tags:index', async () => {
  requireVault()
  try {
    return await indexAllTags()
  } catch {
    return []
  }
})

// --- Search ---

ipcMain.handle('search:query', async (_, term: string) => {
  requireVault()
  try {
    return await searchVault(term)
  } catch {
    return []
  }
})

// --- Calendar ---

ipcMain.handle('calendar:listEvents', async (_, start: string, end: string) => {
  requireVault()
  return listStoredEvents(start, end)
})

ipcMain.handle('calendar:createEvent', async (_, event: Parameters<typeof createStoredEvent>[0]) => {
  requireVault()
  return createStoredEvent(event)
})

ipcMain.handle('calendar:updateEvent', async (_, id: string, updates: Parameters<typeof updateStoredEvent>[1]) => {
  requireVault()
  return updateStoredEvent(id, updates)
})

ipcMain.handle('calendar:deleteEvent', async (_, id: string) => {
  requireVault()
  return deleteStoredEvent(id)
})

// --- Contacts ---

ipcMain.handle('contacts:list', () => {
  requireVault()
  return listContacts()
})

ipcMain.handle('contacts:create', async (_, contact: Parameters<typeof createContact>[0]) => {
  requireVault()
  return createContact(contact)
})

ipcMain.handle('contacts:update', async (_, id: string, updates: Parameters<typeof updateContact>[1]) => {
  requireVault()
  return updateContact(id, updates)
})

ipcMain.handle('contacts:delete', async (_, id: string) => {
  requireVault()
  return deleteContact(id)
})

ipcMain.handle('contacts:getByPath', async (_, relativePath: string) => {
  requireVault()
  return getContactByRelativePath(relativePath)
})

ipcMain.handle('calendar:getByPath', async (_, relativePath: string) => {
  requireVault()
  return getEventByRelativePath(relativePath)
})

// --- Encryption ---

ipcMain.handle('encryption:read', async (_, relativePath: string, password: string) => {
  requireVault()
  return readEncryptedNote(relativePath, password)
})

ipcMain.handle('encryption:write', async (_, relativePath: string, content: string, password: string) => {
  requireVault()
  await writeEncryptedNote(relativePath, content, password)
  return true
})

ipcMain.handle('encryption:encrypt', async (_, relativePath: string, password: string) => {
  requireVault()
  return encryptNote(relativePath, password)
})

ipcMain.handle('encryption:decrypt', async (_, relativePath: string, password: string) => {
  requireVault()
  return decryptNote(relativePath, password)
})

// Standalone flow, deliberately outside VaultFS's vault-relative contract —
// same "arbitrary absolute path chosen via native dialog" exception the PDF
// export and attachment copy-in already use, since this must work with no
// vault open at all (the "someone emailed me an encrypted file" case).
ipcMain.handle('encryption:pickExternalFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [
      { name: 'Encrypted files', extensions: ['enc'] },
      { name: 'All files', extensions: ['*'] },
    ],
  })
  if (canceled || filePaths.length === 0) return null
  return { path: filePaths[0], name: path.basename(filePaths[0]) }
})

ipcMain.handle('encryption:decryptExternalFile', async (_, absolutePath: string, password: string) => {
  const raw = await fs.readFile(absolutePath)
  const decrypted = decryptEnvelope(raw, password)
  return { content: decrypted.toString('utf-8'), name: path.basename(absolutePath) }
})

ipcMain.handle('encryption:saveDecryptedCopy', async (_, defaultName: string, content: string) => {
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: defaultName,
  })
  if (canceled || !filePath) return null
  await fs.writeFile(filePath, content, 'utf-8')
  return filePath
})

// --- PDF Export ---

ipcMain.handle('export:pdf', async (_, html: string, defaultName: string) => {
  requireVault()
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: `${defaultName}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  })
  if (canceled || !filePath) return null

  const pdfWindow = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: true },
  })

  await pdfWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
  )

  const pdfData = await pdfWindow.webContents.printToPDF({
    printBackground: true,
    margins: { marginType: 'default' },
  })

  pdfWindow.close()
  await fs.writeFile(filePath, pdfData)
  return filePath
})
