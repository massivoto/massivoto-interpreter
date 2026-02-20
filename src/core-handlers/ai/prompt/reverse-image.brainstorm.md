# Brainstorm: @ai/prompt/reverseImage

**Date:** 2026-02-20
**Participants:** User + Claude

---

## 1. Product Role

**What it IS:**
- A **prompt extraction** command in the `@ai/prompt/*` family
- Analyzes an image and produces a detailed text prompt optimized for image regeneration
- A **template generator** — output includes a `{{variation}}` placeholder for reuse with different scenes
- Part of a prompt-engineering command family (future: `@ai/prompt/merge`, `@ai/prompt/refine`)

**What it is NOT:**
- Not an image description command (`@ai/describe` would be different)
- Not an image generation command — produces text, not images
- Not a generic vision/understanding tool — specifically optimized for producing prompts that generate similar images

**Decision:** `@ai/prompt/reverseImage` namespace clearly signals prompt engineering, not image analysis.

---

## 2. Target Audience

**Persona:** Any workflow author who has a reference image and wants to reproduce or vary it at scale.

**Decision:** General-purpose — not theme-specific. Works for F1 racing, product photos, portraits, landscapes, anything. Must support both visual style reproduction and content extraction use cases.

---

## 3. Core Problem

**Problem:** Generating good image prompts manually is hard. Writing a prompt that reproduces an image's qualities (style, composition, colors, lighting, content, atmosphere) takes expertise and iteration.

**Consequences if unsolved:**
- Users write vague prompts, get inconsistent results across variations
- The `forEach=situations->situation` pipeline breaks if the base prompt is weak
- Each variation requires manual prompt tuning instead of a single `{{variation}}` swap

**Decision:** The command automates prompt engineering from a reference image. Prompt quality is the entire value — the system prompt sent to the AI model must be carefully engineered.

**Rationale:** Everything downstream (`@ai/generateImage`, `@human/validation`, `@file/save`) depends on having a high-quality base prompt.

---

## 4. Unique Value Proposition

**Decision:** The value is NOT the vision API call itself. The value is:

1. **Prompt engineering baked in** — system prompt instructs the model to produce a prompt optimized for image regeneration, not just a description
2. **`{{variation}}` injection** — output is structured as a reusable template
3. **One-liner in OTO** — replaces a multi-step manual workflow
4. **Pipeable** — output feeds directly into `@ai/generateImage`

**Rationale:** Anyone can call a vision API. The differentiator is the system prompt doing the prompt-engineering work.

---

## 5. Acquisition Strategy

Not applicable — internal platform command. Discovered through docs and command registry.

---

## 6. Functional Scope

**IN scope:**
- Accept an image (resolved file path via `~/path`)
- Send image + engineered system prompt to a vision-capable AI model
- Return a text prompt with `{{variation}}` placeholder (always present)
- `model` arg — free string: "light", "best" (aliases), or raw model ID (e.g., "gemini-flash-image-2.5")
- `provider` arg — default: Nano Banana (= Gemini image engine)
- `focus` arg (optional) — steers the AI toward specific aspects of the image
- Standard `output` arg to store result in scope

**OUT of scope:**
- Cost/token tracking (deferred to v1)
- Multiple images input (use `forEach` at OTO level)
- Prompt refinement/iteration (separate `@ai/prompt/refine` command)
- Style vs content mode split — one mode captures everything
- Image format validation — trust the file evaluator
- Post-processing the AI output to enforce `{{variation}}` presence

---

## 7. Core Features

### Feature: Reverse-prompt generation

**Capability:** Given an image, produce a detailed text prompt that can reproduce similar images via an image generation model. Captures style, composition, colors, lighting, content, and atmosphere.

**Acceptance Criteria:**
- Given a valid image file path, When `@ai/prompt/reverseImage image=~/photo.png output=result` is executed, Then `result` contains a non-empty string prompt describing style, composition, colors, content, and atmosphere
- Given the generated prompt is fed to `@ai/generateImage`, When an image is generated, Then it is visually similar in style and content to the original
- Given no `focus` arg is provided, When the command runs, Then the prompt captures all aspects of the image (no bias)

**Test Approach:** Integration test with a mock AI provider returning a canned prompt. Manual QA for prompt quality against real models.

---

### Feature: `{{variation}}` placeholder injection

**Capability:** The generated prompt always includes a `{{variation}}` placeholder in a contextually appropriate position, using standard prompt templating conventions (Mustache/Handlebars style). Opaque to OTO — it's just text.

**Acceptance Criteria:**
- Given a standard execution, When the prompt is generated, Then it contains exactly one `{{variation}}` placeholder in a contextually appropriate position
- Given a user replaces `{{variation}}` with "overtake under the rain", When that prompt is fed to image generation, Then the generated image reflects the variation while preserving the original style

**Test Approach:** Unit test asserting `{{variation}}` presence in mock provider output. System prompt must explicitly instruct `{{variation}}` insertion.

**Decision:** `{{variation}}` is always present. No opt-in flag. Costs nothing if unused (stays as literal text).

---

### Feature: Focus-guided extraction

**Capability:** Optional `focus` arg steers the reverse-prompting toward specific aspects of the image.

**Acceptance Criteria:**
- Given `focus="racing atmosphere and speed"`, When the command runs, Then the generated prompt emphasizes those aspects over others
- Given no `focus` arg, When the command runs, Then the prompt is balanced across all visual aspects

**Test Approach:** Unit test verifying `focus` value is injected into the system prompt sent to the AI provider.

---

### Feature: Model tier selection

**Capability:** `model` arg is a free string. Known aliases ("light", "best") resolve to provider-specific model IDs. Unknown strings are passed as raw model IDs.

