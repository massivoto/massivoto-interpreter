/**
 * @web/fetch url=string maxlength=number start=number raw=boolean
 * @web/fetch url=required maxlength=5000 start=0 raw=false
 */
import { ActionResult, errorToString, ExecutionContext } from '@massivoto/kit'
import { BaseCommandHandler } from '../../../../handlers/base-command-handler.js'
import { FetchClient } from './fetch.client.js'

export class FetchHandler extends BaseCommandHandler<string> {
  constructor() {
    super('@web/fetch')
  }

  async run(
    args: Record<string, any>,
    context: ExecutionContext,
  ): Promise<ActionResult<string>> {
    const url = args.url as string
    const maxLength = args['max-length'] || 5000
    const start = args.start || 0
    const raw = args.raw || false
    return this.fetch(url, maxLength, start, raw)
  }

  async fetch(
    url: string,
    maxLength: number,
    start: number,
    raw: boolean,
  ): Promise<ActionResult<string>> {
    try {
      const value = await new FetchClient().fetch(url, maxLength, start, raw)
      return this.handleSuccess('Fetch executed correctly', value)
    } catch (e) {
      throw this.handleError(errorToString(e))
    }
  }
}
