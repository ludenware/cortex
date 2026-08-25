import type { Contact } from '@cortex/core'
import { VAULT_FOLDERS, withFileTypeLine, stripFileTypeLine } from '@cortex/core'
import { v4 as uuidv4 } from 'uuid'
import { buildFrontmatter, parseFrontmatter, sanitizeFileName } from './markdown-files'
import { vaultFs } from './node-vault-fs'

function contactsDir(): string {
  return VAULT_FOLDERS.CONTACTS
}

function contactFilePath(id: string, name: string): string {
  return `${contactsDir()}/${sanitizeFileName(name)}-${id.slice(0, 8)}.md`
}

function isPresentContactField(value: string | undefined): value is string {
  if (!value) return false
  const trimmed = value.trim()
  return trimmed.length > 0 && trimmed.toLowerCase() !== 'none'
}

export function parseContactFile(raw: string): Contact | null {
  const stripped = stripFileTypeLine(raw)
  const { meta, body } = parseFrontmatter(stripped)
  if (!meta.id || !meta.name) return null
  return {
    id: meta.id,
    name: meta.name,
    email: meta.email || undefined,
    phone: meta.phone || undefined,
    company: isPresentContactField(meta.company) ? meta.company : undefined,
    notes: body.trim() || undefined,
    tags: meta.tags ? meta.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    created: meta.created ?? new Date().toISOString(),
    modified: meta.modified ?? new Date().toISOString(),
  }
}

async function writeContactFile(contact: Contact, existingPath?: string): Promise<string> {
  await vaultFs.mkdir(contactsDir())
  const filePath = existingPath ?? contactFilePath(contact.id, contact.name)
  const content = withFileTypeLine(
    'contact',
    buildFrontmatter(
      {
        id: contact.id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
        tags: contact.tags,
        created: contact.created,
        modified: contact.modified,
      },
      contact.notes ?? ''
    )
  )
  await vaultFs.writeFile(filePath, content)
  return filePath
}

async function findContactFile(id: string): Promise<string | null> {
  let entries
  try {
    entries = await vaultFs.readdir(contactsDir())
  } catch {
    return null
  }
  for (const entry of entries) {
    if (entry.isDirectory || !entry.name.endsWith('.md')) continue
    const filePath = `${contactsDir()}/${entry.name}`
    const raw = await vaultFs.readFile(filePath)
    const contact = parseContactFile(raw)
    if (contact?.id === id) return filePath
  }
  return null
}

export async function listContacts(): Promise<Contact[]> {
  let entries
  try {
    entries = await vaultFs.readdir(contactsDir())
  } catch {
    return []
  }

  const contacts: Contact[] = []
  for (const entry of entries) {
    if (entry.isDirectory || !entry.name.endsWith('.md')) continue
    const raw = await vaultFs.readFile(`${contactsDir()}/${entry.name}`)
    const contact = parseContactFile(raw)
    if (contact) contacts.push(contact)
  }
  return contacts.sort((a, b) => a.name.localeCompare(b.name))
}

export async function createContact(
  input: Omit<Contact, 'id' | 'created' | 'modified'>
): Promise<Contact> {
  const now = new Date().toISOString()
  const contact: Contact = {
    ...input,
    id: uuidv4(),
    tags: input.tags ?? [],
    created: now,
    modified: now,
  }
  await writeContactFile(contact)
  return contact
}

export async function updateContact(
  id: string,
  updates: Partial<Omit<Contact, 'id' | 'created'>>
): Promise<Contact | null> {
  const filePath = await findContactFile(id)
  if (!filePath) return null

  const raw = await vaultFs.readFile(filePath)
  const existing = parseContactFile(raw)
  if (!existing) return null

  const updated: Contact = {
    ...existing,
    ...updates,
    modified: new Date().toISOString(),
  }

  if (updates.name && updates.name !== existing.name) {
    await vaultFs.remove(filePath)
    await writeContactFile(updated)
  } else {
    await writeContactFile(updated, filePath)
  }
  return updated
}

export async function deleteContact(id: string): Promise<boolean> {
  const filePath = await findContactFile(id)
  if (!filePath) return false
  await vaultFs.remove(filePath)
  return true
}

export async function getContactByRelativePath(relativePath: string): Promise<Contact | null> {
  try {
    const raw = await vaultFs.readFile(relativePath)
    return parseContactFile(raw)
  } catch {
    return null
  }
}

export async function getContactFilePath(id: string): Promise<string | null> {
  return findContactFile(id)
}
