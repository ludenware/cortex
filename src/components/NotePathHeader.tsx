import { useLayoutEffect, useRef, useState } from 'react'
import { splitNoteHeaderSegments } from '../utils/note-meta'
import { truncateMiddlePath } from '../utils/path-truncate'
import '../styles/center-panel.css'

interface NotePathHeaderProps {
  content: string
  vaultName: string
  noteRelativePath: string | null
  compact?: boolean
}

const SAFETY_GAP_PX = 16

export default function NotePathHeader({
  content,
  vaultName,
  noteRelativePath,
  compact,
}: NotePathHeaderProps) {
  const { segments, title } = splitNoteHeaderSegments(noteRelativePath, content)
  const segmentsKey = segments.join('/')
  const containerRef = useRef<HTMLDivElement>(null)
  const [display, setDisplay] = useState<{ prefix: string; title: string }>({ prefix: '', title })

  // Read fresh on every recompute rather than captured in a closure — see
  // the mount-only effect below for why.
  const inputsRef = useRef({ vaultName, segments, title })
  inputsRef.current = { vaultName, segments, title }

  const recomputeRef = useRef<() => void>(() => {})
  recomputeRef.current = () => {
    const el = containerRef.current
    if (!el) return
    const { vaultName, segments, title } = inputsRef.current
    const headerRect = el.getBoundingClientRect()
    // `.action-row-center` is `position: fixed`, so it takes no space in
    // the flex row — .action-row-left can flex-grow well past where the
    // center buttons actually sit, and a long path would render right
    // underneath them (visually overlapping and blocking clicks). Measure
    // against the center cluster's real left edge, not this element's own
    // flex-computed width, so truncation always stops clear of it.
    const centerEl = document.querySelector('.action-row-center')
    const centerLeft = centerEl?.getBoundingClientRect().left
    const available = centerLeft !== undefined
      ? centerLeft - headerRect.left - SAFETY_GAP_PX
      : el.clientWidth
    if (available <= 0) return
    // Hard cap, independent of the smarter prefix/title truncation below:
    // .action-row-left is `flex: 1`, so its flex-computed width can extend
    // well past `available` regardless of what text is actually rendered
    // inside it (flexbox has no idea the fixed-position center buttons are
    // there). Without this, an edge case the segment-truncation algorithm
    // can't fully solve on its own — a title long enough that even the
    // maximally-collapsed "vaultName/.../title" doesn't fit, since the
    // title itself is never truncated — would render past this element's
    // own boundary and visually sit on top of "Go Back". Pinning max-width
    // here means the existing `overflow: hidden; text-overflow: ellipsis`
    // CSS always has a correctly-positioned boundary to clip against, so
    // that pathological case degrades to an ellipsized title instead of a
    // dangling, button-covering one.
    el.style.maxWidth = `${available}px`
    // Measured per-element, not once on the container: the title span
    // renders bold (see truncateMiddlePath's doc comment) and a single
    // shared font would underestimate its width.
    const prefixEl = el.querySelector('.note-path-prefix')
    const titleEl = el.querySelector('.note-path-title')
    const prefixFont = window.getComputedStyle(prefixEl ?? el).font
    const titleFont = window.getComputedStyle(titleEl ?? el).font
    setDisplay(truncateMiddlePath(vaultName, segments, title, available, prefixFont, titleFont))
  }

  // Mount-only: a single, stable ResizeObserver/resize-listener, never torn
  // down and recreated on content changes. ResizeObserver callbacks fire
  // asynchronously (queued for the next frame) — recreating the observer on
  // every keystroke (as an earlier version did, via a [..., title] dep
  // array) meant a callback already queued from the *previous* instance,
  // capturing an older/shorter title in its closure, could fire *after* a
  // newer one and overwrite a correctly-truncated result with a stale,
  // untruncated one. That race was rare while typing normally but easy to
  // hit typing fast enough to recreate the observer many times per frame.
  // Routing every callback through `recomputeRef.current()` (always the
  // latest version, reading `inputsRef` fresh) removes the race entirely —
  // there is nothing left to go stale.
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handleResize = () => recomputeRef.current()
    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(el)
    window.addEventListener('resize', handleResize)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  // Recompute immediately whenever the note/vault/title actually changes,
  // rather than waiting for a resize event.
  useLayoutEffect(() => {
    recomputeRef.current()
  }, [vaultName, segmentsKey, title])

  return (
    <div ref={containerRef} className={`note-path-header ${compact ? 'compact' : ''}`}>
      <span className="note-path-prefix">{display.prefix}</span>
      <strong className="note-path-title">{display.title}</strong>
    </div>
  )
}
