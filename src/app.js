
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const app = express();
const authRoutes = require('./routes/auth.routes');
const errorHandler = require('./middleware/error.middleware');

// Security middleware
app.use(helmet());

// Allow cross-origin requests
app.use(cors());

// Parse incoming JSON request bodies
app.use(express.json());

// Basic health-check route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'KoboMarket API is running',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);

// Handle routes that do not exist
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

app.use(errorHandler);

module.exports = app;
