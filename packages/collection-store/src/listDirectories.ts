import fs from 'fs'

import { debug } from 'debug'
const log = debug('listDirectories')

export function listDirectories(dirPath: string): Promise<string[]> {
  log(arguments)
  return new Promise((resolve, reject) => {
    fs.readdir(dirPath, { withFileTypes: true }, (error, files) => {
      if (error) reject(error)
      const directories = files
        .filter((item) => item.isDirectory())
        .map((item) => item.name)
      resolve(directories)
    })
  })
}
