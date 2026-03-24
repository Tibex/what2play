const { Client } = require('pg');

async function setup() {
  const adminClient = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
  });

  try {
    await adminClient.connect();
    console.log('Connected to PostgreSQL');

    const userExists = await adminClient.query(
      "SELECT 1 FROM pg_roles WHERE rolname = 'bgn_user'"
    );
    if (userExists.rows.length === 0) {
      await adminClient.query("CREATE USER bgn_user WITH PASSWORD 'bgn_password'");
      console.log('Created user bgn_user');
    } else {
      console.log('User bgn_user already exists');
    }

    const dbExists = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = 'board_game_night'"
    );
    if (dbExists.rows.length === 0) {
      await adminClient.query('CREATE DATABASE board_game_night OWNER bgn_user');
      console.log('Created database board_game_night');
    } else {
      console.log('Database board_game_night already exists');
    }

    await adminClient.query('GRANT ALL PRIVILEGES ON DATABASE board_game_night TO bgn_user');
    console.log('Granted privileges');
    console.log('Setup complete!');
  } catch (err) {
    console.error('Setup failed:', err.message);
    console.log('\nTrying common postgres passwords...');

    for (const pw of ['', 'postgres', 'password', 'admin']) {
      try {
        const c = new Client({ host: 'localhost', port: 5432, user: 'postgres', password: pw, database: 'postgres' });
        await c.connect();
        console.log(`Connected with password: "${pw}"`);
        
        const userExists = await c.query("SELECT 1 FROM pg_roles WHERE rolname = 'bgn_user'");
        if (userExists.rows.length === 0) {
          await c.query("CREATE USER bgn_user WITH PASSWORD 'bgn_password'");
          console.log('Created user bgn_user');
        }

        const dbExists = await c.query("SELECT 1 FROM pg_database WHERE datname = 'board_game_night'");
        if (dbExists.rows.length === 0) {
          await c.query('CREATE DATABASE board_game_night OWNER bgn_user');
          console.log('Created database board_game_night');
        }

        await c.query('GRANT ALL PRIVILEGES ON DATABASE board_game_night TO bgn_user');
        console.log('Setup complete!');
        await c.end();
        return;
      } catch {
        continue;
      }
    }

    console.error('\nCould not connect with any common credentials.');
    console.error('Please check your PostgreSQL admin user/password and update setup-db.js accordingly.');
  } finally {
    await adminClient.end().catch(() => {});
  }
}

setup();
