// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();
app.use(cors());
app.use(express.json()); // for parsing application/json

// Connect to DB
connectDB(process.env.MONGODB_URI);

// Routes
app.get('/', (req, res) => {
  res.send({ message: 'Server is running' });
});

// Import and use routes
const authRoutes = require('./routes/authRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const settingsRoutes = require('./routes/settingsRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/attendances', attendanceRoutes);
app.use('/api/settings', settingsRoutes);

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
