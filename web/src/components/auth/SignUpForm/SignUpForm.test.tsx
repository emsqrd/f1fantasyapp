import type { Auth } from '@/lib/authStore';
import type { Session } from '@supabase/supabase-js';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SignUpForm } from './SignUpForm';

const mockSession = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
} as unknown as Session;

// Mock useAuth and useNavigate
vi.mock('@/hooks/useAuth', async () => {
  return {
    useAuth: vi.fn(() => ({
      user: null,
      signUp: vi.fn(),
    })),
  };
});

const mockNavigate = vi.fn();
const mockUseSearch = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useSearch: () => mockUseSearch(),
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

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

  it('renders all form fields and submit button', () => {
    setup();
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
  });

  it('shows error if passwords do not match', async () => {
    setup();
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password1' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'password2' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent(/passwords do not match/i);
  });

  it('shows error if password is too short', async () => {
    setup();
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: '123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent(/password must be at least 6 characters/i);
  });

  it('shows error if signUp throws', async () => {
    mockSignUp.mockRejectedValue(new Error('Sign up failed'));
    setup();
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent(/sign up failed/i);
  });

  it('shows generic error message if signUp throws non-Error object', async () => {
    mockSignUp.mockRejectedValue('Network error');
    setup();
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent('Sign up failed');
  });

  it('disables submit button while loading', async () => {
    // Pending forever so the post-submit branch can't race the next test.
    mockSignUp.mockImplementation(() => new Promise(() => {}));
    setup();
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
    expect(screen.getByRole('button', { name: /creating account/i })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    await waitFor(() => expect(mockSignUp).toHaveBeenCalled());
  });

  it('navigates to redirect path when redirect search parameter is provided', async () => {
    mockSignUp.mockResolvedValueOnce({ session: mockSession });
    mockUseSearch.mockReturnValue({ redirect: '/leagues' });
    setup();
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/leagues' });
    });
  });

  it('renders the check-email pending UI when signUp returns no session', async () => {
    mockSignUp.mockResolvedValueOnce({ session: null });
    setup();
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'pending@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    expect(await screen.findByRole('heading', { name: /check your email/i })).toBeInTheDocument();
    expect(screen.getByText('pending@example.com')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('navigates to default destination when signUp returns a session (auto-confirm)', async () => {
    mockSignUp.mockResolvedValueOnce({ session: mockSession });
    setup();
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/' });
    });
  });

  it('clears the auth transition flag even if post-signup navigation rejects', async () => {
    mockSignUp.mockResolvedValueOnce({ session: mockSession });
    mockNavigate.mockRejectedValueOnce(new Error('navigation cancelled'));
    setup();
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      expect(mockStartAuthTransition).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mockCompleteAuthTransition).toHaveBeenCalledTimes(1);
    });
  });

  it('passes emailRedirectTo for the site origin into signUp', async () => {
    mockSignUp.mockResolvedValueOnce({ session: mockSession });
    setup();
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
        { displayName: 'Test User' },
        { emailRedirectTo: `${window.location.origin}/` },
      );
    });
  });

  it('threads search.redirect through emailRedirectTo when present', async () => {
    mockSignUp.mockResolvedValueOnce({ session: mockSession });
    mockUseSearch.mockReturnValue({ redirect: '/join/abc-123' });
    setup();
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

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
