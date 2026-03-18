import { pool } from './db.js';

async function migrate() {
    console.log('Starting migration...');
    try {
        // Add username to users table
        await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS username TEXT UNIQUE DEFAULT NULL;
    `);
        console.log('Added username column to users table');

        // Add username to allowed_matrics table
        await pool.query(`
      ALTER TABLE allowed_matrics
      ADD COLUMN IF NOT EXISTS username TEXT UNIQUE DEFAULT NULL;
    `);
        console.log('Added username column to allowed_matrics table');

        // Add dob and birthday_pic_url to users table
        await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS dob TEXT DEFAULT NULL;
    `);
        console.log('Added dob column to users table');

        await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS birthday_pic_url TEXT DEFAULT '';
    `);
        console.log('Added birthday_pic_url column to users table');

        await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS shoutout_url TEXT DEFAULT '';
    `);
        console.log('Added shoutout_url column to users table');

        await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS instagram TEXT DEFAULT '';
    `);
        console.log('Added instagram column to users table');

        await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS twitter TEXT DEFAULT '';
    `);
        console.log('Added twitter column to users table');

        console.log('Migration completed successfully');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit();
    }
}

migrate();
