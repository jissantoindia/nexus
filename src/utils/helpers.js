/**
 * Replaces {{variable}} placeholders with values from the active environment.
 */
export function interpolate(str, env = {}) {
  if (!str) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => env[key] ?? `{{${key}}}`);
}

/** Apply interpolation to all fields of a request object */
export function interpolateRequest(req, env) {
  return {
    ...req,
    url: interpolate(req.url, env),
    headers: (req.headers || []).map(h => ({
      ...h,
      key: interpolate(h.key, env),
      value: interpolate(h.value, env),
    })),
    params: (req.params || []).map(p => ({
      ...p,
      key: interpolate(p.key, env),
      value: interpolate(p.value, env),
    })),
    body: interpolate(req.body, env),
    auth: req.auth ? {
      ...req.auth,
      token: interpolate(req.auth.token, env),
      username: interpolate(req.auth.username, env),
      password: interpolate(req.auth.password, env),
      value: interpolate(req.auth.value, env),
    } : req.auth,
  };
}

/** Build final URL with query params */
export function buildUrl(url, params = []) {
  try {
    const base = new URL(url.startsWith('http') ? url : 'https://' + url);
    params.filter(p => p.enabled && p.key).forEach(p => base.searchParams.set(p.key, p.value || ''));
    return (url.startsWith('http') ? '' : '') + base.toString();
  } catch {
    const qs = params.filter(p => p.enabled && p.key).map(p => `${p.key}=${p.value || ''}`).join('&');
    return qs ? `${url}?${qs}` : url;
  }
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatMs(ms) {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function statusColor(status) {
  if (!status) return '#8b9ab1';
  if (status < 300) return '#22d3a0';
  if (status < 400) return '#f5a623';
  if (status < 500) return '#f97316';
  return '#ef4444';
}

export function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}
