import { useEffect, useState } from 'react';
import { api, setUnauthorizedHandler } from './api.js';
import LoginForm from './components/LoginForm.jsx';
import InquiryList from './components/InquiryList.jsx';
import InquiryForm from './components/InquiryForm.jsx';
import InquiryDetail from './components/InquiryDetail.jsx';

function useHash() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [expired, setExpired] = useState(false);
  const hash = useHash();

  useEffect(() => {
    setUnauthorizedHandler(() => { setExpired(true); setUser(null); });
    api.me().then((d) => setUser(d.user)).catch(() => {}).finally(() => setChecking(false));
  }, []);

  if (checking) return <p className="center">Loading…</p>;
  if (!user) {
    return <LoginForm onLogin={(u) => { setExpired(false); setUser(u); }}
      notice={expired ? 'Your session has expired. Please sign in again.' : null} />;
  }

  const match = hash.match(/^#\/inquiries\/(.+)$/);

  const logout = async () => {
    await api.logout();
    window.location.hash = '';
    setUser(null);
  };

  return (
    <div className="app">
      <header>
        <a href="#/" className="brand">Inquiry Tracker</a>
        <span>{user.name} ({user.role}) <button className="link" onClick={logout}>Sign out</button></span>
      </header>
      {match ? (
        <InquiryDetail id={match[1]} onChanged={() => setRefreshKey((k) => k + 1)} />
      ) : (
        <main className="grid">
          <InquiryForm onCreated={() => setRefreshKey((k) => k + 1)} />
          <InquiryList refreshKey={refreshKey} showOwner={user.role === 'manager'} />
        </main>
      )}
    </div>
  );
}
