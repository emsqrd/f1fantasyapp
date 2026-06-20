import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { CreateLeague } from './CreateLeague';

function renderCreateLeague() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <CreateLeague />
    </QueryClientProvider>,
  );
}

describe('CreateLeague', () => {
  it('shows a validation error when the league name is left empty', async () => {
    renderCreateLeague();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /create league/i }));

    const nameInput = screen.getByLabelText(/league name/i);
    await user.click(nameInput);
    await user.tab();

    expect(await screen.findByText(/league name is required/i)).toBeInTheDocument();
  });

  it('clears the form when the dialog is closed and reopened', async () => {
    renderCreateLeague();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /create league/i }));
    await user.type(screen.getByLabelText(/league name/i), 'Test League');

    const closeButtons = screen.getAllByRole('button', { name: /close/i });
    await user.click(closeButtons[0]);

    await user.click(screen.getByRole('button', { name: /create league/i }));

    expect(screen.getByLabelText(/league name/i)).toHaveValue('');
  });
});
