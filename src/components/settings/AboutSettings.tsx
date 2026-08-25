import { useEffect, useState } from 'react'
import { Facebook, Github, Instagram } from 'lucide-react'
import AppLogo from '../AppLogo'
import { BlueskyIcon, MastodonIcon, XIcon } from '../icons/SocialIcons'

export default function AboutSettings() {
  const [version, setVersion] = useState('')

  useEffect(() => {
    window.cortex.app.getVersion().then(setVersion).catch(() => {})
  }, [])

  return (
    <div className="about-settings">
      <div className="about-hero">
        <AppLogo variant="full" size="xxxxl" className="about-hero-logo" />
          <div className="about-version-badge">v {version}
        </div>
        <p className="about-tagline">Free, Open-Source, and made with love.</p>
      </div>

      <div className="about-zones">
        <a
          className="about-zone-ludenware"
          href="https://github.com/ludenware"
          target="_blank"
          rel="noreferrer"
        >
          <img
            src={`${import.meta.env.BASE_URL}ludenware-logo.png`}
            alt="Ludenware"
            width={180}
            height={180}
            className="about-ludenware-zone-logo"
          />
        </a>

        <div className="about-zone-links">
          <div className="about-card">
            <h3 className="about-links-title">Follow The Development</h3>
            <a
              className="about-link"
              href="https://github.com/ludenware/cortex"
              target="_blank"
              rel="noreferrer"
            >
              <Github size={20} />
              github.com/ludenware/cortex
            </a>
          </div>

          <div className="repo-card">
            <h3 className="about-links-title">Visit Our Repository</h3>
            <a
              className="repo-link"
              href="https://github.com/ludenware"
              target="_blank"
              rel="noreferrer"
            >
              <Github size={20} />
              github.com/ludenware
            </a>
          </div>

          <div className="about-card">
            <h3 className="about-links-title">Connect With Us</h3>
            <a
              className="about-link"
              href="https://x.com/ludenware"
              target="_blank"
              rel="noreferrer"
            >
              <XIcon size={20} />
              @ludenware
            </a>
            <a
              className="about-link"
              href="https://instagram.com/ludenware"
              target="_blank"
              rel="noreferrer"
            >
              <Instagram size={20} />
              @ludenware
            </a>
            <a
              className="about-link"
              href="https://facebook.com/ludenware"
              target="_blank"
              rel="noreferrer"
            >
              <Facebook size={20} />
              @ludenware
            </a>
            <a
              className="about-link"
              href="https://bsky.app/profile/ludenware.bsky.social"
              target="_blank"
              rel="noreferrer"
            >
              <BlueskyIcon size={20} />
              @ludenware
            </a>
            <a
              className="about-link"
              href="https://fosstodon.org/@ludenware"
              target="_blank"
              rel="noreferrer"
            >
              <MastodonIcon size={20} />
              @ludenware
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
