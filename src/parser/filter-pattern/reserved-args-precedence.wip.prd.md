# PRD: Reserved Args Precedence (Filter Pattern)

**Status:** DRAFT
**Last updated:** 2026-02-23

> - DRAFT: Coding should not start, requirements being defined
> - APPROVED: Code can start, requirements stable
> - IMPLEMENTED: Tests passing, feature complete
> - ITERATING: Modifying existing code, PRD being updated

## Progress

| Section | Status | Progress |
|---------|--------|----------|
| Context | ✅ Complete | 100% |
| Scope | ✅ Complete | 100% |
| Requirements: Precedence Model | ❌ Not Started | 0/3 |
| Requirements: Remove Mutual Exclusivity | ❌ Not Started | 0/3 |
| Requirements: Interpreter - Filter Pattern | ❌ Not Started | 0/4 |
| Requirements: New Reserved Args (retry, collect) | ❌ Not Started | 0/6 |
| Acceptance Criteria | ❌ Not Started | 0/14 |
| Theme | ✅ Defined | - |
| **Overall** | **DRAFT** | **0%** |

## Parent PRD

- [ForEach Reserved Argument](../foreach.done.prd.md) (IMPLEMENTED)

## Child PRDs

- None

## Context

When multiple reserved args coexist on a single instruction or block, the runtime must
evaluate them in a defined order. Currently, `forEach=` and `if=` are mutually exclusive
(R-FE-82 in `foreach.done.prd.md`), forcing users to nest blocks:

```oto
@block/begin forEach=situations -> situation
  @block/begin if={situation.length > 2}
    @ai/generateImage variation=situation retry=3
  @block/end
@block/end
```

The **filter pattern** (Option B) removes this restriction. `if=` becomes a per-item
filter evaluated inside the `forEach` loop, because the condition often references the
loop variable — which only exists after `forEach` binds it:

```oto
@ai/generateImage variation=situation forEach=situations->situation retry=3 if={situation.length > 2}
```

This is the dominant model in declarative languages: Python comprehensions
(`[x for x in items if cond(x)]`), Ansible (`loop` + `when`), Jinja2
(`{% for x in items if cond %}`).

### Canonical Precedence Chain

```
forEach → if → retry → execute → output/collect
```

Pseudocode equivalent:

```typescript
for (const situation of situations) {        // forEach=
  if (situation.length > 2) {                // if= (per-item filter)
    retryUpTo(3, () => {                     // retry=
      const result = execute(command, args)  // execute
      collect(results, result)               // collect= / output=
    })
  }
}
```

### Why not guard-first (if before forEach)?

The `if=` condition `{situation.length > 2}` references `situation`, which is the loop
variable bound by `forEach`. Evaluating `if` before `forEach` would be a scoping error —
the variable doesn't exist yet.

For a global guard ("skip this entire line"), use `@flow/if` or a conditional block:

```oto
@block/begin if={isReady}
  @ai/generateImage forEach=situations->situation retry=3
@block/end
```

## Decision Log

| Date | Option | Decision | Rationale |
|------|--------|----------|-----------|
| 2026-02-23 | A (guard-first) vs B (filter) vs C (two keywords) | **B (filter pattern)** | Scoping: `if=` references loop variable bound by `forEach`; matches Python/Ansible/Jinja2 |
| 2026-02-23 | Keep mutual exclusivity vs remove | **Remove** | R-FE-82 is superseded by the filter pattern; nested blocks remain an option but not required |

## Scope

**In scope:**
- Define canonical evaluation order for all reserved args
- Remove R-FE-82 mutual exclusivity validation (parser + tests)
- Interpreter support: `if=` evaluated per-item inside `forEach` loop
- New reserved args: `retry=` (integer, retry on failure) and `collect=` (accumulate results)
- Parser tokens, AST nodes, and reserved words for retry and collect
- `retry=` and `collect=` work independently (not only with forEach)

**Out of scope:**
- `when=` global guard keyword (use `@flow/if` block instead)
- `yield=` as stream-aware collect (deferred, same behavior as `collect=` for now)
- Parallel forEach execution
- `retry=` with backoff strategy or delay (simple counter only for now)
- Error handling inside retry (just re-execute, fail after N attempts)

## Requirements

### Precedence Model

**Last updated:** 2026-02-23
**Test:** `npx vitest run massivoto-interpreter/src/parser/filter-pattern/`
**Progress:** 0/3 (0%)

