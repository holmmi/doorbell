import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { test } from 'node:test'

for (const secret of [undefined, '', '   ']) {
  void test(`JWT configuration rejects ${JSON.stringify(secret)} secrets`, () => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      DOTENV_CONFIG_PATH: '__test_missing_env__',
    }
    if (secret === undefined) {
      delete env.JWT_SECRET
    } else {
      env.JWT_SECRET = secret
    }

    const result = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        '--input-type=module',
        '--eval',
        "await import('./src/config/auth.ts')",
      ],
      {
        cwd: path.resolve(import.meta.dirname, '../../..'),
        env,
        encoding: 'utf8',
      }
    )
    assert.notEqual(result.status, 0)
    assert.match(
      result.stderr,
      /Missing required environment variable: JWT_SECRET/
    )
  })
}
