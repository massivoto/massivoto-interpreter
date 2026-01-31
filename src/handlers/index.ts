// Re-export from new command-registry module
export { BaseCommandHandler } from './base-command-handler.js'
export { CoreHandlersBundle } from '../command-registry/core-handlers-bundle.js'
export { CommandNotFoundError } from '../command-registry/errors.js'

// Legacy exports - keep for backward compatibility during migration
export {
  registerStandardCommandHandlers,
  getCommandHandlerRegistry,
} from './register-handlers.js'
