# PRD: File Path Literals (Parser)

**Status:** IMPLEMENTED
**Last updated:** 2026-02-20
**Source:** [file-access.brainstorm.md](../../../../platform/documentation/draft/file-access.brainstorm.md)

> - DRAFT: Coding should not start, requirements being defined
> - APPROVED: Code can start, requirements stable
> - IMPLEMENTED: Tests passing, feature complete
> - ITERATING: Modifying existing code, PRD being updated

## Progress

| Section | Status | Progress |
|---------|--------|----------|
| Context | Complete | 100% |
| Scope | Complete | 100% |
| Requirements: AST Nodes | Complete | 4/4 |
| Requirements: Token Registration | Complete | 3/3 |
| Requirements: Parsers | Complete | 5/5 |
| Requirements: Parser Integration | Complete | 3/3 |
| Requirements: Security | Complete | 3/3 |
| Acceptance Criteria | Complete | 10/10 |
| **Overall** | **IMPLEMENTED** | **100%** |

## Parent PRD

- [file-access.brainstorm.md](../../../../platform/documentation/draft/file-access.brainstorm.md)

## Child PRDs

- None (evaluator and `@core/files/save` will be separate PRDs)

## Context

OTO programs cannot reference local files. The runtime has `data`, `scope`, `env`, and `store` but no filesystem access. This blocks the v0.6 use case (The Race Was Great image pipeline).

The `~/` prefix introduces file paths as first-class AST nodes. The parser distinguishes files from globs at parse time:

```oto
@ai/describe image=~/images/hero.png output=description
@block/begin forEach=~/images/races/*.jpg -> photo
  @ai/describe image={photo} output=description
@block/end
```

This PRD covers **parsing only**: AST nodes, tokenization, parser combinators. Evaluation (resolving paths to content), the `|path` pipe, and `@core/files/save` are out of scope.

## Decision Log

| Date | Option | Decision | Rationale |
|------|--------|----------|-----------|
| 2026-02-17 | Node naming: `LiteralFileNode` vs `FileLiteralNode` | **`FileLiteralNode`** | These are references, not pure values. Distinguishes from value literals while keeping `Literal` suffix for "parsed from source" |
| 2026-02-17 | Union placement: separate `PathLiteralNode` vs in `LiteralNode` | **In `LiteralNode`** | Syntactically literal (written in source), `AtomicNode` includes `LiteralNode` already, flows naturally into expression hierarchy |
| 2026-02-17 | One parser or two | **Two: `globLiteralParser` + `fileLiteralParser`** | Clean separation, type-safe dispatch in evaluator, `*` detection at parse time |
| 2026-02-17 | Parser composition | **`pathLiteralParser = F.try(globLiteralParser).or(fileLiteralParser)`** | Glob tried first (more specific due to `*` requirement), file as fallback |
| 2026-02-17 | File layout | **Single file `file-path-parser.ts`** | Both parsers share `~/` prefix logic, no need to split |
| 2026-02-17 | Braced expression support `{~/path}` | **Not in this PRD** | File parsers work for bare `~/path`. Expression parser already routes braced content through `fullExpression` which includes `atomicParser`. Add roadmap item to test. |
| 2026-02-20 | Field name: `.path`/`.pattern` vs `.value` | **`.value` for both** | All literal nodes use `.value` consistently. Type discriminant (`literal-file` vs `literal-glob`) carries the semantic distinction. Enables uniform literal handling in evaluator. |
| 2026-02-20 | `~/` prefix in stored value | **Kept** | The stored `.value` includes `~/` prefix (e.g. `"~/images/hero.png"`). Stripping is the evaluator/command's job, not the parser's. |
| 2026-02-20 | Trailing slash handling | **Accepted and normalized** | `~/images/` is valid input (directory reference). The trailing slash is stripped in `.value` (becomes `"~/images"`). This is a `.map()` normalization, not a `.filter()` rejection. |
| 2026-02-20 | `path-literal.wip.prd.md` | **OBSOLETE** | Merged into this PRD. |

## Scope

**In scope:**
- `FileLiteralNode` and `GlobLiteralNode` AST node types
- `fileLiteralParser` and `globLiteralParser` parser combinators
- `pathLiteralParser` composition
- Token registration in genlex
- Integration into `atomicParser()`
- `..` rejection at parse time (security)
- Bare argument usage: `image=~/images/hero.png`

