import { bootstrap } from '../src/app.js';
import { initORM } from '../src/db.js';

export async function initTestApp(port: number) {
  console.log(`[DEBUG] Starting initTestApp for port ${port}`)

  try {
    // Enable lightweight behavior in routes for tests
    process.env.GUIDE_TEST_MODE = '1'
    console.log(`[DEBUG] Calling initORM...`)
    // this will create all the ORM services and cache them
    const { orm } = await initORM({
      // no need for debug information, it would only pollute the logs
      debug: false,
      // we will use in-memory database, this way we can easily parallelize our tests
      dbName: ':memory:',
    });
    console.log(`[DEBUG] initORM completed successfully`)

    console.log(`[DEBUG] Creating schema...`)
    // create the schema so we can use the database
    await orm.schema.createSchema();
    console.log(`[DEBUG] Schema created successfully`)

    // Disable seeder completely to test basic functionality
    // await orm.seeder.seed(TestSeeder);

    console.log(`[DEBUG] Calling bootstrap...`)
    // In tests we do not need to bind network port; we use app.inject
    const { app } = await bootstrap(port, false, false);
    // Ensure Fastify instance is fully initialized before using app.inject
    await app.ready()
    // Mark app as running in test mode for lightweight paths
    ;(app as any).testMode = true
    console.log(`[DEBUG] Bootstrap completed successfully`)

    console.log(`[DEBUG] initTestApp completed for port ${port}`)
    return app;
  } catch (error) {
    console.error(`[DEBUG] Error in initTestApp:`, error)
    throw error
  }
}
