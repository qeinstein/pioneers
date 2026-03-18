/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // Add columns to users table
  await knex.schema.table('users', async (table) => {
    if (!(await knex.schema.hasColumn('users', 'username'))) {
      table.text('username').unique().defaultTo(null);
    }
    if (!(await knex.schema.hasColumn('users', 'dob'))) {
      table.text('dob').defaultTo(null);
    }
    if (!(await knex.schema.hasColumn('users', 'birthday_pic_url'))) {
      table.text('birthday_pic_url').defaultTo('');
    }
    if (!(await knex.schema.hasColumn('users', 'shoutout_url'))) {
      table.text('shoutout_url').defaultTo('');
    }
    if (!(await knex.schema.hasColumn('users', 'instagram'))) {
      table.text('instagram').defaultTo('');
    }
    if (!(await knex.schema.hasColumn('users', 'twitter'))) {
      table.text('twitter').defaultTo('');
    }
  });

  // Add username to allowed_matrics
  const hasUsernameInMatrics = await knex.schema.hasColumn('allowed_matrics', 'username');
  if (!hasUsernameInMatrics) {
    await knex.schema.table('allowed_matrics', (table) => {
      table.text('username').unique().defaultTo(null);
    });
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
  return knex.schema
    .table('users', (table) => {
      table.dropColumns(['username', 'dob', 'birthday_pic_url', 'shoutout_url', 'instagram', 'twitter']);
    })
    .table('allowed_matrics', (table) => {
      table.dropColumn('username');
    });
}
