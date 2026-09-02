const express = require('express');
const { db } = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// Listar contas com filtros
router.get('/', (req, res) => {
  const { type, status, start, end, q } = req.query;
  const params = [];
  let sql = `SELECT a.*, m.type AS movement_type FROM accounts a
             LEFT JOIN movements m ON m.id = a.movement_id WHERE 1=1`;
  if (type && ['pagar', 'receber'].includes(type)) { sql += ' AND a.type = ?'; params.push(type); }
  if (status && ['pendente', 'pago', 'atrasado'].includes(status)) { sql += ' AND a.status = ?'; params.push(status); }
  if (start) { sql += ' AND a.due_date >= ?'; params.push(start); }
  if (end) { sql += ' AND a.due_date <= ?'; params.push(end); }
  if (q) { sql += ' AND (a.description LIKE ? OR a.counterparty LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  sql += ' ORDER BY a.due_date ASC, a.id DESC';
  res.json(db.prepare(sql).all(...params));
});

// Criar conta manualmente
router.post('/', (req, res) => {
  const b = req.body || {};
  if (!['pagar', 'receber'].includes(b.type)) return res.status(400).json({ error: 'Tipo deve ser pagar ou receber.' });
  if (!b.value || Number(b.value) <= 0) return res.status(400).json({ error: 'Valor deve ser maior que zero.' });
  if (!b.due_date) return res.status(400).json({ error: 'Data de vencimento é obrigatória.' });
  const info = db.prepare(
    `INSERT INTO accounts (user_id, type, description, counterparty, value, due_date, status)
     VALUES (?,?,?,?,?,?,?)`
  ).run(req.user.id, b.type, b.description || null, b.counterparty || null, Number(b.value), b.due_date, 'pendente');
  res.status(201).json(db.prepare('SELECT * FROM accounts WHERE id = ?').get(info.lastInsertRowid));
});

// Atualizar conta
router.put('/:id', (req, res) => {
  const acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  if (!acc) return res.status(404).json({ error: 'Conta não encontrada.' });
  const b = req.body || {};
  db.prepare(
    `UPDATE accounts SET description=?, counterparty=?, value=?, due_date=? WHERE id=?`
  ).run(
    b.description !== undefined ? b.description : acc.description,
    b.counterparty !== undefined ? b.counterparty : acc.counterparty,
    b.value !== undefined ? Number(b.value) : acc.value,
    b.due_date || acc.due_date,
    acc.id
  );
  res.json(db.prepare('SELECT * FROM accounts WHERE id = ?').get(acc.id));
});

// Baixa de conta (marcar como paga/recebida)
router.post('/:id/settle', requireRole('proprietario', 'gerente'), (req, res) => {
  const acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  if (!acc) return res.status(404).json({ error: 'Conta não encontrada.' });
  if (acc.status === 'pago') return res.status(400).json({ error: 'Esta conta já foi baixada.' });

  const paidDate = (req.body && req.body.paid_date) || new Date().toISOString().slice(0, 10);
  db.prepare('UPDATE accounts SET status=?, paid_date=? WHERE id=?').run('pago', paidDate, acc.id);

  // Se não há movimentação vinculada, registra a movimentação financeira correspondente
  if (!acc.movement_id) {
    const type = acc.type === 'pagar' ? 'despesa' : 'receita';
    db.prepare(
      `INSERT INTO movements (user_id, type, date, value, description, payment_method, counterparty)
       VALUES (?,?,?,?,?,?,?)`
    ).run(req.user.id, type, paidDate, acc.value, acc.description, 'dinheiro', acc.counterparty);
  }

  res.json(db.prepare('SELECT * FROM accounts WHERE id = ?').get(acc.id));
});

// Desfazer baixa
router.post('/:id/unsettle', (req, res) => {
  const acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  if (!acc) return res.status(404).json({ error: 'Conta não encontrada.' });
  db.prepare('UPDATE accounts SET status=?, paid_date=? WHERE id=?').run('pendente', null, acc.id);
  res.json(db.prepare('SELECT * FROM accounts WHERE id = ?').get(acc.id));
});

// Deletar conta
router.delete('/:id', (req, res) => {
  const acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  if (!acc) return res.status(404).json({ error: 'Conta não encontrada.' });
  db.prepare('DELETE FROM accounts WHERE id = ?').run(acc.id);
  res.json({ ok: true });
});

module.exports = router;