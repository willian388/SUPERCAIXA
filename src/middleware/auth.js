const jwt = require('jsonwebtoken');
const { db } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-nao-utilizar-em-producao';

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    created_at: user.created_at
  };
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Não autenticado.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado.' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
  }
}

const ROLES = { proprietario: 3, gerente: 2, caixa: 1 };
function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado para este nível de usuário.' });
    }
    next();
  };
}

module.exports = { signToken, publicUser, authRequired, requireRole, JWT_SECRET, ROLES };