import { describe, it, expect } from 'vitest'
import { Stream } from '@masala/parser'
import { buildInstructionParserForTest } from './instruction-parser.js'

describe('Reserved Arguments', () => {
  // Two grammars: one for acceptance tests, one for rejection tests
  const grammarForAccept = buildInstructionParserForTest()
  // thenEos() ensures full consumption - use for rejection tests
  const grammarForReject = buildInstructionParserForTest().thenEos()

  function parse(instruction: string) {
    const stream = Stream.ofChars(instruction)
    return grammarForAccept.parse(stream)
  }

  function parseStrict(instruction: string) {
    const stream = Stream.ofChars(instruction)
    return grammarForReject.parse(stream)
  }

  describe('output=identifier', () => {
    it('parses output=result and stores in InstructionNode.output', () => {
      const parsing = parse('@twitter/post message="hello" output=result')
      expect(parsing.isAccepted()).toBe(true)
      const instr = parsing.value

      expect(instr.output).toBeDefined()
      expect(instr.output).toEqual({ type: 'identifier', value: 'result' })
      // Regular args should not contain output
      expect(
        instr.args.find((a: any) => a.name.value === 'output'),
      ).toBeUndefined()
    })

    it('parses output at beginning of args', () => {
      const parsing = parse('@twitter/post output=tweets message="hello"')

      expect(parsing.isAccepted()).toBe(true)
      const instr = parsing.value

      expect(instr.output).toEqual({ type: 'identifier', value: 'tweets' })
      expect(instr.args.length).toBe(1)
      expect(instr.args[0].name.value).toBe('message')
    })

    it('parses output as only arg', () => {
      const parsing = parse('@data/fetch output=response')

      expect(parsing.isAccepted()).toBe(true)
      const instr = parsing.value

      expect(instr.output).toEqual({ type: 'identifier', value: 'response' })
      expect(instr.args.length).toBe(0)
    })

    it('rejects output=123 (must be identifier)', () => {
      const parsing = parseStrict('@twitter/post output=123')
      expect(parsing.isAccepted()).toBe(false)
    })

    it('rejects output="string" (must be identifier)', () => {
      const parsing = parseStrict('@twitter/post output="result"')
      expect(parsing.isAccepted()).toBe(false)
    })
  })

  describe('if=expression', () => {
    it('parses if=identifier and stores in InstructionNode.condition', () => {
      const parsing = parse('@twitter/post message="hello" if=isVerified')

      expect(parsing.isAccepted()).toBe(true)
      const instr = parsing.value

      expect(instr.condition).toBeDefined()
      expect(instr.condition).toEqual({
        type: 'identifier',
        value: 'isVerified',
      })
    })

    it('parses if={binary expression}', () => {
      const parsing = parse(
        '@twitter/post message="hello" if={followers > 100}',
      )

      expect(parsing.isAccepted()).toBe(true)
      const instr = parsing.value

      expect(instr.condition).toBeDefined()
      expect(instr.condition?.type).toBe('binary')
      expect((instr.condition as any).operator).toBe('>')
    })

    it('parses if={logical expression}', () => {
      const parsing = parse('@twitter/post if={isActive && hasPermission}')

      expect(parsing.isAccepted()).toBe(true)
      const instr = parsing.value

      expect(instr.condition?.type).toBe('logical')
      expect((instr.condition as any).operator).toBe('&&')
    })

    it('parses if={comparison with number}', () => {
      const parsing = parse('@data/filter if={count >= 10}')

      expect(parsing.isAccepted()).toBe(true)
      const instr = parsing.value

      expect(instr.condition?.type).toBe('binary')
      expect((instr.condition as any).operator).toBe('>=')
      expect((instr.condition as any).left).toEqual({
        type: 'identifier',
        value: 'count',
      })
      expect((instr.condition as any).right).toEqual({
        type: 'literal-number',
        value: 10,
      })
    })

    it('parses if with boolean literal', () => {
      const parsing = parse('@debug/log if=true')

      expect(parsing.isAccepted()).toBe(true)
      const instr = parsing.value

      expect(instr.condition).toEqual({ type: 'literal-boolean', value: true })
    })
  })

  describe('strict syntax (no spaces around =)', () => {
    it('rejects if = condition (space before =)', () => {
      const parsing = parseStrict('@twitter/post if = isActive')
      // 'if' alone is a reserved word, can't be used as identifier
      // So this should fail to parse
      expect(parsing.isAccepted()).toBe(false)
    })

    it('rejects output = result (space before =)', () => {
      const parsing = parseStrict('@twitter/post output = result')
      // 'output' is now a reserved word, can't be used as identifier
      expect(parsing.isAccepted()).toBe(false)
    })

    it('accepts if= condition (space after = is just token separator)', () => {
      // 'if=' is a single token, space after is just GenLex separator
      // This is different from 'if = cond' where space breaks the token
      const parsing = parse('@twitter/post if= isActive')
      expect(parsing.isAccepted()).toBe(true)
      expect(parsing.value.condition).toEqual({
        type: 'identifier',
        value: 'isActive',
      })
    })
  })

  describe('combined reserved args', () => {
    it('parses both output and if on same instruction', () => {
      const parsing = parse(
        '@twitter/post message="hello" if=isActive output=result',
      )

      expect(parsing.isAccepted()).toBe(true)
      const instr = parsing.value

      expect(instr.condition).toEqual({ type: 'identifier', value: 'isActive' })
      expect(instr.output).toEqual({ type: 'identifier', value: 'result' })
      expect(instr.args.length).toBe(1)
      expect(instr.args[0].name.value).toBe('message')
    })

    it('parses reserved args in any order', () => {
      const parsing = parse(
        '@twitter/post output=result if=isActive message="hello"',
      )

      expect(parsing.isAccepted()).toBe(true)
      const instr = parsing.value

      expect(instr.output).toBeDefined()
      expect(instr.condition).toBeDefined()
      expect(instr.args.length).toBe(1)
    })
  })

  describe('no reserved args', () => {
    it('parses instruction without reserved args', () => {
      const parsing = parse('@twitter/post message="hello" count=5')

      expect(parsing.isAccepted()).toBe(true)
      const instr = parsing.value

      expect(instr.output).toBeUndefined()
      expect(instr.condition).toBeUndefined()
      expect(instr.args.length).toBe(2)
    })

    it('parses instruction with no args at all', () => {
      const parsing = parse('@system/ping')

      expect(parsing.isAccepted()).toBe(true)
      const instr = parsing.value

      expect(instr.output).toBeUndefined()
      expect(instr.condition).toBeUndefined()
      expect(instr.args.length).toBe(0)
    })
  })

  describe('label="name" reserved argument', () => {
    describe('R-GOTO-01: label is a reserved argument', () => {
      it('parses label="retry" and stores in InstructionNode.label', () => {
        const parsing = parse('@utils/set input="hello" label="retry"')
        expect(parsing.isAccepted()).toBe(true)
        const instr = parsing.value

        expect(instr.label).toBe('retry')
        // label should not appear in regular args
        expect(
          instr.args.find((a: any) => a.name.value === 'label'),
        ).toBeUndefined()
      })

      it('parses label at beginning of args', () => {
        const parsing = parse('@utils/set label="start" input="value"')
        expect(parsing.isAccepted()).toBe(true)
        const instr = parsing.value

        expect(instr.label).toBe('start')
        expect(instr.args.length).toBe(1)
        expect(instr.args[0].name.value).toBe('input')
      })

      it('parses label as only arg', () => {
        const parsing = parse('@utils/log label="checkpoint"')
        expect(parsing.isAccepted()).toBe(true)
        const instr = parsing.value

        expect(instr.label).toBe('checkpoint')
        expect(instr.args.length).toBe(0)
      })
    })

    describe('R-GOTO-03: label must be a simple string literal', () => {
      it('rejects label=identifier (must be quoted string)', () => {
        const parsing = parseStrict('@utils/set label=myLabel')
        expect(parsing.isAccepted()).toBe(false)
      })

      it('rejects label={expression} (must be string literal)', () => {
        const parsing = parseStrict('@utils/set label={name}')
        expect(parsing.isAccepted()).toBe(false)
      })

      it('rejects label=123 (must be string literal)', () => {
        const parsing = parseStrict('@utils/set label=123')
        expect(parsing.isAccepted()).toBe(false)
      })
    })

    describe('R-GOTO-04: label must match identifier pattern', () => {
      it('accepts label="retry"', () => {
        const parsing = parse('@utils/set label="retry"')
        expect(parsing.isAccepted()).toBe(true)
        expect(parsing.value.label).toBe('retry')
      })

      it('accepts label="my_label"', () => {
        const parsing = parse('@utils/set label="my_label"')
        expect(parsing.isAccepted()).toBe(true)
        expect(parsing.value.label).toBe('my_label')
      })

      it('accepts label="retry-loop"', () => {
        const parsing = parse('@utils/set label="retry-loop"')
        expect(parsing.isAccepted()).toBe(true)
        expect(parsing.value.label).toBe('retry-loop')
      })

      it('accepts label="_private"', () => {
        const parsing = parse('@utils/set label="_private"')
        expect(parsing.isAccepted()).toBe(true)
        expect(parsing.value.label).toBe('_private')
      })

      it('accepts label="Label123"', () => {
        const parsing = parse('@utils/set label="Label123"')
        expect(parsing.isAccepted()).toBe(true)
        expect(parsing.value.label).toBe('Label123')
      })

      it('rejects label="123start" (must start with letter or underscore)', () => {
        const parsing = parseStrict('@utils/set label="123start"')
        expect(parsing.isAccepted()).toBe(false)
      })

      it('rejects label="-invalid" (must start with letter or underscore)', () => {
        const parsing = parseStrict('@utils/set label="-invalid"')
        expect(parsing.isAccepted()).toBe(false)
      })

      it('rejects label="has space" (no spaces allowed)', () => {
        const parsing = parseStrict('@utils/set label="has space"')
        expect(parsing.isAccepted()).toBe(false)
      })

      it('rejects label="" (empty string)', () => {
        const parsing = parseStrict('@utils/set label=""')
        expect(parsing.isAccepted()).toBe(false)
      })
    })

    describe('combined with other reserved args', () => {
      it('parses label with output and if', () => {
        const parsing = parse(
          '@utils/set input="value" label="checkpoint" output=result if=isActive',
        )
        expect(parsing.isAccepted()).toBe(true)
        const instr = parsing.value

        expect(instr.label).toBe('checkpoint')
        expect(instr.output).toEqual({ type: 'identifier', value: 'result' })
        expect(instr.condition).toEqual({
          type: 'identifier',
          value: 'isActive',
        })
        expect(instr.args.length).toBe(1)
      })

      it('parses label in any position', () => {
        const parsing = parse(
          '@utils/set output=result label="mid" input="value"',
        )
        expect(parsing.isAccepted()).toBe(true)
        const instr = parsing.value

        expect(instr.label).toBe('mid')
        expect(instr.output).toBeDefined()
        expect(instr.args.length).toBe(1)
      })
    })
  })

  describe('retry=expression (R-FILTER-61, R-FILTER-64, R-FILTER-66)', () => {
    it('AC-FP-13: parses retry=3 as literal number expression', () => {
      const parsing = parse('@ai/generateImage prompt="F1 car" retry=3')
      expect(parsing.isAccepted()).toBe(true)
      const instr = parsing.value

      expect(instr.retry).toBeDefined()
      expect(instr.retry).toEqual({ type: 'literal-number', value: 3 })
    })

    it('parses retry=0 (no retry)', () => {
      const parsing = parse('@ai/generateImage prompt="F1 car" retry=0')
      expect(parsing.isAccepted()).toBe(true)
      expect(parsing.value.retry).toEqual({ type: 'literal-number', value: 0 })
    })

    it('parses retry={maxRetries} as expression', () => {
      const parsing = parse(
        '@ai/generateImage prompt="F1 car" retry={maxRetries}',
      )
      expect(parsing.isAccepted()).toBe(true)
      expect(parsing.value.retry).toBeDefined()
      expect(parsing.value.retry?.type).toBe('identifier')
      expect((parsing.value.retry as any).value).toBe('maxRetries')
    })

    it('parses retry as only arg', () => {
      const parsing = parse('@ai/generateImage retry=2')
      expect(parsing.isAccepted()).toBe(true)
      expect(parsing.value.retry).toEqual({ type: 'literal-number', value: 2 })
      expect(parsing.value.args.length).toBe(0)
    })

    it('retry does not appear in regular args', () => {
      const parsing = parse('@ai/generateImage prompt="F1 car" retry=3')
      expect(parsing.isAccepted()).toBe(true)
      expect(
        parsing.value.args.find((a: any) => a.name.value === 'retry'),
      ).toBeUndefined()
    })
  })

  describe('collect=identifier (R-FILTER-62, R-FILTER-64, R-FILTER-66)', () => {
    it('AC-FP-14: parses collect=myResults as identifier', () => {
      const parsing = parse('@ai/describe prompt="F1" collect=myResults')
      expect(parsing.isAccepted()).toBe(true)
      const instr = parsing.value

      expect(instr.collect).toBeDefined()
      expect(instr.collect).toEqual({ type: 'identifier', value: 'myResults' })
    })

    it('parses collect=images', () => {
      const parsing = parse(
        '@ai/generateImage prompt="F1 car" collect=images',
      )
      expect(parsing.isAccepted()).toBe(true)
      expect(parsing.value.collect).toEqual({
        type: 'identifier',
        value: 'images',
      })
    })

    it('rejects collect=123 (must be identifier)', () => {
      const parsing = parseStrict('@ai/describe collect=123')
      expect(parsing.isAccepted()).toBe(false)
    })

    it('rejects collect="string" (must be identifier)', () => {
      const parsing = parseStrict('@ai/describe collect="results"')
      expect(parsing.isAccepted()).toBe(false)
    })

    it('collect does not appear in regular args', () => {
      const parsing = parse('@ai/describe prompt="F1" collect=results')
      expect(parsing.isAccepted()).toBe(true)
      expect(
        parsing.value.args.find((a: any) => a.name.value === 'collect'),
      ).toBeUndefined()
    })
  })

  describe('R-FILTER-103: collect and output mutually exclusive', () => {
    it('AC-FP-11: rejects instruction with both output and collect', () => {
      const source = '@ai/describe prompt="F1" output=result collect=results'
      expect(() => {
        const parsing = parse(source)
        if (!parsing.isAccepted()) throw new Error('Parse failed')
      }).toThrow(/Cannot use both output= and collect=/)
    })
  })

  describe('all reserved args combined (R-FILTER-02)', () => {
    it('AC-FP-12: parses all four reserved args regardless of order', () => {
      const parsing = parse(
        '@race/run retry=3 if={x} collect=r forEach=items -> item',
      )
      expect(parsing.isAccepted()).toBe(true)
      const instr = parsing.value

      expect(instr.retry).toEqual({ type: 'literal-number', value: 3 })
      expect(instr.condition).toBeDefined()
      expect(instr.collect).toEqual({ type: 'identifier', value: 'r' })
      expect(instr.forEach).toBeDefined()
      expect(instr.forEach?.iterator.value).toBe('item')
    })

    it('parses retry and collect with forEach and output', () => {
      const parsing = parse(
        '@race/run forEach=drivers -> driver retry=2 output=result',
      )
      expect(parsing.isAccepted()).toBe(true)
      const instr = parsing.value

      expect(instr.forEach).toBeDefined()
      expect(instr.retry).toEqual({ type: 'literal-number', value: 2 })
      expect(instr.output).toEqual({ type: 'identifier', value: 'result' })
    })
  })
})
