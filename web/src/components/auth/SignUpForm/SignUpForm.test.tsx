import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SignUpForm } from './SignUpForm';

// Mock useAuth and useNavigate
vi.mock('@/hooks/useAuth', async () => {
  return {
    useAuth: vi.fn(() => ({
      user: null,
      signUp: vi.fn(),
    })),
  };
});

vi.mock('@tanstack/react-router', () => ({
  useNavigate: vi.fn(),
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

describe('SignUpForm', () => {
  let mockSignUp: ReturnType<typeof vi.fn>;
  let mockNavigate: ReturnType<typeof vi.fn>;
  let useAuth: typeof import('@/hooks/useAuth').useAuth;
  let useNavigate: typeof import('@tanstack/react-router').useNavigate;

  beforeEach(async () => {
    mockSignUp = vi.fn();
    mockNavigate = vi.fn();
    useAuth = (await import('@/hooks/useAuth')).useAuth;
    useNavigate = (await import('@tanstack/react-router')).useNavigate;
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: false,
      signIn: vi.fn(),
      signUp: mockSignUp,
      signOut: vi.fn(),
    });
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
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
    mockSignUp.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));
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
});
