// ===== SuperCaixa SPA =====
const API = new API();
if (!API.token) location.href = '/login.html';

const content = document.getElementById('content');
const VIEWS = ['dashboard', 'movements', 'cashclose', 'cashflow', 'accounts', 'reports', 'settings'];
let currentView = 'dashboard';
let categoriesCache = null;

// ---------- helpers ----------
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function money(v) { return API.fmtMoney(v); }
function moneyClass(v) { return v >= 0 ? 'pos' : 'neg'; }
function toast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.className = 'toast ' + type;
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(t._h);
  t._h = setTimeout(() => t.style.display = 'none', 2800);
}
function openModal(html) {
  document.getElementById('modalBox').innerHTML = html;
  document.getElementById('modalBackdrop').classList.remove('hidden');
}
function closeModal() { document.getElementById('modalBackdrop').classList.add('hidden'); }
function canManage() { const r = API.user.role; return r === 'proprietario' || r === 'gerente'; }

// ---------- routing ----------
function switchView(view) {
  if (!VIEWS.includes(view)) view = 'dashboard';
  currentView = view;
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active', a.dataset.view === view));
  document.getElementById('sidebar').classList.remove('open');
  const titles = {
    dashboard: 'Dashboard', movements: 'Movimentações', cashclose: 'Fechamento de Caixa',
    cashflow: 'Fluxo de Caixa', accounts: 'Contas a Pagar / Receber', reports: 'Relatórios (DRE)',
    settings: 'Categorias'
  };
  document.getElementById('pageTitle').textContent = titles[view];
  const renderers = { dashboard, movements, cashclose, cashflow, accounts, reports, settings };
  renderers[view]();
}
document.querySelectorAll('.nav a').forEach(a => a.addEventListener('click', () => switchView(a.dataset.view)));
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }
function doLogout() { API.logout(); location.href = '/login.html'; }

// ---------- user header ----------
(function initUser() {
  const u = API.user;
  if (u) {
    document.getElementById('userName').textContent = u.name;
    document.getElementById('userRole').textContent = ROLE_LABELS[u.role] || u.role;
    document.getElementById('chipRole').textContent = ROLE_LABELS[u.role] || u.role;
  }
})();

