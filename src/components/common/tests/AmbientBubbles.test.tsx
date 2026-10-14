import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { AmbientBubbles } from '../AmbientBubbles';

describe('AmbientBubbles', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render the correct number of bubbles when count is provided', () => {
    const count = 10;
    const { container } = render(<AmbientBubbles count={count} />);
    const bubbles = container.querySelectorAll('.ambient-bubble');
    expect(bubbles).toHaveLength(count);
  });

  it('should render 22 bubbles by default matching web client', () => {
    const { container } = render(<AmbientBubbles />);
    const bubbles = container.querySelectorAll('.ambient-bubble');
    expect(bubbles).toHaveLength(22);
  });

  it('should render bubbles with valid dynamic styles', () => {
    const { container } = render(<AmbientBubbles count={1} />);
    const bubble = container.querySelector('.ambient-bubble') as HTMLElement;
    expect(bubble).not.toBeNull();

    expect(bubble.style.width).toMatch(/\d+(\.\d+)?px/);
    expect(bubble.style.height).toMatch(/\d+(\.\d+)?px/);
    expect(bubble.style.left).toMatch(/\d+(\.\d+)?(%|vw)/);
    expect(bubble.style.animationDuration).toMatch(/\d+(\.\d+)?s/);
    expect(bubble.style.animationDelay).toMatch(/\d+(\.\d+)?s/);

    const size = parseFloat(bubble.style.width);
    const left = parseFloat(bubble.style.left);
    const duration = parseFloat(bubble.style.animationDuration);
    const delay = parseFloat(bubble.style.animationDelay);

    expect(size).toBeGreaterThanOrEqual(14);
    expect(size).toBeLessThanOrEqual(38);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(left).toBeLessThanOrEqual(100);
    expect(duration).toBeGreaterThanOrEqual(9);
    expect(duration).toBeLessThanOrEqual(23);
    expect(delay).toBeGreaterThanOrEqual(-25);
    expect(delay).toBeLessThanOrEqual(18);
  });

  it('should not have any interactive elements', () => {
    const { container } = render(<AmbientBubbles />);
    const buttons = container.querySelectorAll('button, a, input');
    expect(buttons).toHaveLength(0);
  });
});
