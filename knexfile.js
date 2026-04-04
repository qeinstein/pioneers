import * as dotenv from 'dotenv';
dotenv.config();

/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
export default {
  development: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    migrations: {
      directory: './server/migrations',
      tableName: 'knex_migrations',
      extension: 'js',
      loadExtensions: ['.js']
    }
  },
  production: {
    client: 'postgresql',
    connection: {
      connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
      ssl: { rejectUnauthorized: false }
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: './server/migrations',
      tableName: 'knex_migrations',
      extension: 'js',
      loadExtensions: ['.js']
    }
  }
};
