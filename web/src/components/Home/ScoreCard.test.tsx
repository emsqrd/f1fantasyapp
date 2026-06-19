import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ScoreCard } from './ScoreCard';

describe('ScoreCard', () => {
  it('renders the eyebrow and title', () => {
    render(<ScoreCard eyebrow="Last race stats" title="Monaco Grand Prix" score={47} />);

    expect(screen.getByText('Last race stats')).toBeInTheDocument();
    expect(screen.getByText('Monaco Grand Prix')).toBeInTheDocument();
  });

  it('formats the score with a thousands separator and a "pts" suffix', () => {
    render(<ScoreCard eyebrow="Season stats" title="Total" score={1234} />);

    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('pts')).toBeInTheDocument();
  });

  it('renders an em-dash and no "pts" suffix when the score is null', () => {
    render(<ScoreCard eyebrow="Season stats" title="Total" score={null} />);

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('pts')).not.toBeInTheDocument();
  });
});
