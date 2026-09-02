const { db } = require('../db');
const { signToken } = require('../middleware/auth');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

module.exports = function (router) {
  const enabled = !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI);

  // Informa se o login com Google está disponível
  router.get('/google/status', (req, res) => {
    res.json({ enabled });
  });

  // Inicia o fluxo OAuth
  router.get('/google', (req, res) => {
    if (!enabled) {
      return res.status(400).json({ error: 'Login com Google não configurado no servidor.' });
    }
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online'
    });
    res.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
  });

  // Callback do Google
  router.get('/google/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send('Código de autorização ausente.');

    try {
      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: GOOGLE_REDIRECT_URI,
          grant_type: 'authorization_code'
        })
      });
      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        throw new Error('Falha ao obter token do Google: ' + JSON.stringify(tokenData));
      }

      const userRes = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const profile = await userRes.json();
      if (!profile.email) throw new Error('E-mail não retornado pelo Google.');

      // Busca por google_id ou e-mail
      let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(profile.sub)
        || db.prepare('SELECT * FROM users WHERE email = ?').get(profile.email.toLowerCase());

      if (user) {
        // Vincula o google_id se ainda não estiver vinculado
        if (!user.google_id) {
          db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(profile.sub, user.id);
          user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
        }
      } else {
        const info = db.prepare(
          'INSERT INTO users (name, email, google_id, role) VALUES (?,?,?,?)'
        ).run(profile.name || profile.email.split('@')[0], profile.email.toLowerCase(), profile.sub, 'caixa');
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
      }

      const token = signToken(user);
      res.redirect(`${FRONTEND_URL}/login.html?google_token=${encodeURIComponent(token)}`);
    } catch (err) {
      console.error('Erro no login com Google:', err.message);
      res.status(500).send('Falha no login com Google: ' + err.message);
    }
  });

  return router;
};