**Out of scope:**
- Evaluator (resolving paths to file content) - separate PRD
- `|path` pipe - separate PRD
- `@core/files/save` command - separate PRD
- Braced expression testing `{~/path}` - roadmap item
- Multi-store `store->name` syntax - v1.0
- Relative paths without `~/` prefix

## Requirements

File parser implementation goes in massivoto-interpreter/src/parser/file/file-path-parser.ts

### AST Nodes

**Test:** `npx vitest run massivoto-interpreter/src/parser/file/file-path-parser.spec.ts`
**Progress:** 4/4

- [x] R-FP-01: Add `FileLiteralNode` to `ast.ts`:
  ```typescript
  interface FileLiteralNode {
    type: 'literal-file'
    value: string  // e.g. "~/images/hero.png" (with ~/ prefix kept)
  }
  ```
- [x] R-FP-02: Add `GlobLiteralNode` to `ast.ts`:
  ```typescript
  interface GlobLiteralNode {
    type: 'literal-glob'
    value: string  // e.g. "~/images/races/*.jpg" (with ~/ prefix kept)
  }
  ```
- [x] R-FP-03: Add both to the `LiteralNode` union:
  ```typescript
  type LiteralNode =
    | LiteralStringNode
    | LiteralNumberNode
    | LiteralBooleanNode
    | LiteralNullNode
    | FileLiteralNode
    | GlobLiteralNode
  ```
- [x] R-FP-04: Export both from `ast.ts`

> **Note:** Since `LiteralNode` is already part of `AtomicNode`, `SimpleExpressionNode`, and `ExpressionNode`, no other union types need updating.

### Token Registration

**Test:** `npx vitest run massivoto-interpreter/src/parser/file/file-path-parser.spec.ts`
**Progress:** 3/3

- [x] R-FP-11: Register `GLOB_PATH` token in `argument-tokens.ts` with priority **3000** (higher than `MULTIPLY` `*`, `DOT` `.`, `DIV` `/`, `MINUS` `-` to prevent partial tokenization)
- [x] R-FP-12: Register `FILE_PATH` token in `argument-tokens.ts` with priority **2500** (lower than `GLOB_PATH` so glob is tried first, higher than operators)
- [x] R-FP-13: Add `FILE_PATH` and `GLOB_PATH` to `ArgTokens` interface:
  ```typescript
  FILE_PATH: SingleParser<FileLiteralNode>   // .value includes ~/
  GLOB_PATH: SingleParser<GlobLiteralNode>   // .value includes ~/
  ```

> **Priority rationale:** The `~/images/*.png` input contains `*`, `.`, `/`, `-` which are also operator tokens. Genlex tries higher priority first. At 3000/2500, the full path regex matches before any operator token can claim a character.

### Parsers

**File:** `massivoto-interpreter/src/parser/file/file-path-parser.ts`
**Test:** `npx vitest run massivoto-interpreter/src/parser/file/file-path-parser.spec.ts`
**Progress:** 5/5

- [x] R-FP-21: `fileLiteralParser` — regex-based parser matching `~/` followed by one or more allowed characters **without** `*`:
  ```
  Pattern: ~\/[a-zA-Z0-9_\-\.\/]+
  Allowed: a-z A-Z 0-9 _ - . /
  Forbidden: * (that's a glob), spaces, }, ", ..
  ```
  Maps to `FileLiteralNode` with `value` = full matched string (including `~/` prefix). Trailing slash is stripped via `.map()` normalization.

- [x] R-FP-22: `globLiteralParser` — regex-based parser matching `~/` followed by allowed characters **with at least one** `*`:
  ```
  Pattern: ~\/[a-zA-Z0-9_\-\.\/]*\*[a-zA-Z0-9_\-\.\/\*]*
  Allowed: a-z A-Z 0-9 _ - . / *
  Forbidden: spaces, }, ", ..
  ```
  Maps to `GlobLiteralNode` with `value` = full matched string (including `~/` prefix). Trailing slash is stripped via `.map()` normalization.

- [x] R-FP-23: `pathLiteralParser` — composition:
  ```typescript
  const pathLiteralParser = F.try(globLiteralParser).or(fileLiteralParser)
  ```

- [x] R-FP-24: Both parsers apply `.filter()` to reject paths containing `..` (path traversal). This is a parse-time rejection, not an evaluator concern.

- [x] R-FP-25: Both parsers apply `.map()` to normalize trailing slashes: `~/images/` becomes `~/images`. Trailing slash is accepted (directory reference) but stripped from the stored `.value`.

### Parser Integration

**Test:** `npx vitest run massivoto-interpreter/src/parser/file/file-path-parser.spec.ts`
**Progress:** 3/3

