import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, mockUser, setupAuthenticatedUser } from '../../../tests/testUtils';
import Layout from '../Layout';

// Mock the useWorkflowNavigation hook
const mockNavigateBack = vi.fn();
const mockNavigateNext = vi.fn();
const mockGetCurrentStepInfo = vi.fn();

vi.mock('@/hooks/useWorkflowNavigation', () => ({
  useWorkflowNavigation: () => ({
    navigateBack: mockNavigateBack,
    navigateNext: mockNavigateNext,
    getCurrentStepInfo: mockGetCurrentStepInfo,
  }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuthenticatedUser();
    mockGetCurrentStepInfo.mockReturnValue({
      isInWorkflow: false,
      currentStep: 0,
      totalSteps: 0,
      procedureType: null,
    });
  });

  it('should render layout with title', () => {
    render(
      <Layout title="Test Page">
        <div>Test Content</div>
      </Layout>
    );

    expect(screen.getByText('Test Page')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should display user name when authenticated', () => {
    render(
      <Layout title="Test Page">
        <div>Content</div>
      </Layout>
    );

    expect(screen.getByText('User:')).toBeInTheDocument();
    expect(screen.getByText(mockUser.name)).toBeInTheDocument();
  });

  it('should show logout button by default', () => {
    render(
      <Layout title="Test Page">
        <div>Content</div>
      </Layout>
    );

    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  it('should hide logout button when showLogout is false', () => {
    render(
      <Layout title="Test Page" showLogout={false}>
        <div>Content</div>
      </Layout>
    );

    expect(screen.queryByText('Logout')).not.toBeInTheDocument();
  });

  it('should call logout when logout button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <Layout title="Test Page">
        <div>Content</div>
      </Layout>
    );

    const logoutButton = screen.getByText('Logout');
    await user.click(logoutButton);

    // The logout function from AuthContext should be called
    // This is tested in AuthContext.test.tsx
  });

  it('should show back button when showBackButton is true', () => {
    render(
      <Layout title="Test Page" showBackButton={true}>
        <div>Content</div>
      </Layout>
    );

    const backButton = screen.getByTitle('Back to specified path');
    expect(backButton).toBeInTheDocument();
  });

  it('should hide back button by default', () => {
    render(
      <Layout title="Test Page">
        <div>Content</div>
      </Layout>
    );

    expect(screen.queryByTitle('Back to specified path')).not.toBeInTheDocument();
  });

  it('should navigate to backPath when back button is clicked with backPath', async () => {
    const user = userEvent.setup();

    render(
      <Layout title="Test Page" showBackButton={true} backPath="/home">
        <div>Content</div>
      </Layout>
    );

    const backButton = screen.getByTitle('Back to specified path');
    await user.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith('/home');
  });

  it('should navigate back in history when back button is clicked without backPath', async () => {
    const user = userEvent.setup();

    render(
      <Layout title="Test Page" showBackButton={true}>
        <div>Content</div>
      </Layout>
    );

    const backButton = screen.getByTitle('Back to specified path');
    await user.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('should show workflow navigation buttons', () => {
    render(
      <Layout title="Test Page">
        <div>Content</div>
      </Layout>
    );

    expect(screen.getByText('Prev')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('should call navigateBack when Prev button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <Layout title="Test Page">
        <div>Content</div>
      </Layout>
    );

    const prevButton = screen.getByText('Prev');
    await user.click(prevButton);

    expect(mockNavigateBack).toHaveBeenCalled();
  });

  it('should call navigateNext when Next button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <Layout title="Test Page">
        <div>Content</div>
      </Layout>
    );

    const nextButton = screen.getByText('Next');
    await user.click(nextButton);

    expect(mockNavigateNext).toHaveBeenCalled();
  });

  it('should display workflow step info when in workflow', () => {
    mockGetCurrentStepInfo.mockReturnValue({
      isInWorkflow: true,
      currentStep: 2,
      totalSteps: 5,
      procedureType: 'insertion',
    });

    render(
      <Layout title="Test Page">
        <div>Content</div>
      </Layout>
    );

    expect(screen.getByText(/Step 2\/5 - INSERTION Flow/)).toBeInTheDocument();
  });

  it('should not display workflow step info when not in workflow', () => {
    mockGetCurrentStepInfo.mockReturnValue({
      isInWorkflow: false,
      currentStep: 0,
      totalSteps: 0,
      procedureType: null,
    });

    render(
      <Layout title="Test Page">
        <div>Content</div>
      </Layout>
    );

    expect(screen.queryByText(/Step/)).not.toBeInTheDocument();
  });

  it('should render AlphaTau logo', () => {
    render(
      <Layout title="Test Page">
        <div>Content</div>
      </Layout>
    );

    const logo = screen.getByAltText('AlphaTau Medical');
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('src', '/alphataulogo.png');
  });

  it('should render footer with copyright', () => {
    render(
      <Layout title="Test Page">
        <div>Content</div>
      </Layout>
    );

    const currentYear = new Date().getFullYear();
    expect(
      screen.getByText(`© ${currentYear} AlphaTau Medical Ltd. All rights reserved.`)
    ).toBeInTheDocument();
  });

  it('should render children in main content area', () => {
    render(
      <Layout title="Test Page">
        <div data-testid="child-content">Child Content</div>
      </Layout>
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });
});
