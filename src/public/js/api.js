// Cliente HTTP para a API do SuperCaixa
class API {
  constructor() {
    this.token = localStorage.getItem('sc_token') || null;
    this.user = JSON.parse(localStorage.getItem('sc_user') || 'null');
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('sc_token', token);
  }

  setUser(user) {
    this.user = user;
    localStorage.setItem('sc_user', JSON.stringify(user));
  }

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('sc_token');
    localStorage.removeItem('sc_user');
  }

  _headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this.token) h['Authorization'] = 'Bearer ' + this.token;
    return h;
  }

  async _req(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: this._headers(),
      body: body ? JSON.stringify(body) : undefined
    });
    let data = {};
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      const err = new Error(data.error || 'Erro na requisição');
      err.status = res.status;
      if (res.status === 401) { this.logout(); location.href = '/login.html'; }
      throw err;
    }
    return data;
  }

  get(url)  { return this._req('GET', url); }
  post(url, body) { return this._req('POST', url, body); }
  put(url, body)  { return this._req('PUT', url, body); }
  del(url) { return this._req('DELETE', url); }

  // Auth
  async login(email, password) {
    const d = await this._req('POST', '/api/auth/login', { email, password });
    this.setToken(d.token); this.setUser(d.user);
    return d.user;
  }
  async register(data) {
    const d = await this._req('POST', '/api/auth/register', data);
    this.setToken(d.token); this.setUser(d.user);
    return d.user;
  }

  fmtMoney(v) {
    return (v == null ? 0 : v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  fmtDate(d) {
    if (!d) return '—';
    const parts = String(d).split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
  }
  today() { return new Date().toISOString().slice(0, 10); }
}

const PAY_METHODS = {
  dinheiro: 'Dinheiro', cartao: 'Cartão', pix: 'Pix', fiado: 'Fiado'
};
const PAY_ICONS = {
  dinheiro: '💵', cartao: '💳', pix: '⚡', fiado: '📝'
};
const ROLE_LABELS = { proprietario: 'Proprietário', gerente: 'Gerente', caixa: 'Caixa' };