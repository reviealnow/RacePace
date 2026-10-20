import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
export const workouts = sqliteTable('workouts', {
  id: text('id').primaryKey(),
  owner: text('owner').notNull(),
  name: text('name').notNull(),
  started: integer('started').notNull(),
  duration: real('duration').notNull(),
  distance: real('distance').notNull(),
  payload: text('payload').notNull(),
  created: integer('created').notNull(),
}, table => [index('workouts_owner_started').on(table.owner, table.started)]);
