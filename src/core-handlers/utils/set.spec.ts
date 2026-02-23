import { describe, expect, it } from 'vitest'

import { Stream } from '@masala/parser'
import { registerStandardCommandHandlers } from '../../handlers/register-handlers.js'

import { InstructionNode } from '../../parser/ast.js'
import { buildInstructionParser } from '../../parser/instruction-parser.js'
import { buildProgramParser } from '../../parser/program-parser.js'
import { ExecutionContext, fromPartialContext } from '@massivoto/kit'
import { CoreInterpreter } from '../../core-interpreter.js'
import { ExpressionEvaluator } from '../../evaluator/index.js'
import { PipeRegistry } from '../../pipe-registry/pipe-registry.js'
import { CorePipesBundle } from '../../pipe-registry/core-pipes-bundle.js'

describe('Interpreter with parsed instruction', async () => {
  const registry = await registerStandardCommandHandlers()
  const pipeRegistry = new PipeRegistry()
  pipeRegistry.addBundle(new CorePipesBundle())
  await pipeRegistry.reload()
  const evaluator = new ExpressionEvaluator(pipeRegistry)
  const interpreter = new CoreInterpreter(registry, evaluator)
  const parser = buildInstructionParser()

  const baseContext: ExecutionContext = fromPartialContext({
    env: { MODE: 'test' },
    data: {
      tweets: [{ id: 'a' }, { id: 'b' }],
      count: 42,
      users: ['a', 'b', 'c'],
      nested: {
        deep: {
          value: 99,
        },
      },
    },

    user: {
      id: 'user-123',
      extra: {},
    },
  })

  it('should evaluate literal input and store in output', async () => {
    const dsl = '@utils/set input=3 output=finalCount'
    const result = parser.parse(Stream.ofChars(dsl))
    expect(result.isAccepted()).toBe(true)

    const ast = result.value as InstructionNode

    const statementResult = await interpreter.execute(ast, baseContext)
    expect(statementResult.context.data.finalCount).toBe(3)
  })

  it('should evaluate identifier input from context.data and store in output', async () => {
    const dsl = '@utils/set input={count} output=backup'
    const result = parser.parse(Stream.ofChars(dsl))
    expect(result.isAccepted()).toBe(true)

    const ast = result.value as InstructionNode

    const statementResult = await interpreter.execute(ast, baseContext)
    expect(statementResult.context.data.backup).toBe(42)
  })

  it('should accept array literals with @set/array', async () => {
    const dsl = `@set/array input=["overtake under the rain", "first turn", "monaco tunel"] output=situations`
    const result = parser.parse(Stream.ofChars(dsl))
    expect(result.isAccepted()).toBe(true)

    const ast = result.value as InstructionNode
    const statementResult = await interpreter.execute(ast, baseContext)
    expect(statementResult.context.data.situations).toEqual([
      'overtake under the rain',
      'first turn',
      'monaco tunel',
    ])
  })

  it('should support tail pipe on array', async () => {
    const programParser = buildProgramParser()
    const source = `@set/array input=["john", "jim", "jane"] output=users
@utils/set input={users|tail:2} output=recentUsers`

    const program = programParser.val(source)
    const programResult = await interpreter.executeProgram(program, baseContext)
    expect(programResult.context.data.recentUsers).toEqual(['jim', 'jane'])
  })
})