- ❌ R-FILTER-01: Document the canonical precedence chain in code and DSL spec:
  `forEach → if → retry → execute → output/collect`
  - This is the evaluation order, not the parsing order (parser accepts args in any position)
  - Add a `RESERVED_ARG_PRECEDENCE` constant or comment in the interpreter

- ❌ R-FILTER-02: Position on the line does NOT affect precedence. These are equivalent:
  ```oto
  @cmd/name forEach=items->item if={item.active} retry=3 collect=results
  @cmd/name retry=3 if={item.active} collect=results forEach=items->item
  ```
  The parser already collects reserved args by type, not position — no parser change needed.

- ❌ R-FILTER-03: Reserved args are valid on both `InstructionNode` (single line) and `BlockNode` (`@block/begin`):
  - On instructions: `forEach`, `if`, `retry`, `output`, `collect` all apply to that single command
  - On blocks: `forEach`, `if` apply to the block body; `retry`, `output`, `collect` are NOT valid on blocks (instructions only)

### Remove Mutual Exclusivity

**Last updated:** 2026-02-23
**Test:** `npx vitest run massivoto-interpreter/src/parser/foreach-block.spec.ts`
**Progress:** 0/3 (0%)

- ❌ R-FILTER-21: Remove R-FE-82 validation in `program-parser.ts` (line 91-96):
  Delete the `if (condition && forEach)` check that throws
  `"Block cannot have both forEach= and if= on the same @block/begin"`

- ❌ R-FILTER-22: Update `foreach-block.spec.ts`: replace the two "rejects block with both forEach and if"
  tests (R-FE-82) with tests that **accept** the combination and verify correct AST:
  ```typescript
  it('accepts block with both forEach and if (filter pattern)', () => {
    const source = `@block/begin forEach=users -> user if={user.active}
      @log/print message={user.name}
    @block/end`
    // Should parse successfully with both fields populated
  })
  ```

- ❌ R-FILTER-23: Update `foreach.done.prd.md` open questions: mark
  "Can forEach and if coexist on same block?" as **Yes (filter pattern)** with reference to this PRD

### Interpreter - Filter Pattern

**Last updated:** 2026-02-23
**Test:** `npx vitest run massivoto-interpreter/src/evaluator/filter-pattern.spec.ts`
**Progress:** 0/4 (0%)

- ❌ R-FILTER-41: Modify `executeBlockWithStatementList()` in `core-interpreter.ts` (line 523):
  When block has BOTH `forEach` AND `condition`, execute forEach with per-item filtering.
  Current code checks `forEach` first (early return), then `condition` — change to pass
  condition into the forEach execution path.

- ❌ R-FILTER-42: Modify `executeForEachWithStatementList()`: after binding the iterator variable
  and system variables to scope, evaluate `block.condition` in the current scope context.
  If falsy, skip this iteration (continue to next item). If truthy, execute block body.

  ```typescript
  // Inside forEach loop, after scope push and variable injection:
  if (block.condition) {
    const conditionValue = await this.evaluator.evaluate(block.condition, iterationContext)
    if (!conditionValue) {
      iterationContext = popScope(iterationContext)
      continue  // skip this item
    }
  }
  // Execute block body...
  ```

- ❌ R-FILTER-43: Same filter pattern for single instructions with `forEach` + `if`:
  The instruction-level forEach executor must also support per-item `if` filtering.

- ❌ R-FILTER-44: System variables (`_index`, `_count`, `_length`, etc.) count ALL items in the
  collection, not just filtered ones. `_length` is the original array length. Filtered items
  are skipped but do not alter the counters. This matches Python's `enumerate` behavior.

### New Reserved Args: retry and collect

**Last updated:** 2026-02-23
**Test:** `npx vitest run massivoto-interpreter/src/parser/reserved-args.spec.ts`
**Progress:** 0/6 (0%)

- ❌ R-FILTER-61: Add `RetryArgNode` to `ast.ts`:
  ```typescript
  interface RetryArgNode {
    type: 'retry-arg'
    count: ExpressionNode  // integer expression: retry=3 or retry={maxRetries}
  }
  ```

- ❌ R-FILTER-62: Add `CollectArgNode` to `ast.ts`:
  ```typescript
  interface CollectArgNode {
    type: 'collect-arg'
    target: IdentifierNode  // variable name: collect=results
  }
  ```

