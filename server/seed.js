import { db } from './db.js';

console.log('Seeding database...');

// Check if any admin user already exists
const existingAdmin = await db.prepare('SELECT id FROM users WHERE role = $1').get('admin');

if (existingAdmin) {
    console.log('Admin user already exists. Skipping seed.');
    console.log('Login credentials:');
    console.log('  Admin:  240805099 / admin');
    console.log('');
    console.log('  Students can register after being added to the matric whitelist via Admin Panel.');
} else {
    console.log('No admin found. Seeding database...');
    
    // Clear all data
    // Note: We must delete in reverse order of dependencies to avoid FOREIGN KEY constraint failures
    await db.query(`
      DELETE FROM live_answers;
      DELETE FROM live_participants;
      DELETE FROM live_sessions;
      DELETE FROM pending_role_changes;
      DELETE FROM notifications;
      DELETE FROM streaks;
      DELETE FROM achievements;
      DELETE FROM bookmarks;
      DELETE FROM comments;
      DELETE FROM suggestions;
      DELETE FROM attempts;
      DELETE FROM questions;
      DELETE FROM quizzes;
      DELETE FROM courses;
      DELETE FROM allowed_matrics;
      DELETE FROM users;
    `);

    // Admin user
    await db.prepare(`
      INSERT INTO users (matric_no, password, display_name, role, is_first_login)
      VALUES ($1, $2, $3, 'admin', 0)
    `).run('240805099', 'admin', 'Admin');

    console.log('Database seeded.\n');
    console.log('Login credentials:');
    console.log('  Admin:  240805099 / admin');
    console.log('');
    console.log('  Students can register after being added to the matric whitelist via Admin Panel.');
}
