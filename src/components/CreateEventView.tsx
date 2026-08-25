import { useEffect, useState } from 'react'
import { format, addDays, subDays } from 'date-fns'
import { ChevronLeft, ChevronRight, X, FileText, BookOpen } from 'lucide-react'
import type { CalendarEvent, Contact } from '../types'
import EventLinkSection from './EventLinkSection'
import ContactPickerField from './ContactPickerField'
import ActionRow from './ActionRow'
import ActionButton from './ActionButton'
import '../styles/center-panel.css'

interface NoteOption {
  name: string
  path: string
}

interface CreateEventViewProps {
  date: Date
  canGoBack?: boolean
  onNavBack?: () => void
  onClose: () => void
  onCreated: (event: CalendarEvent) => void
  onError: (msg: string) => void
}

/** The full-canvas "New Event" form — same shell (ActionRow + note-canvas
 *  card) as every other content type, replacing what used to be the app's
 *  one remaining popup modal so creating an event follows the same
 *  navigate-into-the-canvas flow as everything else. */
export default function CreateEventView({ date, canGoBack, onNavBack, onClose, onCreated, onError }: CreateEventViewProps) {
  const [formDate, setFormDate] = useState(date)
  const [title, setTitle] = useState('')
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('10:00')
  const [allDay, setAllDay] = useState(false)
  const [location, setLocation] = useState('')
  const [allContacts, setAllContacts] = useState<Contact[]>([])
  const [allNotes, setAllNotes] = useState<NoteOption[]>([])
  const [allDiaryDates, setAllDiaryDates] = useState<string[]>([])
  const [withContacts, setWithContacts] = useState<Contact[]>([])
  const [withNotes, setWithNotes] = useState<NoteOption[]>([])
  const [withDiaryDates, setWithDiaryDates] = useState<string[]>([])
  const [pickNote, setPickNote] = useState('')
  const [pickDiary, setPickDiary] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  useEffect(() => {
    void Promise.all([
      window.cortex.contacts.list(),
      window.cortex.storage.listFiles('notes'),
      window.cortex.storage.listDiaryDates(),
    ]).then(([contacts, notes, diaryDates]) => {
      setAllContacts(contacts)
      setAllNotes(notes)
      setAllDiaryDates([...diaryDates].sort((a, b) => b.localeCompare(a)))
    }).catch(() => onError('Failed to load contacts/notes/diary for linking'))
  }, [onError])

  const availableNotes = allNotes.filter((n) => !withNotes.some((w) => w.path === n.path))
  const availableDiaryDates = allDiaryDates.filter((d) => !withDiaryDates.includes(d))

  const addNote = () => {
    const note = allNotes.find((n) => n.path === pickNote)
    if (note) { setWithNotes((prev) => [...prev, note]); setPickNote('') }
  }
  const removeNote = (path: string) => setWithNotes((prev) => prev.filter((n) => n.path !== path))

  const addDiary = () => {
    if (!pickDiary) return
    setWithDiaryDates((prev) => [...prev, pickDiary].sort((a, b) => b.localeCompare(a)))
    setPickDiary('')
  }
  const removeDiary = (d: string) => setWithDiaryDates((prev) => prev.filter((x) => x !== d))

  const addContact = (contact: Contact) => setWithContacts((prev) => [...prev, contact])
  const removeContact = (id: string) => setWithContacts((prev) => prev.filter((c) => c.id !== id))
  const createContact = async (name: string): Promise<Contact | null> => {
    try {
      const created = await window.cortex.contacts.create({ name, tags: [] })
      setAllContacts((prev) => [...prev, created])
      addContact(created)
      return created
    } catch {
      onError('Failed to create contact')
      return null
    }
  }

  const addTag = (raw: string) => {
    const tag = raw.toLowerCase().replace(/^#/, '').trim()
    if (!tag || tags.includes(tag)) return
    setTags((prev) => [...prev, tag].sort())
    setTagInput('')
  }
  const removeTag = (tag: string) => setTags((prev) => prev.filter((t) => t !== tag))

  const handleCreate = async () => {
    if (!title.trim()) return
    const dateStr = format(formDate, 'yyyy-MM-dd')
    const startIso = allDay ? new Date(`${dateStr}T00:00:00`).toISOString() : new Date(`${dateStr}T${start}:00`).toISOString()
    const endIso = allDay ? new Date(`${dateStr}T23:59:59`).toISOString() : new Date(`${dateStr}T${end}:00`).toISOString()
    try {
      const created = await window.cortex.calendar.createEvent({
        title: title.trim(),
        start: startIso,
        end: endIso,
        allDay,
        location: location || undefined,
        contactIds: withContacts.length > 0 ? withContacts.map((c) => c.id) : undefined,
        notePaths: withNotes.length > 0 ? withNotes.map((n) => n.path) : undefined,
        diaryDates: withDiaryDates.length > 0 ? withDiaryDates : undefined,
        tags: tags.length > 0 ? tags : undefined,
      })
      onCreated(created)
    } catch {
      onError('Failed to create event')
    }
  }

  return (
    <main className="center-panel">
      <ActionRow
        left={
          <div className="event-form-date-nav">
            <button type="button" onClick={() => setFormDate((d) => subDays(d, 1))} aria-label="Previous day">
              <ChevronLeft size={16} />
            </button>
            <span>{format(formDate, 'yyyy-MM-dd')}</span>
            <button type="button" onClick={() => setFormDate((d) => addDays(d, 1))} aria-label="Next day">
              <ChevronRight size={16} />
            </button>
          </div>
        }
        center={<ActionButton main="GO" sub="BACK" disabled={!canGoBack} onClick={() => onNavBack?.()} />}
        right={
          <>
            <ActionButton main="CANCEL" sub="EVENT" onClick={onClose} />
            <ActionButton main="CREATE" sub="EVENT" onClick={() => void handleCreate()} disabled={!title.trim()} />
          </>
        }
      />

      <div className="event-view-outer note-canvas">
        <div className="event-view-body">
          <div className="form-group">
            <label>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Start Time</label>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} disabled={allDay} />
            </div>
            <div className="form-group">
              <label>End Time</label>
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} disabled={allDay} />
            </div>
          </div>
          <div className="form-group form-group-checkbox">
            <label>
              <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
              All Day
            </label>
          </div>
          <div className="form-group">
            <label>Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>

          <ContactPickerField
            label="With"
            linkedContacts={withContacts}
            allContacts={allContacts}
            onAdd={addContact}
            onRemove={removeContact}
            onCreate={createContact}
          />

          <EventLinkSection
            title="Notes"
            icon={FileText}
            chips={withNotes.map((n) => ({ key: n.path, label: n.name }))}
            available={availableNotes.map((n) => ({ value: n.path, label: n.name }))}
            picked={pickNote}
            onPickedChange={setPickNote}
            onAdd={addNote}
            onRemove={removeNote}
            emptyLabel="No notes linked"
            addPlaceholder="Add a note…"
          />

          <EventLinkSection
            title="Diary entries"
            icon={BookOpen}
            chips={withDiaryDates.map((d) => ({ key: d, label: d }))}
            available={availableDiaryDates.map((d) => ({ value: d, label: d }))}
            picked={pickDiary}
            onPickedChange={setPickDiary}
            onAdd={addDiary}
            onRemove={removeDiary}
            emptyLabel="No diary entries linked"
            addPlaceholder="Add a diary entry…"
          />

          <div className="form-group event-form-tags">
            <label>Tags</label>
            {tags.length > 0 && (
              <div className="event-form-tags-chips">
                {tags.map((tag) => (
                  <span key={tag} className="event-form-tag-chip">
                    #{tag}
                    <button type="button" onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`}>
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              value={tagInput}
              placeholder="Add tag…"
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (tagInput.trim()) addTag(tagInput)
                }
              }}
              onBlur={() => { if (tagInput.trim()) addTag(tagInput) }}
            />
          </div>
        </div>
      </div>
    </main>
  )
}
