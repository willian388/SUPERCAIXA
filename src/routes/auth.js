const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { signToken, publicUser, authRequired } = require('../middleware/auth');

const router = express.Router();

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Registro de novo usuário
router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
  }
  if (!validateEmail(email)) return res.status(400).json({ error: 'E-mail inválido.' });
  if (password.length < 6) return res.status(400).json({ error: 'A senha deve ter ao menos 6 caracteres.' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });

  const allowedRoles = ['caixa', 'gerente', 'proprietario'];
  const finalRole = allowedRoles.includes(role) ? role : 'caixa';
  const hash = await bcrypt.hash(password, 10);
  const info = db.prepare(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)'
  ).run(name, email.toLowerCase(), hash, finalRole);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

// Login com e-mail e senha
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Informe e-mail e senha.' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user || !user.password_hash) {
    return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'E-mail ou senha inválidos.' });

  res.json({ token: signToken(user), user: publicUser(user) });
});

// Dados do usuário autenticado
router.get('/me', authRequired, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// ---- Login com Google (OAuth2) ----
// Fluxo opcional. Quando GOOGLE_CLIENT_ID estiver configurado, o frontend
// redireciona para /api/auth/google para iniciar o fluxo.
const google = require('./google')(router);

module.exports = router;