// =====================================================================
//  DASHBOARD
// =====================================================================
async function dashboard() {
  content.innerHTML = '<div class="empty"><div class="big">⏳</div>Carregando…</div>';
  const d = await API.get('/api/reports/dashboard');
  const hoje = d.hoje, mes = d.mes, contas = d.contas;

  const weekMax = Math.max(1, ...d.ultimos_7_dias.map(x => Math.max(x.entradas, x.saidas)));
  const bars = d.ultimos_7_dias.map(x => `
    <div class="col">
      <div class="bar" title="Entradas ${money(x.entradas)}" style="height:${Math.round(x.entradas / weekMax * 100)}%"></div>
      <div class="bar saida" title="Saídas ${money(x.saidas)}" style="height:${Math.round(x.saidas / weekMax * 100)}%"></div>
      <div class="lbl">${x.date.slice(5)}</div>
    </div>`).join('');

  const recentes = d.ultimas_movimentacoes.map(m => `
    <tr>
      <td><span class="badge ${m.type === 'receita' ? 'green' : 'red'}">${m.type === 'receita' ? 'Receita' : 'Despesa'}</span></td>
      <td>${esc(m.description || m.counterparty || '—')}</td>
      <td>${esc(m.category_name || '—')}</td>
      <td>${esc(m.date)}</td>
      <td class="text-right">${money(m.value)}</td>
    </tr>`).join('') || '<tr><td colspan="5"><div class="empty">Nenhuma movimentação ainda.</div></td></tr>';

  content.innerHTML = `
    <div class="kpi-row">
      <div class="card stat">
        <div class="label">Entradas hoje</div>
        <div class="value pos">${money(hoje.entradas)}</div>
        <div class="sub">${hoje.date}</div>
      </div>
      <div class="card stat">
        <div class="label">Saídas hoje</div>
        <div class="value neg">${money(hoje.saidas)}</div>
        <div class="sub">${hoje.date}</div>
      </div>
      <div class="card stat">
        <div class="label">Resultado do mês</div>
        <div class="value ${moneyClass(mes.resultado)}">${money(mes.resultado)}</div>
        <div class="sub">Receitas ${money(mes.receitas)}</div>
      </div>
      <div class="card stat">
        <div class="label">Contas pendentes</div>
        <div class="value">${contas.pendentes.c}</div>
        <div class="sub">${money(contas.pendentes.v)} · ${contas.atrasadas.c} em atraso</div>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-head"><h3>📈 Saldo dos últimos 7 dias</h3></div>
        <div class="chart">${bars}</div>
        <div class="legend"><span class="in">Entradas</span><span class="out">Saídas</span></div>
      </div>
      <div class="card">
        <div class="card-head"><h3>⚡ Ações rápidas</h3></div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <button class="btn btn-success btn-block" onclick="switchView('movements')">＋ Registrar movimentação</button>
          <button class="btn btn-accent btn-block" onclick="switchView('cashclose')">🧾 Fazer fechamento de caixa</button>
          <button class="btn btn-ghost btn-block" onclick="switchView('reports')">📄 Ver relatório DRE</button>
        </div>
      </div>
    </div>

    <div class="card mt">
      <div class="card-head"><h3>🕒 Últimas movimentações</h3>
        <button class="btn btn-ghost btn-sm" onclick="switchView('movements')">Ver todas</button></div>
      <div class="table-wrap"><table>
        <thead><tr><th></th><th>Descrição</th><th>Categoria</th><th>Data</th><th class="text-right">Valor</th></tr></thead>
        <tbody>${recentes}</tbody>
      </table></div>
    </div>`;
}

// =====================================================================
//  MOVEMENTS
// =====================================================================
async function movements() {
  content.innerHTML = '<div class="empty"><div class="big">⏳</div>Carregando…</div>';
  if (!categoriesCache) categoriesCache = await API.get('/api/categories');
  const all = await API.get('/api/movements');

  const rec = all.filter(m => m.type === 'receita');
  const des = all.filter(m => m.type === 'despesa');

  const row = m => `
    <tr>
      <td><span class="badge ${m.type === 'receita' ? 'green' : 'red'}">${m.type === 'receita' ? 'Receita' : 'Despesa'}</span></td>
      <td>${esc(m.description || '—')}</td>
      <td>${esc(m.category_name || '—')}</td>
      <td>${esc(m.counterparty || '—')}</td>
      <td>${PAY_ICONS[m.payment_method] || ''} ${esc(PAY_METHODS[m.payment_method] || m.payment_method)}</td>
      <td>${esc(m.date)}</td>
      <td class="text-right">${money(m.value)}</td>
      <td><div class="actions">
        <button class="btn btn-danger btn-sm" onclick="delMovement(${m.id})" title="Excluir">🗑</button>
      </div></td>
    </tr>`;

  content.innerHTML = `
    <div class="toolbar">
      <button class="btn btn-primary" onclick="openMovementModal()">＋ Nova movimentação</button>
      <span class="spacer"></span>
    </div>
    <div class="grid grid-2">
      <div class="card">
        <div class="card-head"><h3>🟢 Receitas</h3>
          <span class="badge green">${money(rec.reduce((s, m) => s + m.value, 0))}</span></div>
        <div class="table-wrap"><table>
          <thead><tr><th></th><th>Descrição</th><th>Categoria</th><th>Cliente/Forn.</th><th>Pagamento</th><th>Data</th><th class="text-right">Valor</th><th></th></tr></thead>
          <tbody>${rec.map(row).join('') || '<tr><td colspan="8"><div class="empty">Nenhuma receita.</div></td></tr>'}</tbody>
        </table></div>
      </div>
      <div class="card">
        <div class="card-head"><h3>🔴 Despesas</h3>
          <span class="badge red">${money(des.reduce((s, m) => s + m.value, 0))}</span></div>
        <div class="table-wrap"><table>
          <thead><tr><th></th><th>Descrição</th><th>Categoria</th><th>Fornecedor</th><th>Pagamento</th><th>Data</th><th class="text-right">Valor</th><th></th></tr></thead>
          <tbody>${des.map(row).join('') || '<tr><td colspan="8"><div class="empty">Nenhuma despesa.</div></td></tr>'}</tbody>
        </table></div>
      </div>
    </div>`;
}

