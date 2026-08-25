export interface DirEntry {
  name: string
  isDirectory: boolean
}

export interface VaultStat {
  mtime: string
  size: number
  isDirectory: boolean
}

/** Backend-agnostic contract for reading/writing inside an already-open
 *  vault, addressed entirely by vault-relative paths. Desktop implements
 *  this with Node's `fs`; a future mobile backend implements the same
 *  contract against its own storage APIs — nothing above this interface
 *  needs to change when that happens. */
export interface VaultFS {
  readFile(relativePath: string): Promise<string>
  writeFile(relativePath: string, content: string): Promise<void>
  mkdir(relativePath: string): Promise<void>
  readdir(relativePath: string): Promise<DirEntry[]>
  stat(relativePath: string): Promise<VaultStat>
  exists(relativePath: string): Promise<boolean>
  remove(relativePath: string): Promise<void>
  rename(fromRelativePath: string, toRelativePath: string): Promise<void>
}
