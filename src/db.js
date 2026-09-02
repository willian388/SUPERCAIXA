const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'supercaixa.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      google_id TEXT UNIQUE,
      role TEXT NOT NULL DEFAULT 'caixa',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('receita','despesa')),
      name TEXT NOT NULL,
      is_fixed INTEGER NOT NULL DEFAULT 0,
      is_default INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('receita','despesa')),
      date TEXT NOT NULL,
      value REAL NOT NULL,
      description TEXT,
      payment_method TEXT NOT NULL DEFAULT 'dinheiro'
        CHECK(payment_method IN ('dinheiro','cartao','pix','fiado')),
      category_id INTEGER,
      counterparty TEXT,
      due_date TEXT,
      observations TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      movement_id INTEGER,
      type TEXT NOT NULL CHECK(type IN ('pagar','receber')),
      description TEXT,
      counterparty TEXT,
      value REAL NOT NULL,
      due_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pendente'
        CHECK(status IN ('pendente','pago','atrasado')),
      paid_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (movement_id) REFERENCES movements(id)
    );

    CREATE TABLE IF NOT EXISTS cash_closures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      expected_total REAL NOT NULL,
      actual_total REAL NOT NULL,
      difference REAL NOT NULL,
      by_payment_method TEXT,
      observations TEXT,
      closed_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (closed_by) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_movements_date ON movements(date);
    CREATE INDEX IF NOT EXISTS idx_movements_type ON movements(type);
    CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
    CREATE INDEX IF NOT EXISTS idx_accounts_due ON accounts(due_date);
    CREATE INDEX IF NOT EXISTS idx_closure_date ON cash_closures(date);
  `);
}

function seedDefaults() {
  // Categorias padrão
  const count = db.prepare('SELECT COUNT(*) AS c FROM categories').get().c;
  if (count === 0) {
    const ins = db.prepare('INSERT INTO categories (type, name, is_fixed, is_default) VALUES (?,?,?,1)');
    const tx = db.transaction(() => {
      // Receitas
      [['receita', 'Vendas'], ['receita', 'Aporte de Capital'], ['receita', 'Outras Receitas']]
        .forEach(r => ins.run(r[0], r[1], 0));
      // Despesas
      [
        ['despesa', 'Compras de Mercadorias', 0],
        ['despesa', 'Pagamento a Fornecedores', 1],
        ['despesa', 'Contas de Consumo (água/luz)', 1],
        ['despesa', 'Aluguel', 1],
        ['despesa', 'Salários e Encargos', 1],
        ['despesa', 'Impostos', 1],
        ['despesa', 'Outras Despesas', 0]
      ].forEach(r => ins.run(r[0], r[1], r[2]));
    });
    tx();
  }

  // Usuário administrador inicial
  const adminCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (adminCount === 0) {
    const passwordHash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)')
      .run('Administrador', 'admin@supercaixa.com', passwordHash, 'proprietario');
  }
}

module.exports = { db, migrate, seedDefaults };

// Executa quando o módulo é carregado diretamente
if (require.main === module) {
  migrate();
  seedDefaults();
  console.log('Banco de dados inicializado em', DB_PATH);
}