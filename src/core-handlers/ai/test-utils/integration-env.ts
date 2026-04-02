import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { config as dotenvConfig } from 'dotenv'

/**
 * R-AIC-82: Test utility for integration tests.
 * Selectively copies keys from the root .env into a temporary test .env.
 * Cleans up after the test.
 */

const ROOT_ENV_PATH = path.resolve(
  import.meta.dirname ?? __dirname,
  '../../../../.env',
)

interface IntegrationEnvOptions {
  keys: string[]
  extraVars?: Record<string, string>
}

export class IntegrationEnv {
  private tempDir: string | undefined
  private envPath: string | undefined

  constructor(private readonly rootEnvPath: string = ROOT_ENV_PATH) {}

  hasRootEnv(): boolean {
    return fs.existsSync(this.rootEnvPath)
  }

  setup(options: IntegrationEnvOptions): Record<string, string> {
    const rootEnv = this.loadRootEnv()
    if (!rootEnv) {
      throw new Error(
        `Skipping integration tests: no API keys found in root .env. See env.dist for setup.`,
      )
    }

    const env: Record<string, string> = {}

    for (const key of options.keys) {
      const value = rootEnv[key]
      if (value) {
        env[key] = value
      }
    }

    if (options.extraVars) {
      Object.assign(env, options.extraVars)
    }

    this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'integration-env-'))
    this.envPath = path.join(this.tempDir, '.env')

    const content = Object.entries(env)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n')
    fs.writeFileSync(this.envPath, content)

    return env
  }

  getTempDir(): string {
    if (!this.tempDir) throw new Error('Call setup() first')
    return this.tempDir
  }

  cleanup(): void {
    if (this.tempDir) {
      fs.rmSync(this.tempDir, { recursive: true, force: true })
      this.tempDir = undefined
      this.envPath = undefined
    }
  }

  private loadRootEnv(): Record<string, string> | undefined {
    if (!fs.existsSync(this.rootEnvPath)) return undefined

    const result = dotenvConfig({ path: this.rootEnvPath, override: false })
    if (result.error || !result.parsed) return undefined

    const hasKeys = Object.keys(result.parsed).some((k) => k.endsWith('_API_KEY'))
    if (!hasKeys) return undefined

    return result.parsed as Record<string, string>
  }
}

export function skipIfNoRootEnv(rootEnvPath: string = ROOT_ENV_PATH): boolean {
  if (!fs.existsSync(rootEnvPath)) {
    console.log(
      'Skipping integration tests: no API keys found in root .env. See env.dist for setup.',
    )
    return true
  }
  return false
}
