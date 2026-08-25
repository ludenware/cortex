import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import MarkdownPreview from './MarkdownPreview'
import PasswordPrompt from './PasswordPrompt'
import { formatEncryptionError } from '../utils/encryption-error'
import './OpenEncryptedFileModal.css'

interface OpenEncryptedFileModalProps {
  open: boolean
  onClose: () => void
}

/** Standalone "someone emailed me an encrypted file" flow — the native
 *  "Open Encrypted File…" menu item. Deliberately independent of the vault
 *  state (works with no vault open at all): pick any file, ask for its
 *  password, decrypt in memory, show it (markdown gets a real preview via
 *  the same MarkdownPreview component read-mode notes use; anything else
 *  skips straight to "Save Decrypted Copy As…" since there's no in-app
 *  renderer for it). Nothing is ever written back to the original file —
 *  only an explicit "Save a copy" writes plaintext to disk, and only where
 *  the user picks. */
export default function OpenEncryptedFileModal({ open, onClose }: OpenEncryptedFileModalProps) {
  const [picked, setPicked] = useState<{ path: string; name: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [decrypted, setDecrypted] = useState<{ content: string; name: string } | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setPicked(null)
      setError(null)
      setDecrypted(null)
      setSaveMessage(null)
      return
    }
    void (async () => {
      const result = await window.cortex.encryption.pickExternalFile()
      if (!result) {
        onClose()
        return
      }
      setPicked(result)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const handleUnlock = async (password: string) => {
    if (!picked) return
    try {
      const result = await window.cortex.encryption.decryptExternalFile(picked.path, password)
      setError(null)
      setDecrypted(result)
    } catch (err) {
      setError(formatEncryptionError(err))
    }
  }

  const handleSaveCopy = async () => {
    if (!decrypted) return
    const defaultName = decrypted.name.replace(/\.enc$/i, '')
    const saved = await window.cortex.encryption.saveDecryptedCopy(defaultName, decrypted.content)
    if (saved) setSaveMessage(`Saved to ${saved}`)
  }

  // Picker still open / user hasn't chosen a file yet — nothing to render
  // (the native dialog itself is the UI at this point).
  if (picked && !decrypted) {
    return (
      <PasswordPrompt
        open
        mode="unlock"
        title={`Enter password for "${picked.name}"`}
        actionLabel="Unlock"
        error={error}
        onSubmit={handleUnlock}
        onCancel={onClose}
      />
    )
  }

  if (!decrypted) return null

  const isMarkdown = decrypted.name.toLowerCase().endsWith('.md') || decrypted.name.toLowerCase().endsWith('.md.enc')

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal open-encrypted-modal" onClick={(e) => e.stopPropagation()}>
        <div className="open-encrypted-header">
          <Lock size={16} />
          <h2>{decrypted.name.replace(/\.enc$/i, '')}</h2>
        </div>

        {isMarkdown ? (
          <div className="open-encrypted-preview">
            <MarkdownPreview content={decrypted.content} />
          </div>
        ) : (
          <p className="confirm-message">
            This file type can't be previewed in Cortex. Save a decrypted copy to open it elsewhere.
          </p>
        )}

        {saveMessage && <p className="open-encrypted-save-message">{saveMessage}</p>}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={handleSaveCopy}>Save Decrypted Copy As…</button>
        </div>
      </div>
    </div>
  )
}
