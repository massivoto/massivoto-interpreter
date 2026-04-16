import { describe, it, expect } from 'vitest'
import { GenLex, SingleParser, Stream } from '@masala/parser'
import { AtomicNode } from '../../ast.js'
import { createArgumentTokens } from './argument-tokens.js'
import { atomicParser } from './literals-parser.js'

export function buildParserForTests(): SingleParser<AtomicNode> {
  const genlex = new GenLex()
  const tokens = createArgumentTokens(genlex)
  const grammar = atomicParser(tokens)
  return genlex.use(grammar)
}

describe('Atomic parser', () => {
  const grammar = buildParserForTests()

  it('should accept an id argument', () => {
    const stream = Stream.ofChars('id')
    const parsing = grammar.parse(stream)
    expect(parsing.isAccepted()).toBe(true)
    expect(parsing.value).toEqual({
      type: 'bare-string',
      value: 'id',
    })
  })

  it('should accept an id argument, thought starts like true', () => {
    const stream = Stream.ofChars('tryThis')
    const parsing = grammar.parse(stream)
    expect(parsing.isAccepted()).toBe(true)
    expect(parsing.value).toEqual({
      type: 'bare-string',
      value: 'tryThis',
    })
  })

  it('should accept an id argument, thought it starts WITH true', () => {
    const stream = Stream.ofChars('trueMan')
    const parsing = grammar.parse(stream)
    expect(parsing.isAccepted()).toBe(true)
    expect(parsing.value).toEqual({
      type: 'bare-string',
      value: 'trueMan',
    })
  })

  it('should accept a number argument', () => {
    const stream = Stream.ofChars('10')
    const parsing = grammar.parse(stream)
    expect(parsing.isAccepted()).toBe(true)
    expect(parsing.value).toEqual({ type: 'literal-number', value: 10 })
  })

  it('should accept a number argument kept as string', () => {
    const stream = Stream.ofChars('"10"')
    const parsing = grammar.parse(stream)
    expect(parsing.isAccepted()).toBe(true)
    expect(parsing.value).toEqual({ type: 'literal-string', value: '10' })
  })

  it('should accept a boolean true', () => {
    const stream = Stream.ofChars('true')
    const parsing = grammar.parse(stream)
    expect(parsing.isAccepted()).toBe(true)
    expect(parsing.value).toEqual({ type: 'literal-boolean', value: true })
  })

  it('should accept a boolean false', () => {
    const stream = Stream.ofChars('false')
    const parsing = grammar.parse(stream)
    expect(parsing.isAccepted()).toBe(true)
    expect(parsing.value).toEqual({ type: 'literal-boolean', value: false })
  })

  it('should keep quoted boolean "true" as string', () => {
    const stream = Stream.ofChars('"true"')
    const parsing = grammar.parse(stream)
    expect(parsing.isAccepted()).toBe(true)
    expect(parsing.value).toEqual({ type: 'literal-string', value: 'true' })
  })

  it('should keep quoted boolean "false" as string', () => {
    const stream = Stream.ofChars('"false"')
    const parsing = grammar.parse(stream)
    expect(parsing.isAccepted()).toBe(true)
    expect(parsing.value).toEqual({ type: 'literal-string', value: 'false' })
  })

  it('should treat capitalized True as identifier (case-sensitive)', () => {
    const stream = Stream.ofChars('True')
    const parsing = grammar.parse(stream)
    expect(parsing.isAccepted()).toBe(true)
    expect(parsing.value).toEqual({ type: 'bare-string', value: 'True' })
  })

  it('should treat identifiers starting with true as identifier', () => {
    const stream = Stream.ofChars('trueValue')
    const parsing = grammar.parse(stream)
    expect(parsing.isAccepted()).toBe(true)
    expect(parsing.value).toEqual({
      type: 'bare-string',
      value: 'trueValue',
    })
  })

  it('should treat falsey as identifier, not boolean', () => {
    const stream = Stream.ofChars('falsey')
    const parsing = grammar.parse(stream)
    expect(parsing.isAccepted()).toBe(true)
    expect(parsing.value).toEqual({ type: 'bare-string', value: 'falsey' })
  })
})

