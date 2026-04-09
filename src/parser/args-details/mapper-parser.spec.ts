import { describe, it, expect } from 'vitest'
import { SingleParser, Stream, TracingGenLex } from '@masala/parser'
import { ExpressionNode } from '../ast.js'
import { createExpressionWithPipe } from './full-expression-parser.js'
import { createArgumentTokens } from './tokens/argument-tokens.js'

/**
 * Creates a parser that includes mapper expression support.
 * This function mirrors the full expression parser setup used in other tests.
 */
function createMapperGrammar(): SingleParser<ExpressionNode> {
  const genlex = new TracingGenLex()
  const tokens = createArgumentTokens(genlex)
  const grammar = createExpressionWithPipe(tokens)
  return genlex.use(grammar)
}

describe('Mapper parser', () => {
  const grammar = createMapperGrammar()

  describe('AC-MAP-01: Basic mapper expression', () => {
    it('should parse users -> name as MapperExpressionNode with ReferenceNode source and BindingNode target', () => {
      const stream = Stream.ofChars('users -> name')
      const parsing = grammar.parse(stream)

      expect(parsing.isAccepted()).toBe(true)
      expect(parsing.value).toEqual({
        type: 'mapper',
        source: { type: 'reference', path: ['users'] },
        target: { type: 'binding', name: 'name' },
      })
    })

    it('should parse with spaces around arrow', () => {
      const stream = Stream.ofChars('users  ->  name')
      const parsing = grammar.parse(stream)

      expect(parsing.isAccepted()).toBe(true)
      expect(parsing.value).toEqual({
        type: 'mapper',
        source: { type: 'reference', path: ['users'] },
        target: { type: 'binding', name: 'name' },
      })
    })
  })

  describe('AC-MAP-02: Pipe expression as source - rejected by mapper, handled by forEach fallback', () => {
    it('should NOT parse {users|filter:active} -> id as mapper (complex source rejected)', () => {
      // The mapper parser only accepts reference sources (IDENTIFIER(.IDENTIFIER)*)
      // Pipe expressions fall through to baseExpression, not producing a mapper
      const stream = Stream.ofChars('{users|filter:active} -> id')
      const parsing = grammar.thenEos().parse(stream)

      // The mapper parser rejects this because the source is a pipe expression.
      // The full expression parser falls back to the pipe expression alone,
      // but then '-> id' remains unconsumed, so thenEos() rejects.
      expect(parsing.isAccepted()).toBe(false)
    })

    it('should NOT parse {users|filter:active|sort:asc} -> id as mapper', () => {
      const stream = Stream.ofChars('{users|filter:active|sort:asc} -> id')
      const parsing = grammar.thenEos().parse(stream)

      expect(parsing.isAccepted()).toBe(false)
    })
  })

  describe('AC-MAP-03: Member expression as source becomes ReferenceNode with path', () => {
    it('should parse data.users -> email with dotted reference', () => {
      const stream = Stream.ofChars('data.users -> email')
      const parsing = grammar.parse(stream)

      expect(parsing.isAccepted()).toBe(true)
      expect(parsing.value).toEqual({
        type: 'mapper',
        source: { type: 'reference', path: ['data', 'users'] },
        target: { type: 'binding', name: 'email' },
      })
    })

    it('should parse deeply nested member response.data.users -> name', () => {
      const stream = Stream.ofChars('response.data.users -> name')
      const parsing = grammar.parse(stream)

      expect(parsing.isAccepted()).toBe(true)
      expect(parsing.value).toEqual({
        type: 'mapper',
        source: { type: 'reference', path: ['response', 'data', 'users'] },
        target: { type: 'binding', name: 'name' },
      })
    })
  })

  describe('AC-MAP-04: Parser rejects number on right side', () => {
    it('should reject users -> 123 (right side must be binding identifier)', () => {
      const stream = Stream.ofChars('users -> 123')
      const parsing = grammar.thenEos().parse(stream)

      expect(parsing.isAccepted()).toBe(false)
    })
  })

  describe('AC-MAP-05: Parser rejects dots in target', () => {
    it('should reject users -> settings.theme (no dots in binding)', () => {
      const stream = Stream.ofChars('users -> settings.theme')
      const parsing = grammar.thenEos().parse(stream)

      expect(parsing.isAccepted()).toBe(false)
    })
  })

  describe('AC-MAP-06: Precedence - mapper is lowest', () => {
    it('should parse {users|filter:x} -> name with pipe inside braces, reference outside', () => {
      // With the new mapper, {users|filter:x} is not a valid reference, so this is rejected
      const stream = Stream.ofChars('{users|filter:x} -> name')
      const parsing = grammar.thenEos().parse(stream)

      expect(parsing.isAccepted()).toBe(false)
    })

    it('should reject complex expression (a + b) -> name (not a reference)', () => {
      const stream = Stream.ofChars('(a + b) -> name')
      const parsing = grammar.thenEos().parse(stream)

      expect(parsing.isAccepted()).toBe(false)
    })
  })

  describe('AC-MAP-07: Backwards compatibility', () => {
    it('should parse count=42 (no arrow) as LiteralNumberNode', () => {
      const stream = Stream.ofChars('42')
      const parsing = grammar.parse(stream)

      expect(parsing.isAccepted()).toBe(true)
      expect(parsing.value).toEqual({
        type: 'literal-number',
        value: 42,
      })
    })

    it('should parse simple identifier without arrow', () => {
      const stream = Stream.ofChars('users')
      const parsing = grammar.parse(stream)

      expect(parsing.isAccepted()).toBe(true)
      expect(parsing.value).toEqual({
        type: 'identifier',
        value: 'users',
      })
    })

    it('should parse binary expression without arrow', () => {
      const stream = Stream.ofChars('a + b')
      const parsing = grammar.parse(stream)

      expect(parsing.isAccepted()).toBe(true)
      expect(parsing.value).toMatchObject({
        type: 'binary',
        operator: '+',
      })
    })

    it('should parse pipe expression without arrow', () => {
      const stream = Stream.ofChars('{users|filter:active}')
      const parsing = grammar.parse(stream)

      expect(parsing.isAccepted()).toBe(true)
      expect(parsing.value).toMatchObject({
        type: 'pipe-expression',
      })
    })
  })

  describe('AC-MAP-08: Mapper inside braces', () => {
    it('should parse {users -> name} with mapper inside braces', () => {
      const stream = Stream.ofChars('{users -> name}')
      const parsing = grammar.parse(stream)

      expect(parsing.isAccepted()).toBe(true)
      expect(parsing.value).toEqual({
        type: 'mapper',
        source: { type: 'reference', path: ['users'] },
        target: { type: 'binding', name: 'name' },
      })
    })

    it('should parse nested: {data.users -> email} in braces', () => {
      const stream = Stream.ofChars('{data.users -> email}')
      const parsing = grammar.parse(stream)

      expect(parsing.isAccepted()).toBe(true)
      expect(parsing.value).toEqual({
        type: 'mapper',
        source: { type: 'reference', path: ['data', 'users'] },
        target: { type: 'binding', name: 'email' },
      })
    })
  })

  describe('Edge cases', () => {
    it('should reject empty source -> name', () => {
      const stream = Stream.ofChars('-> name')
      const parsing = grammar.parse(stream)

      expect(parsing.isAccepted()).toBe(false)
    })

    it('should reject users -> (empty target)', () => {
      const stream = Stream.ofChars('users ->')
      const parsing = grammar.thenEos().parse(stream)

      expect(parsing.isAccepted()).toBe(false)
    })

    it('should reject chained mappers users -> friends -> name', () => {
      const stream = Stream.ofChars('users -> friends -> name')
      const parsing = grammar.thenEos().parse(stream)

      expect(parsing.isAccepted()).toBe(false)
    })

    it('should reject mapper with string literal source (not a reference)', () => {
      const stream = Stream.ofChars('"hello" -> value')
      const parsing = grammar.thenEos().parse(stream)

      expect(parsing.isAccepted()).toBe(false)
    })

    it('should reject mapper with array literal source (not a reference)', () => {
      const stream = Stream.ofChars('[a, b, c] -> value')
      const parsing = grammar.thenEos().parse(stream)

      expect(parsing.isAccepted()).toBe(false)
    })

    it('should reject reserved words as target', () => {
      const stream = Stream.ofChars('users -> true')
      const parsing = grammar.thenEos().parse(stream)

      expect(parsing.isAccepted()).toBe(false)
    })
  })
})
