import { describe, it, expect } from 'vitest'
import { Stream } from '@masala/parser'
import { buildInstructionParserForTest } from './instruction-parser.js'
import { InstructionNode, SystemVariableNode } from './ast.js'

/**
 * Formula One Race theme: system variables use the $-prefix convention.
 * In a forEach over drivers, $index gives position, $count gives 1-based count, etc.
 */
describe('System Variable Parser (R-SYSVAR-21 to 23)', () => {
  const grammar = buildInstructionParserForTest()
  const grammarStrict = buildInstructionParserForTest().thenEos()

  function parse(instruction: string) {
    return grammar.parse(Stream.ofChars(instruction))
  }

  function parseStrict(instruction: string) {
    return grammarStrict.parse(Stream.ofChars(instruction))
  }

  describe('R-SYSVAR-21: $identifier token produces SystemVariableNode', () => {
    it('parses $index as system-variable node', () => {
      const parsing = parse('@utils/log message=$index')
      expect(parsing.isAccepted()).toBe(true)
      const instr = parsing.value as InstructionNode
      const arg = instr.args[0]
      expect(arg.value).toEqual({
        type: 'system-variable',
        name: 'index',
      })
    })

    it('parses $count as system-variable node', () => {
      const parsing = parse('@utils/log message=$count')
      expect(parsing.isAccepted()).toBe(true)
      const instr = parsing.value as InstructionNode
      const arg = instr.args[0]
      expect(arg.value).toEqual({
        type: 'system-variable',
        name: 'count',
      })
    })

    it('parses $length as system-variable node', () => {
      const parsing = parse('@utils/log message=$length')
      expect(parsing.isAccepted()).toBe(true)
      const instr = parsing.value as InstructionNode
      const arg = instr.args[0]
      expect(arg.value).toEqual({
        type: 'system-variable',
        name: 'length',
      })
    })

    it('parses $first as system-variable node', () => {
      const parsing = parse('@utils/log message=$first')
      expect(parsing.isAccepted()).toBe(true)
      const instr = parsing.value as InstructionNode
      expect(instr.args[0].value).toEqual({
        type: 'system-variable',
        name: 'first',
      })
    })

    it('parses $last as system-variable node', () => {
      const parsing = parse('@utils/log message=$last')
      expect(parsing.isAccepted()).toBe(true)
      const instr = parsing.value as InstructionNode
      expect(instr.args[0].value).toEqual({
        type: 'system-variable',
        name: 'last',
      })
    })

    it('parses $odd and $even as system-variable nodes', () => {
      const parsing = parse('@utils/log a=$odd b=$even')
      expect(parsing.isAccepted()).toBe(true)
      const instr = parsing.value as InstructionNode
      expect(instr.args[0].value).toEqual({
        type: 'system-variable',
        name: 'odd',
      })
      expect(instr.args[1].value).toEqual({
        type: 'system-variable',
        name: 'even',
      })
    })

    it('parses $runId (future system variable pattern)', () => {
      const parsing = parse('@utils/log message=$runId')
      expect(parsing.isAccepted()).toBe(true)
      const instr = parsing.value as InstructionNode
      expect(instr.args[0].value).toEqual({
        type: 'system-variable',
        name: 'runId',
      })
    })

    it('parses $_underscoreStart as system-variable', () => {
      const parsing = parse('@utils/log message=$_internal')
      expect(parsing.isAccepted()).toBe(true)
      const instr = parsing.value as InstructionNode
      expect(instr.args[0].value).toEqual({
        type: 'system-variable',
        name: '_internal',
      })
    })
  })

  describe('R-SYSVAR-22: $variable works in all expression positions', () => {
    it('AC-SYSVAR-07: $index in braced expression {$index}', () => {
      const parsing = parse('@utils/log message={$index}')
      expect(parsing.isAccepted()).toBe(true)
      const instr = parsing.value as InstructionNode
      const argValue = instr.args[0].value as SystemVariableNode
      expect(argValue.type).toBe('system-variable')
      expect(argValue.name).toBe('index')
    })

    it('$index in binary expression {$index + 1}', () => {
      const parsing = parse('@utils/log message={$index + 1}')
      expect(parsing.isAccepted()).toBe(true)
      const instr = parsing.value as InstructionNode
      const argValue = instr.args[0].value
      expect(argValue.type).toBe('binary')
    })

    it('$count in comparison if={$count > 0}', () => {
      const parsing = parse('@utils/log message="hi" if={$count > 0}')
      expect(parsing.isAccepted()).toBe(true)
      const instr = parsing.value as InstructionNode
      expect(instr.condition).toBeDefined()
      expect(instr.condition!.type).toBe('binary')
    })

    it('$first in condition if=$first', () => {
      const parsing = parse('@utils/log message="hi" if=$first')
      expect(parsing.isAccepted()).toBe(true)
      const instr = parsing.value as InstructionNode
      expect(instr.condition).toBeDefined()
      const condition = instr.condition as SystemVariableNode
      expect(condition.type).toBe('system-variable')
      expect(condition.name).toBe('first')
    })

    it('$index in logical expression if={$first || $last}', () => {
      const parsing = parse('@utils/log message="hi" if={$first || $last}')
      expect(parsing.isAccepted()).toBe(true)
      const instr = parsing.value as InstructionNode
      expect(instr.condition).toBeDefined()
      expect(instr.condition!.type).toBe('logical')
    })
  })

  describe('R-SYSVAR-23: invalid $ patterns are rejected', () => {
    it('$123 (digit after $) is not accepted as a complete instruction', () => {
      const parsing = parseStrict('@utils/log message=$123')
      expect(parsing.isAccepted()).toBe(false)
    })

    it('bare $ is not accepted as a complete instruction', () => {
      const parsing = parseStrict('@utils/log message=$')
      expect(parsing.isAccepted()).toBe(false)
    })
  })
})