- [x] R-FP-31: Add `FILE_PATH` and `GLOB_PATH` to `atomicParser()` in `literals-parser.ts`:
  ```typescript
  export function atomicParser(tokens: ArgTokens): SingleParser<AtomicNode> {
    const { IDENTIFIER, STRING, NUMBER, BOOLEAN, FILE_PATH, GLOB_PATH } = tokens
    return F.tryAll([GLOB_PATH,FILE_PATH, IDENTIFIER, BOOLEAN, STRING, NUMBER])
  }
  ```
- [x] R-FP-32: Update `AtomicNode` type if needed (should be automatic via `LiteralNode` union expansion)
- [x] R-FP-33: Verify bare argument parsing works: `image=~/images/hero.png` produces an `ArgumentNode` with `FileLiteralNode` value

### Security

**Progress:** 3/3

- [x] R-FP-41: `..` anywhere in the path is rejected at parse time with a clear error. `~/images/../secrets/key.pem` must fail to parse.
- [x] R-FP-42: Only Latin characters allowed: `a-zA-Z0-9`, `*`, `-`, `_`, `.`, `/`. No spaces, no unicode, no special characters.
- [x] R-FP-43: Path must start with `~/` — no bare paths like `images/hero.png` or absolute paths like `/etc/passwd`.

## Acceptance Criteria

### Theme

> **Theme:** F1 Image Pipeline (The Race Was Great)
>
> We're building a landing page for a F1 SaaS. We need to process racing photos,
> generate hero images, and organize driver portraits.

### Criteria

- [x] AC-FP-01: Given `@ai/describe image=~/images/hero.png`, when parsed, then `image` argument has `FileLiteralNode` with `value: "~/images/hero.png"`
- [x] AC-FP-02: Given `@ai/describe image=~/images/races/monaco.final.png`, when parsed, then dots are literal path characters, `value: "~/images/races/monaco.final.png"`
- [x] AC-FP-03: Given `of=~/images/races/*.jpg`, when parsed, then `of` argument has `GlobLiteralNode` with `value: "~/images/races/*.jpg"`
- [x] AC-FP-04: Given `of=~/images/**/*.png`, when parsed, then `GlobLiteralNode` with `value: "~/images/**/*.png"` (double glob)
- [x] AC-FP-05: Given `path=~/output/drivers/vettel/hero.png`, when parsed, then deep nested path works: `value: "~/output/drivers/vettel/hero.png"`
- [x] AC-FP-06: Given `image=~/images/../secrets/key.pem`, when parsed, then parser rejects with error (path traversal)
- [x] AC-FP-07: Given `image=~/images/`, when parsed, then trailing slash is accepted and normalized: `FileLiteralNode` with `value: "~/images"`
- [x] AC-FP-08: Given `image=~/a`, when parsed, then single-character filename works: `FileLiteralNode` with `value: "~/a"`
- [x] AC-FP-09: Given `data=~/race-data/2024_monaco-results.json`, when parsed, then `_` and `-` in path are accepted
- [x] AC-FP-10: Given two arguments `@cmd input=~/in/data.json output=result`, when parsed, then `~/in/data.json` is parsed as `FileLiteralNode` and `result` is parsed as `IdentifierNode` (no confusion between `~/` paths and identifiers)

## Implementation Context for LLM

### Required Reading

1. **Masala Parser Documentation** (parser combinator library):
   - https://raw.githubusercontent.com/masala/masala-parser/refs/heads/main/llm.txt
   - Key concepts: `F.try()`, `.then()`, `.or()`, `.drop()`, `.map()`, `.filter()`, `F.regex()`, `leanToken`, `genlex.tokenize()`

2. **Existing literal patterns** — follow the same token registration + atomicParser integration:
   - `shared-parser.ts` — regex definitions for `numberLiteral`, `stringLiteral`, `booleanLiteral`
   - `argument-tokens.ts` — `createArgumentTokens()` registers them with genlex
   - `literals-parser.ts` — `atomicParser()` combines them

### Expression Parser Architecture

```
fullExpression (mapper)
  └── baseExpression (pipe | braced | simple)
        └── simpleExpression (logical → comparative → additive → multiplicative)
              └── postfix → unary → primary
                    └── arrayLiteral | parenthesized | atomic
                          └──  GLOB_PATH| FILE_PATH | IDENTIFIER | BOOLEAN | STRING | NUMBER
                                                      ^^^^^^^^^^^^^^^^^^^
                                                      pathLiteralParser goes here
```

