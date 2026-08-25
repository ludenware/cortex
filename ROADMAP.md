# Cortex Roadmap

This document tracks what's being worked on, what's planned, and what's being considered for Cortex. It's a living document — priorities can and will shift as the project evolves.

For a snapshot of what's already shipped, see the [Features](README.md#features) section of the README. This file is only about what's ahead.

---

## Now

***Actively being worked on.***

- contacts:
 information to contain a links section that shows all notes, diary, and calendar events that contains that individual contact

- export as PDF: function improvement

- images: function improvement

- attachments: function improvement

---

## Next

***Planned, not yet started.***

- spellcheck for notes and diary entries

- more settings categories: editor preferences (default save folder, spellcheck toggle once it exists), diary entry templates, a Data & Privacy category (local version history/backup, reveal vault in Finder), keyboard shortcuts reference

---

## Later

***On the radar, not yet scheduled.***

- iOS application

- android application

---

## Under Consideration

***Ideas being weighed — not committed to.***

- web-based application

---

## Recently Shipped

***Landed in the last release or two, kept here briefly for context before rolling off.***

**Unreleased (since v0.2.0)**
- Settings menu — opens in the center panel like notes/contacts/events, with a category sidebar (Appearance, About Cortex) and a consistent action row. Theme is now Light/Dark/System instead of a simple toggle; new Text Size setting (small/medium/large); Export/Reset settings
- About Cortex moved from a native popup into the Settings menu, with real GitHub/Bluesky/Mastodon links
- Internal: extracted a portable storage interface (`VaultFS`) as groundwork for an eventual mobile port — no user-facing change, but the desktop app's file I/O is no longer hardwired to Node-only APIs

**v0.2.0**
- Vault-wide search — persistent search bar + `Cmd/Ctrl+K` command palette across notes, diary, contacts, calendar events, and tags, including matching by tag membership (not just title/content)
- Calendar events now support tags, and open in the main panel (not a popup) with Read/Edit modes, plus the ability to link — and create on the fly — contacts, notes, and diary entries
- A consistent action row (Back navigation, Read/Edit toggle, Close/Delete) with matching sizing and alignment across notes, diary, contacts, and calendar events
- New underline formatting and a reorganized markdown toolbar
- Contact tagging on notes and diary
- Wikilinking for notes and diary
- PDF export for notes and diary entries
- Vault-selection safety guards to prevent accidental vault nesting
- App now launches maximized

---

## How to Propose Something

Bug reports, feature requests, and suggestions are welcome — [open an issue](https://github.com/ominatsune/cortex/issues) on GitHub.
