import { GenlexTracer, Stream, TracingGenLex } from '@masala/parser'
import { describe, it, expect } from 'vitest'
import { createSimpleExpressionParser, createSimpleExpressionWithParenthesesParser } from '../simple-expression-parser.js'
import { createArgumentTokens } from '../tokens/argument-tokens.js'
import { atomicParser } from '../tokens/literals-parser.js'
import { createBarePipeParser, createPipeParser } from './pipe-parser.js'

let tracer: GenlexTracer

function createPipeGrammar() {
  const genlex = new TracingGenLex()
  const tokens = createArgumentTokens(genlex)
  tracer = genlex.tracer
  const expressionParser = createSimpleExpressionWithParenthesesParser(tokens)
  const pipeParser = createPipeParser(tokens, expressionParser)
  return genlex.use(pipeParser)
}

function createBarePipeGrammar() {
  const genlex = new TracingGenLex()
  const tokens = createArgumentTokens(genlex)
  tracer = genlex.tracer
  const bareAtomic = atomicParser(tokens)
  const bareSimple = createSimpleExpressionParser(tokens, bareAtomic)
  const barePipeParser = createBarePipeParser(tokens, bareSimple)
  return genlex.use(barePipeParser)
}

describe('Pipe parser', () => {
  const pipeGrammar = createPipeGrammar()

  it('should parse a simple pipe expression', () => {
    const stream = Stream.ofChars('{value | pipe1:arg1:arg2 | pipe2}')
    const parsing = pipeGrammar.parse(stream)

    const logs = tracer.flushForAi()
    expect(parsing.isAccepted()).toBe(true)
    const expected = {
      type: 'pipe-expression',
      input: {
        type: 'identifier',
        value: 'value',
      },
      segments: [
        {
          pipeName: 'pipe1',
          args: [
            { type: 'identifier', value: 'arg1' },
            { type: 'identifier', value: 'arg2' },
          ],
        },
        {
          pipeName: 'pipe2',
          args: [],
        },
      ],
    }
    expect(parsing.value).toEqual(expected)
  })

  it('should parse a dense pipe expression', () => {
    const stream = Stream.ofChars('{value|pipe1|pipe2}')
    const parsing = pipeGrammar.parse(stream)

    const logs = tracer.flushForAi()
    expect(parsing.isAccepted()).toBe(true)
    const expected = {
      type: 'pipe-expression',
      input: {
        type: 'identifier',
        value: 'value',
      },
      segments: [
        {
          pipeName: 'pipe1',
          args: [],
        },
        {
          pipeName: 'pipe2',
          args: [],
        },
      ],
    }
    expect(parsing.value).toEqual(expected)
  })

  it('should parse a pipe expression with nested expressions', () => {
    const stream = Stream.ofChars('{(a + b) | sum}')
    const parsing = pipeGrammar.parse(stream)

    const logs = tracer.flushForAi()
    expect(parsing.isAccepted()).toBe(true)
    const expected = {
      type: 'pipe-expression',
      input: {
        type: 'binary',
        operator: '+',
        left: { type: 'identifier', value: 'a' },
        right: { type: 'identifier', value: 'b' },
      },
      segments: [
        {
          pipeName: 'sum',
          args: [],
        },
      ],
    }
    expect(parsing.value).toEqual(expected)
  })

  it('should parse a pipe expression with nested expressions', () => {
    const stream = Stream.ofChars('{a + b*2 | sum}')
    const parsing = pipeGrammar.parse(stream)

    const logs = tracer.flushForAi()
    expect(parsing.isAccepted()).toBe(true)

    const expected = {
      type: 'pipe-expression',
      input: {
        type: 'binary',
        operator: '+',
        left: { type: 'identifier', value: 'a' },
        right: {
          type: 'binary',
          operator: '*',
          left: { type: 'identifier', value: 'b' },
          right: { type: 'literal-number', value: 2 },
        },
      },
      segments: [
        {
          pipeName: 'sum',
          args: [],
        },
      ],
    }

    expect(parsing.value).toEqual(expected)
  })
  it('should NOT parse an almost pipe expression', () => {
    const stream = Stream.ofChars('{value}')
    const parsing = pipeGrammar.parse(stream)

    expect(parsing.isAccepted()).toBe(false)
  })

  it('do not parse a really empty pipe expression', () => {
    let stream = Stream.ofChars('{}')
    let parsing = pipeGrammar.parse(stream)
    expect(parsing.isAccepted()).toBe(false)

    stream = Stream.ofChars('{ | }')
    parsing = pipeGrammar.parse(stream)
    expect(parsing.isAccepted()).toBe(false)

    stream = Stream.ofChars('{ | pipe1 }')
    parsing = pipeGrammar.parse(stream)
    expect(parsing.isAccepted()).toBe(false)

    stream = Stream.ofChars('{ value | }')
    parsing = pipeGrammar.parse(stream)
    expect(parsing.isAccepted()).toBe(false)

    stream = Stream.ofChars('{ | pipe1:arg1 }')
    parsing = pipeGrammar.parse(stream)
    expect(parsing.isAccepted()).toBe(false)

    stream = Stream.ofChars('{ value | pipe1: }')
    parsing = pipeGrammar.parse(stream)
    expect(parsing.isAccepted()).toBe(false)

    stream = Stream.ofChars('{ value | pipe1:arg1 | }')
    parsing = pipeGrammar.parse(stream)
    expect(parsing.isAccepted()).toBe(false)

    stream = Stream.ofChars('{ | pipe1:arg1 | pipe2 }')
    parsing = pipeGrammar.parse(stream)
    expect(parsing.isAccepted()).toBe(false)
  })
})

