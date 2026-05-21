import { startOfHour } from 'date-fns';

export interface EnergyOverlapResult {
  totalConsumptionKwh: number;
  totalProductionKwh: number;
  totalActuallyConsumedKwh: number;
  utilizationRate: number;
}

export function calculateEnergyOverlap(
  consumerData: Array<{ timestamp: Date; power_kw: number }>,
  producerData: Array<{ timestamp: Date; power_kw: number }>,
  consumerUnit: 'kW' | 'kWh' = 'kW',
  producerUnit: 'kW' | 'kWh' = 'kW'
): EnergyOverlapResult {
  console.log('calculateEnergyOverlap called with:', {
    consumerDataLength: consumerData.length,
    producerDataLength: producerData.length,
    consumerUnit,
    producerUnit,
    sampleConsumer: consumerData[0],
    sampleProducer: producerData[0],
    consumerKeys: consumerData[0] ? Object.keys(consumerData[0]) : [],
    producerKeys: producerData[0] ? Object.keys(producerData[0]) : []
  });

  // Create hour key WITHOUT timezone conversion
  function makeHourKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
  }

  const hourlyData = new Map<string, {
    consumption: number[];
    production: number[];
  }>();

  consumerData.forEach(point => {
    const hourKey = makeHourKey(startOfHour(point.timestamp));
    if (!hourlyData.has(hourKey)) {
      hourlyData.set(hourKey, { consumption: [], production: [] });
    }
    hourlyData.get(hourKey)!.consumption.push(point.power_kw);
  });

  producerData.forEach(point => {
    const hourKey = makeHourKey(startOfHour(point.timestamp));
    if (!hourlyData.has(hourKey)) {
      hourlyData.set(hourKey, { consumption: [], production: [] });
    }
    hourlyData.get(hourKey)!.production.push(point.power_kw);
  });

  console.log('Hourly data size:', hourlyData.size);

  let totalConsumptionKwh = 0;
  let totalProductionKwh = 0;
  let totalActuallyConsumedKwh = 0;

  let debugCount = 0;
  hourlyData.forEach((data, hourKey) => {
    if (debugCount < 3) {
      console.log('Raw data sample:', {
        consumption: data.consumption.slice(0, 2),
        production: data.production.slice(0, 2)
      });
    }

    const consumptionSum = data.consumption.reduce((sum, val) => {
      const numVal = typeof val === 'number' ? val : parseFloat(String(val));
      return sum + (isNaN(numVal) ? 0 : numVal);
    }, 0);
    const consumptionKwh = consumerUnit === 'kW'
      ? consumptionSum * 0.25
      : consumptionSum;

    const productionSum = data.production.reduce((sum, val) => {
      const numVal = typeof val === 'number' ? val : parseFloat(String(val));
      return sum + (isNaN(numVal) ? 0 : numVal);
    }, 0);
    const productionKwh = producerUnit === 'kW'
      ? productionSum * 0.25
      : productionSum;

    const actuallyConsumedKwh = Math.min(consumptionKwh, productionKwh);

    if (debugCount < 3) {
      console.log('Hour calculation:', {
        hourKey,
        consumptionValues: data.consumption.length,
        productionValues: data.production.length,
        consumptionSum,
        productionSum,
        consumptionKwh,
        productionKwh,
        actuallyConsumedKwh
      });
      debugCount++;
    }

    totalConsumptionKwh += consumptionKwh;
    totalProductionKwh += productionKwh;
    totalActuallyConsumedKwh += actuallyConsumedKwh;
  });

  const utilizationRate = totalProductionKwh > 0
    ? (totalActuallyConsumedKwh / totalProductionKwh) * 100
    : 0;

  console.log('Final totals:', {
    totalConsumptionKwh,
    totalProductionKwh,
    totalActuallyConsumedKwh,
    utilizationRate
  });

  return {
    totalConsumptionKwh,
    totalProductionKwh,
    totalActuallyConsumedKwh,
    utilizationRate,
  };
}
