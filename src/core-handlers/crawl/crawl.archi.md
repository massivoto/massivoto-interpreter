# Architecture: Crawl Handlers

**Last updated:** 2026-03-13

## Parent

- [Interpreter](../../../interpreter.archi.md)

## Children

- (none -- leaf module)

## Overview

The Crawl module adds 6 OTO commands (`@crawl/session/open`, `@crawl/page`, `@crawl/follow`, `@crawl/extract`, `@crawl/example`, `@crawl/fetch`) that let users fetch, navigate, and extract data from websites directly inside OTO programs. Crawl output flows into existing OTO primitives (`@file/save`, `collect=`, `if=`, `while=`) with no glue code.

The module operates in two distinct modes:

- **No-AI mode (manual selectors):** The user provides explicit CSS selectors or text patterns via command arguments (`selector=`, `follow=`, `as=`). The crawl loop is fully deterministic -- no AI calls are made. This is the default for `@crawl/fetch`, `@crawl/extract`, and `@crawl/follow` when used without `@crawl/example`.

- **AI mode (learned selectors):** The user calls `@crawl/example` one or more times with example pages and a natural-language `prompt=`. An AI provider analyzes the HTML and produces CSS selectors (stored in `session.learnedSelectors`). Subsequent `@crawl/extract` and `@crawl/follow` calls use these learned selectors automatically. The AI is invoked **once per example call**, not per page -- the crawl loop remains deterministic after learning.

All commands share a common `CrawlAdapter` interface for fetching HTML, allowing the fetch layer to be swapped (mock for tests, `SimpleCrawlAdapter` for lightweight use, future `CrawleeAdapter` for production with rate limiting and robots.txt).

## Diagram

```
                    ┌──────────────────────────────────────────────────┐
                    │                OTO Program                       │
                    │                                                  │
                    │  @crawl/session/open url=... output=session      │
                    │  @crawl/example url=... prompt=... session=...   │  <-- AI mode (optional)
                    │  @block/begin while={session.hasNext}            │
                    │    @crawl/page session=... output=page           │
                    │    @crawl/extract session=... input=page         │
                    │    @crawl/follow session=... input=page          │
                    │  @block/end                                      │
                    └──────────────────────┬───────────────────────────┘
                                           │
              ┌────────────────────────────┼────────────────────────────┐
              │                            │                            │
              ▼                            ▼                            ▼
   ┌─────────────────┐        ┌─────────────────┐         ┌─────────────────────┐
   │ Session Handlers │        │  Page Pipeline  │         │  One-Shot Handler   │
   ├─────────────────┤        ├─────────────────┤         ├─────────────────────┤
   │ SessionOpen     │        │ CrawlPage       │         │ CrawlFetch          │
   │ CrawlExample    │        │ CrawlExtract    │         │ (no session needed) │
   │                 │        │ CrawlFollow     │         │                     │
   └────────┬────────┘        └────────┬────────┘         └──────────┬──────────┘
            │                          │                              │
            ▼                          ▼                              ▼
   ┌─────────────────────────────────────────────────────────────────────────────┐
   │                              CrawlAdapter                                  │
   ├─────────────────────────────────────────────────────────────────────────────┤
   │  fetch(url, options) -> CrawlPage { url, status, html, cheerio }          │
   │  createQueue()       -> CrawlQueue                                        │
   ├──────────────────────┬─────────────────────┬───────────────────────────────┤
   │  MockCrawlAdapter    │  SimpleCrawlAdapter  │  (future) CrawleeAdapter     │
   │  (unit tests)        │  (real HTTP/cheerio)  │  (rate limit, robots.txt)   │
   └──────────────────────┴─────────────────────┴───────────────────────────────┘
```

### AI Mode vs No-AI Mode

```
  NO-AI MODE (manual selectors)              AI MODE (learned selectors)
  ──────────────────────────────             ───────────────────────────────

  User provides CSS/text args:               User calls @crawl/example with prompt:

  @crawl/follow follow="a.next"              @crawl/example url=... prompt="Extract
  @crawl/extract selector=".title"              album title, artist. Follow pagination."
  @crawl/fetch url=... selector="h1"
                                             AI analyzes HTML once per example call
         │                                   and produces LearnedSelectors:
         │                                     { follow: ["a.next-page"],
         ▼                                       extract: [
  ┌──────────────┐                                 { field:"title", selector:"h2.album",
  │  Deterministic│                                   as:"text" },
  │  CSS query   │                                 { field:"artist", selector:".artist",
  │  via Cheerio │                                   as:"text" }
  └──────────────┘                               ] }
                                                     │
  No AI calls.                                       ▼
  No cost.                                   ┌──────────────────┐
  Full user control.                         │  Stored in        │
                                             │  session.learned  │
                                             │  Selectors        │
                                             └────────┬─────────┘
                                                      │
                                                      ▼
                                             ┌──────────────────┐
                                             │  Crawl loop uses │
                                             │  learned CSS --  │
                                             │  deterministic,  │
                                             │  no more AI calls│
                                             └──────────────────┘

  KEY DIFFERENCE:
  - No-AI: selectors come from command args (user writes CSS)
  - AI: selectors come from @crawl/example (AI writes CSS once)
  - In both modes, the page-by-page crawl loop is deterministic
  - AI cost = number of @crawl/example calls, NOT number of pages
```

