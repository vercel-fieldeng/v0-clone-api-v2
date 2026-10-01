import { drizzle } from 'drizzle-orm/postgres-js'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Load environment variables
import { config } from 'dotenv'
config()

const db: PostgresJsDatabase<typeof schema> = process.env.POSTGRES_URL
  ? drizzle(postgres(process.env.POSTGRES_URL), { schema })
  : new Proxy({} as PostgresJsDatabase<typeof schema>, {
      get() {
        throw new Error('POSTGRES_URL is required for database operations')
      },
    })

export default db
