import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Layout } from './Layout';

// Render the real Layout but mock PageHeader to keep tests focused and deterministic
vi.mock('../PageHeader/PageHeader', () => ({
  PageHeader: () => <div data-testid="mock-page-header">Mock PageHeader</div>,
}));

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the PageHeader and outlet children', async () => {
    // Create test router with Layout as root component
    const rootRoute = createRootRoute({
      component: Layout,
    });

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => <div data-testid="home-child">Home Child</div>,
    });

    const routeTree = rootRoute.addChildren([indexRoute]);
    const memoryHistory = createMemoryHistory({ initialEntries: ['/'] });
    const router = createRouter({ routeTree, history: memoryHistory });

    render(<RouterProvider router={router} />);

    // Wait for router to initialize
    await waitFor(() => {
      // PageHeader should be present (mocked)
      expect(screen.getByTestId('mock-page-header')).toBeInTheDocument();

      // Outlet content should render
      expect(screen.getByTestId('home-child')).toBeInTheDocument();
      expect(screen.getByText('Home Child')).toBeVisible();
    });
  });

  it('renders nested routes inside the Outlet', async () => {
    // Create test router with Layout as root component
    const rootRoute = createRootRoute({
      component: Layout,
    });

    const dashboardRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/dashboard',
      component: () => <div data-testid="dashboard-child">Dashboard</div>,
    });

    const routeTree = rootRoute.addChildren([dashboardRoute]);
    const memoryHistory = createMemoryHistory({ initialEntries: ['/dashboard'] });
    const router = createRouter({ routeTree, history: memoryHistory });

    render(<RouterProvider router={router} />);

    // Wait for router to initialize
    await waitFor(() => {
      expect(screen.getByTestId('mock-page-header')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-child')).toBeInTheDocument();
      expect(screen.getByText('Dashboard')).toBeVisible();
    });
  });
});
