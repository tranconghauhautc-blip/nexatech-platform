const TOKEN_KEY = 'vulncart_token';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const api = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  },
  setToken(t) {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  },
  async authRequired() {
    if (!this.getToken()) {
      location.href = '/account.html';
      throw new Error('login required');
    }
  },
  async request(method, path, body) {
    const headers = { Accept: 'application/json' };
    const token = this.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { message: text };
    }
    if (!res.ok) {
      alert((data && data.message) || res.statusText);
      throw Object.assign(new Error('api error'), { data, status: res.status });
    }
    return data;
  },
  get(path) {
    return this.request('GET', path);
  },
  post(path, body) {
    return this.request('POST', path, body);
  },
  patch(path, body) {
    return this.request('PATCH', path, body);
  },
  del(path) {
    return this.request('DELETE', path);
  },
};
