import { NARROW_NO_BREAK_SPACE, NO_BREAK_SPACE } from 'utils/strings';
import { budgetFormat } from 'utils/numbers';

describe('budgetFormat', () => {
  it('should return the complete number as a currency (€)', () => {
    expect(budgetFormat(45968493)).toBe(
      `45${NARROW_NO_BREAK_SPACE}968${NARROW_NO_BREAK_SPACE}493${NO_BREAK_SPACE}€`
    );
  });
});
