import { CoreCommandRegistry } from './command-registry.js'
import {
  ExitHandler,
  GotoHandler,
  LogHandler,
  ReturnHandler,
  SetHandler,
} from '../core-handlers/index.js'

/**
 * Create a fresh command registry with standard handlers.
 * This avoids the singleton issue from registerStandardCommandHandlers.
 * Includes flow control handlers for @flow/goto, @flow/exit, @flow/return.
 */
export async function createStandardCommandRegistry(): Promise<CoreCommandRegistry> {
  const registry = new CoreCommandRegistry()
  await registry.addRegistryItem('@utils/log', new LogHandler())
  await registry.addRegistryItem('@utils/set', new SetHandler())
  // Flow control handlers (R-GOTO-41, R-GOTO-44, R-GOTO-47)
  await registry.addRegistryItem('@flow/goto', new GotoHandler())
  await registry.addRegistryItem('@flow/exit', new ExitHandler())
  await registry.addRegistryItem('@flow/return', new ReturnHandler())
  return registry
}