describe('String escape sequences', () => {
  const grammar = buildParserForTests()

  it('should parse escaped backslash', () => {
    const stream = Stream.ofChars('"C:\\\\Users\\\\name"')
    const parsing = grammar.parse(stream)
    expect(parsing.isAccepted()).toBe(true)
    expect(parsing.value).toEqual({
      type: 'literal-string',
      value: 'C:\\Users\\name',
    })
  })

  it('should parse escaped newline', () => {
    const stream = Stream.ofChars('"line1\\nline2"')
    const parsing = grammar.parse(stream)
    expect(parsing.isAccepted()).toBe(true)
    expect(parsing.value).toEqual({
      type: 'literal-string',
      value: 'line1\nline2',
    })
  })

  it('should parse escaped tab', () => {
    const stream = Stream.ofChars('"col1\\tcol2"')
    const parsing = grammar.parse(stream)
    expect(parsing.isAccepted()).toBe(true)
    expect(parsing.value).toEqual({
      type: 'literal-string',
      value: 'col1\tcol2',
    })
  })

  it('should parse mixed escapes (backslash, newline, tab)', () => {
    const stream = Stream.ofChars('"line1\\nline2\\tcol"')
    const parsing = grammar.parse(stream)
    expect(parsing.isAccepted()).toBe(true)
    expect(parsing.value).toEqual({
      type: 'literal-string',
      value: 'line1\nline2\tcol',
    })
  })

  it('should parse escaped backslash in single-quoted string', () => {
    const stream = Stream.ofChars("'C:\\\\Users\\\\name'")
    const parsing = grammar.parse(stream)
    expect(parsing.isAccepted()).toBe(true)
    expect(parsing.value).toEqual({
      type: 'literal-string',
      value: 'C:\\Users\\name',
    })
  })

  it('should parse escaped newline in single-quoted string', () => {
    const stream = Stream.ofChars("'line1\\nline2'")
    const parsing = grammar.parse(stream)
    expect(parsing.isAccepted()).toBe(true)
    expect(parsing.value).toEqual({
      type: 'literal-string',
      value: 'line1\nline2',
    })
  })

  it('should parse escaped tab in single-quoted string', () => {
    const stream = Stream.ofChars("'col1\\tcol2'")
    const parsing = grammar.parse(stream)
    expect(parsing.isAccepted()).toBe(true)
    expect(parsing.value).toEqual({
      type: 'literal-string',
      value: 'col1\tcol2',
    })
  })
})

describe('Single-quoted strings', () => {
  const grammar = buildParserForTests()

  it('should parse a simple single-quoted string', () => {
    const stream = Stream.ofChars("'hello world'")
    const parsing = grammar.parse(stream)
    expect(parsing.isAccepted()).toBe(true)
    expect(parsing.value).toEqual({
      type: 'literal-string',
      value: 'hello world',
    })
  })

  it('should parse empty single-quoted string', () => {
    const stream = Stream.ofChars("''")
    const parsing = grammar.parse(stream)
    expect(parsing.isAccepted()).toBe(true)
    expect(parsing.value).toEqual({
      type: 'literal-string',
      value: '',
    })
  })

  it('should parse double quotes inside single-quoted string', () => {
    const stream = Stream.ofChars("'He said \"hello\" to them'")
    const parsing = grammar.parse(stream)
    expect(parsing.isAccepted()).toBe(true)
    expect(parsing.value).toEqual({
      type: 'literal-string',
      value: 'He said "hello" to them',
    })
  })

  it('should parse single quotes inside double-quoted string', () => {
    const stream = Stream.ofChars('"the customer\'s feedback"')
    // Note: The \' here is a JS string escape, not an OTO escape.
    // In the actual OTO source, this would be: "the customer's feedback"
    // But Stream.ofChars receives the raw characters.
    // Let me use a raw approach:
    const stream2 = Stream.ofChars("\"the customer's feedback\"")
    const parsing = stream2 ? grammar.parse(stream2) : grammar.parse(stream)
    expect(parsing.isAccepted()).toBe(true)
    expect(parsing.value).toEqual({
      type: 'literal-string',
      value: "the customer's feedback",
    })
  })

  it('should parse JSON content in single-quoted string', () => {
    const stream = Stream.ofChars("'{\"name\": \"John\"}'")
    const parsing = grammar.parse(stream)
    expect(parsing.isAccepted()).toBe(true)
    expect(parsing.value).toEqual({
      type: 'literal-string',
      value: '{"name": "John"}',
    })
  })
})

describe('Removed escape: backslash-quote', () => {
  const grammar = buildParserForTests()

  it('should NOT parse backslash-doublequote as escape -- use single quotes instead', () => {
    // Old OTO: "say \"hello\"" -- \" was an escape, produced 'say "hello"'
    // New OTO: \" is no longer a valid escape. Use single quotes instead:
    const stream = Stream.ofChars("'say \"hello\" to them'")
    const parsing = grammar.parse(stream)
    expect(parsing.isAccepted()).toBe(true)
    expect(parsing.value).toEqual({
      type: 'literal-string',
      value: 'say "hello" to them',
    })
  })

  it('backslash before double-quote is not an escape sequence', () => {
    // "say \" -- the \ is literal (not followed by recognized escape char)
    // then " closes the string. GenLex rejects because of leftover text.
    const stream = Stream.ofChars('"say \\"hello"')
    const parsing = grammar.parse(stream)
    // GenLex rejects: the string "say \" is parsed, but "hello" remains
    expect(parsing.isAccepted()).toBe(false)
  })
})
