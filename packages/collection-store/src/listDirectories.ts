import fs from 'fs'

export function listDirectories(dirPath: string): Promise<string[]> {
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
