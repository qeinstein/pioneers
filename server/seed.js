import db from './db.js';

console.log('Seeding database...');

// Clear all data
db.exec(`
  DELETE FROM notifications;
  DELETE FROM achievements;
  DELETE FROM streaks;
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
db.prepare(`
  INSERT INTO users (matric_no, password, display_name, role, is_first_login)
  VALUES (?, ?, ?, 'admin', 0)
`).run('240805099', 'admin', 'Admin');

console.log('Database seeded.\n');
console.log('Login credentials:');
console.log('  Admin:  240805099 / admin');
console.log('');
console.log('  Students can register after being added to the matric whitelist via Admin Panel.');