**Acceptance Criteria:**
- Given no `model` arg, When the command runs, Then it uses the "best" tier
- Given `model="light"`, When the command runs, Then it uses the cheaper/faster model
- Given `model="gemini-flash-image-2.5"`, When the command runs, Then it passes that exact model ID to the provider
- Given a provider with only one vision model, When either tier is selected, Then both resolve to the same model

**Test Approach:** Unit test asserting correct model ID resolution per tier and raw passthrough.

---

## 8. Differentiating Features

No separate differentiating features for an internal command. The differentiator IS the OTO integration: one-liner, pipeable, `{{variation}}` built-in.

---

## 9. Version Assignment

**Decision:** Ship everything at once. All features are POC.

| Feature | Version | Rationale |
|---------|---------|-----------|
| Reverse-prompt generation | POC | Core value, must work first |
| `{{variation}}` placeholder | POC | Just a system prompt instruction, zero extra code cost |
| Focus-guided extraction | POC | Trivial to implement — just an arg passed to system prompt |
| Model tier selection | POC | Simple alias resolution, no complex abstraction needed |

**Rationale:** All features are lightweight additions to the core API call. No reason to phase them.

---

## 10. Critical Edge Cases

| Edge Case | Expected Behavior |
|-----------|-------------------|
| Image file doesn't exist / unresolvable path | Fail with clear error from file evaluator (not our problem) |
| Image is not a photo (diagram, text, blank) | Still produce a prompt — AI does its best, no quality validation |
| AI provider returns no `{{variation}}` in prompt | Accept it — system prompt asks for it, but we don't enforce/inject post-hoc |
| AI provider is down / API error | Standard `ActionResult` failure with `fatalError` message |
| Very large image file | Pass to provider as-is — let the API reject if too large |
| `focus` arg is nonsensical | Pass to provider as-is — garbage in, garbage out |

**Decision:** No validation on our side. Trust the file evaluator for image resolution, trust the AI for prompt quality and `{{variation}}` inclusion. Standard error handling through `ActionResult`.

---

## 11. Non-Functional Constraints

- **Performance:** Single API call to a vision model. Latency depends on provider — nothing to optimize. No caching.
- **Security:** Image content goes to a third-party API. Same trust model as `@ai/text` and `@ai/image`.
- **Cost:** No tracking for now (deferred to v1).

---

## 12. External Dependencies

| Dependency | Status | Risk |
|------------|--------|------|
| **Nano Banana / Gemini vision** | Available — Nano Banana = Gemini image engine. `GeminiProvider` already exists in codebase | None |
| **File path evaluator** | WIP — `~/path` resolves at parse time, evaluator must deliver image content at runtime | Medium — prerequisite |
| **`AiProvider` interface** | Exists with `generateText` and `generateImage` only | Medium — needs new `analyzeImage` method |

### Architecture Decision: `analyzeImage` on `AiProvider`

**Options considered:**
- A) Add `analyzeImage(request: ImageAnalysisRequest): Promise<TextResult>` to `AiProvider` — clean interface separation
- B) Extend `TextRequest` to accept optional image attachment — piggybacks on existing method
- C) Bypass provider abstraction, call Nano Banana directly — fastest but dirty

**Decision:** Option A — `analyzeImage` as a new method on `AiProvider`.

**Rationale:** Vision analysis is a distinct capability, not text generation with an image bolted on. Clean separation of concerns.

---

## 13. Major Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Prompt quality is inconsistent | Low value — variations won't match original | Iterate on system prompt. Tunable without code changes |
| File evaluator not ready in time | Can't resolve `~/f1.png` to content | Hardcode test image path for POC, decouple from evaluator timeline |
| `{{variation}}` placement is wrong | Generated images don't reflect the variation | System prompt engineering — instruct model to place it at scene/subject, not style section |

**Decision:** No blockers. Nano Banana supports vision. Biggest risk is prompt quality — mitigated by system prompt iteration.

---

## 14. Priority

**Decision:** High priority. This is the first line of the v0.6 OTO program. Everything downstream depends on it. March 6th deadline for The Race Was Great.

Also unblocks the `focus` pattern reusable across future `@ai/prompt/*` commands.

---

## Naming Decisions

| Decision | Choice | Alternatives Rejected |
|----------|--------|-----------------------|
| Command name | `@ai/prompt/reverseImage` | `@ai/describe`, `@ai/reverse` — too generic |
| Guidance arg | `focus` | `context` (too wide), `intent` (abstract), `guidance` (long), `aspect` (too narrow) |
| Template placeholder | `{{variation}}` | `{variation}` (collides with OTO syntax), `__VARIATION__` (ugly) |

---

## Gaps / Open Questions

1. **System prompt engineering:** The actual system prompt text for Nano Banana needs to be crafted and iterated. This is the most impactful piece — worth a dedicated session.
2. **`ImageAnalysisRequest` type:** What fields? At minimum: `image` (base64 or buffer), `prompt` (system instructions), `model` (string). Need to define this on `AiProvider`.
3. **File evaluator dependency:** Can we test the handler independently by passing image content directly, before the evaluator resolves `~/path`?
4. **Nano Banana model IDs:** What are the concrete model IDs for "light" and "best" vision tiers?

---

## Next Steps

1. Define `analyzeImage` method and `ImageAnalysisRequest` type on `AiProvider` interface
2. Implement `analyzeImage` on `GeminiProvider` (Nano Banana)
3. Create `ReverseImageHandler` in `massivoto-interpreter/src/core-handlers/ai/prompt/`
4. Register in `CoreHandlersBundle`
5. Write and iterate on the system prompt
6. Integration test with mock provider
7. Manual QA with real images
