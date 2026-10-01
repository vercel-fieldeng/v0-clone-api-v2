import type { InferSelectModel } from 'drizzle-orm'
import {
  pgTable,
  varchar,
  timestamp,
  uuid,
  primaryKey,
  unique,
} from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  email: varchar('email', { length: 64 }).notNull(),
  password: varchar('password', { length: 64 }),
  created_at: timestamp('created_at').notNull().defaultNow(),
})

export type User = InferSelectModel<typeof users>

// Ownership and immutable chat-creation ledger. Rows remain after upstream
// deletion so deleting a chat cannot reset the 24-hour creation quota.
export const chat_ownerships = pgTable(
  'chat_ownerships',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    v0_chat_id: varchar('v0_chat_id', { length: 255 }).notNull(), // v0 API chat ID
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    // Ensure each v0 chat can only be owned by one user
    unique('chat_ownerships_v0_chat_id_unique').on(table.v0_chat_id),
  ],
)

export type ChatOwnership = InferSelectModel<typeof chat_ownerships>

// Track anonymous chat creation by IP for rate limiting
export const anonymous_chat_logs = pgTable('anonymous_chat_logs', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  ip_address: varchar('ip_address', { length: 45 }).notNull(), // IPv6 can be up to 45 chars
  v0_chat_id: varchar('v0_chat_id', { length: 255 }).notNull(), // v0 API chat ID
  created_at: timestamp('created_at').notNull().defaultNow(),
})

export type AnonymousChatLog = InferSelectModel<typeof anonymous_chat_logs>
