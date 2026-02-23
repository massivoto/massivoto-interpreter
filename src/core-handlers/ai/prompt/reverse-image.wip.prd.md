# PRD: @ai/prompt/reverseImage

**Status:** IMPLEMENTED
**Last updated:** 2026-02-20
**Target Version:** 0.6

> - DRAFT: Coding should not start, requirements being defined
> - APPROVED: Code can start, requirements stable
> - IMPLEMENTED: Tests passing, feature complete
> - ITERATING: Modifying existing code, PRD being updated

## Progress

| Section | Status | Progress |
|---------|--------|----------|
| AiProvider Interface | ✅ Done | 3/3 |
| GeminiProvider Vision | ✅ Done | 3/3 |
| ReverseImage Handler | ✅ Done | 5/5 |
| Model Tier Resolution | ✅ Done | 3/3 |
| Registration | ✅ Done | 2/2 |
| Dummy Model | ✅ Done | 3/3 |
| Unit Testing | ✅ Done | 4/4 |
| Integration Testing (Manual) | ✅ Done (scaffold) | 4/4 |
| AC: Automatic | ✅ Done | 5/6 |
| AC: Dummy Mode | ✅ Done | 3/3 |
| AC: Manual | ⏳ Scaffold ready | 0/3 |
| **Overall** | **IMPLEMENTED** | **95%** |

## Parent PRD

- [AI Commands](../ai-commands.done.prd.md) (extends the AI command family)

## Child PRDs

- None

## Context

The v0.6 OTO program for "The Race Was Great" starts with:

```oto
@ai/prompt/reverseImage image=~/f1.png output=f1RacingPrompt
```

This command takes an image and produces a detailed text prompt that can reproduce similar images with variations. The generated prompt includes a `{{variation}}` placeholder (standard Mustache/Handlebars convention) so the same prompt can be reused with different scenes via `@ai/image/generate`.

This is the first command in the `@ai/prompt/*` family — a set of prompt-engineering commands that automate what humans do manually today.

See [reverse-image.brainstorm.md](./reverse-image.brainstorm.md) for the full brainstorm session.

## Decision Log

| Date | Option | Decision | Rationale |
|------|--------|----------|-----------|
| 2026-02-20 | Guidance arg name | **`focus`** | Short, intuitive, reads naturally in OTO. Rejected: `context` (too wide), `intent` (abstract), `guidance` (long) |
| 2026-02-20 | `{{variation}}` presence | **Always present** | Zero cost if unused (literal text). Simplifies contract. No opt-in flag needed |
| 2026-02-20 | `{{variation}}` enforcement | **No post-processing** | System prompt asks for it, but we don't inject/validate after AI response. Trust the model |
| 2026-02-20 | AiProvider extension | **New `analyzeImage` method** | Clean interface separation. Vision analysis is a distinct capability, not text generation with image input. Rejected: extending TextRequest (muddy), bypassing abstraction (dirty) |
| 2026-02-20 | Model arg semantics | **Free string with aliases** | `model` accepts "light", "best" (aliases) or raw model IDs (e.g., "gemini-2.0-flash"). Best of both worlds |
| 2026-02-20 | Version phasing | **All features at once (POC)** | focus + model tier are trivial additions. No reason to phase |
| 2026-02-20 | Cost tracking | **Deferred to v1** | No token counting for now |
| 2026-02-20 | Dummy model | **`model="dummy"` short-circuits handler** | Returns hardcoded prompt. Enables fast unit tests, CI-safe, no API key needed. Same pattern as "light"/"best" aliases |
| 2026-02-20 | Dummy implementation | **Static `buildDummyPrompt(variation: boolean)` on handler** | Handler concern, not provider. Static method keeps handler `run()` clean. Boolean param for testing flexibility and future `@ai/prompt/*` commands |
| 2026-02-20 | Integration testing | **`ReverseImageAnalyser` with full OTO pipeline** | Takes an OTO code line, runs full parse -> evaluate -> execute. Uses real Gemini API. Manual-only, skipped in CI |

## Scope

**In scope:**
- `analyzeImage` method on `AiProvider` interface + `ImageAnalysisRequest`/`ImageAnalysisResult` types
- `analyzeImage` implementation on `GeminiProvider` using Gemini vision API
- `ReverseImageHandler` extending `BaseCommandHandler`
- Model tier resolution: "light" and "best" aliases + raw model ID passthrough
- Registration in `CoreHandlersBundle`
- System prompt engineered for reverse-prompting with `{{variation}}`
- Unit tests with mock provider

