const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

const resolveApiBase = () => {
  const envBase = process.env.REACT_APP_API_BASE?.trim();
  if (envBase) return trimTrailingSlash(envBase);

  if (typeof window !== 'undefined') {
    const { protocol, hostname, origin } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${protocol}//${hostname}:8000`;
    }
    return trimTrailingSlash(origin);
  }

  return 'http://localhost:8000';
};

export const API_BASE = resolveApiBase();
export const IG_API_BASE = `${API_BASE}/instagram`;
