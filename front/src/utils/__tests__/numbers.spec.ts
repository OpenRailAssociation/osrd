import { budgetFormat } from 'utils/numbers';

describe('budgetFormat', () => {
  it('should return the complete number as a currency (€)', () => {
    expect(budgetFormat(45968493)).toBe('45\u202f968\u202f493\xa0€');
  });
});
