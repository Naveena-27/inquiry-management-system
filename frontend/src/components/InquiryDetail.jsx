import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { TRANSITIONS } from '../validate.js';

export default function InquiryDetail({ id, onChanged }) {
  const [inquiry, setInquiry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null); 

  const load = () => {
    setLoading(true);
    setLoadError(null);
    api.get(id)
      .then((d) => setInquiry(d.inquiry))
      .catch((err) => setLoadError(err))
      .finally(() => setLoading(false));
  };
  useEffect(load, [id]);

  const change = async (to) => {
    setSaving(true);
    setNotice(null);
    try {
      const d = await api.changeStatus(inquiry.id, to, inquiry.version);
      setInquiry(d.inquiry);
      onChanged?.();
    } catch (err) {
      // Use the latest server data if this copy is stale.
      if (err.current) setInquiry(err.current); 
      setNotice({ type: err.code === 'STALE' ? 'warn' : 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const back = <a href="#/">← Back to inquiries</a>;

  if (loading) {
    return (
      <main className="card">
        <p>Loading inquiry…</p>
      </main>
    );
  }
  if (loadError) {
    const msg =
    loadError.status === 404
      ? 'This inquiry does not exist, or you do not have access to it.'
      : loadError.status === 400
        ? 'That is not a valid inquiry link.'
        : loadError.message;
    return <main className="card"><p className="error" role="alert">{msg}</p>{back}{' '}
      {loadError.status !== 404 &&
       loadError.status !== 400 &&
        <button className="link" onClick={load}>Retry</button>}</main>;
  }

  return (
    <main className="card">
      {back}
      <h2>{inquiry.subject}</h2>
      <p><span className={`badge s-${inquiry.status.replace(' ', '')}`}>{inquiry.status}</span></p>
      <p><strong>{inquiry.customer_name}</strong> · {inquiry.contact}</p>
      <p>{inquiry.description}</p>

      <p className="muted">
        Owner: {inquiry.owner_name} · Created{' '}
        {new Date(inquiry.created_at).toLocaleString()} · Updated{' '}
        {new Date(inquiry.updated_at).toLocaleString()}
      </p>

      <div className="actions">
        {TRANSITIONS[inquiry.status].map((to) => (
          <button key={to} disabled={saving} onClick={() => change(to)}>
            {inquiry.status === 'Resolved' ? 'Reopen' : `Mark ${to}`}
          </button>
        ))}
      </div>

      {notice && <p className={notice.type === 'warn' ? 'warn' : 'error'} role="alert">{notice.text}</p>}
    </main>
  );
}
