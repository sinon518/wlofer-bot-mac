const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api');
const webRoutes = require('./routes/web');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

const DATA_PATH = process.env.WLOFER_DATA_PATH || path.join(__dirname, '../../');
app.use('/public_icerik', express.static(path.join(DATA_PATH, 'icerik', 'videolar')));

// API routes for dynamic operations
app.use('/api', apiRoutes);

// Web routes for specific oauth callbacks etc.
app.use('/', webRoutes);

module.exports = app;