- ❌ R-FILTER-63: Update `InstructionNode` in `ast.ts`:
  ```typescript
  interface InstructionNode {
    type: 'instruction'
    action: ActionNode
    args: ArgumentNode[]
    output?: IdentifierNode       // existing
    condition?: ExpressionNode    // existing
    forEach?: ForEachArgNode      // existing
    label?: string                // existing
    retry?: ExpressionNode        // NEW: from retry=expression
    collect?: IdentifierNode      // NEW: from collect=identifier
  }
  ```

- ❌ R-FILTER-64: Add parser tokens `RETRY_KEY` and `COLLECT_KEY` (priority 500) in `instruction-parser.ts`:
  ```typescript
  RETRY_KEY: genlex.tokenize(C.string('retry='), 'RETRY_KEY', 500)
  COLLECT_KEY: genlex.tokenize(C.string('collect='), 'COLLECT_KEY', 500)
  ```

- ❌ R-FILTER-65: Add `retry` and `collect` to reserved words in `shared-parser.ts`

- ❌ R-FILTER-66: Add `retryArg` and `collectArg` parsers, wire into `reservedArg` combinator:
  - `retry=` accepts any expression (must evaluate to integer at runtime)
  - `collect=` accepts an identifier (like `output=`)
  - Update `ReservedArgNode` union type

### Interpreter - retry Execution

**Last updated:** 2026-02-23
**Test:** `npx vitest run massivoto-interpreter/src/parser/filter-pattern/retry.spec.ts`
**Progress:** 0/3 (0%)

- ❌ R-FILTER-81: `retry=N` wraps the command execution in a loop: if the command throws, retry up to N times.
  After N failures, re-throw the last error. On first success, stop retrying.

- ❌ R-FILTER-82: `retry=` applies per individual execution. In a `forEach`, each item gets its own retry budget:
  ```oto
  @ai/generateImage forEach=prompts->prompt retry=3 collect=images
  # prompt[0] may retry 3 times, prompt[1] may retry 3 times, independently
  ```

- ❌ R-FILTER-83: `retry=0` means no retry (execute once, fail on error). `retry=1` means one retry (execute twice max).

### Interpreter - collect Execution

**Last updated:** 2026-02-23
**Test:** `npx vitest run massivoto-interpreter/src/parser/filter-pattern/collect.spec.ts`
**Progress:** 0/3 (0%)

- ❌ R-FILTER-101: `collect=varName` accumulates results into an array variable in scope.
  Without `forEach`, `collect=` behaves like `output=` but always wraps in an array (single-element).

- ❌ R-FILTER-102: With `forEach`, `collect=` appends each iteration's result to the array:
  ```oto
  @ai/generateImage forEach=prompts->prompt collect=images
  # images = [result0, result1, result2, ...]
  ```
  Filtered items (skipped by `if=`) do NOT append to the collection.

- ❌ R-FILTER-103: `collect=` and `output=` are mutually exclusive on the same instruction.
  Parser validates this and throws: "Cannot use both output= and collect= on the same instruction"

## Dependencies

- **Depends on:**
  - [ForEach Reserved Argument](../foreach.done.prd.md) (IMPLEMENTED) - provides forEach parsing and execution
  - [Reserved Arguments](../reserved-arguments.done.prd.md) (IMPLEMENTED) - provides pattern for adding new reserved args
  - [Variable Scope](../../evaluator/variable-scope.done.prd.md) (IMPLEMENTED) - scope chain for per-item evaluation

- **Blocks:**
  - Reverse Image command (needs retry for robustness)
  - Grid applet (needs collect for result aggregation)

## Open Questions

- [x] Should `if=` be a guard or filter? -> **Filter** (per-item, inside forEach)
- [x] Should `_index` count filtered items or all items? -> **All items** (matches Python enumerate)
- [ ] Should `retry=` support a delay/backoff? -> Deferred (simple counter for now)
- [ ] Should `collect=` support deduplication? -> Probably not, use a pipe: `{results|unique}`
- [ ] Should `retry=` and `collect=` be valid on `@block/begin`? -> **No**, instructions only

## Acceptance Criteria

### Theme

> **Theme:** Formula One Race Automation
>
> Generating F1 race images with AI, filtering situations, retrying flaky generation,
> collecting results for human validation. Matches the v0.6 roadmap goal.

