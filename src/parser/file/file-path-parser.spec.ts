import { describe, it, expect } from 'vitest'
import {
  GenlexTracer,
  SingleParser,
  Stream,
  TracingGenLex,
} from '@masala/parser'
import {
  ExpressionNode,
  FileLiteralNode,
  GlobLiteralNode,
  ArgumentNode,
} from '../ast.js'
import { createExpressionWithPipe } from '../args-details/full-expression-parser.js'
import { createArgumentTokens } from '../args-details/tokens/argument-tokens.js'
import { createArgGrammar } from '../arg-parser.js'

let tracer: GenlexTracer

function buildExpressionParser(): SingleParser<ExpressionNode> {
  const genlex = new TracingGenLex()
  tracer = genlex.tracer
  const tokens = createArgumentTokens(genlex)
  const grammar = createExpressionWithPipe(tokens)
  return genlex.use(grammar)
}

function buildArgParser(): SingleParser<ArgumentNode> {
  const genlex = new TracingGenLex()
  tracer = genlex.tracer
  const tokens = createArgumentTokens(genlex)
  const grammar = createArgGrammar(tokens)
  return genlex.use(grammar)
}

/**
 * Theme: F1 Image Pipeline (The Race Was Great)
 *
 * We're building a landing page for a F1 SaaS. We need to process racing photos,
 * generate hero images, and organize driver portraits.
 */
describe('File path literal parser', () => {
  const parser = buildExpressionParser()

  describe('R-FP-21: fileLiteralParser parses ~/ paths without *', () => {
    it('should parse ~/images/hero.png as FileLiteralNode', () => {
      const stream = Stream.ofChars('~/images/hero.png')
      const parsing = parser.parse(stream)

      expect(parsing.isAccepted()).toBe(true)
      const result = parsing.value as FileLiteralNode
      expect(result.type).toBe('literal-file')
      expect(result.value).toBe('~/images/hero.png')
    })

    it('should parse ~/a as single-character filename', () => {
      const stream = Stream.ofChars('~/a')
      const parsing = parser.parse(stream)

      expect(parsing.isAccepted()).toBe(true)
      const result = parsing.value as FileLiteralNode
      expect(result.type).toBe('literal-file')
      expect(result.value).toBe('~/a')
    })

    it('should parse deep nested paths', () => {
      const stream = Stream.ofChars('~/output/drivers/vettel/hero.png')
      const parsing = parser.parse(stream)

      expect(parsing.isAccepted()).toBe(true)
      const result = parsing.value as FileLiteralNode
      expect(result.type).toBe('literal-file')
      expect(result.value).toBe('~/output/drivers/vettel/hero.png')
    })

    it('should parse paths with dots as literal characters', () => {
      const stream = Stream.ofChars('~/images/races/monaco.final.png')
      const parsing = parser.parse(stream)

      expect(parsing.isAccepted()).toBe(true)
      const result = parsing.value as FileLiteralNode
      expect(result.type).toBe('literal-file')
      expect(result.value).toBe('~/images/races/monaco.final.png')
    })

    it('should parse paths with hyphens and underscores', () => {
      const stream = Stream.ofChars('~/race-data/2024_monaco-results.json')
      const parsing = parser.parse(stream)

      expect(parsing.isAccepted()).toBe(true)
      const result = parsing.value as FileLiteralNode
      expect(result.type).toBe('literal-file')
      expect(result.value).toBe('~/race-data/2024_monaco-results.json')
    })
  })

  describe('R-FP-22: globLiteralParser parses ~/ paths with *', () => {
    it('should parse ~/images/races/*.jpg as GlobLiteralNode', () => {
      const stream = Stream.ofChars('~/images/races/*.jpg')
      const parsing = parser.parse(stream)

      expect(parsing.isAccepted()).toBe(true)
      const result = parsing.value as GlobLiteralNode
      expect(result.type).toBe('literal-glob')
      expect(result.value).toBe('~/images/races/*.jpg')
    })

    it('should parse double glob ~/images/**/*.png', () => {
      const stream = Stream.ofChars('~/images/**/*.png')
      const parsing = parser.parse(stream)

      expect(parsing.isAccepted()).toBe(true)
      const result = parsing.value as GlobLiteralNode
      expect(result.type).toBe('literal-glob')
      expect(result.value).toBe('~/images/**/*.png')
    })

    it('should parse glob with star at end ~/photos/*', () => {
      const stream = Stream.ofChars('~/photos/*')
      const parsing = parser.parse(stream)

      expect(parsing.isAccepted()).toBe(true)
      const result = parsing.value as GlobLiteralNode
      expect(result.type).toBe('literal-glob')
      expect(result.value).toBe('~/photos/*')
    })
  })

  describe('R-FP-24: Path traversal rejection', () => {
    it('should reject ~/images/../secrets/key.pem', () => {
      const stream = Stream.ofChars('~/images/../secrets/key.pem')
      const parsing = parser.thenEos().parse(stream)

      expect(parsing.isAccepted()).toBe(false)
    })

    it('should reject ~/..', () => {
      const stream = Stream.ofChars('~/..')
      const parsing = parser.thenEos().parse(stream)

      expect(parsing.isAccepted()).toBe(false)
    })

    it('should reject glob with traversal ~/images/../*.jpg', () => {
      const stream = Stream.ofChars('~/images/../*.jpg')
      const parsing = parser.thenEos().parse(stream)

      expect(parsing.isAccepted()).toBe(false)
    })
  })

  describe('R-FP-25: Trailing slash normalization', () => {
    it('should normalize ~/images/ to ~/images', () => {
      const stream = Stream.ofChars('~/images/')
      const parsing = parser.parse(stream)

      expect(parsing.isAccepted()).toBe(true)
      const result = parsing.value as FileLiteralNode
      expect(result.type).toBe('literal-file')
      expect(result.value).toBe('~/images')
    })
  })

  describe('R-FP-43: Must start with ~/', () => {
    it('should not parse bare path images/hero.png as file literal', () => {
      const stream = Stream.ofChars('images/hero.png')
      const parsing = parser.parse(stream)

      if (parsing.isAccepted()) {
        expect(parsing.value.type).not.toBe('literal-file')
        expect(parsing.value.type).not.toBe('literal-glob')
      }
    })
  })
})

