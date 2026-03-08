// load environment variables from the config directory
// dotenv defaults to looking for a .env file in the current working
// directory (backend/) so we specify the explicit path where we placed
// our file.
require('dotenv').config({ path: './src/config/.env' });

const { syncDaily } = require('./services/syncService');

async function main() {
  try {
    await syncDaily();
    process.exit(0);
  } catch (err) {
    console.error('Error during sync:', err.message || err);
    process.exit(1);
  }
}

main();
