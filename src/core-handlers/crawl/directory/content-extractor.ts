// R-DIR-20: Content extraction with auto-detection of main content area

import TurndownService from 'turndown'
import type { CheerioAPI } from 'cheerio'
import type { ExtractAs } from '../adapter/crawl-adapter.js'

const turndown = new TurndownService()

/** Elements to remove before content extraction (navigation chrome) */
const CHROME_SELECTORS = [
  'script', 'style', 'nav', 'header', 'footer',
  '.navbar', '.sidebar', '.menu', '.nav', '.navigation',
  '[role="navigation"]', '#treeDiv', '#searchDiv',
  'noscript', 'iframe',
]

/** Content area selectors in priority order */
const CONTENT_SELECTORS = [
  'main',
  'article',
  '[role="main"]',
  '.content',
  '#content',
  '.body',
]

/**
 * Extract the main content from a parsed HTML page.
 * Strips navigation chrome and auto-detects the content area.
 */
export function extractPageContent(
  $: CheerioAPI,
  format: ExtractAs,
  selector?: string,
): string {
  // Clone to avoid mutating the original cheerio instance
  const $clone = $.root().clone()
  const $doc = $.load($clone.html() ?? '')

  if (selector) {
    const content = $doc(selector)
    if (content.length > 0) {
      return formatContent($doc, content, format)
    }
    // Selector provided but no match -- fall through to auto-detect
  }

  // Remove chrome elements
  for (const sel of CHROME_SELECTORS) {
    $doc(sel).remove()
  }

  // Try content selectors in priority order
  for (const contentSel of CONTENT_SELECTORS) {
    const content = $doc(contentSel)
    if (content.length > 0) {
      return formatContent($doc, content.first(), format)
    }
  }

  // Fallback: use body after chrome removal
  const body = $doc('body')
  if (body.length > 0) {
    return formatContent($doc, body, format)
  }

  return ''
}

/**
 * Extract the page title from HTML.
 * Priority: first h1 > title tag > empty string.
 */
export function extractPageTitle($: CheerioAPI, fallbackFromUrl: string): string {
  const h1 = $('h1').first().text().trim()
  if (h1) return h1

  const title = $('title').first().text().trim()
  if (title) return title

  return fallbackFromUrl
}

function formatContent($: CheerioAPI, elements: any, format: ExtractAs): string {
  switch (format) {
    case 'markdown': {
      const html = $(elements).html() ?? ''
      return turndown.turndown(html).trim()
    }
    case 'html': {
      return $(elements).html() ?? ''
    }
    case 'text': {
      return $(elements).text().replace(/\s+/g, ' ').trim()
    }
    default:
      return turndown.turndown($(elements).html() ?? '').trim()
  }
}
