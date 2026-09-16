import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AmbientBubbles } from './AmbientBubbles';

describe('AmbientBubbles', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render the correct number of bubbles', () => {
    const count = 10;
    render(<AmbientBubbles count={count} />);
    const bubbles = screen.getAllByRole('generic', { name: /bubble/i });
    expect(bubbles).toHaveLength(count);
  });

  it('should render the default number of bubbles when count is not provided', () => {
    render(<AmbientBubbles />);
    const bubbles = screen.getAllByRole('generic', { name: /bubble/i });
    expect(bubbles).toHaveLength(25);
  });

  it('should render bubbles with correct styles', () => {
    const count = 1;
    render(<AmbientBubbles count={count} />);
    const bubble = screen.getByRole('generic', { name: /bubble/i });
    const style = window.getComputedStyle(bubble);

    expect(style.width).not.toBe('');
    expect(style.height).not.toBe('');
    expect(style.left).not.toBe('');
    expect(style.animationDuration).not.toBe('');
    expect(style.animationDelay).not.toBe('');
    expect(style.opacity).not.toBe('');
  });

  it('should handle count boundary values', () => {
    const minCount = 0;
    const maxCount = 50;
    render(<AmbientBubbles count={minCount} />);
    let bubbles = screen.queryAllByRole('generic', { name: /bubble/i });
    expect(bubbles).toHaveLength(minCount);

    render(<AmbientBubbles count={maxCount} />);
    bubbles = screen.getAllByRole('generic', { name: /bubble/i });
    expect(bubbles).toHaveLength(maxCount);
  });

  it('should generate bubbles with valid properties', () => {
    const count = 1;
    render(<AmbientBubbles count={count} />);
    const bubble = screen.getByRole('generic', { name: /bubble/i });
    const style = window.getComputedStyle(bubble);

    const size = parseFloat(style.width);
    const left = parseFloat(style.left);
    const duration = parseFloat(style.animationDuration);
    const delay = parseFloat(style.animationDelay);
    const opacity = parseFloat(style.opacity);

    expect(size).toBeGreaterThanOrEqual(6);
    expect(size).toBeLessThanOrEqual(26);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(left).toBeLessThanOrEqual(100);
    expect(duration).toBeGreaterThanOrEqual(6);
    expect(duration).toBeLessThanOrEqual(14);
    expect(delay).toBeGreaterThanOrEqual(0);
    expect(delay).toBeLessThanOrEqual(6);
    expect(opacity).toBeGreaterThanOrEqual(0.15);
    expect(opacity).toBeLessThanOrEqual(0.6);
  });
});
