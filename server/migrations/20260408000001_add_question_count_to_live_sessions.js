/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  const exists = await knex.schema.hasColumn('live_sessions', 'question_count');
  if (!exists) {
    await knex.schema.table('live_sessions', (table) => {
      table.integer('question_count').defaultTo(null);
    });
    console.log('Added question_count to live_sessions');
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  const exists = await knex.schema.hasColumn('live_sessions', 'question_count');
  if (exists) {
    await knex.schema.table('live_sessions', (table) => {
      table.dropColumn('question_count');
    });
  }
}
