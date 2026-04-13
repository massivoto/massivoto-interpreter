import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import {
  createEmptyExecutionContext,
  ProgramResult,
  write,
} from '@massivoto/kit'
import { runProgram } from '../../../program-runner.js'
import { CoreCommandRegistry } from '../../../command-registry/command-registry.js'
import { CoreHandlersBundle } from '../../../command-registry/core-handlers-bundle.js'
import { FileSaveHandler } from '../../file/file-save.handler.js'

/**
 * Reusable test runner for OTO integration tests.
 *
 * Replaces the duplicated ImageGenerator / ReverseImageAnalyser patterns
 * with a single utility that supports:
 * - Multi-line OTO programs
 * - Preloaded variables
 * - Temporary workspace with automatic cleanup
 * - Output extraction with actionable error messages
 * - File existence checks in workspace
 */
export class OtoTestRunner {
  private lastResult: ProgramResult | undefined
  private preloadedVars: Record<string, any> = {}
  private workspace: string | undefined
  private extraEnv: Record<string, string> = {}

  /**
   * Pre-load a variable into scope before running the program.
   */
  withVar(name: string, value: any): this {
    this.preloadedVars[name] = value
    return this
  }

  /**
   * Add extra environment variables on top of defaults.
   */
  withEnv(env: Record<string, string>): this {
    Object.assign(this.extraEnv, env)
    return this
  }

  /**
   * Create a temporary workspace directory.
   * Sets context.fileSystem.projectRoot so @file/save can write relative paths.
   * Call cleanup() when done.
   */
  withWorkspace(prefix = 'oto-test-'): this {
    this.workspace = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
    return this
  }

  /**
   * Parse and execute an OTO program through the full pipeline.
   */
  async run(otoSource: string): Promise<ProgramResult> {
    const registry = new CoreCommandRegistry()
    registry.addBundle(new CoreHandlersBundle())
    await registry.reload()
    await registry.addRegistryItem('@file/save', new FileSaveHandler())

    const context = createEmptyExecutionContext('integration-test')
    context.env = {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? '',
      ...this.extraEnv,
    }

    if (this.workspace) {
      context.fileSystem = { projectRoot: this.workspace }
    }

    for (const [name, value] of Object.entries(this.preloadedVars)) {
      write(name, value, context.scopeChain)
    }
    this.preloadedVars = {}

    this.lastResult = await runProgram(otoSource, context, registry)
    return this.lastResult
  }

  /**
   * Get an output variable from the last run.
   * Throws with an actionable error message if undefined.
   */
  getOutput(varName: string): any {
    if (!this.lastResult) throw new Error('No result available, call run() first')
    const value = this.lastResult.data[varName]
    if (value === undefined) {
      const actions = this.lastResult.batches.flatMap(b => b.actions)
      const failed = actions.find(a => !a.success)
      const hint = failed
        ? `Command ${failed.command} failed: ${failed.fatalError ?? failed.messages?.join(', ')}`
        : 'No failed action found, but output was not stored'
      throw new Error(`Output "${varName}" is undefined. ${hint}`)
    }
    return value
  }

  /**
   * Return the workspace directory path.
   */
  getWorkspacePath(): string {
    if (!this.workspace) throw new Error('No workspace created. Call withWorkspace() first')
    return this.workspace
  }

  /**
   * Check if a file exists in the workspace (relative path).
   */
  fileExists(relativePath: string): boolean {
    return fs.existsSync(path.join(this.getWorkspacePath(), relativePath))
  }

  /**
   * Read a file from the workspace as UTF-8 string.
   */
  readWorkspaceFile(relativePath: string): string {
    return fs.readFileSync(path.join(this.getWorkspacePath(), relativePath), 'utf-8')
  }

  /**
   * Get file size in bytes for a file in the workspace.
   */
  fileSize(relativePath: string): number {
    return fs.statSync(path.join(this.getWorkspacePath(), relativePath)).size
  }

  /**
   * Remove the temporary workspace. Safe to call multiple times.
   */
  cleanup(): void {
    if (this.workspace) {
      fs.rmSync(this.workspace, { recursive: true, force: true })
      this.workspace = undefined
    }
  }
}
