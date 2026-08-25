interface IconProps {
  size?: number
}

// Simplified glyphs (not the exact official brand marks) — lucide-react
// doesn't ship Bluesky/Mastodon icons, and these are close enough for a
// small "connect with us" link without pulling in a brand-icon dependency.

// The hand-drawn paths below (Bluesky, Mastodon) don't fill their 24x24
// viewBox the way a professionally-metered icon set (lucide's Github, or
// XIcon below) does — measured via getBBox(), they sit in a ~15x13 and
// ~16x15 box respectively with 4.5-5px margins, versus lucide's ~2px. Left
// unscaled, they visibly read smaller and shifted right next to Github/X
// in a row of same-size icons. Each `<g transform>` rescales the path to
// occupy the same ~20x20 footprint (2px margin, matching Github) that the
// other icons use, computed from the exact measured bounding box rather
// than eyeballed — verified after via the same getBBox measurement.
export function BlueskyIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <g transform="translate(2 3.316) scale(1.3333) translate(-4.5 -4.5)">
        <path d="M12 9c-1.5-2.5-4-4.5-6-4.5-1 0-1.5.5-1.5 1.5 0 1 .3 4 .8 5 .7 1.5 2.3 2 4.2 1.7-1.8.3-4 1.2-1.7 3.8 2.3 2.6 3.4-.3 4.2-2.5.8 2.2 1.9 5.1 4.2 2.5 2.3-2.6.1-3.5-1.7-3.8 1.9.3 3.5-.2 4.2-1.7.5-1 .8-4 .8-5 0-1-.5-1.5-1.5-1.5-2 0-4.5 2-6 4.5z" />
      </g>
    </svg>
  )
}

export function XIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

export function MastodonIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <g transform="translate(2 2.578) scale(1.25) translate(-5 -3)">
        <path d="M12 3C8 3 5 4 5 8v4c0 3.5 2 5.5 5 6 .7.1 1.4.1 2 0v-2.5c-2 .1-3.5-.5-4-2 1.4.7 3 1 5 1s3.6-.3 5-1c-.5 1.5-2 2.1-4 2v2.5c.6.1 1.3.1 2 0 3-.5 5-2.5 5-6V8c0-4-3-5-7-5z" />
        <path d="M9 8c.6 0 1 .4 1 1v2H8V9c0-.6.4-1 1-1z" />
        <path d="M15 8c.6 0 1 .4 1 1v2h-2V9c0-.6.4-1 1-1z" />
      </g>
    </svg>
  )
}
