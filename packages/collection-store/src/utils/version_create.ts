import { Delta } from 'jsondiffpatch'
import { IVersion } from '../types/IVersion'

export function version_create(version: number, delta: Delta): IVersion {
  return {
    version,
    delta,
    date: Date.now(),
  }
}
