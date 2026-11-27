import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';

import type { ScenarioCardDetails } from 'applications/operationalStudies/types';

import ScenarioCard from '../ScenarioCard';

const scenario = {
  id: 42,
  name: 'My scenario',
  description: '',
  tags: [],
  infra_name: 'infra',
  train_schedules_count: 0,
  last_modification: '2024-01-01T00:00:00Z',
} as unknown as ScenarioCardDetails;

describe('ScenarioCard', () => {
  it('does not toggle selection when the card itself is clicked', () => {
    const toggleSelect = vi.fn();
    render(
      <MemoryRouter>
        <ScenarioCard
          setFilterChips={vi.fn()}
          scenario={scenario}
          isSelected={false}
          toggleSelect={toggleSelect}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('scenario-card-My scenario'));
    expect(toggleSelect).not.toHaveBeenCalled();
  });

  it('toggles selection when the checkbox is clicked', () => {
    const toggleSelect = vi.fn();
    render(
      <MemoryRouter>
        <ScenarioCard
          setFilterChips={vi.fn()}
          scenario={scenario}
          isSelected={false}
          toggleSelect={toggleSelect}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('scenario-card-select'));
    expect(toggleSelect).toHaveBeenCalledWith(42);
  });
});
