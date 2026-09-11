import { sql, type Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // How the ticket came in: auto-routing, automation-failure, broker,
  // back-office. No CHECK, by the same rule as 0025.
  await sql`ALTER TABLE tickets ADD COLUMN origin text`.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE tickets DROP COLUMN origin`.execute(db)
}
