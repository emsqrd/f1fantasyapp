import type { Auth } from '@/lib/authStore';
import type { Session } from '@supabase/supabase-js';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SignUpForm } from './SignUpForm';

const mockSession = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
} as unknown as Session;

// Mock useAuth and useNavigate
vi.mock('@/hooks/useAuth', () => {
  return {
    useAuth: vi.fn(() => ({
      user: null,
      signUp: vi.fn(),
    })),
  };
});

const mockNavigate = vi.fn();
const mockUseSearch =
  vi.fn<() => { redirect?: string; confirmationError?: 'expired' | 'generic' }>();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useSearch: () => mockUseSearch(),
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

type User = ReturnType<typeof userEvent.setup>;

const displayNameInput = () => screen.getByLabelText('Display Name');
const emailInput = () => screen.getByLabelText('Email');
const passwordInput = () => screen.getByLabelText('Password');
const confirmPasswordInput = () => screen.getByLabelText('Confirm Password');

const VALID_INPUT = {
  displayName: 'Test User',
  email: 'test@example.com',
  password: 'password123',
  confirmPassword: 'password123',
};

async function fillForm(user: User, overrides: Partial<typeof VALID_INPUT> = {}) {
  const values = { ...VALID_INPUT, ...overrides };
  if (values.displayName) await user.type(displayNameInput(), values.displayName);
  if (values.email) await user.type(emailInput(), values.email);
  if (values.password) await user.type(passwordInput(), values.password);
  if (values.confirmPassword) await user.type(confirmPasswordInput(), values.confirmPassword);
}

const submit = (user: User) => user.click(screen.getByRole('button', { name: /sign up/i }));

