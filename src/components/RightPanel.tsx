import { Calendar, Link2 } from 'lucide-react'
import CalendarPanel from './CalendarPanel'
import LinksPanel from './LinksPanel'
import type { CalendarEvent, Contact } from '../types'
import '../styles/right-panel.css'

export type FeatureZone = 'calendar' | 'links'

interface RightPanelProps {
  featureZone: FeatureZone
  onFeatureZoneChange: (zone: FeatureZone) => void
  selectedPath: string | null
  noteContent: string
  onOpenNote: (path: string, name: string) => void
  refreshKey: number
  diaryRefreshKey?: number
  onError: (msg: string) => void
  onRefresh: () => void
  focusEvent?: CalendarEvent | null
  onClearFocusEvent?: () => void
  onOpenDiaryEntry?: (dateStr: string) => void
  onCloseDiaryEntry?: (dateStr: string) => void
  onOpenEvent?: (event: CalendarEvent) => void
  onOpenContact?: (contact: Contact) => void
  onCreateEvent?: (date: Date) => void
  openEventId?: string | null
}

const FEATURE_TABS: { id: FeatureZone; label: string; icon: typeof Calendar }[] = [
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'links', label: 'Links', icon: Link2 },
]

export default function RightPanel({
  featureZone,
  onFeatureZoneChange,
  selectedPath,
  noteContent,
  onOpenNote,
  refreshKey,
  diaryRefreshKey,
  onError,
  onRefresh,
  focusEvent,
  onClearFocusEvent,
  onOpenDiaryEntry,
  onCloseDiaryEntry,
  onOpenEvent,
  onOpenContact,
  onCreateEvent,
  openEventId,
}: RightPanelProps) {
  return (
    <aside className="right-panel">
      <div className="right-panel-nav">
        {FEATURE_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`right-panel-tab ${featureZone === id ? 'active' : ''}`}
            onClick={() => onFeatureZoneChange(id)}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      <div className="right-panel-body">
        {featureZone === 'calendar' && (
          <CalendarPanel
            onError={onError}
            onRefresh={onRefresh}
            onCloseDiaryEntry={onCloseDiaryEntry}
            focusEvent={focusEvent}
            onClearFocusEvent={onClearFocusEvent}
            onOpenDiaryEntry={onOpenDiaryEntry}
            onOpenEvent={onOpenEvent}
            onOpenContact={onOpenContact}
            onCreateEvent={onCreateEvent}
            diaryRefreshKey={diaryRefreshKey}
            fileRefreshKey={refreshKey}
            openEventId={openEventId}
          />
        )}
        {featureZone === 'links' && (
          <LinksPanel
            selectedPath={selectedPath}
            noteContent={noteContent}
            refreshKey={refreshKey}
            onOpenNote={onOpenNote}
            onError={onError}
          />
        )}
      </div>
    </aside>
  )
}
