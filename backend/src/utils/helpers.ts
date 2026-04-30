import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a new UUID
 */
export const newId = (): string => {
  return uuidv4();
};

/**
 * Get current ISO timestamp
 */
export const nowIso = (): string => {
  return new Date().toISOString();
};

/**
 * Generate realistic price history using mean-reverting random walk
 */
export const generatePriceHistory = (startPrice: number, numPoints: number = 200): number[] => {
  const prices: number[] = [startPrice];
  const meanReversion = 0.1;
  const volatility = 0.02;
  const mean = startPrice;

  for (let i = 1; i < numPoints; i++) {
    const lastPrice = prices[i - 1];
    const drift = meanReversion * (mean - lastPrice) / mean;
    const randomShock = volatility * (Math.random() - 0.5);
    const newPrice = lastPrice * (1 + drift + randomShock);
    prices.push(Math.max(newPrice, startPrice * 0.5)); // Floor at 50% of start price
  }

  return prices;
};

/**
 * Calculate statistics for a dataset
 */
export const calculateStats = (values: number[]) => {
  if (values.length === 0) return null;

  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;
  const variance = values.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return {
    mean,
    min: Math.min(...values),
    max: Math.max(...values),
    stdDev,
    count: values.length,
  };
};
