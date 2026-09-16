import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AmbientBubbles } from '../AmbientBubbles';

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
    const bubbles = screen.getAllByRole('generic', { name: /ambient-bubble/i });
    expect(bubbles).toHaveLength(count);
  });

  it('should render the default number of bubbles when count is not provided', () => {
    const defaultCount = 25;
    render(<AmbientBubbles />);
    const bubbles = screen.getAllByRole('generic', { name: /ambient-bubble/i });
    expect(bubbles).toHaveLength(defaultCount);
  });

  it('should render bubbles with valid size', () => {
    const count = 1;
    render(<AmbientBubbles count={count} />);
    const bubble = screen.getByRole('generic', { name: /ambient-bubble/i });
    const style = window.getComputedStyle(bubble);
    const size = parseFloat(style.width);
    expect(size).toBeGreaterThanOrEqual(6);
    expect(size).toBeLessThanOrEqual(25);
  });

  it('should render bubbles with valid left position', () => {
    const count = 1;
    render(<AmbientBubbles count={count} />);
    const bubble = screen.getByRole('generic', { name: /ambient-bubble/i });
    const style = window.getComputedStyle(bubble);
    const left = parseFloat(style.left);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(left).toBeLessThanOrEqual(100);
  });

  it('should render bubbles with valid duration', () => {
    const count = 1;
    render(<AmbientBubbles count={count} />);
    const bubble = screen.getByRole('generic', { name: /ambient-bubble/i });
    const style = window.getComputedStyle(bubble);
    const duration = parseFloat(style.animationDuration);
    expect(duration).toBeGreaterThanOrEqual(6);
    expect(duration).toBeLessThanOrEqual(14);
  });

  it('should render bubbles with valid delay', () => {
    const count = 1;
    render(<AmbientBubbles count={count} />);
    const bubble = screen.getByRole('generic', { name: /ambient-bubble/i });
    const style = window.getComputedStyle(bubble);
    const delay = parseFloat(style.animationDelay);
    expect(delay).toBeGreaterThanOrEqual(0);
    expect(delay).toBeLessThanOrEqual(6);
  });

  it('should render bubbles with valid opacity', () => {
    const count = 1;
    render(<AmbientBubbles count={count} />);
    const bubble = screen.getByRole('generic', { name: /ambient-bubble/i });
    const style = window.getComputedStyle(bubble);
    const opacity = parseFloat(style.opacity);
    expect(opacity).toBeGreaterThanOrEqual(0.15);
    expect(opacity).toBeLessThanOrEqual(0.6);
  });

  it('should not have any interactive elements', () => {
    render(<AmbientBubbles />);
    const buttons = screen.queryAllByRole('button');
    expect(buttons).toHaveLength(0);
  });
});