**Out of scope:**
- Cost/token tracking (v1)
- OpenAI/Anthropic provider implementations (v1)
- Multiple images as input (use `forEach` at OTO level)
- Prompt refinement/iteration (future `@ai/prompt/refine`)
- Style vs content mode split
- Image format validation (trust file evaluator)
- Post-processing to enforce `{{variation}}` presence
- File path evaluator (separate PRD, prerequisite)

## Requirements

### AiProvider Interface Extension

**Last updated:** 2026-02-20
**Test:** `npx vitest run massivoto-interpreter/src/core-handlers/ai/`
**Progress:** 3/3 (100%)

- ✅ R-RIMG-01: Add `ImageAnalysisRequest` type to `types.ts` with fields: `image` (base64 string), `prompt` (system instructions for the AI), `model` (optional string)
- ✅ R-RIMG-02: Add `ImageAnalysisResult` type to `types.ts` with fields: `text` (string)
- ✅ R-RIMG-03: Add `analyzeImage(request: ImageAnalysisRequest): Promise<ImageAnalysisResult>` method to `AiProvider` interface

**Types:**

```typescript
interface ImageAnalysisRequest {
  image: string        // base64-encoded image
  prompt: string       // instructions for the AI (system prompt)
  model?: string       // model ID or undefined for default
}

interface ImageAnalysisResult {
  text: string         // generated text response
}
```

### GeminiProvider Vision Implementation

**Last updated:** 2026-02-20
**Test:** `npx vitest run massivoto-interpreter/src/core-handlers/ai/providers/gemini.provider.spec.ts`
**Progress:** 3/3 (100%)

- ✅ R-RIMG-21: Implement `analyzeImage` on `GeminiProvider` using the `generateContent` endpoint with multimodal input (text + inline image)
- ✅ R-RIMG-22: Default vision model is `gemini-2.0-flash` (best), light model is `gemini-2.0-flash-lite`
- ✅ R-RIMG-23: Send image as `inlineData` part with `mimeType: "image/png"` alongside text prompt part

**Gemini Vision API shape:**

```typescript
// POST /models/{model}:generateContent
{
  contents: [{
    parts: [
      { text: "system prompt here" },
      { inlineData: { mimeType: "image/png", data: "<base64>" } }
    ]
  }]
}
```

### ReverseImage Handler

**Last updated:** 2026-02-20
**Test:** `npx vitest run massivoto-interpreter/src/core-handlers/ai/prompt/reverse-image.handler.spec.ts`
**Progress:** 5/5 (100%)

- ✅ R-RIMG-41: Create `ReverseImageHandler` extending `BaseCommandHandler<string>` with id `@ai/prompt/reverseImage`
- ✅ R-RIMG-42: Required args: `image` (base64 string from file evaluator), `output` (variable name)
- ✅ R-RIMG-43: Optional args: `focus` (string to steer emphasis), `model` (string: "light", "best", or raw model ID), `provider` (default: "gemini")
- ✅ R-RIMG-44: Build system prompt that instructs the AI to: (a) produce a detailed image generation prompt capturing style, composition, colors, lighting, content, atmosphere; (b) include exactly one `{{variation}}` placeholder at the scene/subject position; (c) if `focus` is provided, emphasize those aspects
- ✅ R-RIMG-45: Return generated prompt text as `ActionResult.value` (interpreter stores in output variable)

**Command Signature:**

```oto
@ai/prompt/reverseImage image=~/f1.png output=f1RacingPrompt
@ai/prompt/reverseImage image=~/photo.png focus="racing atmosphere" model="light" output=prompt
@ai/prompt/reverseImage image=~/product.jpg model="gemini-2.0-flash-lite" output=productPrompt
```

| Arg | Required | Default | Type | Description |
|-----|----------|---------|------|-------------|
| `image` | Yes | - | string (base64) | Image content, resolved by file evaluator from `~/path` |
| `output` | Yes | - | identifier | Variable to store generated prompt |
| `focus` | No | - | string | Steer AI emphasis (e.g., "racing atmosphere and speed") |
| `model` | No | `"best"` | string | "light", "best" (aliases), or raw model ID |
| `provider` | No | `"gemini"` | string | AI provider name |

### Model Tier Resolution

