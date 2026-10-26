import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import InquiryDetail from '../components/InquiryDetail.jsx';
import { api } from '../api.js';

vi.mock('../api.js', () => ({
  api: {
    get: vi.fn(),
    changeStatus: vi.fn(),
  },
}));

test('shows latest server data when a status update is stale', async () => {
  api.get.mockResolvedValue({
    inquiry: {
      id: 1,
      customer_name: 'Nimal',
      contact: 'nimal@mail.com',
      subject: 'Login issue',
      description: 'Customer cannot log into the system.',
      status: 'New',
      version: 1,
      owner_name: 'Staff One',
      created_at: '2026-10-25T10:00:00Z',
      updated_at: '2026-10-25T10:00:00Z',
    },
  });

  api.changeStatus.mockRejectedValue({
    code: 'STALE',
    message: 'This inquiry was updated elsewhere. Showing the latest version.',
    current: {
      id: 1,
      customer_name: 'Nimal',
      contact: 'nimal@mail.com',
      subject: 'Login issue',
      description: 'Customer cannot log into the system.',
      status: 'In Progress',
      version: 2,
      owner_name: 'Staff One',
      created_at: '2026-10-25T10:00:00Z',
      updated_at: '2026-10-25T10:05:00Z',
    },
  });

  render(<InquiryDetail id="1" />);

  const button = await screen.findByRole('button', {
    name: /mark in progress/i,
  });

  await userEvent.click(button);

  expect(
    await screen.findByText(
      'This inquiry was updated elsewhere. Showing the latest version.'
    )
  ).toBeTruthy();

  await waitFor(() => {
    expect(screen.getByText('In Progress')).toBeTruthy();
  });

  expect(api.changeStatus).toHaveBeenCalledWith(1, 'In Progress', 1);
});