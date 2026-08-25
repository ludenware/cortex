import { useState, useEffect, useCallback } from 'react'
import {
  ChevronRight, ChevronDown, FileText, Folder, FolderPlus,
  Plus, Trash2, FilePlus, File, CalendarDays, FoldVertical, UnfoldVertical, Lock,
} from 'lucide-react'
import { format, subDays, addDays } from 'date-fns'
import { isDiaryPath, isEncryptedPath } from '@cortex/core'
import type { TreeNode, AppZone } from '../types'
import ConfirmDialog from './ConfirmDialog'
import '../styles/left-panel.css'

interface FileBrowserProps {
  zone: AppZone
  selectedPath: string | null
  vaultName: string | null
  onSelect: (path: string, name: string, opts?: { isNew?: boolean }) => void
  onGoToVaultRoot: () => void
  onCloseOpenFile: () => void
  onRefresh: () => void
  refreshKey: number
  tagFilter: string | null
  onError: (msg: string) => void
}

interface PendingDelete {
  path: string
  name: string
  isFolder: boolean
}

function TreeItem({
  node,
  depth,
  selectedPath,
  activeFolder,
  dragPath,
  dragOverPath,
  onDragOverTarget,
  isDiaryMode,
  onSelectFile,
  onSelectFolder,
  onDelete,
  onMove,
  expanded,
  toggleExpand,
}: {
  node: TreeNode
  depth: number
  selectedPath: string | null
  activeFolder: string
  dragPath: string | null
  dragOverPath: string | null
  onDragOverTarget: (path: string | null) => void
  isDiaryMode: boolean
  onSelectFile: (path: string, name: string) => void
  onSelectFolder: (path: string) => void
  onDelete: (path: string, name: string, isFolder: boolean, e: React.MouseEvent) => void
  onMove: (from: string, toFolder: string) => void
  expanded: Set<string>
  toggleExpand: (path: string) => void
}) {
  const isFolder = node.type === 'folder'
  const isOpen = expanded.has(node.path)
  const isFileActive = selectedPath === node.path
  const isFolderActive = isFolder && activeFolder === node.path
  // .md.enc counts as "markdown-like" for click-routing purposes (opens via
  // onSelectFile, same as a plain .md note) even though its ciphertext
  // obviously isn't renderable markdown yet — CenterPanel's loadNote()
  // detects the .enc suffix itself and shows the locked/password state
  // instead of trying to render it.
  const isMarkdown = node.path.endsWith('.md') || node.path.endsWith('.md.enc') || (node.type === 'file' && !node.path.includes('.'))
  const isDragging = dragPath === node.path
  // Diary entries are locked — no drag targets
  const isDropTarget = !isDiaryMode && isFolder && dragPath !== null && dragPath !== node.path && !node.path.startsWith(`${dragPath}/`)
  // Which one specific folder the dragged item is currently hovering over
  // (out of potentially many valid drop targets) — this is what turns
  // green, distinct from isDropTarget's "any of these would work" outline.
  const isDragHover = isDropTarget && dragOverPath === node.path
  // Only individual day files are date-locked — year/month folders are
  // regular directories, deletable/navigable like any other folder.
  const isDiaryEntry = isDiaryPath(node.path) && !isFolder

  const handleDragStart = (e: React.DragEvent) => {
    if (isDiaryMode) { e.preventDefault(); return }
    e.dataTransfer.setData('text/plain', node.path)
    e.dataTransfer.effectAllowed = 'move'

    // The browser snapshots the drag-ghost image synchronously when
    // dragstart fires — before React can re-render with .dragging's own
    // opacity — so without this the ghost that follows the cursor is
    // full-strength and visually buries the green drop-target highlight
    // underneath it. A custom, much more transparent clone fixes that;
    // it only needs to exist in the DOM for the instant of the snapshot,
    // so it's removed again on the next tick.
    const original = e.currentTarget as HTMLElement
    const ghost = original.cloneNode(true) as HTMLElement
    ghost.style.position = 'fixed'
    ghost.style.top = '-1000px'
    ghost.style.left = '-1000px'
    ghost.style.width = `${original.offsetWidth}px`
    ghost.style.opacity = '0.15'
    ghost.style.pointerEvents = 'none'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 12, 12)
    setTimeout(() => ghost.remove(), 0)

    onMove(node.path, '__drag_start__')
  }

  const handleDragEnd = () => {
    if (isDiaryMode) return
    onMove('', '__drag_end__')
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (isDiaryMode || !isFolder || !dragPath || dragPath === node.path) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (isDropTarget) onDragOverTarget(node.path)
  }

  // Fires when the pointer leaves this row's DOM subtree — guarded so
  // moving between the folder icon/name/delete-icon spans *inside* the
  // same row (still children of this button) doesn't flicker the
  // highlight off and immediately back on.
  const handleDragLeave = (e: React.DragEvent) => {
    if (!isDropTarget) return
    const related = e.relatedTarget as Node | null
    if (related && e.currentTarget.contains(related)) return
    onDragOverTarget(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    if (isDiaryMode) return
    e.preventDefault()
    e.stopPropagation()
    onDragOverTarget(null)
    const from = e.dataTransfer.getData('text/plain') || dragPath
    if (!from || from === node.path || node.path.startsWith(`${from}/`)) return
    onMove(from, node.path)
  }

  return (
    <>
      <button
        className={`tree-item ${isFileActive || isFolderActive ? 'active' : ''} ${isFolderActive && !isFileActive ? 'folder-active' : ''} ${isDragging ? 'dragging' : ''} ${isDropTarget ? 'drop-target' : ''} ${isDragHover ? 'drag-hover' : ''} ${isDiaryEntry ? 'diary-locked' : ''}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        draggable={!isDiaryMode && !isDiaryEntry}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={(e) => {
          e.stopPropagation()
          if (isFolder) {
            toggleExpand(node.path)
            onSelectFolder(node.path)
          } else if (isMarkdown) {
            onSelectFile(node.path, node.name)
          } else {
            onSelectFolder(pathDir(node.path))
          }
        }}
      >
        {isFolder ? (
          isOpen ? <ChevronDown size={16} className="tree-chevron" /> : <ChevronRight size={16} className="tree-chevron" />
        ) : (
          <span className="tree-chevron-spacer" />
        )}
        {isFolder ? (
          <Folder size={16} className="tree-icon folder" />
        ) : node.encrypted ? (
          <Lock size={16} className="tree-icon encrypted" />
        ) : isMarkdown ? (
          isDiaryEntry ? <CalendarDays size={16} className="tree-icon diary" /> : <FileText size={16} className="tree-icon file" />
        ) : (
          <File size={16} className="tree-icon attachment" />
        )}
        <span className={`tree-name ${isFileActive ? 'tree-name-open' : ''}`}>{node.name}</span>
        <span className="tree-delete" onClick={(e) => onDelete(node.path, node.name, isFolder, e)} role="button" tabIndex={0}>
          <Trash2 size={16} />
        </span>
      </button>
      {isFolder && isOpen && node.children?.map((child) => (
        <TreeItem
          key={child.path}
          node={child}
          depth={depth + 1}
          selectedPath={selectedPath}
          activeFolder={activeFolder}
          dragPath={dragPath}
          dragOverPath={dragOverPath}
          onDragOverTarget={onDragOverTarget}
          isDiaryMode={isDiaryMode}
          onSelectFile={onSelectFile}
          onSelectFolder={onSelectFolder}
          onDelete={onDelete}
          onMove={onMove}
          expanded={expanded}
          toggleExpand={toggleExpand}
        />
      ))}
    </>
  )
}

export default function FileBrowser({
  zone,
  selectedPath,
  vaultName,
  onSelect,
  onGoToVaultRoot,
  onCloseOpenFile,
  onRefresh,
  refreshKey,
  tagFilter,
  onError,
}: FileBrowserProps) {
  const [tree, setTree] = useState<TreeNode[]>([])
  const [activeFolder, setActiveFolder] = useState<string>('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newName, setNewName] = useState('')
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [dragPath, setDragPath] = useState<string | null>(null)
  const [dragOverPath, setDragOverPath] = useState<string | null>(null)

  const isDiaryMode = zone === 'diary'

  const loadTree = useCallback(async () => {
    if (zone === 'contacts') return
    try {
      const data = await window.cortex.storage.getVaultTree(zone === 'diary' ? 'diary' : 'notes')
      setTree(data)
      // Auto-expand all diary year folders
      if (zone === 'diary') {
        setExpanded(prev => {
          const next = new Set(prev)
          const addFolders = (nodes: TreeNode[]) => {
            for (const n of nodes) {
              if (n.type === 'folder') {
                next.add(n.path)
                addFolders(n.children ?? [])
              }
            }
          }
          addFolders(data)
          return next
        })
      }
    } catch {
      onError('Failed to load vault tree')
    }
  }, [zone, onError])

  useEffect(() => {
    loadTree()
  }, [loadTree, refreshKey])

  // Reset to the zone's root whenever no file is selected, or the zone itself
  // changes — otherwise activeFolder can be left pointing at a path from a
  // different zone (e.g. a diary folder) after switching to Notes with
  // nothing open, and "New Note" would try to create inside that stale path.
  useEffect(() => {
    setActiveFolder(selectedPath ? pathDir(selectedPath) : '')
  }, [selectedPath, zone])

  const toggleExpand = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const handleSelectFile = (path: string, name: string) => {
    if (!path.endsWith('.md') && !isEncryptedPath(path)) return
    setActiveFolder(pathDir(path))
    onSelect(path, name)
  }

  const handleSelectFolder = (path: string) => {
    setActiveFolder(path)
  }

  const handleMove = async (from: string, toFolder: string) => {
    if (toFolder === '__drag_start__') {
      setDragPath(from)
      return
    }
    if (toFolder === '__drag_end__') {
      setDragPath(null)
      setDragOverPath(null)
      return
    }
    try {
      const newPath = await window.cortex.storage.movePath(from, toFolder)
      if (selectedPath === from) {
        const name = newPath.split('/').pop()?.replace(/\.md$/, '') ?? from
        onSelect(newPath, name)
      }
      onRefresh()
    } catch {
      onError('Failed to move item')
    } finally {
      setDragPath(null)
      setDragOverPath(null)
    }
  }

  const handleCreateNote = async () => {
    try {
      // activeFolder is already notes-scoped (e.g. "notes/subfolder") or "" for the root.
      // The backend defaults empty/missing dir to the notes root.
      const entry = await window.cortex.storage.createNote(activeFolder || undefined)
      onRefresh()
      onSelect(entry.path, entry.name, { isNew: true })
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to create note')
    }
  }

  const handleCreateFolder = async () => {
    if (!newName.trim()) return
    try {
      // Ensure folder path is inside notes/
      const base = activeFolder && activeFolder.startsWith('notes') ? activeFolder : 'notes'
      const folderPath = `${base}/${newName.trim()}`
      await window.cortex.storage.createFolder(folderPath)
      setShowNewFolder(false)
      setNewName('')
      onRefresh()
    } catch {
      onError('Failed to create folder')
    }
  }

  const requestDelete = (path: string, name: string, isFolder: boolean, e: React.MouseEvent) => {
    e.stopPropagation()
    setPendingDelete({ path, name, isFolder })
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    // Deleting a folder that merely *contains* the open file (e.g. a year
    // or month folder) also needs to close it — not just an exact path
    // match — otherwise CenterPanel's autosave can write the file straight
    // back to disk after its parent folder is gone.
    const deletingOpenFile = !!selectedPath &&
      (selectedPath === pendingDelete.path || selectedPath.startsWith(`${pendingDelete.path}/`))
    try {
      await window.cortex.storage.deleteFile(pendingDelete.path)
      if (deletingOpenFile) {
        onCloseOpenFile()
      }
      onRefresh()
    } catch {
      onError('Failed to delete')
    } finally {
      setPendingDelete(null)
    }
  }

  const handleAddAttachment = async () => {
    try {
      await window.cortex.attachments.add(activeFolder)
      onRefresh()
    } catch {
      onError('Failed to add attachment')
    }
  }

  // Diary navigation: open/create yesterday, today, tomorrow
  const openDiaryDay = useCallback(async (offset: number) => {
    const date = offset === 0 ? new Date()
      : offset === -1 ? subDays(new Date(), 1)
      : addDays(new Date(), 1)
    const dateStr = format(date, 'yyyy-MM-dd')
    try {
      const diaryPath = await window.cortex.storage.openDiaryEntry(dateStr)
      onRefresh()
      onSelect(diaryPath, dateStr, { isNew: false })
    } catch {
      onError(`Failed to open diary for ${dateStr}`)
    }
  }, [onRefresh, onSelect, onError])

  const [tagPaths, setTagPaths] = useState<Set<string> | null>(null)

  useEffect(() => {
    if (!tagFilter) {
      setTagPaths(null)
      return
    }
    window.cortex.tags.index().then((tags) => {
      const found = tags.find((t) => t.tag === tagFilter)
      setTagPaths(found ? new Set(found.paths) : new Set())
    })
  }, [tagFilter, refreshKey])

  const filteredTree = tagPaths ? filterTreeByPaths(tree, tagPaths) : tree

  const allFolderPaths = collectFolderPaths(filteredTree)
  const allExpanded = allFolderPaths.length > 0 && allFolderPaths.every((p) => expanded.has(p))

  const handleToggleExpandAll = () => {
    setExpanded(allExpanded ? new Set() : new Set(allFolderPaths))
  }

  if (zone === 'contacts') {
    return (
      <div className="file-browser-empty">
        Select a contact from the list below, or create a new one.
      </div>
    )
  }

  const handleRootDrop = (e: React.DragEvent) => {
    if (isDiaryMode) return
    e.preventDefault()
    const from = e.dataTransfer.getData('text/plain') || dragPath
    if (!from) return
    handleMove(from, '')
  }

  const handleGoToVaultRoot = () => {
    setActiveFolder('')
    setExpanded(new Set())
    onGoToVaultRoot()
  }

  return (
    <div className="file-browser">
      {isDiaryMode ? (
        <div className="file-browser-actions">
          <button className="fb-action-btn fb-diary-btn" onClick={() => openDiaryDay(-1)} title="Open or create yesterday's diary">
            ← Yesterday
          </button>
          <button className="fb-action-btn fb-diary-btn fb-diary-today" onClick={() => openDiaryDay(0)} title="Open or create today's diary">
            Today
          </button>
          <button className="fb-action-btn fb-diary-btn" onClick={() => openDiaryDay(1)} title="Open or create tomorrow's diary">
            Tomorrow →
          </button>
        </div>
      ) : (
        <div className="file-browser-actions">
          <button className="fb-action-btn" onClick={handleCreateNote} title="New note in current folder">
            <Plus size={16} /> Note
          </button>
          <button className="fb-action-btn" onClick={() => { setShowNewFolder(true); setNewName('') }} title="New subfolder">
            <FolderPlus size={16} /> Folder
          </button>
          <button className="fb-action-btn" onClick={handleAddAttachment} title="Add attachment to current folder">
            <FilePlus size={16} /> File
          </button>
        </div>
      )}

      <div className="fb-toolbar-row">
        <button
          type="button"
          className={`vault-root-bar ${activeFolder === '' && !selectedPath ? 'active' : ''}`}
          onDragOver={(e) => { if (dragPath) e.preventDefault() }}
          onDrop={handleRootDrop}
          onClick={handleGoToVaultRoot}
        >
          {vaultName ?? 'Vault'}
        </button>
        <button
          type="button"
          className="fb-icon-btn"
          onClick={handleToggleExpandAll}
          disabled={allFolderPaths.length === 0}
          title={allExpanded ? 'Collapse all folders' : 'Expand all folders'}
        >
          {allExpanded ? <FoldVertical size={16} /> : <UnfoldVertical size={16} />}
        </button>
      </div>

      <div className="file-tree">
        {filteredTree.map((node) => (
          <TreeItem
            key={node.path}
            node={node}
            depth={0}
            selectedPath={selectedPath}
            activeFolder={activeFolder}
            dragPath={dragPath}
            dragOverPath={dragOverPath}
            onDragOverTarget={setDragOverPath}
            isDiaryMode={isDiaryMode}
            onSelectFile={handleSelectFile}
            onSelectFolder={handleSelectFolder}
            onDelete={requestDelete}
            onMove={handleMove}
            expanded={expanded}
            toggleExpand={toggleExpand}
          />
        ))}
        {filteredTree.length === 0 && (
          <div className="file-browser-empty">
            {isDiaryMode
              ? 'No diary entries yet — press "Today" to start writing'
              : 'Empty — create a note to get started'}
          </div>
        )}
      </div>

      {!isDiaryMode && showNewFolder && (
        <div className="inline-form">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Folder name"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateFolder()
              if (e.key === 'Escape') setShowNewFolder(false)
            }}
          />
          <button onClick={handleCreateFolder}>Create</button>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title={pendingDelete?.isFolder ? 'Delete folder' : 'Delete item'}
        message={
          pendingDelete?.isFolder
            ? `Are you sure you want to delete the folder "${pendingDelete?.name}" and everything inside it? This cannot be undone.`
            : `Are you sure you want to delete "${pendingDelete?.name}"? This cannot be undone.`
        }
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}

function pathDir(filePath: string): string {
  const parts = filePath.split('/')
  parts.pop()
  return parts.join('/')
}

function collectFolderPaths(nodes: TreeNode[]): string[] {
  const paths: string[] = []
  for (const node of nodes) {
    if (node.type === 'folder') {
      paths.push(node.path)
      paths.push(...collectFolderPaths(node.children ?? []))
    }
  }
  return paths
}

function filterTreeByPaths(tree: TreeNode[], paths: Set<string>): TreeNode[] {
  return tree.reduce<TreeNode[]>((acc, node) => {
    if (node.type === 'folder') {
      const children = filterTreeByPaths(node.children ?? [], paths)
      if (children.length > 0) acc.push({ ...node, children })
    } else if (paths.has(node.path)) {
      acc.push(node)
    }
    return acc
  }, [])
}

export { pathDir }

