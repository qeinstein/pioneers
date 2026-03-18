# Pioneers Quiz Portal

A quiz and learning platform for CSC2k28 students.

##  Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Setup Database**
   Ensure your `.env` file has a valid `DATABASE_URL`.
   ```bash
   npm run migrate
   ```

3. **Run Development Server**
   ```bash
   npm run dev
   ```

## Tech Stack

- **Frontend**: React (Vite), KaTeX (Math), TailwindCSS
- **Backend**: Node.js (Express), Socket.io (Live Quizzes)
- **Database**: PostgreSQL (Knex.js Migrations)
- **Media**: Cloudinary

## Project Structure

- `src/`: React frontend components and pages.
- `server/`: Express API, routes, and database configuration.
- `server/migrations/`: Database schema version history.

## Deployment

This project is optimized for deployment on platforms like Render.
The build command should include migrations:
`npm install && npm run build && npm run migrate`

## For Contributions

Check `CONTRIBTING.md`, Gracias.
