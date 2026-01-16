import { useAuth } from '@/hooks/useAuth';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { MockedFunction } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SignInForm } from './SignInForm';

// Mock useAuth
vi.mock('@/hooks/useAuth');

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

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
      signIn: signInMock,
      signUp: vi.fn(),
      signOut: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders form fields and submit button', () => {
    render(<SignInForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows error message on failed login', async () => {
    signInMock.mockRejectedValueOnce(new Error('Invalid credentials'));
    render(<SignInForm />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'fail@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'badpass' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent(/login failed: invalid credentials/i);
    expect(mockNavigate).not.toHaveBeenCalledWith('/dashboard');
  });

  it('disables submit button while loading', async () => {
    let resolvePromise: (value?: unknown) => void = () => {};
    signInMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve;
        }),
    );
    render(<SignInForm />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(screen.getByRole('button', { name: /signing in/i })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    // Resolve the promise to finish loading
    await waitFor(() => resolvePromise !== undefined && resolvePromise !== null);
    resolvePromise();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in/i })).toHaveAttribute(
        'aria-busy',
        'false',
      );
    });
  });

  it('has a link to sign up', () => {
    render(<SignInForm />);
    const link = screen.getByRole('link', { name: /sign up/i });
    expect(link).toHaveAttribute('href', '/sign-up');
  });
});
