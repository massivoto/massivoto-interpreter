import { ActionResult, ExecutionContext } from '@massivoto/kit'
import { BaseCommandHandler } from '../handlers/index.js'

export class BasicHandler<V> extends BaseCommandHandler<V> {
  constructor(
    commandName: string,
    runFunction: (
      args: Record<string, any>,
      context: ExecutionContext | undefined,
      output?: string | undefined,
    ) => Promise<ActionResult<V>>,
  ) {
    super(commandName)
    this.run = runFunction
  }

  run(
    args: Record<string, any>,
    context: ExecutionContext,
    output?: string | undefined,
  ): Promise<ActionResult<V>> {
    throw new Error('Method not implemented.')
  }
}
