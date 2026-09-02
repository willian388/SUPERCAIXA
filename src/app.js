const path = require('path');
const express = require('express');
const cors = require('cors');

const { migrate, seedDefaults } = require('./db');
const authRoutes = require('./routes/auth');
const categoryRoutes = require('./routes/categories');
const movementRoutes = require('./routes/movements');
const accountRoutes = require('./routes/accounts');
const cashRoutes = require('./routes/cash');
const reportRoutes = require('./routes/reports');

const app = express();

app.use(cors());
app.use(express.json());

// Frontend estático
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// API
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/movements', movementRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/cash', cashRoutes);
app.use('/api/reports', reportRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Rota raiz → login
app.get('/', (req, res) => res.redirect('/login.html'));

// Fallback para SPA (app.html)
app.get('/app', (req, res) => res.sendFile(path.join(publicDir, 'app.html')));

// 404 para API
app.use('/api', (req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

module.exports = { app, migrate, seedDefaults };