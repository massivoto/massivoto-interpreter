/**
 * CoreCommandRegistry - concrete implementation of CommandRegistry.
 *
 * Extends BaseComposableRegistry to provide command handler management
 * with conflict detection, lifecycle management, and bundle provenance tracking.
 *
 * @example
 * ```typescript
 * const registry = new CoreCommandRegistry()
 * registry.addBundle(new CoreHandlersBundle())
 * registry.addBundle(customBundle)
 * await registry.reload()
 *
 * const handler = await registry.resolve('@social/post')
 * await handler.run(args, context)
 * ```
 */
import {
  BaseComposableRegistry,
  CommandHandler,
  CommandRegistry,
} from '@massivoto/kit'

export class CoreCommandRegistry
  extends BaseComposableRegistry<CommandHandler>
  implements CommandRegistry {}