**Last updated:** 2026-02-20
**Test:** `npx vitest run massivoto-interpreter/src/core-handlers/ai/prompt/reverse-image.handler.spec.ts`
**Progress:** 3/3 (100%)

- ✅ R-RIMG-61: Resolve `"best"` to `gemini-2.0-flash` and `"light"` to `gemini-2.0-flash-lite` for Gemini provider
- ✅ R-RIMG-62: Pass any unrecognized model string directly to the provider as a raw model ID
- ✅ R-RIMG-63: Default to `"best"` when no `model` arg is provided

**Resolution logic:**

```typescript
function resolveModel(model: string | undefined, provider: string): string {
  const raw = model ?? 'best'
  if (provider === 'gemini') {
    if (raw === 'best') return 'gemini-2.0-flash'
    if (raw === 'light') return 'gemini-2.0-flash-lite'
  }
  return raw // passthrough for raw model IDs
}
```

### Registration

**Last updated:** 2026-02-20
**Test:** `npx vitest run massivoto-interpreter/src/command-registry/`
**Progress:** 2/2 (100%)

- ✅ R-RIMG-81: Export `ReverseImageHandler` from `core-handlers/index.ts`
- ✅ R-RIMG-82: Register `ReverseImageHandler` in `CoreHandlersBundle.load()` alongside existing AI handlers

### Dummy Model

**Last updated:** 2026-02-20
**Test:** `npx vitest run massivoto-interpreter/src/core-handlers/ai/prompt/reverse-image.handler.spec.ts`
**Progress:** 3/3 (100%)

- ✅ R-RIMG-91: When `model="dummy"`, the handler short-circuits before calling `analyzeImage` and returns the result of `ReverseImageHandler.buildDummyPrompt(true)`
- ✅ R-RIMG-92: Static method `buildDummyPrompt(variation: boolean)` returns a realistic photography prompt. When `variation=true`, includes `{{variation}}` at the scene/subject position. When `variation=false`, omits it.
- ✅ R-RIMG-93: The dummy prompt is detailed enough to be usable for downstream pipeline testing (style, composition, lighting, colors described)

**Signature:**

```typescript
static buildDummyPrompt(variation: boolean): string
```

**Dummy prompt example (variation=true):**

```
A detailed photograph capturing {{variation}} with soft natural lighting,
shallow depth of field, warm color palette dominated by golden and amber tones,
shot from a low angle perspective, background softly blurred with bokeh circles,
high contrast between subject and environment, cinematic composition with
rule of thirds framing, subtle lens flare from the light source
```

### Unit Testing

**Last updated:** 2026-02-20
**Test:** `npx vitest run massivoto-interpreter/src/core-handlers/ai/prompt/reverse-image.handler.spec.ts`
**Progress:** 4/4 (100%)

- ✅ R-RIMG-101: Unit test `ReverseImageHandler` with mock `AiProvider` returning a canned reverse-prompt containing `{{variation}}`
- ✅ R-RIMG-102: Test `focus` arg injection into the system prompt sent to `analyzeImage`
- ✅ R-RIMG-103: Test model tier resolution: "best" -> `gemini-2.0-flash`, "light" -> `gemini-2.0-flash-lite`, raw passthrough
- ✅ R-RIMG-104: Test error cases: missing `image` arg, missing `output` arg, missing API key, provider error

### Integration Testing (Manual)

**Last updated:** 2026-02-20
**Test:** `npx vitest run massivoto-interpreter/src/core-handlers/ai/prompt/reverse-image.handler.integration.spec.ts`
**Progress:** 4/4 (100%)

- ✅ R-RIMG-111: Create `ReverseImageAnalyser` test utility that takes an OTO code line string, runs it through the full pipeline (parser -> evaluator -> interpreter -> handler), and returns the execution result
- ✅ R-RIMG-112: `ReverseImageAnalyser` uses a real `GEMINI_API_KEY` from env, sets up a full `CoreCommandRegistry` with `CoreHandlersBundle`, and provides helper methods: `run(otoLine: string): Promise<ProgramResult>` and `getOutput(varName: string): string`
- ✅ R-RIMG-113: Integration tests are skipped when `GEMINI_API_KEY` is not set (`describe.skipIf(!process.env.GEMINI_API_KEY)`)
- ✅ R-RIMG-114: Integration test scenarios: (a) basic reverseImage with a real test image, (b) reverseImage with `focus` arg, (c) reverseImage with `model="light"`, (d) verify output contains `{{variation}}`

