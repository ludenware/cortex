import { app, Menu } from 'electron'

app.setName('Cortex')

export function setApplicationMenu(
  onOpenSettings: (category?: string) => void,
  onOpenEncryptedFile: () => void
) {
  const isMac = process.platform === 'darwin'

  const showAbout = () => onOpenSettings('about')
  const showPreferences = () => onOpenSettings()

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { label: 'About Cortex', click: showAbout },
              { type: 'separator' as const },
              { label: 'Preferences…', accelerator: 'Cmd+,', click: showPreferences },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        { label: 'Open Encrypted File…', accelerator: 'CmdOrCtrl+Shift+O', click: onOpenEncryptedFile },
        { type: 'separator' as const },
        ...(isMac ? [] : [{ label: 'About Cortex', click: showAbout }]),
        ...(isMac ? [] : [{ label: 'Settings…', accelerator: 'Ctrl+,', click: showPreferences }]),
        ...(isMac ? [] : [{ type: 'separator' as const }]),
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac
          ? [{ type: 'separator' as const }, { role: 'front' as const }]
          : [{ role: 'close' as const }]),
      ],
    },
    {
      role: 'help' as const,
      submenu: [{ label: 'About Cortex', click: showAbout }],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
