import { BasePipeFunction } from './types.js'
import { PipeTypeError } from './errors.js'

// R-FILE-41 to R-FILE-44
export class PathPipe extends BasePipeFunction {
  readonly id = 'path'

  async execute(input: any, args: any[]): Promise<string> {
    if (!Array.isArray(input)) {
      throw new PipeTypeError('path', 'array', typeof input)
    }

    if (input.length === 0) {
      return ''
    }

    const coerced = input.map((seg) => String(seg))

    // R-FILE-43: reject '..' segments
    for (const seg of coerced) {
      if (seg === '..') {
        throw new Error("Path pipe rejects '..' segments (security)")
      }
    }

    // R-FILE-42: join with '/', skip empty, normalize slashes
    const joined = coerced
      .filter((seg) => seg !== '')
      .join('/')

    // Normalize consecutive slashes to single
    return joined.replace(/\/+/g, '/')
  }
}
