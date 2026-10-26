import { useState } from 'react';
import { api } from '../api.js';
import { validateInquiry } from '../validate.js';

const EMPTY = { customer_name: '', contact: '', subject: '', description: '' };
const LABELS = {
  customer_name: 'Customer name',
  contact: 'Email or phone',
  subject: 'Subject',
  description: 'Description',
};

export default function InquiryForm({ onCreated }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const updateField = (field) => (event) => {
    setForm({ ...form, [field]: event.target.value });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaved(false);
    setFormError(null);
    const errs = validateInquiry(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await api.create(form);
      setForm(EMPTY);
      setSaved(true);
      onCreated?.();
    } catch (err) {
      if (err.fields) setErrors(err.fields);
      setFormError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card" onSubmit={submit} noValidate>
      <h2>New inquiry</h2>
      {['customer_name', 'contact', 'subject'].map((k) => (
        <label key={k}>{LABELS[k]}
          <input value={form[k]} onChange={updateField(k)} aria-invalid={!!errors[k]} />
          {errors[k] && <span className="error">{errors[k]}</span>}
        </label>
      ))}

      <label>
        {LABELS.description}
        <textarea
          rows="4"
          value={form.description}
          onChange={updateField('description')}
          aria-invalid={!!errors.description}
        />
        {errors.description && <span className="error">{errors.description}</span>}
      </label>

      {formError && !formError.fields && (
        <p className="error" role="alert">
          {formError.message}{' '}
          {formError.existingId && <a href={`#/inquiries/${formError.existingId}`}>View existing</a>}
        </p>
      )}

      {saved && <p className="ok" role="status">Inquiry saved.</p>}
      <button disabled={busy}>{busy ? 'Saving…' : 'Save inquiry'}</button>
    </form>
  );
}
