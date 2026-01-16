import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LandingPage } from './LandingPage';

// Mock the useAuth hook
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: null,
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    session: null,
  })),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(component);
};

describe('LandingPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    // Mock scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
    // Mock getElementById to return a partial HTMLElement with scrollIntoView method
    const mockElement = {
      scrollIntoView: vi.fn(),
    } as unknown as HTMLElement;
    vi.spyOn(document, 'getElementById').mockReturnValue(mockElement);
  });

  it('renders the main heading', () => {
    renderWithRouter(<LandingPage />);
    expect(screen.getByText(/Race to Glory with/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Race to Glory with/i })).toBeInTheDocument();
  });

  it('displays key features', () => {
    renderWithRouter(<LandingPage />);
    expect(screen.getByText('Compete with Friends')).toBeInTheDocument();
    expect(screen.getByText('Real-time Analytics')).toBeInTheDocument();
    expect(screen.getByText('Strategic Depth')).toBeInTheDocument();
  });

  it('shows how it works section', () => {
    renderWithRouter(<LandingPage />);
    expect(screen.getByText('Build Your Team')).toBeInTheDocument();
    expect(screen.getByText('Join a League')).toBeInTheDocument();
    expect(screen.getByText('Race for Points')).toBeInTheDocument();
  });

  it('displays social proof statistics', () => {
    renderWithRouter(<LandingPage />);
    expect(screen.getByText('10K+')).toBeInTheDocument();
    expect(screen.getByText('Active Players')).toBeInTheDocument();
  });

  it('should navigate to sign-up page when "Start Your Journey" button is clicked', async () => {
    const user = userEvent.setup();
    renderWithRouter(<LandingPage />);

    const startButton = screen.getByRole('button', { name: /start your journey/i });
    await user.click(startButton);

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/sign-up' });
  });

  it('should navigate to sign-up page when "Get Started Free" button is clicked', async () => {
    const user = userEvent.setup();
    renderWithRouter(<LandingPage />);

    const getStartedButton = screen.getByRole('button', { name: /get started free/i });
    await user.click(getStartedButton);

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/sign-up' });
  });

  it('should scroll to features section when "Learn More" button is clicked', async () => {
    const user = userEvent.setup();
    const mockScrollIntoView = vi.fn();
    const mockElement = {
      scrollIntoView: mockScrollIntoView,
    } as unknown as HTMLElement;
    vi.spyOn(document, 'getElementById').mockReturnValue(mockElement);

    renderWithRouter(<LandingPage />);

    const learnMoreButton = screen.getByRole('button', { name: /learn more/i });
    await user.click(learnMoreButton);

    expect(document.getElementById).toHaveBeenCalledWith('features');
    expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it('should handle case where features element is not found', async () => {
    const user = userEvent.setup();
    vi.spyOn(document, 'getElementById').mockReturnValue(null);

    renderWithRouter(<LandingPage />);

    const learnMoreButton = screen.getByRole('button', { name: /learn more/i });
    // Should not throw an error when element is not found
    await expect(user.click(learnMoreButton)).resolves.not.toThrow();

    expect(document.getElementById).toHaveBeenCalledWith('features');
  });

  it('should display all feature cards with icons and descriptions', () => {
    renderWithRouter(<LandingPage />);

    // Check that all 6 feature cards are present
    expect(screen.getByText('Compete with Friends')).toBeInTheDocument();
    expect(screen.getByText('Real-time Analytics')).toBeInTheDocument();
    expect(screen.getByText('Strategic Depth')).toBeInTheDocument();
    expect(screen.getByText('Mobile Optimized')).toBeInTheDocument();
    expect(screen.getByText('Live Updates')).toBeInTheDocument();
    expect(screen.getByText('Global Community')).toBeInTheDocument();

    // Check that feature descriptions are present
    expect(screen.getByText(/Create leagues, invite friends/)).toBeInTheDocument();
    expect(screen.getByText(/Track your team's performance/)).toBeInTheDocument();
    expect(screen.getByText(/Make crucial decisions/)).toBeInTheDocument();
  });

  it('should display all how-it-works steps', () => {
    renderWithRouter(<LandingPage />);

    // Check step numbers
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    // Check step descriptions
    expect(screen.getByText(/Select your favorite drivers/)).toBeInTheDocument();
    expect(screen.getByText(/Create or join leagues/)).toBeInTheDocument();
    expect(screen.getByText(/Earn points based on real F1/)).toBeInTheDocument();
  });

  it('should display all social proof statistics', () => {
    renderWithRouter(<LandingPage />);

    expect(screen.getByText('10K+')).toBeInTheDocument();
    expect(screen.getByText('500+')).toBeInTheDocument();
    expect(screen.getByText('50K+')).toBeInTheDocument();
    expect(screen.getByText('24/7')).toBeInTheDocument();

    expect(screen.getByText('Active Players')).toBeInTheDocument();
    expect(screen.getByText('Leagues Created')).toBeInTheDocument();
    expect(screen.getByText('Teams Built')).toBeInTheDocument();
    expect(screen.getByText('Live Scoring')).toBeInTheDocument();
  });

  it('should display CTA section with benefits', () => {
    renderWithRouter(<LandingPage />);

    expect(screen.getByText('Ready to Start Racing?')).toBeInTheDocument();
    expect(screen.getByText('Free to play')).toBeInTheDocument();
    expect(screen.getByText('No credit card required')).toBeInTheDocument();
    expect(screen.getByText('Start immediately')).toBeInTheDocument();
  });

  it('should display footer with brand name', () => {
    renderWithRouter(<LandingPage />);

    const brandElements = screen.getAllByText('F1 Fantasy Sports');
    expect(brandElements.length).toBe(2); // Appears in hero and footer
    expect(screen.getByText('© 2025 F1 Fantasy Sports. All rights reserved.')).toBeInTheDocument();
  });
});
