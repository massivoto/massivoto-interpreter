/**
 * System variables — underscore-prefixed identifiers reserved for the runner.
 *
 * R-WORKSPACE-21..R-WORKSPACE-24: `_project` is populated by the runner at
 * boot and exposed read-only to the OTO program. The same convention applies
 * to the future `_env`, `_vault`, `_network` family.
 *
 * Convention: any identifier that starts with `_` is *system-owned*. Programs
 * may read it but never assign to it via `output=` (or any future write
 * mechanism). This module provides the predicate + the error builder so the
 * interpreter and any future write site share a single source of truth.
 *
 * Note: this is distinct from the `$`-sigil family (`$index`, `$first`, ...)
 * which lives in the AST as `SystemVariableNode` and is reserved for forEach
 * iteration. `_`-prefixed identifiers are still ordinary `IdentifierNode`s,
 * just placed into the root scope by the runner.
 */
import { EvaluationError } from './evaluators.js'
import type { BindingNode, ExpressionNode } from '../parser/ast.js'

type AnyAstNode = ExpressionNode | BindingNode

/**
 * Returns `true` when an identifier name belongs to the system namespace.
 * Any name starting with an underscore is reserved for the runner to populate.
 */
export function isSystemIdentifier(name: string): boolean {
  return name.length > 0 && name.startsWith('_')
}

/**
 * Builds the EvaluationError thrown when an OTO program tries to write to a
 * `_*` identifier. The message intentionally points the user at the two
 * legitimate ways of setting `_project`.
 *
 * R-WORKSPACE-24: exact message contract.
 */
export function buildReadOnlyError(
  name: string,
  expression: AnyAstNode,
): EvaluationError {
  if (name === '_project') {
    return new EvaluationError(
      '_project is read-only and cannot be reassigned. Set MASSIVOTO_PROJECT in .env or use --project on the CLI.',
      'identifier',
      expression as ExpressionNode,
    )
  }
  return new EvaluationError(
    `${name} is read-only and cannot be reassigned. Identifiers starting with "_" are populated by the runner and cannot be written from an OTO program.`,
    'identifier',
    expression as ExpressionNode,
  )
}

/**
 * Throws if the given output key targets a system identifier.
 *
 * The check is run after `parseOutputTarget` has split the namespace from the
 * key, so both `output=_project` (data namespace) and `output=scope._project`
 * (scope namespace) are rejected.
 */
export function assertOutputKeyIsWritable(
  outputKey: string,
  expression: AnyAstNode,
): void {
  if (isSystemIdentifier(outputKey)) {
    throw buildReadOnlyError(outputKey, expression)
  }
}
