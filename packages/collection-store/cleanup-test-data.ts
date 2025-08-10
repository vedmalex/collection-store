import { cleanupTestData } from './packages/shared-test-utils/src/utils/testUtils';

const main = async () => {
  const dataPaths = ['./test-data', './test-data-2'];
  await cleanupTestData(dataPaths);
  console.log('Test data cleanup complete.');
};

main().catch(console.error);