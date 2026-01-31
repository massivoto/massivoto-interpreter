import { ActionResult, ExecutionContext } from '@massivoto/kit'
import { BaseCommandHandler } from '../../handlers/index.js'

export class SetHandler extends BaseCommandHandler<any> {
  readonly type = 'command' as const

  constructor() {
    super('@utils/set')
  }

  async init(): Promise<void> {}
  async dispose(): Promise<void> {}
  async run(
    args: Record<string, any>,
    context: ExecutionContext,
  ): Promise<ActionResult<any>> {
    const input = args.input as any

    if (input === undefined) {
      return this.handleFailure('Input is required', 'Input is required')
    }
    return this.handleSuccess('Set successfully', input)
  }
}
