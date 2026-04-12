/**
 * AiCommandHandler - base class for AI command handlers.
 *
 * Handlers that need an AI provider extend this instead of BaseCommandHandler.
 * The interpreter detects `instanceof AiCommandHandler` and resolves + injects
 * the provider into context.resolvedProvider before calling handler.run().
 *
 * R-PAR-05: Dedicated subclass with capability field
 */
import type { AiCapability } from '@massivoto/kit'
import { BaseCommandHandler } from './base-command-handler.js'

export abstract class AiCommandHandler<T = string> extends BaseCommandHandler<T> {
  /**
   * Declares which AI capability this handler needs (text, image, image-analysis, etc.).
   * Used by the interpreter and config system for provider routing.
   */
  abstract readonly capability: AiCapability
}
