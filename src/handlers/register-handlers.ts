import { CoreCommandRegistry } from '../command-registry/command-registry.js'
import { FetchHandler } from '../core-handlers/mcp/client/fetch/fetch.handler.js'
import { FileSystemWriterHandler } from '../core-handlers/mcp/client/filesystem/filesystem.handler.js'
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

  const fileWriter = new FileSystemWriterHandler()
  await registry.addRegistryItem('@file/write', fileWriter)

  const logger = new LogHandler()
  await registry.addRegistryItem('@utils/log', logger)

  const setter = new SetHandler()
  await registry.addRegistryItem('@utils/set', setter)
  await registry.addRegistryItem('@set/array', setter)

  return registry
}
