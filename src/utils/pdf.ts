import { renderMarkdownToHtml } from './pdf-markdown'

/** `markdown` is expected to already start with a single `# Title` heading
 *  line (CenterPanel.tsx's handleExportPdf ensures this for both notes,
 *  whose body already starts with one, and diary entries, whose title is
 *  prepended before calling this) — there's no separate app-branded
 *  header here, so the title only ever appears once, exactly like it does
 *  reading the note inside Cortex itself. */
export function buildPdfHtml(markdown: string): string {
  const body = renderMarkdownToHtml(markdown)
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      max-width: 700px;
      margin: 40px auto;
      padding: 0 20px;
      color: #1a1a1f;
      line-height: 1.7;
    }
    h1 { font-size: 2em; border-bottom: 2px solid #e5e5e5; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; margin-top: 1.5em; }
    h3 { font-size: 1.25em; margin-top: 1.2em; }
    h4 { font-size: 1.1em; margin-top: 1.2em; }
    h5 { font-size: 1em; margin-top: 1em; }
    h6 { font-size: 0.9em; margin-top: 1em; color: #555; }
    p { margin: 0.8em 0; }
    ul, ol { margin: 0.8em 0; padding-left: 1.5em; }
    li { margin: 0.3em 0; }
    ul:has(input[type='checkbox']) { list-style: none; padding-left: 1.2em; }
    li input[type='checkbox'] { margin-right: 6px; }
    blockquote { border-left: 3px solid #7c6aef; padding-left: 16px; margin: 0.8em 0; color: #666; }
    blockquote p { margin: 0.4em 0; }
    code { background: #f4f4f5; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    pre { background: #f4f4f5; padding: 16px; border-radius: 8px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #f9f9f9; }
    hr { border: none; border-top: 1px solid #e5e5e5; margin: 2em 0; }
  </style>
</head>
<body>
  ${body}
</body>
</html>`
}
