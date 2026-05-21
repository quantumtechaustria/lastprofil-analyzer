import { startOfHour, startOfDay } from 'date-fns';

export interface SpotPriceCostResult {
  totalConsumptionKwh: number;
  totalCostEur: number;
  averagePriceCtKwh: number;
  hourlyResults: Array<{
    timestamp: Date;
    consumptionKwh: number;
    priceCtKwh: number;
    costEur: number;
  }>;
  dailyResults: Array<{
    date: Date;
    consumptionKwh: number;
    costEur: number;
    avgPriceCtKwh: number;
  }>;
  monthlyResults: Array<{
    month: string;
    consumptionKwh: number;
    costEur: number;
    avgPriceCtKwh: number;
  }>;
  quarterHourResults: Array<{
    timestamp: Date;
    consumptionKwh: number;
    priceCtKwh: number;
    costEur: number;
  }>;
}

export function calculateSpotPriceCosts(
  loadProfileData: Array<{ timestamp: Date; power_kw: number }>,
  spotPrices: Array<{ timestamp: Date; priceCtKwh: number }>,
  dataUnit: 'kW' | 'kWh' = 'kW'
): SpotPriceCostResult {
  console.log('Spot Price Cost Calculation - Input:', {
    loadProfileDataLength: loadProfileData.length,
    spotPricesLength: spotPrices.length,
    dataUnit,
    firstLoadData: loadProfileData[0],
    firstSpotPrice: spotPrices[0],
  });

  function makeKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  const spotPriceMap = new Map<string, number>();

  spotPrices.forEach(sp => {
    const key = makeKey(sp.timestamp);
    spotPriceMap.set(key, sp.priceCtKwh);
  });

  console.log('Spot price map created:', {
    mapSize: spotPriceMap.size,
  });

  const quarterHourResults: Array<{
    timestamp: Date;
    consumptionKwh: number;
    priceCtKwh: number;
    costEur: number;
  }> = [];

  let totalConsumptionKwh = 0;
  let totalCostEur = 0;
  let totalWeightedPrice = 0;

  let matchedCount = 0;
  let unmatchedCount = 0;

  loadProfileData.forEach(point => {
    const key = makeKey(point.timestamp);
    const spotPrice = spotPriceMap.get(key);

    if (spotPrice === undefined) {
      unmatchedCount++;
      console.log('No spot price for:', key);
      return;
    }

    matchedCount++;
    const energyKwh = dataUnit === 'kW' ? point.power_kw * 0.25 : point.power_kw;
    const costEur = (energyKwh * spotPrice) / 100;

    totalConsumptionKwh += energyKwh;
    totalCostEur += costEur;
    totalWeightedPrice += spotPrice * energyKwh;

    quarterHourResults.push({
      timestamp: point.timestamp,
      consumptionKwh: energyKwh,
      priceCtKwh: spotPrice,
      costEur,
    });
  });

  console.log('Matching results:', { matchedCount, unmatchedCount });

  // Create hour key WITHOUT timezone conversion
  function makeHourKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
  }

  const hourlyMap = new Map<string, {
    consumptionKwh: number;
    costEur: number;
    weightedPrice: number;
  }>();

  quarterHourResults.forEach(qh => {
    const hourKey = makeHourKey(startOfHour(qh.timestamp));
    if (!hourlyMap.has(hourKey)) {
      hourlyMap.set(hourKey, { consumptionKwh: 0, costEur: 0, weightedPrice: 0 });
    }
    const hour = hourlyMap.get(hourKey)!;
    hour.consumptionKwh += qh.consumptionKwh;
    hour.costEur += qh.costEur;
    hour.weightedPrice += qh.priceCtKwh * qh.consumptionKwh;
  });

  const hourlyResults: SpotPriceCostResult['hourlyResults'] = Array.from(hourlyMap.entries())
    .map(([hourKey, data]) => ({
      timestamp: new Date(hourKey),
      consumptionKwh: data.consumptionKwh,
      priceCtKwh: data.consumptionKwh > 0 ? data.weightedPrice / data.consumptionKwh : 0,
      costEur: data.costEur,
    }))
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const averagePriceCtKwh = totalConsumptionKwh > 0
    ? totalWeightedPrice / totalConsumptionKwh
    : 0;

  // Create day key WITHOUT timezone conversion
  function makeDayKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  const dailyMap = new Map<string, {
    consumptionKwh: number;
    costEur: number;
    weightedPrice: number;
  }>();

  hourlyResults.forEach(result => {
    const dayKey = makeDayKey(startOfDay(result.timestamp));
    if (!dailyMap.has(dayKey)) {
      dailyMap.set(dayKey, { consumptionKwh: 0, costEur: 0, weightedPrice: 0 });
    }
    const day = dailyMap.get(dayKey)!;
    day.consumptionKwh += result.consumptionKwh;
    day.costEur += result.costEur;
    day.weightedPrice += result.priceCtKwh * result.consumptionKwh;
  });

  const dailyResults = Array.from(dailyMap.entries())
    .map(([dayKey, data]) => ({
      date: new Date(dayKey),
      consumptionKwh: data.consumptionKwh,
      costEur: data.costEur,
      avgPriceCtKwh: data.consumptionKwh > 0 ? data.weightedPrice / data.consumptionKwh : 0,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const monthlyMap = new Map<string, {
    consumptionKwh: number;
    costEur: number;
    weightedPrice: number;
  }>();

  hourlyResults.forEach(result => {
    const monthKey = `${result.timestamp.getFullYear()}-${String(result.timestamp.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, { consumptionKwh: 0, costEur: 0, weightedPrice: 0 });
    }
    const month = monthlyMap.get(monthKey)!;
    month.consumptionKwh += result.consumptionKwh;
    month.costEur += result.costEur;
    month.weightedPrice += result.priceCtKwh * result.consumptionKwh;
  });

  const monthlyResults = Array.from(monthlyMap.entries())
    .map(([month, data]) => ({
      month,
      consumptionKwh: data.consumptionKwh,
      costEur: data.costEur,
      avgPriceCtKwh: data.consumptionKwh > 0 ? data.weightedPrice / data.consumptionKwh : 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const finalResult = {
    totalConsumptionKwh,
    totalCostEur,
    averagePriceCtKwh,
    hourlyResults,
    dailyResults,
    monthlyResults,
    quarterHourResults,
  };

  console.log('Spot Price Cost Calculation - Results:', {
    totalConsumptionKwh,
    totalCostEur,
    averagePriceCtKwh,
    hourlyResultsCount: hourlyResults.length,
    dailyResultsCount: dailyResults.length,
    monthlyResultsCount: monthlyResults.length,
    quarterHourResultsCount: quarterHourResults.length,
  });

  return finalResult;
}
