# Contributor Guide & Code of Conduct

## Code of Conduct

### Our Standards
- **Be Professional**: Use welcoming and inclusive language.
- **Be Respectful**: Respect differing viewpoints and experiences. Gracefully accept constructive criticism.
- **Focus on the Community**: What is best for the project and the users, not just the individual.
- **Zero Tolerance**: Harassment, exclusionary jokes, or personal attacks are strictly prohibited.

---

##  Technical Standards

### Database Migrations
To maintain database integrity across all environments:
1. **No Manual Schema Changes**: Never run `ALTER TABLE` or `CREATE TABLE` directly.
2. **Use Knex Migrations**: All changes must be version-controlled in `server/migrations/`.
   - Create: `npm run migrate:make <description>`
   - Apply: `npm run migrate`
3. **Safety First**: Always use `hasTable` and `hasColumn` checks in `up()` functions to ensure migrations are idempotent and safe for production.
4. **Data Preservation**: Never use `dropTable` or `truncate` in a migration unless data loss is the specific goal of the task.

### Coding Style
- **ES Modules**: Use `import/export` syntax (not `require`).
- **Clean Code**: Use descriptive variable names and keep functions focused on a single task.
- **Security**: Never commit secrets, API keys, or `.env` files. Use `process.env`.
- **Formatting**: Adhere to the existing Prettier/ESLint configuration.

### Git Workflow
- **Branching**: Use the format `type/description` (e.g., `feat/add-timer`, `fix/login-bug`).
- **Commits**: Use conventional commits (e.g., `feat: ...`, `fix: ...`, `docs: ...`).
- **PRs**: Ensure your code is linted and tested locally before opening a Pull Request.

---

## Environment Setup
1. Clone the repo and run `npm install`.
2. Copy `.env.example` to `.env` and fill in your credentials.
3. Run `npm run migrate` to sync your local database.
4. Run `npm run dev` to start the development environment.
