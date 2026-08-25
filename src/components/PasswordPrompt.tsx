import { useEffect, useState } from 'react'
import './PasswordPrompt.css'

interface PasswordPromptProps {
  open: boolean
  /** 'new' shows a password + confirm pair plus the unrecoverable-loss
   *  warning (used when encrypting something for the first time). 'unlock'
   *  shows a single password field (opening/decrypting an existing
   *  encrypted file). */
  mode: 'new' | 'unlock'
  title: string
  actionLabel: string
  /** Set by the caller after a failed attempt (e.g. wrong password) —
   *  cleared automatically the next time the dialog opens. */
  error?: string | null
  onSubmit: (password: string) => void
  onCancel: () => void
}

export default function PasswordPrompt({
  open,
  mode,
  title,
  actionLabel,
  error,
  onSubmit,
  onCancel,
}: PasswordPromptProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    if (open) {
      setPassword('')
      setConfirmPassword('')
    }
  }, [open])

  if (!open) return null

  const mismatch = mode === 'new' && confirmPassword.length > 0 && password !== confirmPassword
  const canSubmit = mode === 'new' ? password.length > 0 && password === confirmPassword : password.length > 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    onSubmit(password)
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <form className="modal password-prompt" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2>{title}</h2>

        {mode === 'new' && (
          <p className="password-prompt-warning">
            There is no password recovery. If this password is lost, the file cannot be decrypted — ever.
          </p>
        )}

        <div className="form-group">
          <label htmlFor="password-prompt-password">Password</label>
          <input
            id="password-prompt-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </div>

        {mode === 'new' && (
          <div className="form-group">
            <label htmlFor="password-prompt-confirm">Confirm password</label>
            <input
              id="password-prompt-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {mismatch && <p className="password-prompt-error">Passwords don't match</p>}
          </div>
        )}

        {error && <p className="password-prompt-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>{actionLabel}</button>
        </div>
      </form>
    </div>
  )
}
