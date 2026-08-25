import ReactMarkdown, { defaultUrlTransform, type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'

/** Real markdown → HTML for PDF export, via the same `remark-gfm` +
 *  `remark-breaks` pipeline MarkdownPreview.tsx uses for in-app read mode —
 *  reusing it (rather than the old hand-rolled regex converter this
 *  replaced) is what makes headings h1-h6, ***bold italic***, ~~strike~~,
 *  checkboxes, and paragraph/line breaks all "just work" correctly, since
 *  they're now real CommonMark/GFM parsing instead of an ad-hoc regex
 *  approximation that only ever covered a handful of cases. */

function urlTransform(url: string): string {
  if (url.startsWith('underline://')) return url
  return defaultUrlTransform(url)
}

/** `++text++` -> a markdown link with a custom scheme, the same trick
 *  MarkdownPreview.tsx uses — kept in sync so the exported PDF matches
 *  what read-mode shows for underlined text. */
function preprocessUnderline(markdown: string): string {
  return markdown.replace(/\+\+(.+?)\+\+/g, (_match, text: string) => `[${text}](underline://)`)
}

/** Wikilinks and `@mentions` are click-to-navigate concepts that don't mean
 *  anything in a static PDF — render the plain title/name text instead of
 *  leaving the raw `[[...]]` syntax visible in the exported document. */
function preprocessWikiLinks(markdown: string): string {
  return markdown.replace(/\[\[([^\]]+)\]\]/g, (_match, title: string) => title.trim())
}

const components: Components = {
  a: ({ href, children }: { href?: string; children?: ReactNode }) => {
    if (href?.startsWith('underline://')) return <u>{children}</u>
    return <a href={href}>{children}</a>
  },
}

export function renderMarkdownToHtml(markdown: string): string {
  const processed = preprocessUnderline(preprocessWikiLinks(markdown))
  return renderToStaticMarkup(
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} urlTransform={urlTransform} components={components}>
      {processed}
    </ReactMarkdown>
  )
}
