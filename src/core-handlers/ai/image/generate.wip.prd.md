# PRD: @ai/image/generate

**Status:** IMPLEMENTED
**Last updated:** 2026-02-23
**Target Version:** 0.6

> - DRAFT: Coding should not start, requirements being defined
> - APPROVED: Code can start, requirements stable
> - IMPLEMENTED: Tests passing, feature complete
> - ITERATING: Modifying existing code, PRD being updated

## Progress

| Section | Status | Progress |
|---------|--------|----------|
| Shared AI Defaults | ✅ Done | 3/3 |
| GenerateImage Handler | ✅ Done | 5/5 |
| Variation Substitution | ✅ Done | 3/3 |
| Model Tier Resolution | ✅ Done | 2/2 |
| Registration & Cleanup | ✅ Done | 4/4 |
| Dummy Model | ✅ Done | 3/3 |
| Unit Testing | ✅ Done | 4/4 |
| Integration Testing | ✅ Done | 3/3 |
| Acceptance Criteria | ✅ Done | 10/10 |
| **Overall** | **IMPLEMENTED** | **100%** |

## Parent PRD

- [AI Commands](../ai-commands.done.prd.md) (extends the AI command family)

## Child PRDs

- None

## Context

The v0.6 OTO program for "The Race Was Great" needs to generate images from prompts:

```oto
@ai/prompt/reverseImage image=~/f1.png output=f1RacingPrompt
@set/array input=["overtake under the rain", "first turn", "monaco tunnel"] output=situations
@ai/image/generate prompt=f1RacingPrompt variation=situation forEach=situations->situation retry=3 collect=images
@human/validation items=images display=gallery output=selectedImages
@file/save file=~/selection/f1.png forEach=selectedImages->image
```

This command replaces the old `@ai/image` handler with a cleaner namespace (`@ai/image/generate`) and adds `{{variation}}` template substitution — the missing link between `@ai/prompt/reverseImage` output and batch image generation.

See [generate.brainstorm.md](./generate.brainstorm.md) for the full brainstorm session.

### Architecture Decision: AI Command Families

Two families with a clear contract:

- **`@ai/image/*`** always returns image data (base64). Commands: `generate`, future `edit`, `upscale`
- **`@ai/prompt/*`** always returns text. Commands: `reverseImage`, future `merge`, `refine`

This grouping is by **output type**, not by media type. The `@ai/prompt/*` family grows naturally as prompt-engineering tools. A command that analyzes an image but returns text belongs in `@ai/prompt/*`, not `@ai/image/*`.

## Decision Log

| Date | Option | Decision | Rationale |
|------|--------|----------|-----------|
| 2026-02-23 | Command naming | **`@ai/image/generate`** | Opens namespace for siblings (`edit`, `upscale`). Replaces old `@ai/image` |
| 2026-02-23 | `prompt` vs `content` arg | **`prompt`** | Standard, unambiguous. `content` could mean image content, text content, etc. |
| 2026-02-23 | `variation` as arg vs pipe | **First-class arg** | The `forEach` + `variation` pattern is the primary use case. A `replace` pipe would be verbose and worse DX |
| 2026-02-23 | `{{variation}}` replacement | **`replaceAll`** | All occurrences replaced. If the prompt mentions `{{variation}}` twice, user wants both substituted |
| 2026-02-23 | Multi-variable substitution | **Not supported** | Single `variation` only. Multi-variable is `@ai/prompt/merge` territory. Keep it simple |
| 2026-02-23 | `provider` arg | **Removed** | `model` handles provider resolution. Less args = simpler command |
| 2026-02-23 | `size`/`style` args | **Kept as optional** | Not advertised, but available. Defaults in shared `ai/defaults.ts`. Prompt carries the intent for now |
| 2026-02-23 | Output format | **Raw base64 string** | Value resolver (type coercion) deferred to v0.9. Simple string is good enough |
| 2026-02-23 | Default values location | **Shared `ai/defaults.ts`** | Single source of truth. No duplication between `@ai/image/generate`, `@ai/text`, or future commands |
| 2026-02-23 | Old `@ai/image` | **Delete** | No backward compat. Move fast and break things (CLAUDE.md) |

## Scope