// =====================================================================
//  FECHAMENTO DE CAIXA
// =====================================================================
async function cashclose() {
  content.innerHTML = '<div class="empty"><div class="big">⏳</div>Carregando…</div>';
  const today = API.today();
  const sales = await API.get('/api/cash/daily-sales/' + today);
  const closures = await API.get('/api/cash');

  const byPay = sales.by_payment.map(s => `
    <div class="bar-row">
      <div class="bar-label"><b>${PAY_ICONS[s.payment_method] || ''} ${esc(PAY_METHODS[s.payment_method] || s.payment_method)}</b><span>${money(s.total)} (${s.count} vendas)</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${sales.total ? Math.round(s.total / sales.total * 100) : 0}%;background:var(--primary)"></div></div>
    </div>`).join('') || '<div class="empty">Nenhuma venda registrada hoje.</div>';

  const hist = closures.map(c => {
    const diff = c.difference;
    return `<tr>
      <td>${esc(c.date)}</td>
      <td class="text-right">${money(c.expected_total)}</td>
      <td class="text-right">${money(c.actual_total)}</td>
      <td class="text-right money ${moneyClass(diff)}">${diff >= 0 ? '+' : ''}${money(diff)}</td>
      <td><span class="badge ${diff === 0 ? 'green' : (diff > 0 ? 'blue' : 'orange')}">${diff === 0 ? 'OK' : (diff > 0 ? 'Sobra' : 'Falta')}</span></td>
      <td>${esc(c.closed_by_name || '—')}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="6"><div class="empty">Nenhum fechamento ainda.</div></td></tr>';

  content.innerHTML = `
    <div class="grid grid-2">
      <div class="card">
        <div class="card-head"><h3>🧾 Fechamento de hoje (${esc(today)})</h3></div>
        <div class="alert alert-info">Valor esperado calculado pelas receitas de hoje (exceto fiado).</div>
        ${byPay}
        <div class="field mt">
          <label>Valor esperado pelo sistema (R$)</label>
          <input type="number" step="0.01" id="fcExpected" value="${sales.total.toFixed(2)}">
        </div>
        <div class="field">
          <label>Valor real em caixa (R$)</label>
          <input type="number" step="0.01" id="fcActual" placeholder="0,00">
        </div>
        <div class="field">
          <label>Observações</label>
          <textarea id="fcObs" rows="2" placeholder="Ex.: troco, diferença na gaveta…"></textarea>
        </div>
        <button class="btn btn-success btn-block" onclick="doClosure('${today}')">Confirmar fechamento</button>
      </div>
      <div class="card">
        <div class="card-head"><h3>🕘 Histórico de fechamentos</h3></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Data</th><th class="text-right">Esperado</th><th class="text-right">Real</th><th class="text-right">Diferença</th><th>Status</th><th>Quem</th></tr></thead>
          <tbody>${hist}</tbody>
        </table></div>
      </div>
    </div>`;
}
async function doClosure(date) {
  const expected = document.getElementById('fcExpected').value;
  const actual = document.getElementById('fcActual').value;
  const obs = document.getElementById('fcObs').value;
  if (!actual) return toast('Informe o valor real em caixa', 'error');
  try {
    await API.post('/api/cash', { date, expected_total: expected, actual_total: actual, observations: obs });
    toast('Fechamento de caixa salvo!');
    cashclose();
  } catch (e) { toast(e.message, 'error'); }
}

// =====================================================================
//  FLUXO DE CAIXA DIÁRIO
// =====================================================================
async function cashflow() {
  content.innerHTML = '<div class="empty"><div class="big">⏳</div>Carregando…</div>';
  const today = API.today();
  const d = await API.get('/api/cash/flow?date=' + today);
  const total = d.entradas + d.saidas || 1;
  const pct = v => Math.round(v / total * 100);

  content.innerHTML = `
    <div class="toolbar">
      <input type="date" id="flowDate" value="${today}" onchange="loadFlow()">
      <div class="field" style="margin:0"><input type="number" id="flowInitial" placeholder="Saldo inicial (R$)" style="width:180px" value="0" onchange="loadFlow()"></div>
    </div>
    <div class="kpi-row">
      <div class="card stat"><div class="label">Saldo inicial</div><div class="value">${money(d.saldo_inicial)}</div></div>
      <div class="card stat"><div class="label">Entradas</div><div class="value pos">${money(d.entradas)}</div></div>
      <div class="card stat"><div class="label">Saídas</div><div class="value neg">${money(d.saidas)}</div></div>
      <div class="card stat"><div class="label">Saldo final projetado</div><div class="value ${moneyClass(d.saldo_final)}">${money(d.saldo_final)}</div></div>
    </div>
    <div class="card">
      <div class="card-head"><h3>📊 Composição do dia</h3></div>
      <div class="bar-row">
        <div class="bar-label"><b>Entradas</b><span>${money(d.entradas)}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct(d.entradas)}%;background:var(--primary)"></div></div>
      </div>
      <div class="bar-row">
        <div class="bar-label"><b>Saídas</b><span>${money(d.saidas)}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct(d.saidas)}%;background:var(--accent)"></div></div>
      </div>
    </div>`;
}
async function loadFlow() {
  const date = document.getElementById('flowDate').value || API.today();
  const init = document.getElementById('flowInitial').value || 0;
  const d = await API.get('/api/cash/flow?date=' + date + '&opening=' + init);
  const total = d.entradas + d.saidas || 1;
  const pct = v => Math.round(v / total * 100);
  const cards = document.querySelector('.kpi-row');
  cards.innerHTML = `
    <div class="card stat"><div class="label">Saldo inicial</div><div class="value">${money(d.saldo_inicial)}</div></div>
    <div class="card stat"><div class="label">Entradas</div><div class="value pos">${money(d.entradas)}</div></div>
    <div class="card stat"><div class="label">Saídas</div><div class="value neg">${money(d.saidas)}</div></div>
    <div class="card stat"><div class="label">Saldo final projetado</div><div class="value ${moneyClass(d.saldo_final)}">${money(d.saldo_final)}</div></div>`;
  const comp = document.querySelector('.content .card');
  comp.innerHTML = `<div class="card-head"><h3>📊 Composição do dia</h3></div>
    <div class="bar-row"><div class="bar-label"><b>Entradas</b><span>${money(d.entradas)}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct(d.entradas)}%;background:var(--primary)"></div></div></div>
    <div class="bar-row"><div class="bar-label"><b>Saídas</b><span>${money(d.saidas)}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct(d.saidas)}%;background:var(--accent)"></div></div></div>`;
}

