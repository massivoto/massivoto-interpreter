import { CoreCommandRegistry } from '../command-registry/command-registry.js'
import { FetchHandler } from '../core-handlers/mcp/client/fetch/fetch.handler.js'
import { FileSaveHandler } from '../core-handlers/file/file-save.handler.js'
import { LogHandler } from '../core-handlers/utils/log.handler.js'
import { SetHandler } from '../core-handlers/utils/set.handler.js'

let commandHandlerRegistry: CoreCommandRegistry | undefined = undefined

export function getCommandHandlerRegistry() {
  if (!commandHandlerRegistry) {
    commandHandlerRegistry = new CoreCommandRegistry()
  }
  return commandHandlerRegistry
}

export async function registerStandardCommandHandlers(): Promise<CoreCommandRegistry> {
  const registry = getCommandHandlerRegistry()

  /*  const open = new OpenAction()
  registry.register('@puppet/open', open)*/

  const reader = new FetchHandler()
  await registry.addRegistryItem('@web/read', reader)

  const fileSave = new FileSaveHandler()
  await registry.addRegistryItem('@file/save', fileSave)

  const logger = new LogHandler()
  await registry.addRegistryItem('@utils/log', logger)

  const setter = new SetHandler()
  await registry.addRegistryItem('@utils/set', setter)
  await registry.addRegistryItem('@set/array', setter)

  return registry
}
