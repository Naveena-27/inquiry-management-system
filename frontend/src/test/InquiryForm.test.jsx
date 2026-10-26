import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import InquiryForm from '../components/InquiryForm.jsx';
import { api } from '../api.js';

vi.mock('../api.js', () => ({ api: { create: vi.fn() } }));

test('shows field errors and does not call the API when the form is empty', async () => {
  render(<InquiryForm />);
  await userEvent.click(screen.getByRole('button', { name: /save inquiry/i }));
  expect(screen.getByText('Name must be at least 2 characters')).toBeTruthy();
  expect(screen.getByText('Enter a valid email or phone number')).toBeTruthy();
  expect(api.create).not.toHaveBeenCalled();
});
