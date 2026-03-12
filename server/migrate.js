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

        console.log('Migration completed successfully');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit();
    }
}

migrate();
