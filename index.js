const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Body Parser Middleware
app.use(express.json());

// Serve static assets from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Mount authentication routes
app.use('/api/auth', require('./routes/auth'));

// Catch-all route to serve the Single Page App for any non-API request
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`   User Authentication Service running on port ${PORT} `);
  console.log(`   Local URL: http://localhost:${PORT}              `);
  console.log(`==================================================`);
});
