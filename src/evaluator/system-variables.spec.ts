/**
 * Tests for the system-variables module.
 *
 * Theme: Cabinet de conseil. Émilie's program reads `_project` to label its
 * outputs. Sofia accidentally writes `output=_project` and must get a clear
 * error.
 */
import { describe, it, expect } from 'vitest'

import {
  isSystemIdentifier,
  assertOutputKeyIsWritable,
  buildReadOnlyError,
} from './system-variables.js'
import { EvaluationError } from './evaluators.js'
import type { IdentifierNode } from '../parser/ast.js'

const fakeIdentifier = (name: string): IdentifierNode => ({
  type: 'identifier',
  value: name,
})

describe('isSystemIdentifier', () => {
  it('returns true for any name starting with underscore', () => {
    expect(isSystemIdentifier('_project')).toBe(true)
    expect(isSystemIdentifier('_env')).toBe(true)
    expect(isSystemIdentifier('_vault')).toBe(true)
    expect(isSystemIdentifier('_network')).toBe(true)
    expect(isSystemIdentifier('_anything')).toBe(true)
  })

  it('returns false for ordinary identifiers', () => {
    expect(isSystemIdentifier('user')).toBe(false)
    expect(isSystemIdentifier('project')).toBe(false)
    expect(isSystemIdentifier('myValue')).toBe(false)
    expect(isSystemIdentifier('_')).toBe(true) // bare underscore counts (system-reserved)
  })

  it('returns false for empty string', () => {
    expect(isSystemIdentifier('')).toBe(false)
  })

  it('returns false for $-prefixed system variables (different family)', () => {
    // $-sigil is the SystemVariableNode AST family (forEach iterators).
    // The `_` family is independent and lives on regular IdentifierNodes.
    expect(isSystemIdentifier('$index')).toBe(false)
  })
})

describe('buildReadOnlyError (R-WORKSPACE-24)', () => {
  it('uses the exact contract message for _project', () => {
    const expr = fakeIdentifier('_project')
    const err = buildReadOnlyError('_project', expr)
    expect(err).toBeInstanceOf(EvaluationError)
    expect(err.message).toBe(
      '_project is read-only and cannot be reassigned. Set MASSIVOTO_PROJECT in .env or use --project on the CLI.',
    )
  })

  it('uses a generic message for other _* identifiers (future _env, _vault, ...)', () => {
    const expr = fakeIdentifier('_env')
    const err = buildReadOnlyError('_env', expr)
    expect(err).toBeInstanceOf(EvaluationError)
    expect(err.message).toContain('_env is read-only')
    expect(err.message).toContain('populated by the runner')
  })
})

describe('assertOutputKeyIsWritable', () => {
  it('does nothing for an ordinary identifier', () => {
    const expr = fakeIdentifier('user')
    expect(() => assertOutputKeyIsWritable('user', expr)).not.toThrow()
    expect(() => assertOutputKeyIsWritable('myResult', expr)).not.toThrow()
  })

  it('throws EvaluationError for _project', () => {
    const expr = fakeIdentifier('_project')
    expect(() => assertOutputKeyIsWritable('_project', expr)).toThrow(
      EvaluationError,
    )
  })

  it('throws for any underscore-prefixed name', () => {
    const expr = fakeIdentifier('_env')
    expect(() => assertOutputKeyIsWritable('_env', expr)).toThrow(
      EvaluationError,
    )
    expect(() => assertOutputKeyIsWritable('_anything', expr)).toThrow(
      EvaluationError,
    )
  })

  it('error message for _project matches the R-WORKSPACE-24 contract', () => {
    const expr = fakeIdentifier('_project')
    try {
      assertOutputKeyIsWritable('_project', expr)
      expect.fail('expected EvaluationError to be thrown')
    } catch (error) {
      const err = error as EvaluationError
      expect(err.message).toBe(
        '_project is read-only and cannot be reassigned. Set MASSIVOTO_PROJECT in .env or use --project on the CLI.',
      )
    }
  })
})
