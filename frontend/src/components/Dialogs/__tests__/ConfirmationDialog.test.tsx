import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../../../../tests/testUtils';
import ConfirmationDialog from '../ConfirmationDialog';

describe('ConfirmationDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onConfirm: mockOnConfirm,
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render dialog when isOpen is true', () => {
    render(<ConfirmationDialog {...defaultProps} />);

    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
  });

  it('should not render dialog when isOpen is false', () => {
    render(<ConfirmationDialog {...defaultProps} isOpen={false} />);

    expect(screen.queryByText('Confirm Action')).not.toBeInTheDocument();
  });

  it('should display default button text', () => {
    render(<ConfirmationDialog {...defaultProps} />);

    expect(screen.getByText('Continue')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should display custom button text', () => {
    render(
      <ConfirmationDialog
        {...defaultProps}
        confirmText="Delete"
        cancelText="Go Back"
      />
    );

    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Go Back')).toBeInTheDocument();
  });

  it('should call onConfirm when confirm button is clicked', async () => {
    const user = userEvent.setup();
    render(<ConfirmationDialog {...defaultProps} />);

    const confirmButton = screen.getByText('Continue');
    await user.click(confirmButton);

    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<ConfirmationDialog {...defaultProps} />);

    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should disable buttons when loading is true', () => {
    render(<ConfirmationDialog {...defaultProps} loading={true} />);

    const confirmButton = screen.getByText('Processing...');
    const cancelButton = screen.getByText('Cancel');

    expect(confirmButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
  });

  it('should show "Processing..." text when loading', () => {
    render(<ConfirmationDialog {...defaultProps} loading={true} />);

    expect(screen.getByText('Processing...')).toBeInTheDocument();
    expect(screen.queryByText('Continue')).not.toBeInTheDocument();
  });

  it('should render warning type with correct icon', () => {
    const { container } = render(
      <ConfirmationDialog {...defaultProps} type="warning" />
    );

    const icon = container.querySelector('.text-yellow-600');
    expect(icon).toBeInTheDocument();
  });

  it('should render success type with correct icon', () => {
    const { container } = render(
      <ConfirmationDialog {...defaultProps} type="success" />
    );

    const icon = container.querySelector('.text-green-600');
    expect(icon).toBeInTheDocument();
  });

  it('should render error type with correct icon', () => {
    const { container } = render(
      <ConfirmationDialog {...defaultProps} type="error" />
    );

    const icon = container.querySelector('.text-red-600');
    expect(icon).toBeInTheDocument();
  });

  it('should render info type with correct icon', () => {
    const { container } = render(
      <ConfirmationDialog {...defaultProps} type="info" />
    );

    const icon = container.querySelector('.text-blue-600');
    expect(icon).toBeInTheDocument();
  });

  it('should handle multiline messages', () => {
    render(
      <ConfirmationDialog
        {...defaultProps}
        message="Line 1\nLine 2\nLine 3"
      />
    );

    expect(screen.getByText(/Line 1/)).toBeInTheDocument();
  });

  it('should have correct button styling for warning type', () => {
    render(
      <ConfirmationDialog {...defaultProps} type="warning" />
    );

    const confirmButton = screen.getByText('Continue');
    expect(confirmButton).toHaveClass('bg-yellow-600');
  });

  it('should have correct button styling for success type', () => {
    render(
      <ConfirmationDialog {...defaultProps} type="success" />
    );

    const confirmButton = screen.getByText('Continue');
    expect(confirmButton).toHaveClass('bg-green-600');
  });

  it('should have correct button styling for error type', () => {
    render(
      <ConfirmationDialog {...defaultProps} type="error" />
    );

    const confirmButton = screen.getByText('Continue');
    expect(confirmButton).toHaveClass('bg-red-600');
  });

  it('should have correct button styling for info type', () => {
    render(
      <ConfirmationDialog {...defaultProps} type="info" />
    );

    const confirmButton = screen.getByText('Continue');
    expect(confirmButton).toHaveClass('bg-blue-600');
  });

  it('should not call onConfirm when button is disabled', async () => {
    const user = userEvent.setup();
    render(<ConfirmationDialog {...defaultProps} loading={true} />);

    const confirmButton = screen.getByText('Processing...');
    await user.click(confirmButton);

    // Should not be called because button is disabled
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  it('should not call onClose when cancel button is disabled', async () => {
    const user = userEvent.setup();
    render(<ConfirmationDialog {...defaultProps} loading={true} />);

    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    // Should not be called because button is disabled
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('should render with dialog panel styling', () => {
    const { container } = render(<ConfirmationDialog {...defaultProps} />);

    const panel = container.querySelector('.rounded-2xl.bg-white');
    expect(panel).toBeInTheDocument();
  });

  it('should render title with correct styling', () => {
    render(<ConfirmationDialog {...defaultProps} />);

    const title = screen.getByText('Confirm Action');
    expect(title).toHaveClass('text-lg', 'font-medium');
  });
});
