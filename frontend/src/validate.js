// Client-side hints only. The API validates again independently.
const phoneOrEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ||
                            /^\+?[\d\s-]{7,20}$/.test(v);

export function validateInquiry(f) {
  const e = {};
  // Limits mirror backend/src/rules.js so the user gets the hint before the API rejects it.
  const name = f.customer_name.trim(), subject = f.subject.trim(), desc = f.description.trim();
  if (name.length < 2) e.customer_name = 'Name must be at least 2 characters';
  else if (name.length > 100) e.customer_name = 'Name must be at most 100 characters';

  if (!phoneOrEmail(f.contact.trim())) e.contact = 'Enter a valid email or phone number';

  if (subject.length < 3) e.subject = 'Subject must be at least 3 characters';
  else if (subject.length > 150) e.subject = 'Subject must be at most 150 characters';

  if (desc.length < 10) e.description = 'Description must be at least 10 characters';
  else if (desc.length > 2000) e.description = 'Description must be at most 2000 characters';

  return e;
}

export const TRANSITIONS = {
  New: ['In Progress'],
  'In Progress': ['New', 'Resolved'],
  Resolved: ['In Progress'],
};