## Dependencies

- **Depends on:** File path evaluator (resolves `~/f1.png` to base64 content at runtime) — separate PRD, currently WIP
- **Blocks:** v0.6 OTO program (this is the first line)

## Open Questions

- [ ] Verify exact Gemini model IDs for vision: is `gemini-2.0-flash` the current best for vision, and `gemini-2.0-flash-lite` the light option?
- [ ] Should the system prompt be stored as a separate constant/file for easy iteration, or inline in the handler?

## Acceptance Criteria

### Theme

> **Theme:** Photography Studio (a photographer analyzing reference photos to reproduce their style)
>
> New theme for this feature — fits the visual analysis and reproduction workflow.

### Automatic (unit tests with mock provider)

Tests in `reverse-image.handler.spec.ts` — run in CI.

- [x] AC-RIMG-01: Given photographer Carlos uses `model="light"`, when the command runs, then `gemini-2.0-flash-lite` is sent to the provider's `analyzeImage` method
- [x] AC-RIMG-02: Given photographer Carlos uses `model="gemini-2.0-flash-lite"`, when the command runs, then that exact model ID is sent to the provider (raw passthrough)
- [x] AC-RIMG-03: Given photographer Emma provides `focus="warm lighting and bokeh effect"`, when the command runs, then the system prompt sent to `analyzeImage` contains "warm lighting and bokeh effect"
- [x] AC-RIMG-04: Given no image is provided (missing `image` arg), when the command runs, then it returns a clear error: "Image is required"
- [x] AC-RIMG-05: Given the API key is missing, when the command runs, then it returns an actionable error with setup instructions
- [ ] Edge cases covered in `reverse-image.handler.edge.spec.ts`

### Automatic with Dummy mode (full OTO pipeline, deterministic output)

Tests in `reverse-image.handler.spec.ts` — run in CI. Uses `model="dummy"` to short-circuit the AI call.

- [x] AC-RIMG-11: Given photographer Emma writes `@ai/prompt/reverseImage image=~/emma-portrait.png model="dummy" output=portraitPrompt`, when the full OTO pipeline runs (parse -> evaluate -> execute), then `portraitPrompt` is stored in scope and contains the hardcoded dummy prompt with `{{variation}}`
- [x] AC-RIMG-12: Given `model="dummy"`, when the command runs, then no API call is made and no API key is required
- [x] AC-RIMG-13: Given `model="dummy"` with `focus="warm lighting"`, when the command runs, then the dummy prompt is returned unchanged (focus is ignored in dummy mode)

### Manual (real Gemini API, human verification)

Tests in `reverse-image.handler.integration.spec.ts` — skipped in CI. Run manually with `GEMINI_API_KEY`.
Verified by human: prompt quality, `{{variation}}` placement, focus emphasis.

- [ ] AC-RIMG-21: Given photographer Emma has a portrait photo, when she runs `@ai/prompt/reverseImage image=<base64> output=portraitPrompt`, then `portraitPrompt` contains a detailed text prompt describing the photo's style, composition, lighting, colors, and content, with a `{{variation}}` placeholder at the scene/subject position
- [ ] AC-RIMG-22: Given photographer Emma runs reverseImage with `focus="warm lighting and bokeh effect"`, when the prompt is generated, then it emphasizes warm lighting and bokeh while still capturing other visual aspects
- [ ] AC-RIMG-23: Given photographer Carlos uses `model="light"`, when the command runs with real API, then it produces a usable prompt (may be less detailed than "best" but still functional)

## Example Usage

```oto
// Basic reverse-prompting
@ai/prompt/reverseImage image=~/f1.png output=f1RacingPrompt

// With focus and model selection
@ai/prompt/reverseImage image=~/product.jpg focus="product placement and branding" model="light" output=productPrompt

// Full pipeline: reverse-prompt -> variations -> generate -> validate -> save
@ai/prompt/reverseImage image=~/f1.png output=f1RacingPrompt
@set/array values=['overtake under the rain', 'first turn', 'monaco tunnel'] output=situations
@ai/image/generate prompt=f1RacingPrompt variation=situation forEach=situations->situation retry=3 collect=images
@human/validation items=images display=gallery output=selectedImages
@file/save file={["selection/", "f1-", $index, ".png"] | path} forEach=selectedImages->image
```
