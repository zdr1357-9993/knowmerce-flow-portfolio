import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const workspaces = sqliteTable('flow_workspaces', {
  ownerId: text('owner_id').primaryKey(),
  data: text('data').notNull(),
  revision: integer('revision').notNull().default(0),
});
