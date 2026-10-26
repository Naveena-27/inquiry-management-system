import { z } from 'zod';

export const STATUSES = ['New', 'In Progress', 'Resolved'];

// Allowed inquiry status transitions.
export const TRANSITIONS = {
  New: ['In Progress'],
  'In Progress': ['New', 'Resolved'],
  Resolved: ['In Progress'],
};

export const canTransition = (from, to) => (TRANSITIONS[from] || []).includes(to);

const phoneOrEmail = (v) =>(
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 
  /^\+?[\d\s-]{7,20}$/.test(v));

export const inquirySchema = z.object({
  customer_name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  contact: z.string().trim().refine(phoneOrEmail, 'Enter a valid email or phone number'),
  subject: z.string().trim().min(3, 'Subject must be at least 3 characters').max(150),
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(2000),
});

export const statusChangeSchema = z.object({
  status: z.enum(STATUSES, { message: 'Status must be New, In Progress or Resolved' }),
  version: z.number().int().positive(),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export function fieldErrors(zodError) {
  const out = {};
  for (const i of zodError.issues) out[i.path[0] ?? '_'] ??= i.message;
  return out;
}
