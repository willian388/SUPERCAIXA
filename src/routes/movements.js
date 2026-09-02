const express = require('express');
const { db } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

const PAYMENT_METHODS = ['dinheiro', 'cartao', 'pix', 'fiado'];

// Listar movimentações com filtros
router.get('/', (req, res) => {
  const { type, start, end, payment_method, q, limit } = req.query;
  const params = [];
  let sql = `SELECT m.*, c.name AS category_name, c.is_fixed AS category_is_fixed
             FROM movements m LEFT JOIN categories c ON c.id = m.category_id WHERE 1=1`;

  if (type && ['receita', 'despesa'].includes(type)) { sql += ' AND m.type = ?'; params.push(type); }
  if (start) { sql += ' AND m.date >= ?'; params.push(start); }
  if (end) { sql += ' AND m.date <= ?'; params.push(end); }
  if (payment_method && PAYMENT_METHODS.includes(payment_method)) { sql += ' AND m.payment_method = ?'; params.push(payment_method); }
  if (q) { sql += ' AND (m.description LIKE ? OR m.counterparty LIKE ? OR m.observations LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`); }

  sql += ' ORDER BY m.date DESC, m.id DESC';
  if (limit) { sql += ' LIMIT ?'; params.push(Number(limit)); }

  res.json(db.prepare(sql).all(...params));
});

// Resumo agregado (total receitas/despesas por período, agrupado por forma de pagamento)
router.get('/summary', (req, res) => {
  const { start, end } = req.query;
  const params = [];
  let where = 'WHERE 1=1';
  if (start) { where += ' AND date >= ?'; params.push(start); }
  if (end) { where += ' AND date <= ?'; params.push(end); }

  const byType = db.prepare(
    `SELECT type, COALESCE(SUM(value),0) AS total FROM movements ${where} GROUP BY type`
  ).all(...params);

  const byPayment = db.prepare(
    `SELECT type, payment_method, COALESCE(SUM(value),0) AS total FROM movements ${where} GROUP BY type, payment_method`
  ).all(...params);

  const totals = { receita: 0, despesa: 0 };
  byType.forEach(r => { totals[r.type] = r.total; });

  res.json({ totals, by_payment: byPayment });
});

// Obter uma movimentação
router.get('/:id', (req, res) => {
  const m = db.prepare(
    `SELECT m.*, c.name AS category_name FROM movements m
     LEFT JOIN categories c ON c.id = m.category_id WHERE m.id = ?`
  ).get(req.params.id);
  if (!m) return res.status(404).json({ error: 'Movimentação não encontrada.' });
  res.json(m);
});

function validateBody(body) {
  const errors = [];
  if (!body || !['receita', 'despesa'].includes(body.type)) errors.push('Tipo deve ser receita ou despesa.');
  if (!body || !body.date) errors.push('Data é obrigatória.');
  if (body && (body.value === undefined || isNaN(Number(body.value)) || Number(body.value) <= 0)) {
    errors.push('Valor deve ser maior que zero.');
  }
  if (body && body.payment_method && !PAYMENT_METHODS.includes(body.payment_method)) {
    errors.push('Forma de pagamento inválida.');
  }
  return errors;
}

// Criar movimentação
router.post('/', (req, res) => {
  const errors = validateBody(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });

  const b = req.body;
  const info = db.prepare(
    `INSERT INTO movements
       (user_id, type, date, value, description, payment_method, category_id, counterparty, due_date, observations)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(
    req.user.id, b.type, b.date, Number(b.value), b.description || null,
    b.payment_method || 'dinheiro', b.category_id || null,
    b.counterparty || null, b.due_date || null, b.observations || null
  );

  const movementId = info.lastInsertRowid;

  // Cria conta a receber se venda a prazo (fiado)
  if (b.type === 'receita' && (b.payment_method || 'dinheiro') === 'fiado' && b.due_date) {
    db.prepare(
      `INSERT INTO accounts (user_id, movement_id, type, description, counterparty, value, due_date)
       VALUES (?,?,?,?,?,?,?)`
    ).run(req.user.id, movementId, 'receber', b.description, b.counterparty, Number(b.value), b.due_date);
  }
  // Cria conta a pagar se despesa com vencimento
  if (b.type === 'despesa' && b.due_date) {
    db.prepare(
      `INSERT INTO accounts (user_id, movement_id, type, description, counterparty, value, due_date)
       VALUES (?,?,?,?,?,?,?)`
    ).run(req.user.id, movementId, 'pagar', b.description, b.counterparty, Number(b.value), b.due_date);
  }

  const m = db.prepare('SELECT * FROM movements WHERE id = ?').get(movementId);
  res.status(201).json(m);
});

// Atualizar movimentação
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM movements WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Movimentação não encontrada.' });
  const b = req.body || {};
  db.prepare(
    `UPDATE movements SET date=?, value=?, description=?, payment_method=?,
       category_id=?, counterparty=?, due_date=?, observations=?
     WHERE id=?`
  ).run(
    b.date || existing.date, b.value !== undefined ? Number(b.value) : existing.value,
    b.description !== undefined ? b.description : existing.description,
    b.payment_method || existing.payment_method,
    b.category_id !== undefined ? b.category_id : existing.category_id,
    b.counterparty !== undefined ? b.counterparty : existing.counterparty,
    b.due_date !== undefined ? b.due_date : existing.due_date,
    b.observations !== undefined ? b.observations : existing.observations,
    existing.id
  );
  res.json(db.prepare('SELECT * FROM movements WHERE id = ?').get(existing.id));
});

// Deletar movimentação (e contas vinculadas)
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM movements WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Movimentação não encontrada.' });
  db.prepare('DELETE FROM movements WHERE id = ?').run(existing.id);
  db.prepare('DELETE FROM accounts WHERE movement_id = ?').run(existing.id);
  res.json({ ok: true });
});

module.exports = router;