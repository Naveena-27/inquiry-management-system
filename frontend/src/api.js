export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message || 'Request failed');
    this.status = status;
    this.code = body?.error?.code;
    this.fields = body?.error?.fields;
    this.current = body?.error?.current;
    this.existingId = body?.error?.existingId;
  }
}

// Handle unauthorized API responses globally.
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

async function request(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, {
      error: {
        code: 'NETWORK',
        message: 'Cannot reach the server. Check your connection.',
      },
    });
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  // Ignore expected 401 responses from authentication routes.
  if (res.status === 401 && !path.startsWith('/auth/')) onUnauthorized();
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export const api = {
  login: (email, password) =>
  request('/auth/login', {
    method: 'POST',
    body: { email, password },
  }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  list: ({ status, q }) => {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (q) p.set('q', q);
    return request(`/inquiries?${p}`);
  },
  get: (id) => request(`/inquiries/${id}`),
  create: (data) =>
  request('/inquiries', {
    method: 'POST',
    body: data,
  }),
  changeStatus: (id, status, version) =>
    request(`/inquiries/${id}/status`, {
      method: 'PATCH',
      body: { status, version },
    }),
};
