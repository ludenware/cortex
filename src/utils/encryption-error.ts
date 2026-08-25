/** Electron's IPC layer wraps a thrown main-process Error's message as
 *  `Error invoking remote method '<channel>': DecryptionError: <message>`
 *  by the time it reaches the renderer — extracts just the meaningful part
 *  (e.g. "Incorrect password") for display, instead of leaking the IPC
 *  channel name and error class into the UI. */
export function formatEncryptionError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  if (message.includes('Incorrect password')) return 'Incorrect password'
  if (message.includes('Not a valid encrypted file')) return 'Not a valid encrypted file'
  return 'Failed to decrypt'
}