## Key Components

| Component | File | Responsibility |
|-----------|------|----------------|
| `CrawlAdapter` | adapter/crawl-adapter.ts | Interface for fetching pages and creating queues. Defines all shared types (`CrawlPage`, `CrawlQueue`, `LearnedSelectors`, `ExtractSelector`, `ExtractAs`, `CrawlSessionConfig`). |
| `InMemoryCrawlQueue` | adapter/in-memory-crawl-queue.ts | URL queue with deduplication via visited set. FIFO order, `add()` silently skips visited/queued URLs. |
| `MockCrawlAdapter` | adapter/mock-crawl-adapter.ts | Test adapter with pre-configured pages. Returns 404 for unknown URLs. |
| `SimpleCrawlAdapter` | adapter/simple-crawl-adapter.ts | Real HTTP fetch + cheerio parsing. No rate limiting or robots.txt. Lightweight alternative for integration tests. |
| `CrawlSession` | session/crawl-session.ts | Session state: queue, config, pageCount, learnedSelectors, basePrompt, examplePages. `hasNext` checks both queue and page limit. |
| `SessionOpenHandler` | session/session-open.handler.ts | `@crawl/session/open` -- creates session, validates URL, seeds queue with start URL. |
| `CrawlPageHandler` | page/crawl-page.handler.ts | `@crawl/page` -- dequeues next URL, fetches via adapter, increments pageCount. HTTP errors are non-fatal. |
| `CrawlFollowHandler` | follow/crawl-follow.handler.ts | `@crawl/follow` -- extracts links from page using CSS or text selectors, filters to same-domain, adds to queue. |
| `isCssSelector` / `textToSelector` | follow/selector-resolver.ts | Distinguishes CSS selectors from plain text. Text triggers case-insensitive anchor text matching. |
| `CrawlExtractHandler` | extract/crawl-extract.handler.ts | `@crawl/extract` -- extracts data using manual `selector=` or learned selectors. Formats output via `as=` (text, markdown, html, images, links). Uses `turndown` for markdown conversion. |
| `CrawlExampleHandler` | example/crawl-example.handler.ts | `@crawl/example` -- fetches example page, manages prompt inheritance, calls AI provider to produce `LearnedSelectors`. The only component that invokes AI. |
| `DummyAI` | example/dummy-ai.ts | Test AI provider returning pre-configured `LearnedSelectors` JSON. Implements `AiProvider` interface. |
| `CrawlFetchHandler` | fetch/crawl-fetch.handler.ts | `@crawl/fetch` -- one-shot fetch + optional extract. No session required. Standalone convenience command. |
| `index.ts` | index.ts | Re-exports all handlers, classes, and types from the crawl module. |

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SESSION CRAWL PIPELINE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. SESSION OPEN                                                           │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  @crawl/session/open url="https://..." limit=50                      │ │
│  │                                                                       │ │
│  │  validate URL -> create CrawlSession -> seed queue with start URL    │ │
│  │  output: CrawlSession { config, queue:[startUrl], pageCount:0 }      │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                       │                                     │
│                                       ▼                                     │
│  2. EXAMPLE (optional -- enables AI mode)                                  │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  @crawl/example url="..." prompt="Extract title, author..."          │ │
│  │                                                                       │ │
│  │  fetch page -> apply prompt inheritance -> send ALL example HTML      │ │
│  │  + accumulated prompt to AI provider -> parse JSON response           │ │
│  │  -> store LearnedSelectors in session                                 │ │
│  │                                                                       │ │
│  │  AI call count: exactly 1 per @crawl/example invocation              │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                       │                                     │
│                                       ▼                                     │
│  3. CRAWL LOOP (while session.hasNext)                                     │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  @crawl/page                                                          │ │
│  │    queue.next() -> adapter.fetch(url) -> pageCount++ -> CrawlPage    │ │
│  │                                                                       │ │
│  │  @crawl/extract                                                       │ │
│  │    resolve selectors (manual or learned) -> query cheerio DOM         │ │
│  │    -> format output (text/markdown/html/images/links)                 │ │
│  │                                                                       │ │
│  │  @crawl/follow                                                        │ │
│  │    resolve follow selectors -> find <a> hrefs -> resolve relative     │ │
│  │    -> filter same-domain -> deduplicate -> add to queue               │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                       │                                     │
│                                       ▼                                     │
│  4. TERMINATION                                                            │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  session.hasNext returns false when:                                   │ │
│  │    - pageCount >= config.limit  (safety cap)                          │ │
│  │    - queue is empty             (no more URLs to visit)               │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                      ONE-SHOT FETCH PIPELINE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  @crawl/fetch url="..." [selector="..."] [as="markdown"]                   │
│                                                                             │
│  adapter.fetch(url) -> if selector: query DOM + format                     │
│                      -> if no selector: format full page                    │
│                                                                             │
│  No session. No queue. No AI. Single request, single response.             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                     SELECTOR RESOLUTION HIERARCHY                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  For @crawl/follow:                                                        │
│    1. follow= arg looks like CSS (contains . # > [ : + ~)  -> use as CSS  │
│    2. follow= arg is plain text (e.g. "Next Page")                         │
│       -> match <a> elements whose text contains the string (insensitive)   │
│    3. No follow= arg -> use session.learnedSelectors.follow                │
│    4. No learned selectors either -> error                                  │
│                                                                             │
│  For @crawl/extract:                                                       │
│    1. selector= arg provided -> use as CSS, format with as= (default text)│
│    2. No selector= but session has learned extract selectors               │
│       -> extract each field with its own selector and as type              │
│    3. as= command arg overrides all learned per-field as types             │
│    4. No selector and no learned selectors -> error                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Interfaces

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             CrawlAdapter                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  fetch(url, options?) : Promise<CrawlPage>                                 │
│  createQueue()        : CrawlQueue                                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              CrawlPage                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  url         : string        // fetched URL                                │
│  status      : number        // HTTP status (0 on network failure)         │
│  html        : string        // raw HTML body                              │
│  cheerio     : CheerioAPI    // parsed DOM for CSS queries                 │
│  contentType : string        // e.g. "text/html"                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              CrawlQueue                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  add(url)           : void           // skip if visited or already queued  │
│  addMany(urls)      : void           // batch add with dedup              │
│  next()             : string | null  // FIFO dequeue, marks visited       │
│  hasNext()          : boolean                                              │
│  isVisited(url)     : boolean                                              │
│  markVisited(url)   : void                                                 │
│  size()             : number         // pending queue length               │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                            CrawlSession                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  config            : CrawlSessionConfig  // startUrl, limit, rate         │
│  queue             : CrawlQueue          // URL queue with dedup          │
│  learnedSelectors  : LearnedSelectors | null  // from @crawl/example      │
│  basePrompt        : string | null       // accumulated AI prompt          │
│  examplePages      : CrawlPage[]        // pages fed to AI                │
│  pageCount         : number             // pages consumed so far           │
│  hasNext           : boolean (getter)   // queue.hasNext && under limit    │
│  applyPrompt(p?)   : string | null      // set/augment/inherit prompt     │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          LearnedSelectors                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  follow  : string[]            // CSS selectors for navigation links       │
│  extract : ExtractSelector[]   // per-field extraction definitions          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          ExtractSelector                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  field    : string      // output field name (e.g. "title", "artist")      │
│  selector : string      // CSS selector                                    │
│  as       : ExtractAs   // output format for this field                    │
└─────────────────────────────────────────────────────────────────────────────┘

ExtractAs = 'markdown' | 'text' | 'html' | 'images' | 'links'
```

## Dependencies

- **Depends on:**
  - `../../../handlers/index.js` -- `BaseCommandHandler<T>` base class
  - `@massivoto/kit` -- `ActionResult`, `ExecutionContext`, `createEmptyExecutionContext`
  - `../../ai/types.js` -- `AiProvider` interface (used by `CrawlExampleHandler` and `DummyAI`)
  - `cheerio` -- HTML parsing and CSS selector queries (`CheerioAPI`)
  - `turndown` -- HTML to markdown conversion (used by `CrawlExtractHandler` and `CrawlFetchHandler`)

- **Used by:**
  - `CoreHandlersBundle` -- registers all 6 crawl handlers
  - OTO programs via `@crawl/*` commands
  - Integration tests (`crawl-real-website.integration.spec.ts`)

- **Explicitly excluded:**
  - `apify`, `apify-client`, `@apify/*` -- no Apify platform dependency
  - `crawlee` umbrella package -- only `@crawlee/cheerio` will be used in the future `CrawleeAdapter`
  - `playwright`, `puppeteer` -- no browser rendering (V2 scope)
