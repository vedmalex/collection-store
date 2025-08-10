import fs from 'fs-extra';
import path from 'path';

export const cleanupTestData = async (dataPaths: string[]) => {
  for (const dataPath of dataPaths) {
    const absPath = path.resolve(dataPath);
    if (fs.existsSync(absPath)) {
      console.log(`Cleaning up test data: ${absPath}`);
      await fs.remove(absPath);
    }
  }
};