import { ActionResult, ExecutionContext } from '@massivoto/kit'
import { BaseCommandHandler } from '../../handlers/index.js'

export class LogHandler extends BaseCommandHandler<void> {
  readonly type = 'command' as const

  constructor() {
    super('@utils/log')
  }

  async init(): Promise<void> {}
  async dispose(): Promise<void> {}

  async run(
    args: Record<string, any>,
    context: ExecutionContext,
  ): Promise<ActionResult<void>> {
    const message = args.message
    if (!message) {
      return this.handleFailure('Message is required', 'Message is required')
    }
    const messageStr = String(message)

    // Log to console (existing behavior)
    console.log(`[LOG] ${messageStr}`)

    // R-CONFIRM-124: Append to userLogs
    if (context.userLogs) {
      context.userLogs.push(messageStr)
    }

    return this.handleSuccess(`Logged: ${messageStr}`, undefined)
  }
}