// R-BPIPE-21: Bare pipe parser tests
describe('Bare pipe parser', () => {
  const barePipeGrammar = createBarePipeGrammar()

  // AC-BPIPE-01: hello|uppercase -> PipeExpressionNode with BareStringNode input
  it('should parse a bare string piped through a single pipe', () => {
    const stream = Stream.ofChars('hello|uppercase')
    const parsing = barePipeGrammar.parse(stream)

    expect(parsing.isAccepted()).toBe(true)
    expect(parsing.value).toEqual({
      type: 'pipe-expression',
      input: { type: 'bare-string', value: 'hello' },
      segments: [{ pipeName: 'uppercase', args: [] }],
    })
  })

  // AC-BPIPE-03: hello|upper|trim -> chained segments
  it('should parse chained bare pipes', () => {
    const stream = Stream.ofChars('hello|upper|trim')
    const parsing = barePipeGrammar.parse(stream)

    expect(parsing.isAccepted()).toBe(true)
    expect(parsing.value).toEqual({
      type: 'pipe-expression',
      input: { type: 'bare-string', value: 'hello' },
      segments: [
        { pipeName: 'upper', args: [] },
        { pipeName: 'trim', args: [] },
      ],
    })
  })

  // AC-BPIPE-04: hello|pad:10 -> segment with number argument
  it('should parse bare pipe with number argument', () => {
    const stream = Stream.ofChars('hello|pad:10')
    const parsing = barePipeGrammar.parse(stream)

    expect(parsing.isAccepted()).toBe(true)
    expect(parsing.value).toEqual({
      type: 'pipe-expression',
      input: { type: 'bare-string', value: 'hello' },
      segments: [
        {
          pipeName: 'pad',
          args: [{ type: 'literal-number', value: 10 }],
        },
      ],
    })
  })

  it('should parse bare pipe with multiple arguments', () => {
    const stream = Stream.ofChars('hello|replace:world:earth')
    const parsing = barePipeGrammar.parse(stream)

    expect(parsing.isAccepted()).toBe(true)
    expect(parsing.value).toEqual({
      type: 'pipe-expression',
      input: { type: 'bare-string', value: 'hello' },
      segments: [
        {
          pipeName: 'replace',
          args: [
            { type: 'bare-string', value: 'world' },
            { type: 'bare-string', value: 'earth' },
          ],
        },
      ],
    })
  })

  // AC-BPIPE-06: 42|toString -> number literal input
  it('should parse number literal piped through a pipe', () => {
    const stream = Stream.ofChars('42|toString')
    const parsing = barePipeGrammar.parse(stream)

    expect(parsing.isAccepted()).toBe(true)
    expect(parsing.value).toEqual({
      type: 'pipe-expression',
      input: { type: 'literal-number', value: 42 },
      segments: [{ pipeName: 'toString', args: [] }],
    })
  })

  // AC-BPIPE-07: $index|toString -> system variable input
  it('should parse system variable piped through a pipe', () => {
    const stream = Stream.ofChars('$index|toString')
    const parsing = barePipeGrammar.parse(stream)

    expect(parsing.isAccepted()).toBe(true)
    expect(parsing.value).toEqual({
      type: 'pipe-expression',
      input: { type: 'system-variable', name: 'index' },
      segments: [{ pipeName: 'toString', args: [] }],
    })
  })

  it('should parse boolean literal piped through a pipe', () => {
    const stream = Stream.ofChars('true|toString')
    const parsing = barePipeGrammar.parse(stream)

    expect(parsing.isAccepted()).toBe(true)
    expect(parsing.value).toEqual({
      type: 'pipe-expression',
      input: { type: 'literal-boolean', value: true },
      segments: [{ pipeName: 'toString', args: [] }],
    })
  })

  it('should NOT parse a bare expression without pipe', () => {
    const stream = Stream.ofChars('hello')
    const parsing = barePipeGrammar.parse(stream)

    expect(parsing.isAccepted()).toBe(false)
  })
})
