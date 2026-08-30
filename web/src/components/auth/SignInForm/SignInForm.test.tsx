import { useAuth } from '@/hooks/useAuth';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { MockedFunction } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SignInForm } from './SignInForm';

// Mock useAuth
vi.mock('@/hooks/useAuth');

// Mock useNavigate and useSearch
const mockNavigate = vi.fn();
const mockUseSearch = vi.fn<() => { redirect?: string }>();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useSearch: () => mockUseSearch(),
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

type User = ReturnType<typeof userEvent.setup>;

const emailInput = () => screen.getByLabelText('Email');
const passwordInput = () => screen.getByLabelText('Password');

const VALID_INPUT = {
  email: 'user@example.com',
  password: 'password123',
};

async function fillForm(user: User, overrides: Partial<typeof VALID_INPUT> = {}) {
  const values = { ...VALID_INPUT, ...overrides };
  if (values.email) await user.type(emailInput(), values.email);
  if (values.password) await user.type(passwordInput(), values.password);
}

const submit = (user: User) => user.click(screen.getByRole('button', { name: 'Sign In' }));

describe('SignInForm', () => {
  const signInMock = vi.fn();
  type UseAuthType = typeof useAuth;
  let useAuthMock: MockedFunction<UseAuthType>;

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock = useAuth as unknown as MockedFunction<UseAuthType>;
    useAuthMock.mockReturnValue({
      user: null,
      session: null,
      loading: false,
      isAuthTransitioning: false,
      signIn: signInMock,
      signUp: vi.fn(),
      signOut: vi.fn(),
      startAuthTransition: vi.fn(),
      completeAuthTransition: vi.fn(),
    });
    mockUseSearch.mockReturnValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders form fields and submit button', () => {
    render(<SignInForm />);
    expect(emailInput()).toBeInTheDocument();
    expect(passwordInput()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('marks the credential fields for password-manager autofill', () => {
    render(<SignInForm />);
    expect(emailInput()).toHaveAttribute('autocomplete', 'email');
    expect(passwordInput()).toHaveAttribute('autocomplete', 'current-password');
  });

  it('renders no password hint', () => {
    render(<SignInForm />);
    expect(screen.queryByText(/at least 8 characters/i)).not.toBeInTheDocument();
  });

  it('offers the forgot-password link on the password label row', () => {
    render(<SignInForm />);
    expect(screen.getByRole('link', { name: /forgot password/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  describe('validation', () => {
    it('reports both empty fields at once and does not attempt to sign in', async () => {
      const user = userEvent.setup();
      render(<SignInForm />);

      await submit(user);

      expect(await screen.findByText('Enter your email')).toBeInTheDocument();
      expect(screen.getByText('Enter a password')).toBeInTheDocument();
      expect(signInMock).not.toHaveBeenCalled();
    });

    it('rejects a malformed email', async () => {
      const user = userEvent.setup();
      render(<SignInForm />);

      await fillForm(user, { email: 'not-an-email' });
      await submit(user);

      expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
      expect(signInMock).not.toHaveBeenCalled();
    });

    it('accepts a password shorter than the sign-up minimum', async () => {
      const user = userEvent.setup();
      signInMock.mockResolvedValueOnce(undefined);
      render(<SignInForm />);

      await fillForm(user, { password: 'short' });
      await submit(user);

      await waitFor(() => expect(signInMock).toHaveBeenCalledWith('user@example.com', 'short'));
    });

    it('stays quiet until the first submit, then revalidates while typing', async () => {
      const user = userEvent.setup();
      render(<SignInForm />);

      await user.type(emailInput(), 'not-an-email');
      expect(screen.queryByText('Enter a valid email address')).not.toBeInTheDocument();

      await submit(user);
      expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();

      await user.type(emailInput(), '@example.com');
      await waitFor(() =>
        expect(screen.queryByText('Enter a valid email address')).not.toBeInTheDocument(),
      );
    });

    it('submits the email trimmed', async () => {
      const user = userEvent.setup();
      signInMock.mockResolvedValueOnce(undefined);
      render(<SignInForm />);

      await fillForm(user, { email: '  user@example.com  ' });
      await submit(user);

      await waitFor(() =>
        expect(signInMock).toHaveBeenCalledWith('user@example.com', 'password123'),
      );
    });
  });

  it('renders a signIn failure in the form callout rather than on a field', async () => {
    const user = userEvent.setup();
    signInMock.mockRejectedValueOnce(new Error('Invalid credentials'));
    render(<SignInForm />);

    await fillForm(user, { email: 'fail@example.com' });
    await submit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /login failed: invalid credentials/i,
    );
    expect(screen.getByRole('status')).toHaveTextContent(/login failed: invalid credentials/i);
    expect(passwordInput()).toHaveAttribute('aria-invalid', 'false');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('renders a generic message when signIn rejects with a non-Error value', async () => {
    const user = userEvent.setup();
    signInMock.mockRejectedValueOnce('Network error');
    render(<SignInForm />);

    await fillForm(user);
    await submit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Login Failed');
  });

  it('marks the submit button busy while signIn is in flight', async () => {
    const user = userEvent.setup();
    // Pending forever so the post-submit branch can't race the next test.
    signInMock.mockImplementation(() => new Promise(() => {}));
    render(<SignInForm />);

    await fillForm(user);
    await submit(user);

    expect(screen.getByRole('button', { name: /signing in/i })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    await waitFor(() => expect(signInMock).toHaveBeenCalled());
  });

  it('has a link to sign up', () => {
    render(<SignInForm />);
    const link = screen.getByRole('link', { name: /sign up/i });
    expect(link).toHaveAttribute('href', '/sign-up');
  });

  it('navigates to redirect path when redirect search parameter is provided', async () => {
    const user = userEvent.setup();
    signInMock.mockResolvedValueOnce(undefined);
    mockUseSearch.mockReturnValue({ redirect: '/team/123' });
    render(<SignInForm />);

    await fillForm(user);
    await submit(user);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/team/123' });
    });
  });

  it('navigates to / when no redirect search parameter is provided', async () => {
    const user = userEvent.setup();
    signInMock.mockResolvedValueOnce(undefined);
    mockUseSearch.mockReturnValue({});
    render(<SignInForm />);

    await fillForm(user);
    await submit(user);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/' });
    });
  });
});