describe('File path in argument context', () => {
  const argParser = buildArgParser()

  it('AC-FP-01: image=~/images/hero.png produces FileLiteralNode', () => {
    const stream = Stream.ofChars('image=~/images/hero.png')
    const parsing = argParser.parse(stream)

    expect(parsing.isAccepted()).toBe(true)
    const result = parsing.value as ArgumentNode
    expect(result.type).toBe('argument')
    expect(result.name).toEqual({ type: 'identifier', value: 'image' })
    expect(result.value).toEqual({
      type: 'literal-file',
      value: '~/images/hero.png',
    })
  })

  it('AC-FP-02: dots are literal path characters in image=~/images/races/monaco.final.png', () => {
    const stream = Stream.ofChars('image=~/images/races/monaco.final.png')
    const parsing = argParser.parse(stream)

    expect(parsing.isAccepted()).toBe(true)
    const result = parsing.value as ArgumentNode
    expect(result.value).toEqual({
      type: 'literal-file',
      value: '~/images/races/monaco.final.png',
    })
  })

  it('AC-FP-03: of=~/images/races/*.jpg produces GlobLiteralNode', () => {
    const stream = Stream.ofChars('of=~/images/races/*.jpg')
    const parsing = argParser.parse(stream)

    expect(parsing.isAccepted()).toBe(true)
    const result = parsing.value as ArgumentNode
    expect(result.value).toEqual({
      type: 'literal-glob',
      value: '~/images/races/*.jpg',
    })
  })

  it('AC-FP-04: of=~/images/**/*.png produces GlobLiteralNode with double glob', () => {
    const stream = Stream.ofChars('of=~/images/**/*.png')
    const parsing = argParser.parse(stream)

    expect(parsing.isAccepted()).toBe(true)
    const result = parsing.value as ArgumentNode
    expect(result.value).toEqual({
      type: 'literal-glob',
      value: '~/images/**/*.png',
    })
  })

  it('AC-FP-05: deep nested path=~/output/drivers/vettel/hero.png', () => {
    const stream = Stream.ofChars('path=~/output/drivers/vettel/hero.png')
    const parsing = argParser.parse(stream)

    expect(parsing.isAccepted()).toBe(true)
    const result = parsing.value as ArgumentNode
    expect(result.value).toEqual({
      type: 'literal-file',
      value: '~/output/drivers/vettel/hero.png',
    })
  })

  it('AC-FP-06: image=~/images/../secrets/key.pem is rejected (path traversal)', () => {
    const stream = Stream.ofChars('image=~/images/../secrets/key.pem')
    const parsing = argParser.thenEos().parse(stream)

    expect(parsing.isAccepted()).toBe(false)
  })

  it('AC-FP-07: image=~/images/ trailing slash is accepted and normalized', () => {
    const stream = Stream.ofChars('image=~/images/')
    const parsing = argParser.parse(stream)

    expect(parsing.isAccepted()).toBe(true)
    const result = parsing.value as ArgumentNode
    expect(result.value).toEqual({
      type: 'literal-file',
      value: '~/images',
    })
  })

  it('AC-FP-08: image=~/a single-character filename works', () => {
    const stream = Stream.ofChars('image=~/a')
    const parsing = argParser.parse(stream)

    expect(parsing.isAccepted()).toBe(true)
    const result = parsing.value as ArgumentNode
    expect(result.value).toEqual({
      type: 'literal-file',
      value: '~/a',
    })
  })

  it('AC-FP-09: data=~/race-data/2024_monaco-results.json accepts _ and -', () => {
    const stream = Stream.ofChars('data=~/race-data/2024_monaco-results.json')
    const parsing = argParser.parse(stream)

    expect(parsing.isAccepted()).toBe(true)
    const result = parsing.value as ArgumentNode
    expect(result.value).toEqual({
      type: 'literal-file',
      value: '~/race-data/2024_monaco-results.json',
    })
  })

  it('AC-FP-10: file path and identifier do not confuse each other', () => {
    const argParser1 = buildArgParser()
    const argParser2 = buildArgParser()

    const stream1 = Stream.ofChars('input=~/in/data.json')
    const parsing1 = argParser1.parse(stream1)
    expect(parsing1.isAccepted()).toBe(true)
    expect(parsing1.value.value).toEqual({
      type: 'literal-file',
      value: '~/in/data.json',
    })

    // "output" is a reserved word; use "target" instead to verify identifiers work alongside file paths
    const stream2 = Stream.ofChars('target=result')
    const parsing2 = argParser2.parse(stream2)
    expect(parsing2.isAccepted()).toBe(true)
    expect(parsing2.value.value).toEqual({
      type: 'identifier',
      value: 'result',
    })
  })
})
