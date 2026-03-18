/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // Check users table columns first (outside the table() callback)
  const hasUsername = await knex.schema.hasColumn('users', 'username');
  const hasDob = await knex.schema.hasColumn('users', 'dob');
  const hasBirthdayPic = await knex.schema.hasColumn('users', 'birthday_pic_url');
  const hasShoutout = await knex.schema.hasColumn('users', 'shoutout_url');
  const hasInstagram = await knex.schema.hasColumn('users', 'instagram');
  const hasTwitter = await knex.schema.hasColumn('users', 'twitter');

  // Apply changes to users if needed
  await knex.schema.table('users', (table) => {
    if (!hasUsername) table.text('username').unique().defaultTo(null);
    if (!hasDob) table.text('dob').defaultTo(null);
    if (!hasBirthdayPic) table.text('birthday_pic_url').defaultTo('');
    if (!hasShoutout) table.text('shoutout_url').defaultTo('');
    if (!hasInstagram) table.text('instagram').defaultTo('');
    if (!hasTwitter) table.text('twitter').defaultTo('');
  });

  // Check allowed_matrics table
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
export async function down(knex) {
  // Check for columns before dropping to avoid errors if they've already been dropped
  const hasUsername = await knex.schema.hasColumn('users', 'username');
  const hasUsernameInMatrics = await knex.schema.hasColumn('allowed_matrics', 'username');

  return knex.schema
    .table('users', (table) => {
      if (hasUsername) {
        table.dropColumns(['username', 'dob', 'birthday_pic_url', 'shoutout_url', 'instagram', 'twitter']);
      }
    })
    .table('allowed_matrics', (table) => {
      if (hasUsernameInMatrics) {
        table.dropColumn('username');
      }
    });
}
