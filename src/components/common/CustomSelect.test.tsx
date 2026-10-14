import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CustomSelect, SelectOption } from './CustomSelect';

describe('CustomSelect component', () => {
  const options: SelectOption[] = [
    { value: 'neoforge', label: 'NeoForge' },
    { value: 'fabric', label: 'Fabric' },
    { value: 'forge', label: 'Forge' },
    { value: 'quilt', label: 'Quilt' },
    { value: 'vanilla', label: 'Vanilla' },
  ];

  it('renders selected option label and closed state by default', () => {
    render(
      <CustomSelect
        value="fabric"
        onChange={vi.fn()}
        options={options}
      />
    );

    const trigger = screen.getByRole('button', { expanded: false });
    expect(trigger).toBeDefined();
    expect(screen.getByText('Fabric')).toBeDefined();
    expect(screen.queryByRole('button', { name: /neoforge/i })).toBeNull();
  });

  it('opens dropdown menu on click and displays all options', () => {
    render(
      <CustomSelect
        value="fabric"
        onChange={vi.fn()}
        options={options}
      />
    );

    const trigger = screen.getByRole('button', { expanded: false });
    fireEvent.click(trigger);

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: /neoforge/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /vanilla/i })).toBeDefined();
  });

  it('triggers onChange and closes menu when selecting an option', () => {
    const handleChange = vi.fn();
    render(
      <CustomSelect
        value="fabric"
        onChange={handleChange}
        options={options}
      />
    );

    fireEvent.click(screen.getByRole('button', { expanded: false }));

    const optionBtn = screen.getByRole('button', { name: /quilt/i });
    fireEvent.click(optionBtn);

    expect(handleChange).toHaveBeenCalledWith('quilt');
    expect(screen.queryByRole('button', { name: /neoforge/i })).toBeNull();
  });

  it('closes menu on Escape key press', () => {
    render(
      <CustomSelect
        value="fabric"
        onChange={vi.fn()}
        options={options}
      />
    );

    const trigger = screen.getByRole('button', { expanded: false });
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('does not open when disabled', () => {
    render(
      <CustomSelect
        value="fabric"
        onChange={vi.fn()}
        options={options}
        disabled
      />
    );

    const trigger = screen.getByRole('button');
    expect(trigger.hasAttribute('disabled')).toBe(true);
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});
