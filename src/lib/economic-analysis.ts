import { startOfHour } from 'date-fns';

export interface SpotPrice {
  timestamp: Date;
  priceCtKwh: number;
}

export interface EconomicAnalysisParams {
  consumerData: Array<{ timestamp: Date; value: number }>;
  producerData: Array<{ timestamp: Date; value: number }>;
  spotPrices: SpotPrice[];
  egPrice: number;
  markup: number;
  consumerUnit?: 'kW' | 'kWh';
  producerUnit?: 'kW' | 'kWh';
}

export interface EconomicAnalysisResult {
  hoursWithProduction: number;
  totalHours: number;
  avgProduction: number;
  hoursEgCheaper: number;
  hoursSpotCheaper: number;
  avgSpotPrice: number;
  totalSavings: number;
  totalLoss: number;
  netSavings: number;
  totalConsumptionKwh: number;
  totalProductionKwh: number;
  totalActuallyConsumedKwh: number;
  timePeriod: {
    startDate: Date;
    endDate: Date;
    year?: number;
  };
  hourlyResults: Array<{
    hour: Date;
    spotPrice: number;
    totalSpotPrice: number;
    egPrice: number;
    difference: number;
    consumption: number;
    consumptionKw: number;
    production: number;
    productionKwh: number;
    actuallyConsumed: number;
    savings: number;
  }>;
  topSavingsDays: Array<{
    date: string;
    savings: number;
  }>;
}

