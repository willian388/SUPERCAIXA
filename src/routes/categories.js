const express = require('express');
const { db } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// Listar categorias por tipo
router.get('/', (req, res) => {
  const { type } = req.query;
  let rows;
  if (type && ['receita', 'despesa'].includes(type)) {
    rows = db.prepare('SELECT * FROM categories WHERE type = ? ORDER BY is_default DESC, name ASC').all(type);
  } else {
    rows = db.prepare('SELECT * FROM categories ORDER BY type, is_default DESC, name ASC').all();
  }
  res.json(rows);
});

// Criar categoria
router.post('/', (req, res) => {
  const { type, name, is_fixed } = req.body || {};
  if (!['receita', 'despesa'].includes(type)) return res.status(400).json({ error: 'Tipo inválido.' });
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nome da categoria é obrigatório.' });
  const info = db.prepare(
    'INSERT INTO categories (type, name, is_fixed) VALUES (?,?,?)'
  ).run(type, name.trim(), is_fixed ? 1 : 0);
  res.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid));
});

// Atualizar categoria
router.put('/:id', (req, res) => {
  const { name, is_fixed } = req.body || {};
  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!cat) return res.status(404).json({ error: 'Categoria não encontrada.' });
  db.prepare('UPDATE categories SET name = ?, is_fixed = ? WHERE id = ?')
    .run((name || cat.name).trim(), is_fixed != null ? (is_fixed ? 1 : 0) : cat.is_fixed, cat.id);
  res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(cat.id));
});

// Deletar categoria (somente se não estiver em uso)
router.delete('/:id', (req, res) => {
  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!cat) return res.status(404).json({ error: 'Categoria não encontrada.' });
  if (cat.is_default) return res.status(400).json({ error: 'Categorias padrão não podem ser excluídas.' });
  const inUse = db.prepare('SELECT COUNT(*) AS c FROM movements WHERE category_id = ?').get(cat.id).c;
  if (inUse > 0) return res.status(400).json({ error: 'Categoria em uso em movimentações.' });
  db.prepare('DELETE FROM categories WHERE id = ?').run(cat.id);
  res.json({ ok: true });
});

module.exports = router;