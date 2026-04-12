import { ActionResult, CommandHandler, ExecutionContext } from '@massivoto/kit'
import type { AiProviderName, AiCapability } from '@massivoto/kit'

export abstract class BaseCommandHandler<T> implements CommandHandler<T> {
  // R-AIC-41: optional accepted providers list for AI handlers
  readonly acceptedProviders?: AiProviderName[]

  // R-HC-30: optional capability tag for config-based provider routing
  readonly capability?: AiCapability

  constructor(public id: string) {}
  type = 'command' as const
  async init(): Promise<void> {}
  async dispose(): Promise<void> {}
  abstract run(
    args: Record<string, any>,
    context: ExecutionContext,
    output?: string,
  ): Promise<ActionResult<T>>

  protected handleSuccess(message: string, value?: T): ActionResult<T> {
    const result: ActionResult<T> = {
      success: true,
      value,
      message,
      messages: [message],
      cost: 0,
    }
    return result
  }

  protected handleFailure(
    message: string,
    fatalError?: string,
  ): ActionResult<T> {
    return {
      success: false,
      fatalError,
      message,
      messages: [message],
      cost: 0,
    }
  }

  protected handleError(message: string): string {
    return message
  }

  protected async cleanup(): Promise<void> {}

  toString(): string {
    return `Action: ${this.constructor.name}`
  }
}
