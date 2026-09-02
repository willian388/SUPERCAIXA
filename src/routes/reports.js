const express = require('express');
const { db } = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

function dateRange(req) {
  const start = req.query.start || '0000-01-01';
  const end = req.query.end || '9999-12-31';
  return { start, end };
}

// ---- DRE simplificada ----
router.get('/dre', requireRole('proprietario', 'gerente'), (req, res) => {
  const { start, end } = dateRange(req);

  const receitasTotal = db.prepare(
    `SELECT COALESCE(SUM(value),0) AS total FROM movements WHERE type='receita' AND date BETWEEN ? AND ?`
  ).get(start, end).total;

  const despesasTotal = db.prepare(
    `SELECT COALESCE(SUM(value),0) AS total FROM movements WHERE type='despesa' AND date BETWEEN ? AND ?`
  ).get(start, end).total;

  const receitasByCategory = db.prepare(
    `SELECT COALESCE(c.name,'Sem categoria') AS category, COALESCE(SUM(m.value),0) AS total, COUNT(*) AS count
     FROM movements m LEFT JOIN categories c ON c.id = m.category_id
     WHERE m.type='receita' AND m.date BETWEEN ? AND ? GROUP BY m.category_id ORDER BY total DESC`
  ).all(start, end);

  const despesasByCategory = db.prepare(
    `SELECT COALESCE(c.name,'Sem categoria') AS category, COALESCE(c.is_fixed,0) AS is_fixed,
            COALESCE(SUM(m.value),0) AS total, COUNT(*) AS cnt
     FROM movements m LEFT JOIN categories c ON c.id = m.category_id
     WHERE m.type='despesa' AND m.date BETWEEN ? AND ? GROUP BY m.category_id ORDER BY total DESC`
  ).all(start, end);

  const despesasFixas = db.prepare(
    `SELECT COALESCE(SUM(m.value),0) AS total FROM movements m
     JOIN categories c ON c.id = m.category_id
     WHERE m.type='despesa' AND c.is_fixed=1 AND m.date BETWEEN ? AND ?`
  ).get(start, end).total;
  const despesasVariaveis = despesasTotal - despesasFixas;

  const resultado = receitasTotal - despesasTotal;

  res.json({
    start, end,
    receitas: receitasTotal,
    despesas: despesasTotal,
    despesas_fixas: despesasFixas,
    despesas_variaveis: despesasVariaveis,
    resultado,
    situacao: resultado >= 0 ? 'lucro' : 'prejuizo',
    receitas_por_categoria: receitasByCategory,
    despesas_por_categoria: despesasByCategory
  });
});

// ---- Relatório de vendas por período ----
router.get('/sales', (req, res) => {
  const { start, end } = dateRange(req);
  const { payment_method } = req.query;
  const params = [start, end];
  let sql = `SELECT payment_method, COALESCE(SUM(value),0) AS total, COUNT(*) AS count
             FROM movements WHERE type='receita' AND date BETWEEN ? AND ?`;
  if (payment_method && ['dinheiro', 'cartao', 'pix', 'fiado'].includes(payment_method)) {
    sql += ' AND payment_method = ?'; params.push(payment_method);
  }
  sql += ' GROUP BY payment_method ORDER BY total DESC';
  const byPayment = db.prepare(sql).all(...params);
  const total = byPayment.reduce((s, r) => s + r.total, 0);
  res.json({ start, end, total, by_payment: byPayment });
});

// ---- Relatório de despesas por categoria ----
router.get('/expenses', (req, res) => {
  const { start, end } = dateRange(req);
  const rows = db.prepare(
    `SELECT COALESCE(c.name,'Sem categoria') AS category, COALESCE(c.is_fixed,0) AS is_fixed,
            COALESCE(SUM(m.value),0) AS total, COUNT(*) AS count
     FROM movements m LEFT JOIN categories c ON c.id = m.category_id
     WHERE m.type='despesa' AND m.date BETWEEN ? AND ?
     GROUP BY m.category_id ORDER BY total DESC`
  ).all(start, end);
  const total = rows.reduce((s, r) => s + r.total, 0);
  res.json({ start, end, total, by_category: rows });
});

// ---- Dashboard (visão geral) ----
router.get('/dashboard', (req, res) => {
  const today = req.query.today || new Date().toISOString().slice(0, 10);

  // Resumo de hoje
  const entradasHoje = db.prepare(
    `SELECT COALESCE(SUM(value),0) AS total FROM movements WHERE type='receita' AND date=?`
  ).get(today).total;
  const saidasHoje = db.prepare(
    `SELECT COALESCE(SUM(value),0) AS total FROM movements WHERE type='despesa' AND date=?`
  ).get(today).total;

  // Mês corrente (resumo geral)
  const monthStart = today.slice(0, 7) + '-01';
  const receitasMes = db.prepare(
    `SELECT COALESCE(SUM(value),0) AS total FROM movements WHERE type='receita' AND date >= ?`
  ).get(monthStart).total;
  const despesasMes = db.prepare(
    `SELECT COALESCE(SUM(value),0) AS total FROM movements WHERE type='despesa' AND date >= ?`
  ).get(monthStart).total;

  // Contas a vencer / atrasadas
  const contasPendentes = db.prepare(
    `SELECT COUNT(*) AS c, COALESCE(SUM(value),0) AS v FROM accounts WHERE status='pendente'`
  ).get();
  const contasAtrasadas = db.prepare(
    `SELECT COUNT(*) AS c, COALESCE(SUM(value),0) AS v FROM accounts
     WHERE status='pendente' AND due_date < ?`
  ).get(today);

  // Últimas movimentações
  const recent = db.prepare(
    `SELECT m.*, c.name AS category_name FROM movements m
     LEFT JOIN categories c ON c.id = m.category_id
     ORDER BY m.created_at DESC, m.id DESC LIMIT 8`
  ).all();

  // Evolução do saldo nos últimos 7 dias
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const en = db.prepare(
      `SELECT COALESCE(SUM(value),0) AS v FROM movements WHERE type='receita' AND date=?`
    ).get(ds).v;
    const sa = db.prepare(
      `SELECT COALESCE(SUM(value),0) AS v FROM movements WHERE type='despesa' AND date=?`
    ).get(ds).v;
    days.push({ date: ds, entradas: en, saidas: sa, saldo: en - sa });
  }

  res.json({
    hoje: { date: today, entradas: entradasHoje, saidas: saidasHoje, saldo: entradasHoje - saidasHoje },
    mes: { receitas: receitasMes, despesas: despesasMes, resultado: receitasMes - despesasMes },
    contas: {
      pendentes: contasPendentes,
      atrasadas: contasAtrasadas
    },
    ultimas_movimentacoes: recent,
    ultimos_7_dias: days
  });
});

module.exports = router;