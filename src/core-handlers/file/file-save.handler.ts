import fs from 'fs/promises'
import path from 'path'
import {
  ActionResult,
  ExecutionContext,
  isFileReference,
  resolveFilePath,
} from '@massivoto/kit'
import { BaseCommandHandler } from '../../handlers/index.js'

// R-FILE-61 to R-FILE-64
export class FileSaveHandler extends BaseCommandHandler<string> {
  constructor() {
    super('@file/save')
  }

  async run(
    args: Record<string, any>,
    context: ExecutionContext,
  ): Promise<ActionResult<string>> {
    const data = args.data
    const fileArg = args.file

    if (fileArg === undefined || fileArg === null) {
      return this.handleFailure('Missing required arg: file')
    }

    if (data === undefined) {
      return this.handleFailure('Missing required arg: data')
    }

    let absolutePath: string
    try {
      absolutePath = this.resolveTargetPath(fileArg, context)
    } catch (e: any) {
      return this.handleFailure(e.message)
    }

    // R-FILE-63: create parent directories
    const dir = path.dirname(absolutePath)
    await fs.mkdir(dir, { recursive: true })

    // R-FILE-62: serialize based on data type
    try {
      await this.writeData(data, absolutePath)
    } catch (e: any) {
      return this.handleFailure(`Failed to write file: ${e.message}`)
    }

    return this.handleSuccess(`Saved to ${absolutePath}`, absolutePath)
  }

  private resolveTargetPath(
    fileArg: any,
    context: ExecutionContext,
  ): string {
    // R-FILE-64: FileReference -> use absolutePath
    if (isFileReference(fileArg)) {
      return fileArg.absolutePath
    }

    // String path
    if (typeof fileArg === 'string') {
      // Absolute path: use directly
      if (path.isAbsolute(fileArg)) {
        return fileArg
      }

      // Relative or ~/ prefixed: resolve against projectRoot
      const projectRoot = context.fileSystem?.projectRoot
      if (!projectRoot) {
        throw new Error(
          'File save requires a projectRoot for relative paths. Configure it in the runner.',
        )
      }

      return resolveFilePath(fileArg, projectRoot)
    }

    throw new Error(`Invalid file argument type: ${typeof fileArg}`)
  }

  // R-FILE-62
  private async writeData(data: any, absolutePath: string): Promise<void> {
    if (Buffer.isBuffer(data)) {
      await fs.writeFile(absolutePath, data)
      return
    }

    if (data instanceof Uint8Array) {
      await fs.writeFile(absolutePath, data)
      return
    }

    if (isFileReference(data)) {
      await fs.copyFile(data.absolutePath, absolutePath)
      return
    }

    if (typeof data === 'string') {
      await fs.writeFile(absolutePath, data, 'utf-8')
      return
    }

    if (typeof data === 'object') {
      const json = JSON.stringify(data, null, 2)
      await fs.writeFile(absolutePath, json, 'utf-8')
      return
    }

    // Fallback: coerce to string
    await fs.writeFile(absolutePath, String(data), 'utf-8')
  }
}
