# PRD: System Variables ($-prefix)

**Status:** IMPLEMENTED
**Last updated:** 2026-02-24

> - DRAFT: Coding should not start, requirements being defined
> - APPROVED: Code can start, requirements stable
> - IMPLEMENTED: Tests passing, feature complete
> - ITERATING: Modifying existing code, PRD being updated

## Progress

| Section | Status | Progress |
|---------|--------|----------|
| Context | ✅ Complete | 100% |
| Scope | ✅ Complete | 100% |
| Requirements: AST | ✅ Complete | 3/3 |
| Requirements: Parser | ✅ Complete | 3/3 |
| Requirements: Evaluator | ✅ Complete | 2/2 |
| Requirements: Interpreter | ✅ Complete | 3/3 |
| Requirements: Cleanup | ✅ Complete | 2/2 |
| Acceptance Criteria | ✅ Complete | 8/8 |
| Theme | ✅ Defined | - |
| **Overall** | **IMPLEMENTED** | **100%** |

## Parent PRD

- [ForEach Reserved Argument](./parser/foreach.done.prd.md) (IMPLEMENTED)

## Child PRDs

- None

## Context

OTO programs use `forEach` to iterate over collections. During iteration, the runtime injects
implicit variables (`_index`, `_count`, `_length`, `_first`, `_last`, `_odd`, `_even`) into scope.
These are currently parsed as regular `IdentifierNode` and resolved via standard scope chain lookup,
making them indistinguishable from user-defined variables.

This creates three problems:

1. **No visual distinction** in OTO source code between `_index` (system-injected) and `_myVar` (user-defined)
2. **No enforcement** - users can accidentally overwrite system variables with `output=_index`
3. **No scalability** - future system variables (`$runId`, `$user`, `$cost`) need a clear namespace

The industry convention for system-injected variables is the `$` sigil (n8n, Bash, PHP, Groovy).
Introducing a dedicated `SystemVariableNode` AST type provides compile-time distinction and enables
the evaluator to enforce read-only semantics.

### Current state

```
core-interpreter.ts:700  →  write('_index', index, scopeChain)
evaluators.ts:62         →  case 'identifier': resolveIdentifier(expr, context)
shared-parser.ts:40      →  identifier = /[a-zA-Z_][a-zA-Z0-9_-]*/
ast.ts:107               →  IdentifierNode { type: 'identifier', value: string }
```

All system variables are regular identifiers. No `$` token exists in the parser.

## Decision Log

| Date | Option | Decision | Rationale |
|------|--------|----------|-----------|
| 2026-02-24 | Extend identifier regex vs new AST node | **New SystemVariableNode** | Clean separation, enables read-only enforcement, prevents `output=$index` |
| 2026-02-24 | Backwards compat (`_index` kept) vs hard break | **Hard break** | CLAUDE.md: "move fast and break things". Clean cut, no ambiguity. |
| 2026-02-24 | `$index` vs `_index` vs `loop.index` | **$-sigil** | n8n precedent, visual distinction, scales to future system vars |

## Scope

**In scope:**
- New `SystemVariableNode` AST type
- New parser token for `$identifier` pattern
- Evaluator handling for `SystemVariableNode` (scope-only lookup, read-only)
- Rename all 7 system variables: `_index` → `$index`, `_count` → `$count`, etc.
- Update interpreter injection (2 locations in `core-interpreter.ts`)
- Update all tests

**Out of scope:**
- Future system variables beyond forEach (`$runId`, `$user`, `$cost`) - deferred to their own PRDs
- `output=$foo` prevention at parser level (nice-to-have, can be evaluator-level error)
- Member expressions on system variables (`$loop.index` namespace style)

## Requirements

### AST

**Last updated:** 2026-02-24
**Test:** `npx vitest run massivoto-interpreter/src/parser`
**Progress:** 0/3 (0%)

- ✅ R-SYSVAR-01: Create `SystemVariableNode` interface in `ast.ts` with `type: 'system-variable'` and `name: string` (name without `$` prefix, e.g. `'index'` for `$index`)
- ✅ R-SYSVAR-02: Add `SystemVariableNode` to the `ExpressionNode` union type
- ✅ R-SYSVAR-03: Export `SystemVariableNode` from the AST module

### Parser

**Last updated:** 2026-02-24
**Test:** `npx vitest run massivoto-interpreter/src/parser`
**Progress:** 0/3 (0%)