describe('SignUpForm', () => {
  let mockSignUp: ReturnType<typeof vi.fn<Auth['signUp']>>;
  let mockStartAuthTransition: ReturnType<typeof vi.fn<() => void>>;
  let mockCompleteAuthTransition: ReturnType<typeof vi.fn<() => void>>;
  let useAuth: typeof import('@/hooks/useAuth').useAuth;

  beforeEach(async () => {
    mockSignUp = vi.fn<Auth['signUp']>();
    mockStartAuthTransition = vi.fn<() => void>();
    mockCompleteAuthTransition = vi.fn<() => void>();
    useAuth = (await import('@/hooks/useAuth')).useAuth;
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: false,
      isAuthTransitioning: false,
      signIn: vi.fn(),
      signUp: mockSignUp,
      signOut: vi.fn(),
      startAuthTransition: mockStartAuthTransition,
      completeAuthTransition: mockCompleteAuthTransition,
    });
    mockUseSearch.mockReturnValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const setup = () => {
    render(<SignUpForm />);
  };

  it('renders all form fields, the password hint, and the submit button', () => {
    setup();
    expect(displayNameInput()).toBeInTheDocument();
    expect(emailInput()).toBeInTheDocument();
    expect(passwordInput()).toBeInTheDocument();
    expect(confirmPasswordInput()).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
  });

  it('marks every field for password-manager autofill', () => {
    setup();
    expect(displayNameInput()).toHaveAttribute('autocomplete', 'name');
    expect(emailInput()).toHaveAttribute('autocomplete', 'email');
    expect(passwordInput()).toHaveAttribute('autocomplete', 'new-password');
    expect(confirmPasswordInput()).toHaveAttribute('autocomplete', 'new-password');
  });

  describe('validation', () => {
    it('reports every empty field at once and keeps the hint alongside the password error', async () => {
      const user = userEvent.setup();
      setup();

      await submit(user);

      expect(await screen.findByText('Enter a display name')).toBeInTheDocument();
      expect(screen.getByText('Enter your email')).toBeInTheDocument();
      expect(screen.getByText('Enter a password')).toBeInTheDocument();
      expect(screen.getByText('Confirm your password')).toBeInTheDocument();
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
      expect(mockSignUp).not.toHaveBeenCalled();
    });

    it('rejects a display name longer than 50 characters', async () => {
      const user = userEvent.setup();
      setup();

      await fillForm(user, { displayName: 'a'.repeat(51) });
      await submit(user);

      expect(
        await screen.findByText('Display name must be 50 characters or fewer'),
      ).toBeInTheDocument();
    });

    it('rejects a whitespace-only display name', async () => {
      const user = userEvent.setup();
      setup();

      await fillForm(user, { displayName: '   ' });
      await submit(user);

      expect(await screen.findByText('Enter a display name')).toBeInTheDocument();
    });

    it('rejects a malformed email', async () => {
      const user = userEvent.setup();
      setup();

      await fillForm(user, { email: 'not-an-email' });
      await submit(user);

      expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    });

    it('rejects a password below the minimum length', async () => {
      const user = userEvent.setup();
      setup();

      await fillForm(user, { password: '1234567', confirmPassword: '1234567' });
      await submit(user);

      expect(await screen.findByText('Password is too short')).toBeInTheDocument();
    });

    it('rejects a password above the maximum length', async () => {
      const user = userEvent.setup();
      setup();

      const tooLong = 'a'.repeat(73);
      await fillForm(user, { password: tooLong, confirmPassword: tooLong });
      await submit(user);

      expect(
        await screen.findByText('Password must be 72 characters or fewer'),
      ).toBeInTheDocument();
    });

    it('reports a confirmation that differs from the password', async () => {
      const user = userEvent.setup();
      setup();

      await fillForm(user, { confirmPassword: 'password456' });
      await submit(user);

      expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    });

    it('clears the mismatch error when the password field is the one corrected', async () => {
      const user = userEvent.setup();
      setup();

      await fillForm(user, { confirmPassword: 'password456' });
      await submit(user);
      expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();

      await user.clear(passwordInput());
      await user.type(passwordInput(), 'password456');

      await waitFor(() =>
        expect(screen.queryByText('Passwords do not match')).not.toBeInTheDocument(),
      );
    });

    it('reports an empty confirmation without stacking the mismatch message', async () => {
      const user = userEvent.setup();
      setup();

      await fillForm(user, { confirmPassword: '' });
      await submit(user);

      expect(await screen.findByText('Confirm your password')).toBeInTheDocument();
      expect(screen.queryByText('Passwords do not match')).not.toBeInTheDocument();
    });

    it('stays quiet until the first submit, then revalidates while typing', async () => {
      const user = userEvent.setup();
      setup();

      await user.type(emailInput(), 'not-an-email');
      expect(screen.queryByText('Enter a valid email address')).not.toBeInTheDocument();

      await submit(user);
      expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();

      await user.type(emailInput(), '@example.com');
      await waitFor(() =>
        expect(screen.queryByText('Enter a valid email address')).not.toBeInTheDocument(),
      );
    });

    it('submits the display name and email trimmed', async () => {
      const user = userEvent.setup();
      mockSignUp.mockResolvedValueOnce({ session: mockSession });
      setup();

      await fillForm(user, { displayName: '  Test User  ', email: '  test@example.com  ' });
      await submit(user);

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith(
          'test@example.com',
          'password123',
          { displayName: 'Test User' },
          { emailRedirectTo: `${window.location.origin}/` },
        );
      });
    });
  });

  it('renders a signUp failure in the form callout rather than on a field', async () => {
    const user = userEvent.setup();
    mockSignUp.mockRejectedValue(new Error('Sign up failed'));
    setup();

    await fillForm(user);
    await submit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Sign up failed');
    expect(screen.getByRole('status')).toHaveTextContent('Sign up failed');
    expect(passwordInput()).toHaveAttribute('aria-invalid', 'false');
  });

  it('clears a signUp failure when the next submit is blocked by validation', async () => {
    const user = userEvent.setup();
    mockSignUp.mockRejectedValue(new Error('User already registered'));
    setup();

    await fillForm(user);
    await submit(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('User already registered');

    await user.clear(displayNameInput());
    await submit(user);

    expect(await screen.findByText('Enter a display name')).toBeInTheDocument();
    expect(screen.queryByText('User already registered')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(mockSignUp).toHaveBeenCalledTimes(1);
  });

  it('renders a generic message when signUp rejects with a non-Error value', async () => {
    const user = userEvent.setup();
    mockSignUp.mockRejectedValue('Network error');
    setup();

    await fillForm(user);
    await submit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Sign up failed');
  });

  it('marks the submit button busy while signUp is in flight', async () => {
    const user = userEvent.setup();
    // Pending forever so the post-submit branch can't race the next test.
    mockSignUp.mockImplementation(() => new Promise(() => {}));
    setup();

    await fillForm(user);
    await submit(user);

    expect(screen.getByRole('button', { name: /creating account/i })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    await waitFor(() => expect(mockSignUp).toHaveBeenCalled());
  });

  it('navigates to redirect path when redirect search parameter is provided', async () => {
    const user = userEvent.setup();
    mockSignUp.mockResolvedValueOnce({ session: mockSession });
    mockUseSearch.mockReturnValue({ redirect: '/leagues' });
    setup();

    await fillForm(user);
    await submit(user);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/leagues' });
    });
  });

  it('renders the check-email pending UI when signUp returns no session', async () => {
    const user = userEvent.setup();
    mockSignUp.mockResolvedValueOnce({ session: null });
    setup();

    await fillForm(user, { email: 'pending@example.com' });
    await submit(user);

    expect(await screen.findByRole('heading', { name: /check your email/i })).toBeInTheDocument();
    expect(screen.getByText('pending@example.com')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('navigates to default destination when signUp returns a session (auto-confirm)', async () => {
    const user = userEvent.setup();
    mockSignUp.mockResolvedValueOnce({ session: mockSession });
    setup();

    await fillForm(user);
    await submit(user);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/' });
    });
  });

  it('clears the auth transition flag even if post-signup navigation rejects', async () => {
    const user = userEvent.setup();
    mockSignUp.mockResolvedValueOnce({ session: mockSession });
    mockNavigate.mockRejectedValueOnce(new Error('navigation cancelled'));
    setup();

    await fillForm(user);
    await submit(user);

    await waitFor(() => {
      expect(mockStartAuthTransition).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mockCompleteAuthTransition).toHaveBeenCalledTimes(1);
    });
  });

  it('threads search.redirect through emailRedirectTo when present', async () => {
    const user = userEvent.setup();
    mockSignUp.mockResolvedValueOnce({ session: mockSession });
    mockUseSearch.mockReturnValue({ redirect: '/join/abc-123' });
    setup();

    await fillForm(user);
    await submit(user);

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
        { displayName: 'Test User' },
        { emailRedirectTo: `${window.location.origin}/join/abc-123` },
      );
    });
  });

  it('renders the expired-link copy when search carries confirmationError="expired"', () => {
    mockUseSearch.mockReturnValue({ confirmationError: 'expired' });
    setup();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This confirmation link is no longer valid. Sign up again to receive a new one.',
    );
  });

  it('renders the generic copy when search carries confirmationError="generic"', () => {
    mockUseSearch.mockReturnValue({ confirmationError: 'generic' });
    setup();

    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't confirm your email. Please try signing up again.",
    );
  });

  it('renders no confirmation-error alert when search omits confirmationError', () => {
    mockUseSearch.mockReturnValue({});
    setup();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