// =====================================================================
//  CONTAS A PAGAR / RECEBER
// =====================================================================
async function accounts() {
  content.innerHTML = '<div class="empty"><div class="big">⏳</div>Carregando…</div>';
  const list = await API.get('/api/accounts');
  const today = API.today();
  const statusOf = a => (a.status === 'pendente' && a.due_date < today) ? 'atrasado' : a.status;

  const row = a => {
    const st = statusOf(a);
    const badge = { pendente: 'orange', pago: 'green', atrasado: 'red' }[st];
    const lbl = { pendente: 'Pendente', pago: 'Pago', atrasado: 'Atrasado' }[st];
    return `<tr>
      <td><span class="badge ${a.type === 'pagar' ? 'red' : 'blue'}">${a.type === 'pagar' ? 'A pagar' : 'A receber'}</span></td>
      <td>${esc(a.description || '—')}</td>
      <td>${esc(a.counterparty || '—')}</td>
      <td class="text-right">${money(a.value)}</td>
      <td>${esc(a.due_date)}</td>
      <td><span class="badge ${badge}">${lbl}</span></td>
      <td><div class="actions">
        ${st !== 'pago'
          ? `<button class="btn btn-success btn-sm" onclick="settleAccount(${a.id})">✓ Baixar</button>`
          : `<button class="btn btn-ghost btn-sm" onclick="unsettleAccount(${a.id})" title="Reverter">↩</button>`}
        <button class="btn btn-danger btn-sm" onclick="delAccount(${a.id})">🗑</button>
      </div></td>
    </tr>`;
  };

  const pendPagar = list => list.filter(a => a.type === 'pagar' && statusOf(a) !== 'pago');
  const pendReceber = list => list.filter(a => a.type === 'receber' && statusOf(a) !== 'pago');
  const atrasadas = list.filter(a => statusOf(a) === 'atrasado');

  const rows = list.map(row).join('') || '<tr><td colspan="7"><div class="empty">Nenhuma conta cadastrada.</div></td></tr>';

  content.innerHTML = `
    <div class="kpi-row">
      <div class="card stat"><div class="label">A pagar (pendente)</div><div class="value neg">${money(pendPagar(list).reduce((s, a) => s + a.value, 0))}</div><div class="sub">${pendPagar(list).length} conta(s)</div></div>
      <div class="card stat"><div class="label">A receber (pendente)</div><div class="value pos">${money(pendReceber(list).reduce((s, a) => s + a.value, 0))}</div><div class="sub">${pendReceber(list).length} conta(s)</div></div>
      <div class="card stat"><div class="label">Em atraso</div><div class="value ${atrasadas.length ? 'neg' : ''}">${atrasadas.length}</div><div class="sub">${money(atrasadas.reduce((s, a) => s + a.value, 0))}</div></div>
      <div class="card"><div class="label">&nbsp;</div><button class="btn btn-primary btn-block" onclick="openAccountModal()">＋ Nova conta</button></div>
    </div>
    <div class="card">
      <div class="card-head"><h3>🗓️ Todas as contas</h3>
        <input type="text" placeholder="Buscar…" style="padding:7px 10px;border:1px solid var(--border);border-radius:8px" oninput="filterAccounts(this.value)"></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Tipo</th><th>Descrição</th><th>Fornecedor/Cliente</th><th class="text-right">Valor</th><th>Vencimento</th><th>Status</th><th></th></tr></thead>
        <tbody id="accBody">${rows}</tbody>
      </table></div>
    </div>`;
}
function filterAccounts(q) {
  const rows = document.querySelectorAll('#accBody tr');
  rows.forEach(r => r.style.display = r.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none');
}

// =====================================================================
//  RELATÓRIOS (DRE)
// =====================================================================
async function reports() {
  content.innerHTML = '<div class="empty"><div class="big">⏳</div>Carregando…</div>';
  const first = new Date(); first.setDate(1);
  const start = first.toISOString().slice(0, 10);
  const end = API.today();
  await renderReports(start, end);
}
async function renderReports(start, end) {
  content.innerHTML = '<div class="empty"><div class="big">⏳</div>Calculando…</div>';
  const dre = await API.get(`/api/reports/dre?start=${start}&end=${end}`);
  const sales = await API.get(`/api/reports/sales?start=${start}&end=${end}`);

  const catRows = arr => (arr || []).map(r => `
    <tr><td>${esc(r.category)}</td><td class="text-right">${money(r.total)}</td><td class="text-right">${r.count || r.cnt || ''}</td></tr>`).join('')
    || '<tr><td colspan="3"><div class="empty">Sem dados.</div></td></tr>';

  const payRows = sales.by_payment.map(r => `
    <tr><td>${PAY_ICONS[r.payment_method] || ''} ${esc(PAY_METHODS[r.payment_method] || r.payment_method)}</td>
    <td class="text-right">${money(r.total)}</td><td class="text-right">${r.count}</td></tr>`).join('')
    || '<tr><td colspan="3"><div class="empty">Sem vendas no período.</div></td></tr>';

  content.innerHTML = `
    <div class="toolbar">
      <input type="date" id="repStart" value="${start}">
      <input type="date" id="repEnd" value="${end}">
      <button class="btn btn-ghost" onclick="loadReports()">Aplicar período</button>
    </div>

    <div class="card">
      <div class="card-head"><h3>📄 DRE simplificada — ${esc(start)} a ${esc(end)}</h3></div>
      <div class="table-wrap"><table>
        <tbody>
          <tr><td><b>Total de Receitas</b></td><td class="text-right money pos">${money(dre.receitas)}</td></tr>
          <tr><td>&nbsp;&nbsp;• Despesas fixas</td><td class="text-right money neg">− ${money(dre.despesas_fixas)}</td></tr>
          <tr><td>&nbsp;&nbsp;• Despesas variáveis</td><td class="text-right money neg">− ${money(dre.despesas_variaveis)}</td></tr>
          <tr><td><b>Total de Despesas</b></td><td class="text-right money neg">${money(dre.despesas)}</td></tr>
          <tr style="border-top:2px solid var(--border)"><td><b>Resultado do período</b></td>
            <td class="text-right money ${moneyClass(dre.resultado)}"><b>${money(dre.resultado)}</b> — ${dre.resultado >= 0 ? 'Lucro' : 'Prejuízo'}</td></tr>
        </tbody>
      </table></div>
    </div>

    <div class="grid grid-3 mt">
      <div class="card">
        <div class="card-head"><h3>💵 Despesas por categoria</h3></div>
        <div class="table-wrap"><table><thead><tr><th>Categoria</th><th class="text-right">Total</th><th class="text-right">Qtd</th></tr></thead>
        <tbody>${catRows(dre.despesas_por_categoria)}</tbody></table></div>
      </div>
      <div class="card">
        <div class="card-head"><h3>🛒 Vendas por forma de pagamento</h3></div>
        <div class="table-wrap"><table><thead><tr><th>Pagamento</th><th class="text-right">Total</th><th class="text-right">Vendas</th></tr></thead>
        <tbody>${payRows}</tbody></table></div>
      </div>
      <div class="card">
        <div class="card-head"><h3>📂 Receitas por categoria</h3></div>
        <div class="table-wrap"><table><thead><tr><th>Categoria</th><th class="text-right">Total</th><th class="text-right">Qtd</th></tr></thead>
        <tbody>${catRows(dre.receitas_por_categoria)}</tbody></table></div>
      </div>
    </div>`;
}
async function loadReports() {
  const s = document.getElementById('repStart').value;
  const e = document.getElementById('repEnd').value;
  await renderReports(s, e);
}

// =====================================================================
//  CATEGORIAS (SETTINGS)
// =====================================================================
async function settings() {
  content.innerHTML = '<div class="empty"><div class="big">⏳</div>Carregando…</div>';
  categoriesCache = await API.get('/api/categories');
  const rec = categoriesCache.filter(c => c.type === 'receita');
  const des = categoriesCache.filter(c => c.type === 'despesa');
  const catRow = c => `<tr><td>${esc(c.name)}${c.is_default ? ' <span class="badge gray">padrão</span>' : ''}</td>
    <td>${c.is_fixed ? 'Custo fixo' : 'Custo variável'}</td>
    <td><div class="actions"><button class="btn btn-danger btn-sm" ${c.is_default ? 'disabled' : ''} onclick="delCategory(${c.id})">🗑</button></div></td></tr>`;

  content.innerHTML = `
    <div class="grid grid-2">
      <div class="card">
        <div class="card-head"><h3>🟢 Categorias de Receita</h3>
          <button class="btn btn-ghost btn-sm" onclick="addCategory('receita')">＋ Adicionar</button></div>
        <div class="table-wrap"><table><thead><tr><th>Nome</th><th>Tipo</th><th></th></tr></thead>
        <tbody>${rec.map(catRow).join('')}</tbody></table></div>
      </div>
      <div class="card">
        <div class="card-head"><h3>🔴 Categorias de Despesa</h3>
          <button class="btn btn-ghost btn-sm" onclick="addCategory('despesa')">＋ Adicionar</button></div>
        <div class="table-wrap"><table><thead><tr><th>Nome</th><th>Tipo</th><th></th></tr></thead>
        <tbody>${des.map(catRow).join('')}</tbody></table></div>
      </div>
    </div>
    <div class="card mt">
      <h3>ℹ️ Níveis de acesso</h3>
      <ul style="padding-left:18px;color:var(--text-muted)">
        <li><b>Caixa</b> — registra movimentações e faz fechamento de caixa.</li>
        <li><b>Gerente</b> — tudo do caixa + baixa de contas e relatórios.</li>
        <li><b>Proprietário</b> — acesso total ao sistema.</li>
      </ul>
    </div>`;
}
async function addCategory(type) {
  openModal(`
    <div class="modal-head"><h3>Nova categoria</h3><button class="close" onclick="closeModal()">×</button></div>
    <div class="modal-body">
      <div class="field"><label>Nome</label><input id="ncName" placeholder="Ex.: Categoria"></div>
      <div class="field"><label>Tipo de custo</label>
        <select id="ncFixed"><option value="0">Custo variável</option><option value="1">Custo fixo</option></select></div>
    </div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveCategory('${type}')">Salvar</button></div>`);
}
async function saveCategory(type) {
  const name = document.getElementById('ncName').value.trim();
  const fixed = document.getElementById('ncFixed').value;
  if (!name) return toast('Informe o nome', 'error');
  await API.post('/api/categories', { type, name, is_fixed: fixed });
  closeModal(); toast('Categoria criada'); settings();
}
async function delCategory(id) {
  if (!confirm('Excluir esta categoria?')) return;
  try { await API.del('/api/categories/' + id); toast('Categoria excluída'); settings(); }
  catch (e) { toast(e.message, 'error'); }
}

// =====================================================================
//  MOVEMENT MODAL
// =====================================================================
async function openMovementModal() {
  if (!categoriesCache) categoriesCache = await API.get('/api/categories');
  openModal(`
    <div class="modal-head"><h3>Nova movimentação</h3><button class="close" onclick="closeModal()">×</button></div>
    <div class="modal-body">
      <div class="seg" id="mvSeg">
        <button class="receita active" onclick="setType('receita', this)">＋ Receita</button>
        <button class="despesa" onclick="setType('despesa', this)">− Despesa</button>
      </div>
      <div class="form-grid">
        <div class="field"><label>Data</label><input type="date" id="mvDate" value="${API.today()}"></div>
        <div class="field"><label>Valor (R$)</label><input type="number" step="0.01" id="mvValue" placeholder="0,00"></div>
        <div class="field full"><label>Descrição detalhada</label><textarea id="mvDesc" rows="2" placeholder="Produtos, cliente, observações…"></textarea></div>
        <div class="field"><label>Categoria</label><select id="mvCat"></select></div>
        <div class="field"><label>Contraparte (fornecedor/cliente)</label><input id="mvCounter" placeholder="Opcional"></div>
        <div class="field full"><label>Forma de pagamento</label>
          <div class="radio-pay" id="mvPay">
            ${Object.entries(PAY_METHODS).map(([k, v]) => `<label data-pay="${k}" class="${k === 'dinheiro' ? 'selected' : ''}"><input type="radio" name="pay" value="${k}" ${k === 'dinheiro' ? 'checked' : ''} onclick="selectPay('${k}', this)"> ${v}</label>`).join('')}
          </div>
        </div>
        <div class="field full" id="dueField"><label>Data de vencimento (se houver)</label><input type="date" id="mvDue"></div>
      </div>
    </div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveMovement()">Salvar</button></div>`);
  loadCatOptions('receita');
}
async function loadCatOptions(type) {
  if (!categoriesCache) categoriesCache = await API.get('/api/categories');
  const sel = document.getElementById('mvCat');
  sel.innerHTML = categoriesCache.filter(c => c.type === type).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
}
function setType(type, btn) {
  btn.closest('.seg').querySelectorAll('button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadCatOptions(type);
}
function selectPay(k, el) {
  document.querySelectorAll('#mvPay label').forEach(l => l.classList.toggle('selected', l.dataset.pay === k));
}
async function saveMovement() {
  const type = document.querySelector('#mvSeg button.active').classList.contains('receita') ? 'receita' : 'despesa';
  const payEl = document.querySelector('input[name="pay"]:checked');
  const body = {
    type,
    date: document.getElementById('mvDate').value,
    value: document.getElementById('mvValue').value,
    description: document.getElementById('mvDesc').value,
    category_id: document.getElementById('mvCat').value || null,
    counterparty: document.getElementById('mvCounter').value || null,
    payment_method: payEl ? payEl.value : 'dinheiro',
    due_date: document.getElementById('mvDue').value || null
  };
  if (!body.date) return toast('Informe a data', 'error');
  if (!body.value || body.value <= 0) return toast('Informe um valor válido', 'error');
  try {
    await API.post('/api/movements', body);
    closeModal(); toast('Movimentação registrada!'); movements();
  } catch (e) { toast(e.message, 'error'); }
}
async function delMovement(id) {
  if (!confirm('Excluir esta movimentação?')) return;
  try { await API.del('/api/movements/' + id); toast('Excluída'); movements(); }
  catch (e) { toast(e.message, 'error'); }
}

// =====================================================================
//  ACCOUNT ACTIONS
// =====================================================================
function openAccountModal() {
  openModal(`
    <div class="modal-head"><h3>Nova conta</h3><button class="close" onclick="closeModal()">×</button></div>
    <div class="modal-body">
      <div class="field"><label>Tipo</label><select id="accType">
        <option value="pagar">Conta a pagar</option><option value="receber">Conta a receber</option></select></div>
      <div class="field"><label>Descrição</label><input id="accDesc" placeholder="Ex: Compra com fornecedor"></div>
      <div class="field"><label>Fornecedor / Cliente</label><input id="accCounter" placeholder="Opcional"></div>
      <div class="form-grid">
        <div class="field"><label>Valor (R$)</label><input type="number" step="0.01" id="accValue"></div>
        <div class="field"><label>Vencimento</label><input type="date" id="accDue"></div>
      </div>
    </div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveAccount()">Salvar</button></div>`);
}
async function saveAccount() {
  const body = {
    type: document.getElementById('accType').value,
    description: document.getElementById('accDesc').value,
    counterparty: document.getElementById('accCounter').value || null,
    value: document.getElementById('accValue').value,
    due_date: document.getElementById('accDue').value
  };
  if (!body.value || body.value <= 0) return toast('Informe o valor', 'error');
  if (!body.due_date) return toast('Informe o vencimento', 'error');
  try { await API.post('/api/accounts', body); closeModal(); toast('Conta criada'); accounts(); }
  catch (e) { toast(e.message, 'error'); }
}
async function settleAccount(id) {
  if (!canManage()) return toast('Somente gerente/proprietário pode baixar contas.', 'error');
  try { await API.post('/api/accounts/' + id + '/settle', {}); toast('Conta baixada'); accounts(); }
  catch (e) { toast(e.message, 'error'); }
}
async function unsettleAccount(id) {
  try { await API.post('/api/accounts/' + id + '/unsettle', {}); toast('Baixa revertida'); accounts(); }
  catch (e) { toast(e.message, 'error'); }
}
async function delAccount(id) {
  if (!confirm('Excluir esta conta?')) return;
  try { await API.del('/api/accounts/' + id); toast('Conta excluída'); accounts(); }
  catch (e) { toast(e.message, 'error'); }
}

// =====================================================================
//  INIT
// =====================================================================
switchView('dashboard');