export function performEconomicAnalysis(params: EconomicAnalysisParams): EconomicAnalysisResult {
  const {
    consumerData,
    producerData,
    spotPrices,
    egPrice,
    markup,
    consumerUnit = 'kW',
    producerUnit = 'kW'
  } = params;

  console.log('Economic Analysis - Input:', {
    consumerDataLength: consumerData.length,
    producerDataLength: producerData.length,
    spotPricesLength: spotPrices.length,
    egPrice,
    markup,
    sampleConsumer: consumerData[0],
    sampleProducer: producerData[0],
    sampleSpot: spotPrices[0],
  });

  function makeHourKey(date: Date): string {
    const h = startOfHour(date);
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')} ${String(h.getHours()).padStart(2, '0')}:00`;
  }

  const spotPriceMap = new Map<string, number>();
  spotPrices.forEach(sp => {
    const hourKey = makeHourKey(sp.timestamp);
    spotPriceMap.set(hourKey, sp.priceCtKwh);
  });

  console.log('Spot price map sample:', {
    mapSize: spotPriceMap.size,
    firstKeys: Array.from(spotPriceMap.keys()).slice(0, 3),
    firstValues: Array.from(spotPriceMap.values()).slice(0, 3)
  });

  const hourlyData = new Map<string, {
    consumption: number[];
    production: number[];
  }>();

  consumerData.forEach(point => {
    const hourKey = makeHourKey(point.timestamp);
    if (!hourlyData.has(hourKey)) {
      hourlyData.set(hourKey, { consumption: [], production: [] });
    }
    hourlyData.get(hourKey)!.consumption.push(point.value);
  });

  producerData.forEach(point => {
    const hourKey = makeHourKey(point.timestamp);
    if (!hourlyData.has(hourKey)) {
      hourlyData.set(hourKey, { consumption: [], production: [] });
    }
    hourlyData.get(hourKey)!.production.push(point.value);
  });

  const hourlyResults: EconomicAnalysisResult['hourlyResults'] = [];
  let totalSavings = 0;
  let totalLoss = 0;
  let hoursWithProduction = 0;
  let hoursEgCheaper = 0;
  let hoursSpotCheaper = 0;
  let totalProductionSum = 0;
  let totalSpotPriceSum = 0;
  let spotPriceCount = 0;
  let totalConsumptionKwh = 0;
  let totalProductionKwh = 0;
  let totalActuallyConsumedKwh = 0;

  let debugCounter = 0;
  hourlyData.forEach((data, hourKey) => {
    const hour = new Date(hourKey);

    if (data.production.length === 0) return;

    const productionSum = data.production.reduce((sum, val) => sum + val, 0);
    // Wenn die Daten in kW sind (Leistung), Durchschnitt nehmen
    // Wenn die Daten bereits in kWh sind (Energie), summieren und in kW umrechnen für Vergleichbarkeit
    const productionKw = producerUnit === 'kW'
      ? productionSum / data.production.length  // Durchschnitt der kW-Werte
      : (productionSum * 4) / data.production.length;  // kWh → kW: (Summe * 4) / Anzahl

    if (debugCounter < 3) {
      console.log('Debug hour:', {
        hourKey,
        productionValues: data.production,
        productionSum,
        productionLength: data.production.length,
        productionKw,
        producerUnit,
        consumptionValues: data.consumption,
      });
      debugCounter++;
    }

    if (!isFinite(productionKw) || productionKw <= 0) return;

    hoursWithProduction++;
    totalProductionSum += productionKw;

    const spotPrice = spotPriceMap.get(hourKey);
    if (debugCounter < 5) {
      console.log('Spot price lookup:', {
        hourKey,
        spotPrice,
        hasSpotPrice: spotPrice !== undefined
      });
    }
    if (spotPrice === undefined || !isFinite(spotPrice)) return;

    const consumptionSum = data.consumption.reduce((sum, val) => sum + val, 0);
    // Wenn die Daten in kW sind (Leistung), in kWh umrechnen: kW * 0.25h = kWh
    // Wenn die Daten bereits in kWh sind (Energie), direkt verwenden
    const consumptionKwh = consumerUnit === 'kW'
      ? consumptionSum * 0.25
      : consumptionSum;

    // Für die Chart: Durchschnittsleistung in kW berechnen
    const consumptionKw = consumerUnit === 'kW'
      ? consumptionSum / data.consumption.length  // Durchschnitt der kW-Werte
      : (consumptionSum * 4) / data.consumption.length;  // kWh → kW

    if (!isFinite(consumptionKwh)) return;

    // Production ebenfalls in kWh umrechnen
    const productionKwh = producerUnit === 'kW'
      ? productionSum * 0.25  // kW → kWh für eine Stunde
      : productionSum;

    // WICHTIG: Nur die tatsächlich abnehmbare Menge verwenden!
    // Wenn PV 100 kWh liefert, Kunde aber 500 kWh braucht → nur 100 kWh zählen
    const actuallyConsumedKwh = Math.min(consumptionKwh, productionKwh);

    // Akkumuliere Gesamtwerte
    totalConsumptionKwh += consumptionKwh;
    totalProductionKwh += productionKwh;
    totalActuallyConsumedKwh += actuallyConsumedKwh;

    const totalSpotPrice = spotPrice + markup;

    // Berechnung der Kosten für beide Szenarien (in ct)
    const costWithPPA = actuallyConsumedKwh * egPrice;  // Kosten wenn vom PV (EG-Preis)
    const costWithSpot = actuallyConsumedKwh * totalSpotPrice;  // Kosten wenn vom Spot-Markt

    // Ersparnis = Was würde Spot kosten - Was kostet PPA (in Cent!)
    // Umrechnung in Euro: / 100
    // Positiv = PPA ist günstiger (Ersparnis)
    // Negativ = Spot ist günstiger (Verlust für PPA-Käufer)
    const savings = (costWithSpot - costWithPPA) / 100;  // Cent → Euro
    const difference = totalSpotPrice - egPrice;

    totalSpotPriceSum += spotPrice;
    spotPriceCount++;

    if (savings > 0) {
      // PPA ist günstiger als Spot → Ersparnis für Kunde
      hoursEgCheaper++;
      totalSavings += savings;
    } else {
      // Spot ist günstiger als PPA → Verlust für Kunde
      hoursSpotCheaper++;
      totalLoss += Math.abs(savings);
    }

    hourlyResults.push({
      hour,
      spotPrice,
      totalSpotPrice,
      egPrice,
      difference,
      consumption: consumptionKwh,
      consumptionKw,
      production: productionKw,
      productionKwh,
      actuallyConsumed: actuallyConsumedKwh,
      savings,
    });
  });

  const avgProduction = hoursWithProduction > 0 ? totalProductionSum / hoursWithProduction : 0;
  const avgSpotPrice = spotPriceCount > 0 ? totalSpotPriceSum / spotPriceCount : 0;
  const netSavings = totalSavings - totalLoss;

  console.log('Economic Analysis - Results:', {
    hoursWithProduction,
    totalProductionSum,
    avgProduction,
    hoursEgCheaper,
    hoursSpotCheaper,
    avgSpotPrice,
    totalSavings,
    totalLoss,
    netSavings,
    hourlyResultsCount: hourlyResults.length,
  });

  const dailySavings = new Map<string, number>();
  hourlyResults.forEach(result => {
    const dateKey = result.hour.toISOString().split('T')[0];
    dailySavings.set(dateKey, (dailySavings.get(dateKey) || 0) + result.savings);
  });

  const topSavingsDays = Array.from(dailySavings.entries())
    .map(([date, savings]) => ({ date, savings }))
    .sort((a, b) => b.savings - a.savings)
    .slice(0, 5);

  const allDates = hourlyResults.map(h => h.hour);
  const startDate = allDates.length > 0 ? new Date(Math.min(...allDates.map(d => d.getTime()))) : new Date();
  const endDate = allDates.length > 0 ? new Date(Math.max(...allDates.map(d => d.getTime()))) : new Date();
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  const year = startYear === endYear ? startYear : undefined;

  return {
    hoursWithProduction,
    totalHours: hourlyData.size,
    avgProduction,
    hoursEgCheaper,
    hoursSpotCheaper,
    avgSpotPrice,
    totalSavings,
    totalLoss,
    netSavings,
    totalConsumptionKwh,
    totalProductionKwh,
    totalActuallyConsumedKwh,
    timePeriod: {
      startDate,
      endDate,
      year,
    },
    hourlyResults,
    topSavingsDays,
  };
}
