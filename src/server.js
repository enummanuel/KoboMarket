
require('dotenv').config();

const app = require('./app');
const connectMongoDB = require('./config/mongodb');
const pool = require('./config/postgres');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectMongoDB();

    // Verify PostgreSQL connection
    await pool.query('SELECT 1');

    console.log('PostgreSQL connected successfully');

    // Start accepting HTTP requests
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`KoboMarket API running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Server startup failed:', error.message);

    await pool.end();
    process.exit(1);
  }
};

startServer();