### Criteria

**Filter pattern (forEach + if coexistence):**

- [ ] AC-FP-01: Given `situations = ['rain overtake', 'monaco tunnel', 'pit stop', 'start grid']`
      and `@ai/describe forEach=situations->situation if={situation != 'pit stop'}`,
      when executed, then the command runs for 3 situations (pit stop is skipped)

- [ ] AC-FP-02: Given `@block/begin forEach=drivers->driver if={driver.points > 50}`,
      when parsed, then `BlockNode` has both `forEach` and `condition` populated (no error)

- [ ] AC-FP-03: Given `@block/begin forEach=drivers->driver if={driver.points > 50}`,
      when executed with `drivers = [{name:'Max', points:100}, {name:'Rookie', points:10}]`,
      then block body executes only for Max

- [ ] AC-FP-04: Given forEach over 4 drivers with if filtering 2 out,
      when `_index` is accessed, then values are 0, 1, 2, 3 (not 0, 1 for filtered items only),
      and `_length` is 4 (total, not filtered count)

**Retry:**

- [ ] AC-FP-05: Given `@ai/generateImage prompt="F1 car" retry=2` and the AI fails twice then succeeds,
      when executed, then the command succeeds on the 3rd attempt (1 initial + 2 retries)

- [ ] AC-FP-06: Given `@ai/generateImage prompt="F1 car" retry=2` and the AI fails 3 times,
      when executed, then the command throws the last error after exhausting retries

- [ ] AC-FP-07: Given `@ai/generateImage forEach=prompts->prompt retry=2`,
      when prompt[0] fails once and prompt[1] succeeds immediately,
      then prompt[0] retries independently (prompt[1] does not waste retries)

**Collect:**

- [ ] AC-FP-08: Given `@ai/generateImage forEach=situations->situation collect=images`
      with 3 situations, when executed, then `images` is an array of 3 results

- [ ] AC-FP-09: Given `@ai/generateImage forEach=situations->situation if={situation != 'pit stop'} collect=images`
      with 4 situations (1 filtered), when executed, then `images` has 3 elements (filtered item not collected)

- [ ] AC-FP-10: Given `@ai/describe prompt="F1" collect=results` (no forEach),
      when executed, then `results` is `[singleResult]` (array with one element)

- [ ] AC-FP-11: Given `@ai/describe prompt="F1" output=result collect=results`,
      when parsed, then parser rejects with "Cannot use both output= and collect="

**Precedence independence from position:**

- [ ] AC-FP-12: Given `@cmd/name retry=3 if={x} collect=r forEach=items->item`,
      when parsed, then all four reserved args are correctly extracted regardless of order

**Parsing:**

- [ ] AC-FP-13: Given `@cmd/name retry=3`, when parsed, then `InstructionNode.retry` is a literal number expression with value 3

- [ ] AC-FP-14: Given `@cmd/name collect=myResults`, when parsed, then `InstructionNode.collect` is an identifier node with value "myResults"

**General:**
- [ ] All automated tests pass
- [ ] Edge cases covered in `filter-pattern.edge.spec.ts`

## File Structure

```
massivoto-interpreter/src/
├── parser/
│   ├── ast.ts                         # UPDATE: RetryArgNode, CollectArgNode, InstructionNode fields
│   ├── shared-parser.ts               # UPDATE: add retry, collect to reserved words
│   ├── instruction-parser.ts          # UPDATE: RETRY_KEY, COLLECT_KEY tokens + parsers
│   ├── program-parser.ts              # UPDATE: remove R-FE-82 mutual exclusivity check
│   ├── reserved-args.spec.ts          # UPDATE: add retry, collect parser tests
│   ├── foreach-block.spec.ts          # UPDATE: replace rejection tests with acceptance tests
│   ├── filter-pattern/
│   │   ├── reserved-args-precedence.wip.prd.md  # THIS FILE
│   │   ├── filter-pattern.spec.ts     # NEW: filter pattern integration tests
│   │   ├── filter-pattern.edge.spec.ts # NEW: edge cases
│   │   ├── retry.spec.ts             # NEW: retry execution tests
│   │   └── collect.spec.ts           # NEW: collect execution tests
├── core-interpreter.ts                # UPDATE: filter pattern in executeBlock, retry wrapping, collect accumulation
```
