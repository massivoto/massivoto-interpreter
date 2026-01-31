/**
 * CommandRegistry Module
 *
 * Public exports for the command registry system.
 *
 * @example
 * ```typescript
 * import {
 *   CommandRegistry,
 *   CommandHandler,
 *   BaseCommandHandler,
 *   CoreHandlersBundle,
 *   CommandNotFoundError,
 *   ActionResult,
 * } from '@massivoto/runtime'
 * ```
 */

// Types

// Classes
export { CoreHandlersBundle } from './core-handlers-bundle.js'
export { CoreCommandRegistry } from './command-registry.js'

// Errors
export { CommandNotFoundError } from './errors.js'
export { createStandardCommandRegistry } from './standard-registry.js'