### Key Files to Read

| File | Purpose | What to Learn |
|------|---------|---------------|
| `ast.ts` | AST type definitions | Node interfaces, `LiteralNode` union, `AtomicNode` |
| `argument-tokens.ts` | Token definitions + genlex registration | How to add FILE_PATH/GLOB_PATH tokens with priority |
| `literals-parser.ts` | `atomicParser()` | Where to add the new tokens |
| `shared-parser.ts` | Regex-based parser definitions | Pattern for defining `filePath`/`globPath` regexes |
| `full-expression-parser.ts` | Expression entry point | How `primary` is built, how `atomicParser` feeds in |
| `array-parser.ts` + `array-parser.spec.ts` | Reference implementation | How a new parser was added to the expression hierarchy |

### Token Priority Map

We have this code: 

```typescript
const [COLON, COMMA, DOT] = genlex.keywords([':', ',', '.']) // default priority to 1000
```
The lower the number, the higher the priority
```

STRING_LITERAL: 2000
NUMBER_LITERAL: 2000
BOOLEAN:        1500
PIPE:           1200
IS (=):         1100
IDENTIFIER:     1000
EQ (==):        1000
LT, GT:         1000
[MULTIPLY, DIV...]: 1000
[COLON, COMMA, DOT]:   1000
FILE_PATH:      700  ← new (must beat ., /)
GLOB_PATH:      650  ← new (must beat *, ., /)
NOT (!):         500
LTE, GTE:        500
NEQ (!=):         300
```

### Implementation Sketch

```typescript
// file-path-parser.ts

import { F, SingleParser } from '@masala/parser'
import { FileLiteralNode, GlobLiteralNode } from '../ast.js'

// Regex: ~/ followed by path chars WITHOUT *
const filePathRegex = /~\/[a-zA-Z0-9_\-\.\/]+/

// Regex: ~/ followed by path chars WITH at least one *
const globPathRegex = /~\/[a-zA-Z0-9_\-\.\/]*\*[a-zA-Z0-9_\-\.\/\*]*/

const rejectTraversal = (s: string) => !s.includes('..')
const stripTrailingSlash = (s: string) => s.endsWith('/') ? s.slice(0, -1) : s

export const fileLiteralParser: SingleParser<string> = F.regex(filePathRegex)
  .filter(rejectTraversal)
  .map(stripTrailingSlash)

export const globLiteralParser: SingleParser<string> = F.regex(globPathRegex)
  .filter(rejectTraversal)
  .map(stripTrailingSlash)
```

```typescript
// argument-tokens.ts additions
// This is pseudo code, the naming of initail variables may need some change to satisfy Javascript rules
const GLOB_PATH = genlex.tokenize(globLiteralParser, 'GLOB_PATH', 650)
const FILE_PATH = genlex.tokenize(fileLiteralParser, 'FILE_PATH', 700)

// In return:
GLOB_PATH: GLOB_PATH.map(leanToken).map((v: string) => ({
  type: 'literal-glob' as const,
  value: v,
})),
FILE_PATH: FILE_PATH.map(leanToken).map((v: string) => ({
  type: 'literal-file' as const,
  value: v,
})),
```

```typescript
// literals-parser.ts update
export function atomicParser(tokens: ArgTokens): SingleParser<AtomicNode> {
  const { IDENTIFIER, STRING, NUMBER, BOOLEAN, FILE_PATH, GLOB_PATH } = tokens
  return F.tryAll([GLOB_PATH, FILE_PATH, IDENTIFIER, BOOLEAN, STRING, NUMBER])
}
```

### Test File Location

Create: `massivoto-interpreter/src/parser/file/file-path-parser.spec.ts`

Follow patterns from:
- `args-details/array-parser.spec.ts` — parser-level tests
- `args-details/tokens/literals-parser.spec.ts` — token-level tests

## Dependencies

- **Depends on:** masala parser library (already in use)
- **Blocks:** file-access evaluator PRD, `|path` pipe PRD, `@core/files/save` PRD

## Roadmap Items

- [ ] **Test expression parser with file paths**: Verify `{~/path}` works inside braced expressions. Should work automatically since `atomicParser` feeds into `fullExpression`, but needs explicit tests in `full-expression-parser.spec.ts`.
- [ ] **Test pipe with file paths**: Verify `{~/data/file.json|someTransform}` works.
- [ ] **Test forEach with glob**: Verify `forEach=~/images/*.jpg -> photo` parses correctly (glob as mapper source).

## Open Questions

- None — all decisions made.
