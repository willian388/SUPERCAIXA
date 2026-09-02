require('dotenv').config();
const { app, migrate, seedDefaults } = require('./src/app');

const PORT = process.env.PORT || 3000;

// Garante schema e dados iniciais antes de iniciar
migrate();
seedDefaults();

app.listen(PORT, () => {
  console.log('==========================================');
  console.log('  SuperCaixa - Gestão Financeira');
  console.log('  Acesse: http://localhost:' + PORT);
  console.log('  Login padrão: admin@supercaixa.com / admin123');
  console.log('==========================================');
});
