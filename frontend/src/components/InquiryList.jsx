import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function InquiryList({ refreshKey, showOwner }) {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [state, setState] = useState({ loading: true, error: null, items: [] });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    api.list({ status, q: debouncedSearch })
    .then((data) => {
        if (!cancelled) {
          setState({
            loading: false,
            error: null,
            items: data.inquiries,
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            loading: false,
            error: err.message,
            items: [],
          });
        }
      });
            
    return () => { cancelled = true; };
  }, [status, debouncedSearch, refreshKey, retry]);

  const filtering = status || debouncedSearch;

  return (
    <section className="card">
      <h2>Inquiries</h2>
      <div className="filters">
        <input
          placeholder="Search name, subject, contact"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          <option>New</option>
          <option>In Progress</option>
          <option>Resolved</option>
        </select>
      </div>

      {state.loading && <p>Loading inquiries…</p>}
      
      {state.error && (
        <p className="error" role="alert">
          {state.error}{' '}
          <button
            className="link"
            onClick={() => setRetry((r) => r + 1)}
          >
            Retry
          </button>
        </p>
      )}

      {!state.loading && !state.error && state.items.length === 0 && (
        <p className="muted">
          {filtering
            ? 'No inquiries match your search.'
            : 'No inquiries yet. Record your first one on the left.'}
        </p>
      )}

      <ul className="list">
        {state.items.map((i) => (
          <li key={i.id}>
            <a href={`#/inquiries/${i.id}`}>
              <strong>{i.subject}</strong>
              <span className={`badge s-${i.status.replace(' ', '')}`}>
                {i.status}
              </span>
              <small>
                {i.customer_name}
                {showOwner ? ` · owner: ${i.owner_name}` : ''}
                {' · '}
                {new Date(i.updated_at).toLocaleString()}
              </small>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
