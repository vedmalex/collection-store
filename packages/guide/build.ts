/// <reference types='bun-types' />
//@ts-ignore
import { createConfig } from '../../shared/bun.config.ts'
import pkg from './package.json' assert { type: 'json' }

// Create a Bun config from package.json
const config = createConfig({ pkg, entrypoints: ['src/server.ts'] })

const result = await Bun.build(config)
if (!result.success) {
  throw new AggregateError(result.logs, 'Build failed')
}
