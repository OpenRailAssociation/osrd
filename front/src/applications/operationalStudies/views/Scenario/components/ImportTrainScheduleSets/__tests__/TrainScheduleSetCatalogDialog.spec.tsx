import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import TrainScheduleSetCatalogDialog from '../TrainScheduleSetCatalogDialog';

vi.mock('../useLoadCatalog', () => ({
  default: () => ({
    loading: false,
    error: null,
    data: { catalog: new Map(), trainScheduleSets: new Map() },
    trainScheduleSetsAlreadyImported: new Set(),
  }),
}));

describe('TrainScheduleSetCatalogDialog', () => {
  it('should only imports once when the import button is double clicked', async () => {
    // the import never resolves, so the second click happens while it runs
    const onSubmit = vi.fn(() => new Promise<void>(() => {}));

    render(<TrainScheduleSetCatalogDialog onCancel={vi.fn()} onSubmit={onSubmit} />);

    await userEvent.setup().dblClick(screen.getByTestId('import-train-schedule-sets-button'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
