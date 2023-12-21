import { bootstrap } from './app.js'

try {
  const { url } = await bootstrap(3001, true)
  console.log(`server started at ${url}`)
} catch (e) {
  console.error(e)
}
