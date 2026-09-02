const express = require('express');
const { db } = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// Resumo das vendas do dia por forma de pagamento (para conferência no fechamento)
router.get('/daily-sales/:date', (req, res) => {
  const date = req.params.date;
  const rows = db.prepare(
    `SELECT payment_method, COALESCE(SUM(value),0) AS total, COUNT(*) AS count
     FROM movements WHERE type = 'receita' AND date = ?
     GROUP BY payment_method`
  ).all(date);
  const total = rows.reduce((s, r) => s + r.total, 0);
  res.json({ date, by_payment: rows, total });
});

// Listar fechamentos de caixa
router.get('/', (req, res) => {
  const { start, end } = req.query;
  const params = [];
  let sql = `SELECT c.*, u.name AS closed_by_name FROM cash_closures c
             LEFT JOIN users u ON u.id = c.closed_by WHERE 1=1`;
  if (start) { sql += ' AND c.date >= ?'; params.push(start); }
  if (end) { sql += ' AND c.date <= ?'; params.push(end); }
  sql += ' ORDER BY c.date DESC, c.id DESC';
  res.json(db.prepare(sql).all(...params));
});

// Fazer fechamento de caixa
router.post('/', requireRole('proprietario', 'gerente', 'caixa'), (req, res) => {
  const b = req.body || {};
  const date = b.date;
  if (!date) return res.status(400).json({ error: 'Data é obrigatória.' });

  // Calcula o esperado pelo sistema: soma das receitas do dia
  const receitas = db.prepare(
    `SELECT COALESCE(SUM(value),0) AS total FROM movements
     WHERE type='receita' AND date = ? AND payment_method != 'fiado'`
  ).get(date).total;

  const by_payment = db.prepare(
    `SELECT payment_method, COALESCE(SUM(value),0) AS total FROM movements
     WHERE type='receita' AND date = ? AND payment_method != 'fiado'
     GROUP BY payment_method`
  ).all(date);

  const expectedTotal = b.expected_total !== undefined ? Number(b.expected_total) : receitas;
  const actualTotal = Number(b.actual_total);
  if (isNaN(actualTotal)) return res.status(400).json({ error: 'Informe o valor real em caixa.' });
  const difference = actualTotal - expectedTotal;

  const info = db.prepare(
    `INSERT INTO cash_closures
       (user_id, date, expected_total, actual_total, difference, by_payment_method, observations, closed_by)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(
    req.user.id, date, expectedTotal, actualTotal, difference,
    JSON.stringify(by_payment), b.observations || null, req.user.id
  );
  res.status(201).json(db.prepare('SELECT * FROM cash_closures WHERE id = ?').get(info.lastInsertRowid));
});

// Fluxo de caixa do dia: saldo inicial, entradas, saídas, saldo final projetado
router.get('/flow', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Informe a data (YYYY-MM-DD).' });

  const opening = req.query.opening !== undefined ? Number(req.query.opening) : (Number(req.query.initial) || 0);
  const entradas = db.prepare(
    `SELECT COALESCE(SUM(value),0) AS total FROM movements WHERE type='receita' AND date = ?`
  ).get(date).total;
  const saidas = db.prepare(
    `SELECT COALESCE(SUM(value),0) AS total FROM movements WHERE type='despesa' AND date = ?`
  ).get(date).total;
  const saldoFinal = opening + entradas - saidas;

  res.json({
    date,
    saldo_inicial: opening,
    entradas,
    saidas,
    saldo_final: saldoFinal
  });
});

module.exports = router;