- ✅ R-SYSVAR-21: Add `SYSTEM_VARIABLE` token in `shared-parser.ts` matching pattern `\$[a-zA-Z_][a-zA-Z0-9_]*` — produces `SystemVariableNode`
- ✅ R-SYSVAR-22: Integrate `SYSTEM_VARIABLE` into expression parsing so `$index` is valid anywhere an expression is accepted (args, braced expressions, conditions)
- ✅ R-SYSVAR-23: Ensure `$` followed by invalid chars (e.g. `$123`, `$`) produces a clear parser error, not silent failure

### Evaluator

**Last updated:** 2026-02-24
**Test:** `npx vitest run massivoto-interpreter/src/evaluator`
**Progress:** 0/2 (0%)

- ✅ R-SYSVAR-41: Add `case 'system-variable'` in `ExpressionEvaluator.evaluate()` that resolves `$name` by looking up `$name` in the scope chain only (no fallback to `context.data`)
- ✅ R-SYSVAR-42: If a `SystemVariableNode` resolves to `undefined`, return `undefined` (do not throw). The variable is simply not in scope (e.g. `$index` used outside a forEach).

### Interpreter

**Last updated:** 2026-02-24
**Test:** `npx vitest run massivoto-interpreter/src`
**Progress:** 0/3 (0%)

- ✅ R-SYSVAR-61: In `executeForEachWithStatementList()` (line ~700), rename all `write('_X', ...)` calls to `write('$X', ...)` for the 7 system variables: `$index`, `$count`, `$length`, `$first`, `$last`, `$odd`, `$even`
- ✅ R-SYSVAR-62: In `executeForEachInstruction()` (line ~811), apply the same rename
- ✅ R-SYSVAR-63: Extract a helper function `writeSystemVariables(index, length, scopeChain)` to avoid the duplicated 7-line block across both forEach methods

### Cleanup

**Last updated:** 2026-02-24
**Test:** `npx vitest run massivoto-interpreter/src`
**Progress:** 0/2 (0%)

- ✅ R-SYSVAR-81: Update `foreach.done.prd.md` to reflect the new `$` convention (mark as ITERATING, update the system variables table)
- ✅ R-SYSVAR-82: Update ROADMAP.md to mark "Variable names" section as resolved with `$`-sigil decision

## Dependencies

- **Depends on:** forEach (IMPLEMENTED), scope chain (IMPLEMENTED), expression evaluator (IMPLEMENTED)
- **Blocks:** Nothing directly. Future system variables (`$runId`, `$cost`) will follow this pattern.

## Open Questions

- [x] Prefix convention: `$` selected (n8n, Bash, PHP precedent)
- [x] AST strategy: new `SystemVariableNode` selected (not regex extension)
- [x] Backwards compat: hard break selected
- [x] Should `$index` store the name as `'index'` or `'$index'` internally? **Resolved:** AST `name` field stores `'index'` (without `$`). Scope key uses `'$index'` (with `$`). The evaluator prepends `$` at resolution time.

## Acceptance Criteria

### Theme

> **Theme:** Formula One Race (from "The Race Was Great" v0.6 context)
>
> All test scenarios use F1 racing theme for consistency.
> Reused from: [forEach PRD](./parser/foreach.done.prd.md) which uses the same project context.

### Criteria

- [x] AC-SYSVAR-01: Given 3 F1 drivers `["Verstappen", "Hamilton", "Leclerc"]` iterated with `forEach=drivers->driver`, when the program reads `$index` on each iteration, then it receives `0`, `1`, `2` respectively
- [x] AC-SYSVAR-02: Given the same 3 drivers, when the program reads `$count` on each iteration, then it receives `1`, `2`, `3` respectively
- [x] AC-SYSVAR-03: Given the same 3 drivers, when the program reads `$length` on any iteration, then it always receives `3`
- [x] AC-SYSVAR-04: Given the same 3 drivers, when the program reads `$first` on the first iteration, then it receives `true`; on all other iterations it receives `false`
- [x] AC-SYSVAR-05: Given the same 3 drivers, when the program reads `$last` on the last iteration, then it receives `true`; on all other iterations it receives `false`
- [x] AC-SYSVAR-06: Given a nested forEach (drivers outer, laps inner), when the inner loop reads `$index`, then it gets the inner index (not the outer one); the outer `$index` is shadowed but restored after the inner loop completes
- [x] AC-SYSVAR-07: Given an OTO program with `message={$index}` in a braced expression, when parsed, the AST contains a `SystemVariableNode` with `name: 'index'` (not an `IdentifierNode`)
- [x] AC-SYSVAR-08: Given an OTO program using `$index` outside any forEach loop, when evaluated, it resolves to `undefined` (no error thrown)
- [x] All automated tests pass
- [ ] Edge cases covered in separate `*.edge.spec.ts` files (deferred)
