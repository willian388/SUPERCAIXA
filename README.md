# 🛒 SuperCaixa — Gestão Financeira para Pequenos Supermercados

Sistema web completo para gestão financeira de pequenos supermercados. Resolve as dores de
**fechamento de caixa**, **controle de fluxo de caixa**, **contas a pagar e receber** e
**registro de receitas/despesas**, com relatórios gerenciais (DRE).

Stack: **Node.js + Express + SQLite** (banco embutido, sem servidor externo). Frontend responsivo
em HTML/CSS/JS vanilla, com login por e-mail/senha (e Google opcional).

---

## 1. Requisitos

- **Node.js 18+** (testado na v22)
- Nenhum banco externo — o SQLite é criado automaticamente na primeira execução.

## 2. Instalação e execução

```bash
# 1. Entre na pasta do projeto
cd supercaixa

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente (opcional, já há padrões seguros)
cp .env.example .env
#   edite .env e defina um JWT_SECRET forte

# 4. Inicie o servidor
npm start
```

Acesse **http://localhost:3000**

> Login padrão (criado automaticamente na 1ª execução):
> **E-mail:** `admin@supercaixa.com` — **Senha:** `admin123`
> **Importante:** altere o `JWT_SECRET` no `.env` antes de colocar em produção
> e troque a senha do administrador.

### Banco de dados
O arquivo do banco fica em `data/supercaixa.db` (configurável via `DB_PATH` no `.env`).
Para zerar tudo, basta apagar esse arquivo e reiniciar o servidor.

---

## 3. Funcionalidades

| Módulo | Descrição |
|--------|-----------|
| **Acesso e segurança** | Login/senha com **3 níveis** (Caixa, Gerente, Proprietário) via JWT + login com **Google** (OAuth2 opcional) |
| **Movimentações** | Registro de **receitas** (vendas, aportes) e **despesas** (compras, fornecedores, contas) com data, valor, descrição detalhada, forma de pagamento (dinheiro/cartão/pix/fiado) e categoria |
| **Fechamento de Caixa** | Resumo das vendas por forma de pagamento, comparação **esperado × real**, cálculo de **sobra/falta** e histórico |
| **Fluxo de Caixa** | Saldo inicial, total de entradas, saídas e **saldo final projetado** do dia |
| **Contas a Pagar/Receber** | Listagem com status (pendente/pago/**atrasado**), vencimento, fornecedor/cliente e **baixa** de contas. Fiado e despesas com vencimento geram contas automaticamente |
| **Relatórios** | **DRE simplificada** (receitas, despesas fixas/variáveis, resultado), vendas por período e por forma de pagamento, despesas por categoria |
| **Categorias** | Categorias padrão de receita e despesa, com distinção **custo fixo × variável** |

### Níveis de acesso
- **Caixa** — registra movimentações, faz fechamento de caixa.
- **Gerente** — tudo do caixa + baixa de contas e relatórios.
- **Proprietário** — acesso total.

### Paleta de cores
Primária `#007bff` (azul) · Secundária `#28a745` (verde) · Acento `#fd7e14` (laranja) ·
Neutras `#f8f9fa` / `#333` / `#fff`. Interface limpa e pensada para uso no **checkout**
(desktop/tablet, mas responsiva para celular).

---

## 4. API (resumo)

Todas as rotas de dados exigem `Authorization: Bearer <token>`.

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/login` | Login (e-mail/senha) → `{ token, user }` |
| POST | `/api/auth/register` | Criar usuário |
| GET | `/api/auth/me` | Usuário autenticado |
| GET/POST | `/api/categories` | Listar/criar categorias |
| GET/POST/PUT/DELETE | `/api/movements` | Movimentações (receitas/despesas) |
| GET/POST | `/api/accounts` · POST `/api/accounts/:id/settle` | Contas + baixa |
| GET | `/api/cash/daily-sales/:date` | Vendas do dia por pagamento |
| POST | `/api/cash` | Registrar fechamento de caixa |
| GET | `/api/cash/flow?date=&opening=` | Fluxo de caixa do dia |
| GET | `/api/reports/dre?start=&end=` | DRE simplificada |
| GET | `/api/reports/sales?start=&end=` | Vendas por período/pagamento |
| GET | `/api/reports/dashboard` | Visão geral do dashboard |

---

## 5. Login com Google (opcional)

1. Crie um projeto em https://console.cloud.google.com/apis/credentials (OAuth Client ID).
2. Em **Authorized redirect URIs**, adicione:
   `http://localhost:3000/api/auth/google/callback`
3. Preencha no `.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
   ```
4. Reinicie o servidor. O botão "Continuar com Google" passa a funcionar.

---

## 5. Hospedagem em produção

O app é um servidor Node padrão — pode ser implantado em:

- **Railway / Render / Fly.io / Heroku** — definir `PORT` e `JWT_SECRET` nas variáveis de ambiente.
- **VPS** — usar **PM2** (`pm2 start server.js`) e um reverse proxy **Nginx** para HTTPS.
- **Docker** (exemplo abaixo):

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

Em produção, **sempre**:
- Defina um `JWT_SECRET` forte (32+ caracteres aleatórios).
- Use HTTPS (certificado TLS).
- Faça **backup** do arquivo `data/supercaixa.db` diariamente.

---

## 6. Estrutura do projeto

```
supercaixa/
├── server.js                 # ponto de entrada
├── src/
│   ├── app.js                # configuração do Express (rotas + estáticos)
│   ├── db.js                 # SQLite: schema, categorias padrão, admin inicial
│   ├── middleware/auth.js    # JWT + controle de níveis de acesso
│   ├── routes/
│   │   ├── auth.js           # login/registro/me
│   │   ├── google.js         # login com Google (OAuth2)
│   │   ├── categories.js     # categorias
│   │   ├── movements.js      # receitas e despesas
│   │   ├── accounts.js       # contas a pagar/receber + baixa
│   │   ├── cash.js           # fechamento e fluxo de caixa
│   │   └── reports.js        # DRE, vendas, dashboard
│   └── public/               # frontend (HTML/CSS/JS)
│       ├── login.html
│       ├── app.html
│       ├── css/style.css
│       └── js/{api.js, app.js}
└── .env.example
```

## 7. Ideias de evolução (roadmap)

- Emissão de **boleto/links de cobrança** para inadimplentes.
- **Lembretes/notificações** (e-mail ou in-app) de contas a vencer e em atraso.
- Relatório de **lucro por forma de pagamento** e por dia da semana.
- **Importação/exportação CSV** e integração com **PDV**.
- Dashboard de **indicadores** (margem, ticket médio, giro de caixa).