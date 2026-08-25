import crypto from 'crypto'
import { isEncryptedPath, toEncryptedPath, fromEncryptedPath } from '@cortex/core'

export { isEncryptedPath, toEncryptedPath, fromEncryptedPath }

/** Shared encryption primitive for the optional per-file encryption feature
 *  (notes, and — see pdf-encrypt.ts/export handlers — encrypted DOCX/TXT
 *  exports). The actual cipher/key-derivation lives here rather than
 *  packages/core because it depends on Node's `crypto` module, which
 *  packages/core's tsconfig deliberately excludes (`"types": []`, no
 *  Node/DOM libs) to keep that package portable for the mobile-porting
 *  work — see CLAUDE.md's VaultFS section. (The pure filename-convention
 *  helpers — isEncryptedPath etc. — have no such dependency and live in
 *  packages/core/src/encrypted-path.ts instead, re-exported here so
 *  existing imports from this file keep working; the renderer imports
 *  them directly from `@cortex/core` instead, since it can't reach this
 *  main-process-only file.) If a mobile backend ever needs the same
 *  envelope format, re-derive it there using the platform's own crypto
 *  primitives (e.g. Web Crypto's PBKDF2 + AES-GCM) — the *format* (below)
 *  is what needs to match, not this specific implementation. */

const SCRYPT_KEY_LENGTH = 32 // 256-bit key for AES-256
const SALT_LENGTH = 16
const IV_LENGTH = 12 // recommended nonce length for AES-GCM
const ENVELOPE_VERSION = 1

export class DecryptionError extends Error {
  constructor(message = 'Incorrect password') {
    super(message)
    this.name = 'DecryptionError'
  }
}

interface Envelope {
  v: number
  salt: string
  iv: string
  authTag: string
  ciphertext: string
}

function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH)
}

/** Encrypts arbitrary bytes with a freshly-generated salt/IV, returning a
 *  self-contained JSON envelope (as a UTF-8 buffer) — everything needed to
 *  decrypt is in the envelope except the password itself. */
export function encryptEnvelope(plaintext: Buffer, password: string): Buffer {
  const salt = crypto.randomBytes(SALT_LENGTH)
  const iv = crypto.randomBytes(IV_LENGTH)
  const key = deriveKey(password, salt)

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const authTag = cipher.getAuthTag()

  const envelope: Envelope = {
    v: ENVELOPE_VERSION,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  }
  return Buffer.from(JSON.stringify(envelope), 'utf-8')
}

/** Decrypts an envelope produced by `encryptEnvelope`. Throws
 *  `DecryptionError` for a wrong password (GCM auth-tag mismatch) or a
 *  malformed envelope — never returns silently-wrong plaintext. */
export function decryptEnvelope(data: Buffer, password: string): Buffer {
  let envelope: Envelope
  try {
    envelope = JSON.parse(data.toString('utf-8'))
  } catch {
    throw new DecryptionError('Not a valid encrypted file')
  }
  if (envelope.v !== ENVELOPE_VERSION || !envelope.salt || !envelope.iv || !envelope.authTag || !envelope.ciphertext) {
    throw new DecryptionError('Not a valid encrypted file')
  }

  try {
    const salt = Buffer.from(envelope.salt, 'base64')
    const iv = Buffer.from(envelope.iv, 'base64')
    const authTag = Buffer.from(envelope.authTag, 'base64')
    const ciphertext = Buffer.from(envelope.ciphertext, 'base64')
    const key = deriveKey(password, salt)

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()])
  } catch {
    // Wrong password or corrupted data both surface here — GCM's auth tag
    // check throws on final() when either is true, and we deliberately
    // don't distinguish the two (doing so would leak whether a guessed
    // password was "close").
    throw new DecryptionError()
  }
}
