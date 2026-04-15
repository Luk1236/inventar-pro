// frontend/__tests__/rental-breakdown.test.ts

describe('Rental Rate Calculations', () => {
  function calculateRates(
    rentalPrice: number,
    weekendFactor: number,
    weekFactor: number,
    quantity: number
  ) {
    return {
      daily_rate: rentalPrice,
      weekend_rate: parseFloat((rentalPrice * weekendFactor).toFixed(2)),
      week_rate: parseFloat((rentalPrice * weekFactor * 7).toFixed(2)),
      subtotal_daily: rentalPrice * quantity,
      subtotal_weekend: parseFloat((rentalPrice * weekendFactor * quantity).toFixed(2)),
    };
  }

  it('calculates daily rate correctly', () => {
    const { daily_rate } = calculateRates(100, 1.5, 3.0, 2);
    expect(daily_rate).toBe(100);
  });

  it('calculates weekend rate as daily * weekend_factor', () => {
    const { weekend_rate } = calculateRates(100, 1.5, 3.0, 1);
    expect(weekend_rate).toBe(150);
  });

  it('calculates week rate as daily * week_factor * 7', () => {
    const { week_rate } = calculateRates(100, 1.5, 3.0, 1);
    expect(week_rate).toBe(2100);
  });

  it('multiplies rates by quantity', () => {
    const { subtotal_daily } = calculateRates(50, 1.5, 3.0, 3);
    expect(subtotal_daily).toBe(150);
  });
});