**In scope:**
- Shared `ai/defaults.ts` for AI command defaults (model tiers, image defaults)
- `GenerateImageHandler` extending `BaseCommandHandler<string>`
- `{{variation}}` substitution via `replaceAll`
- Model tier resolution reusing shared defaults
- Registration in `CoreHandlersBundle` as `@ai/image/generate`
- Removal of old `@ai/image` handler (`ImageHandler`)
- Dummy model for deterministic testing
- Unit tests with mock provider
- Integration test scaffold with real Gemini API

**Out of scope:**
- Multiple `{{variable}}` substitutions (future `@ai/prompt/merge`)
- Image editing / inpainting (future `@ai/image/edit`)
- Output format selection (png vs jpg)
- Saving to file (that's `@file/save`)
- Cost/token tracking (deferred to v1)
- Value resolver / type coercion (deferred to v0.9)
- `size`/`style` extraction from prompt with AI (future enhancement)
- OpenAI/Anthropic provider implementations (v1)

## Requirements

### Shared AI Defaults

**Last updated:** 2026-02-23
**Test:** `npx vitest run massivoto-interpreter/src/core-handlers/ai/`
**Progress:** 3/3 (100%)

- ✅ R-GEN-01: Create `ai/defaults.ts` exporting `AI_IMAGE_DEFAULTS` with `size: 'square'`, `style: undefined`, `model: 'best'`
- ✅ R-GEN-02: Create `ai/defaults.ts` exporting `GEMINI_MODEL_TIERS` with `best: 'gemini-2.0-flash'`, `light: 'gemini-2.0-flash-lite'` and a `resolveModel(model: string | undefined, provider: string): string` function
- ✅ R-GEN-03: Refactor `ReverseImageHandler` to import `GEMINI_MODEL_TIERS` and `resolveModel` from `ai/defaults.ts` instead of defining its own copy

**Shape:**

```typescript
// ai/defaults.ts
export const AI_IMAGE_DEFAULTS = {
  size: 'square' as const,
  style: undefined as ('photo' | 'illustration' | '3d' | undefined),
  model: 'best',
}

export const GEMINI_MODEL_TIERS: Record<string, string> = {
  best: 'gemini-2.0-flash',
  light: 'gemini-2.0-flash-lite',
}

export function resolveModel(model: string | undefined, provider: string): string {
  const raw = model ?? AI_IMAGE_DEFAULTS.model
  if (provider === 'gemini' && raw in GEMINI_MODEL_TIERS) {
    return GEMINI_MODEL_TIERS[raw]
  }
  return raw // passthrough for raw model IDs
}
```

### GenerateImage Handler

**Last updated:** 2026-02-23
**Test:** `npx vitest run massivoto-interpreter/src/core-handlers/ai/image/generate.handler.spec.ts`
**Progress:** 5/5 (100%)

- ✅ R-GEN-21: Create `GenerateImageHandler` extending `BaseCommandHandler<string>` with id `@ai/image/generate`
- ✅ R-GEN-22: Required args: `prompt` (string — the text prompt or template)
- ✅ R-GEN-23: Optional args: `variation` (string), `model` (string, default "best"), `size` (string, default from `AI_IMAGE_DEFAULTS`), `style` (string, default from `AI_IMAGE_DEFAULTS`)
- ✅ R-GEN-24: Call `provider.generateImage({ prompt: finalPrompt, size, style })` and return the base64 result as `ActionResult.value`
- ✅ R-GEN-25: Get API key from `context.env.GEMINI_API_KEY` or `process.env.GEMINI_API_KEY`. Fail with actionable error if missing

**Command Signature:**

```oto
@ai/image/generate prompt="A racing car in the rain" output=img
@ai/image/generate prompt=f1RacingPrompt variation="overtake under the rain" output=img
@ai/image/generate prompt=f1RacingPrompt variation=situation model="light" output=img
```

| Arg | Required | Default | Type | Description |
|-----|----------|---------|------|-------------|
| `prompt` | Yes | - | string | Text prompt or template (may contain `{{variation}}`) |
| `variation` | No | - | string | Value to substitute into all `{{variation}}` placeholders |
| `model` | No | `"best"` | string | "light", "best" (aliases), or raw model ID |
| `size` | No | `"square"` | string | "square", "landscape", "portrait" |
| `style` | No | - | string | "photo", "illustration", "3d" |
| `output` | Yes | - | identifier | Variable to store generated base64 image |

### Variation Substitution

**Last updated:** 2026-02-23
**Test:** `npx vitest run massivoto-interpreter/src/core-handlers/ai/image/generate.handler.spec.ts`
**Progress:** 3/3 (100%)

- ✅ R-GEN-41: When `variation` arg is provided, apply `prompt.replaceAll('{{variation}}', variation)` before sending to the provider
- ✅ R-GEN-42: When `variation` is provided but prompt contains no `{{variation}}`, send the prompt as-is (no error, no warning)
- ✅ R-GEN-43: When no `variation` arg is provided, send the prompt as-is (`{{variation}}` stays as literal text)

**Logic:**

```typescript
let finalPrompt = prompt
if (variation !== undefined) {
  finalPrompt = prompt.replaceAll('{{variation}}', String(variation))
}
```

### Model Tier Resolution

**Last updated:** 2026-02-23
**Test:** `npx vitest run massivoto-interpreter/src/core-handlers/ai/image/generate.handler.spec.ts`
**Progress:** 2/2 (100%)

- ✅ R-GEN-61: Use shared `resolveModel()` from `ai/defaults.ts` to resolve "best"/"light" aliases and raw model IDs
- ✅ R-GEN-62: Default to "best" when no `model` arg is provided (via `AI_IMAGE_DEFAULTS.model`)

### Registration & Cleanup

**Last updated:** 2026-02-23
**Test:** `npx vitest run massivoto-interpreter/src/command-registry/`
**Progress:** 4/4 (100%)

- ✅ R-GEN-81: Export `GenerateImageHandler` from `core-handlers/index.ts`
- ✅ R-GEN-82: Register `GenerateImageHandler` in `CoreHandlersBundle.load()` as `@ai/image/generate`
- ✅ R-GEN-83: Remove old `ImageHandler` (`@ai/image`) from `CoreHandlersBundle.load()`
- ✅ R-GEN-84: Delete old `image.handler.ts` and `image.handler.spec.ts` files. Update `core-handlers/index.ts` exports

### Dummy Model

**Last updated:** 2026-02-23
**Test:** `npx vitest run massivoto-interpreter/src/core-handlers/ai/image/generate.handler.spec.ts`
**Progress:** 3/3 (100%)

- ✅ R-GEN-91: When `model="dummy"`, the handler short-circuits before calling `generateImage` and returns a hardcoded tiny base64 PNG string
- ✅ R-GEN-92: Static method `GenerateImageHandler.buildDummyImage(): string` returns a minimal valid base64-encoded PNG (e.g., 1x1 pixel)
- ✅ R-GEN-93: Dummy mode requires no API key. Enables CI-safe testing and downstream pipeline validation

**Signature:**

```typescript
static buildDummyImage(): string  // returns base64 PNG
```

### Unit Testing

**Last updated:** 2026-02-23
**Test:** `npx vitest run massivoto-interpreter/src/core-handlers/ai/image/generate.handler.spec.ts`
**Progress:** 4/4 (100%)

- ✅ R-GEN-101: Unit test with mock `AiProvider`: valid prompt generates base64 image
- ✅ R-GEN-102: Test `{{variation}}` substitution: prompt with placeholder + variation arg sends correct final prompt to provider
- ✅ R-GEN-103: Test model tier resolution: "best" -> `gemini-2.0-flash`, "light" -> `gemini-2.0-flash-lite`, raw passthrough
- ✅ R-GEN-104: Test error cases: missing `prompt` arg, missing API key, provider error

### Integration Testing (Manual)

**Last updated:** 2026-02-23
**Test:** `npx vitest run massivoto-interpreter/src/core-handlers/ai/image/generate.handler.integration.spec.ts`
**Progress:** 3/3 (100%)

- ✅ R-GEN-111: Create integration test scaffold using same `ReverseImageAnalyser` pattern from reverseImage PRD, adapted for image generation
- ✅ R-GEN-112: Integration tests skipped when `GEMINI_API_KEY` is not set
- ✅ R-GEN-113: Integration test scenarios: (a) basic generation, (b) generation with `variation`, (c) generation with `model="light"`

## Dependencies

- **Depends on:** `AiProvider.generateImage()` — already exists on `GeminiProvider`
- **Depends on:** `@ai/prompt/reverseImage` — IMPLEMENTED (produces prompt templates with `{{variation}}`)
- **Depends on:** `forEach`, `collect`, `retry` reserved args — under work on separate instance (not blocking this command)
- **Blocks:** v0.6 OTO program line 3 (image generation step)

## Open Questions

- [ ] Gemini image generation model IDs: are "best"/"light" tiers the same for image generation as for vision? Or does Imagen have separate model IDs?
- [ ] Should `ai/defaults.ts` also define GEMINI_IMAGE_MODEL_TIERS separately from vision model tiers, or is one tier mapping enough?
- [ ] Should we add a `head` pipe alongside `tail` for symmetry? (Not blocking, just noting)

## Acceptance Criteria

### Theme

> **Theme:** Photography Studio (reused from [reverse-image.wip.prd.md](../prompt/reverse-image.wip.prd.md))
>
> A photographer generating images from prompts with different scene variations.

### Automatic (unit tests with mock provider)

Tests in `generate.handler.spec.ts` — run in CI.

- [x] AC-GEN-01: Given photographer Emma writes `@ai/image/generate prompt="A racing car in golden light" output=carImage`, when the command runs with a mock provider, then `carImage` contains the base64 string returned by the provider
- [x] AC-GEN-02: Given photographer Emma has a prompt template `"A car {{variation}} with dramatic lighting"` and provides `variation="under the rain"`, when the command runs, then the prompt sent to the provider is `"A car under the rain with dramatic lighting"`
- [x] AC-GEN-03: Given photographer Carlos has a prompt with `{{variation}}` appearing twice: `"{{variation}} scene with {{variation}} emphasis"` and provides `variation="sunset"`, when the command runs, then the prompt sent to the provider is `"sunset scene with sunset emphasis"`
- [x] AC-GEN-04: Given photographer Carlos provides `variation="Monaco tunnel"` but the prompt contains no `{{variation}}` placeholder, when the command runs, then the prompt is sent unchanged to the provider (no error)
- [x] AC-GEN-05: Given no `variation` arg is provided and the prompt contains `{{variation}}`, when the command runs, then `{{variation}}` is sent as literal text to the provider
- [x] AC-GEN-06: Given photographer Emma uses `model="light"`, when the command runs, then `gemini-2.0-flash-lite` is sent to the provider
- [x] AC-GEN-07: Given no prompt is provided (missing `prompt` arg), when the command runs, then it returns a clear error: "Prompt is required"
- [ ] Edge cases covered in `generate.handler.edge.spec.ts`

### Automatic with Dummy mode (full OTO pipeline, deterministic output)

Tests in `generate.handler.spec.ts` — run in CI.

- [x] AC-GEN-11: Given photographer Emma writes `@ai/image/generate prompt="A car in the sun" model="dummy" output=testImage`, when the full OTO pipeline runs, then `testImage` contains a valid base64 PNG string and no API call is made
- [x] AC-GEN-12: Given `model="dummy"`, when the command runs, then no API key is required

### Manual (real Gemini API, human verification)

Tests in `generate.handler.integration.spec.ts` — skipped in CI.

- [ ] AC-GEN-21: Given photographer Emma provides a detailed prompt from reverseImage, when she runs `@ai/image/generate prompt=<reversePrompt> output=image`, then `image` contains a base64 string that decodes to a valid image visually matching the prompt description (manual verification required)

## Example Usage

```oto
// Basic image generation
@ai/image/generate prompt="A racing car in golden sunset light" output=carImage

// With variation from reverseImage pipeline
@ai/prompt/reverseImage image=~/f1.png output=f1RacingPrompt
@set/array input=["overtake under the rain", "first turn", "monaco tunnel"] output=situations
@ai/image/generate prompt=f1RacingPrompt variation=situation forEach=situations->situation retry=3 collect=images

// With model selection
@ai/image/generate prompt="A portrait" model="light" output=quickImage
@ai/image/generate prompt="A portrait" model="gemini-2.0-flash" output=specificImage

// Dummy mode for testing
@ai/image/generate prompt="anything" model="dummy" output=testImage
```
