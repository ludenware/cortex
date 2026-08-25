/** Pure filename-convention helpers for the optional per-file encryption
 *  feature — no crypto here (that needs Node's `crypto` module, which
 *  lives in electron/crypto-envelope.ts, outside this portable package's
 *  boundary — see that file's top comment). These are just string checks,
 *  so both the renderer (deciding whether to show a locked-note UI) and
 *  the main process (electron/crypto-envelope.ts re-exports these) can
 *  share one definition. */

/** True for a `name.ext.enc` path — a filename fact, not something
 *  requiring a content read. */
export function isEncryptedPath(relativePath: string): boolean {
  return relativePath.toLowerCase().endsWith('.enc')
}

/** `notes/Foo.md` -> `notes/Foo.md.enc` */
export function toEncryptedPath(relativePath: string): string {
  return `${relativePath}.enc`
}

/** `notes/Foo.md.enc` -> `notes/Foo.md` */
export function fromEncryptedPath(relativePath: string): string {
  return relativePath.replace(/\.enc$/i, '')
}
