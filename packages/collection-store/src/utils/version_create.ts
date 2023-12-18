import { Delta } from 'jsondiffpatch'
import { IVersion } from '../types/IVersion'

import { debug } from 'debug'
const log = debug('version_create')

export function version_create(version: number, delta: Delta): IVersion {
  log(arguments)
  return {
    version,
    delta,
    date: Date.now(),
  }
}
