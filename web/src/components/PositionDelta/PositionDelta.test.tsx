import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PositionDelta } from './PositionDelta';

describe('PositionDelta', () => {
  it('renders an up arrow with the absolute value when value is positive', () => {
    render(<PositionDelta value={3} />);

    const span = screen.getByLabelText('Up 3 positions');
    expect(span).toHaveTextContent('↑');
    expect(span).toHaveTextContent('3');
  });

  it('renders a down arrow with the absolute value when value is negative', () => {
    render(<PositionDelta value={-2} />);

    const span = screen.getByLabelText('Down 2 positions');
    expect(span).toHaveTextContent('↓');
    expect(span).toHaveTextContent('2');
  });

  it('renders a flat dash when value is zero', () => {
    render(<PositionDelta value={0} />);

    const span = screen.getByLabelText('No position change');
    expect(span).toHaveTextContent('–');
  });

  it('renders a flat dash when value is null', () => {
    render(<PositionDelta value={null} />);

    const span = screen.getByLabelText('No position change');
    expect(span).toHaveTextContent('–');
  });

  it('marks the glyph as aria-hidden so the label is the only announced text', () => {
    render(<PositionDelta value={3} />);

    const wrapper = screen.getByLabelText('Up 3 positions');
    const glyph = wrapper.querySelector('[aria-hidden="true"]');
    expect(glyph).not.toBeNull();
    expect(glyph).toHaveTextContent('↑');
  });

  it('renders the inline variant with the same accessible name', () => {
    render(<PositionDelta value={-1} variant="inline" />);

    expect(screen.getByLabelText('Down 1 positions')).toBeInTheDocument();
  });
});
