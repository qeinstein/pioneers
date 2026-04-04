/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  const columns = [
    { name: 'username', type: 'text', unique: true },
    { name: 'dob', type: 'text' },
    { name: 'birthday_pic_url', type: 'text' },
    { name: 'shoutout_url', type: 'text' },
    { name: 'instagram', type: 'text' },
    { name: 'twitter', type: 'text' }
  ];

  for (const col of columns) {
    const exists = await knex.schema.hasColumn('users', col.name);
    if (!exists) {
      await knex.schema.table('users', (table) => {
        let column;
        if (col.type === 'text') {
            column = table.text(col.name);
        }
        
        if (col.unique) column.unique();
        
        // Set defaults based on the column name
        if (col.name === 'username' || col.name === 'dob') {
            column.defaultTo(null);
        } else {
            column.defaultTo('');
        }
      });
      console.log(`Added column ${col.name} to users table`);
    }
  }

  const hasMatricUsername = await knex.schema.hasColumn('allowed_matrics', 'username');
  if (!hasMatricUsername) {
    await knex.schema.table('allowed_matrics', (table) => {
      table.text('username').unique().defaultTo(null);
    });
    console.log('Added username to allowed_matrics');
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  // Not needed for a hotfix
}
