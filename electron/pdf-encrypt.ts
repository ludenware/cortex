import { app } from 'electron'
import { execFile } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Native PDF password-protection, via a vendored qpdf binary — see
 *  CLAUDE.md's encryption section for why this exists instead of an npm
 *  wrapper (node-qpdf has a live command-injection CVE; @jspawn/qpdf-wasm
 *  is abandoned) or a Cortex-only wrapper format (the user explicitly
 *  wanted a PDF that opens with a plain password prompt in any reader).
 *
 *  Binaries live in resources/qpdf/{mac,win,linux}/, checked into the repo
 *  (see resources/qpdf/CHECKSUMS.md) and shipped via electron-builder's
 *  `extraResources` (package.json). Always invoked through `execFile` with
 *  an argument *array* — never a shell string — which is immune to the
 *  injection class of bug regardless of what's in the password, by
 *  construction (no shell ever parses the arguments). */

function qpdfDir(): string {
  const base = app.isPackaged ? path.join(process.resourcesPath, 'qpdf') : path.join(__dirname, '../resources/qpdf')
  if (process.platform === 'darwin') return path.join(base, 'mac')
  if (process.platform === 'win32') return path.join(base, 'win')
  return path.join(base, 'linux')
}

function qpdfBinaryPath(): string {
  const dir = qpdfDir()
  return path.join(dir, process.platform === 'win32' ? 'qpdf.exe' : 'qpdf')
}

export class PdfEncryptError extends Error {
  constructor(message = 'Failed to password-protect PDF') {
    super(message)
    this.name = 'PdfEncryptError'
  }
}

/** Encrypts an existing PDF at `inputPath` into a new, password-protected
 *  PDF at `outputPath`, using the same password as both the user and owner
 *  password (matches the "one password to open" UX the export dialog
 *  offers — there's no separate "owner" concept exposed to the user). */
export function encryptPdf(inputPath: string, outputPath: string, password: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const binary = qpdfBinaryPath()
    // Linux's dynamic loader doesn't consult the executable's own directory
    // the way macOS (@executable_path) and Windows (default DLL search
    // order) do, so the bundled lib/ dir needs to be pointed to explicitly.
    const env = process.platform === 'linux'
      ? { ...process.env, LD_LIBRARY_PATH: [path.join(qpdfDir(), 'lib'), process.env.LD_LIBRARY_PATH].filter(Boolean).join(':') }
      : process.env
    execFile(
      binary,
      ['--encrypt', password, password, '256', '--', inputPath, outputPath],
      { env },
      (error) => {
        // qpdf's documented exit codes: 0 = success, 3 = succeeded with
        // warnings (e.g. a slightly malformed input it repaired on the
        // fly) — still a valid encrypted output, not a failure. Only
        // treat other non-zero codes as real errors.
        if (error && (error as NodeJS.ErrnoException & { code?: number }).code !== 3) {
          reject(new PdfEncryptError())
          return
        }
        resolve()
      }
    )
  })
}
