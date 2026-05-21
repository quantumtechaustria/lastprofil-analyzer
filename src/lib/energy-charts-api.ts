export interface EnergyChartsApiResponse {
  license_info: string;
  unix_seconds: number[];
  price: number[];
  unit: string;
  deprecated?: boolean;
}

export interface EnergyChartsSpotPrice {
  timestamp: Date;
  priceEurMwh: number;
  priceCtKwh: number;
}

export interface EnergyChartsFetchResult {
  success: boolean;
  data?: EnergyChartsSpotPrice[];
  error?: string;
  dateRange?: {
    start: Date;
    end: Date;
    totalHours: number;
  };
  licenseInfo?: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export async function fetchSpotPricesFromEnergyCharts(
  startDate: Date,
  endDate: Date
): Promise<EnergyChartsFetchResult> {
  try {
    const allSpotPrices: EnergyChartsSpotPrice[] = [];
    let licenseInfo = '';

    const chunks = splitIntoMonthlyChunks(startDate, endDate);

    for (const chunk of chunks) {
      const startStr = formatDateForApi(chunk.start);
      const endStr = formatDateForApi(chunk.end);

      const url = `${SUPABASE_URL}/functions/v1/energy-charts-proxy?startDate=${startStr}&endDate=${endStr}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          return {
            success: false,
            error: 'API Rate Limit erreicht. Bitte versuchen Sie es später erneut.',
          };
        }
        return {
          success: false,
          error: `API Fehler: ${response.status} ${response.statusText}`,
        };
      }

      const apiData: EnergyChartsApiResponse = await response.json();

      if (!apiData.unix_seconds || !apiData.price) {
        return {
          success: false,
          error: 'Ungültige API Antwort: Fehlende Daten',
        };
      }

      if (apiData.unix_seconds.length === 0) {
        continue;
      }

      if (apiData.unix_seconds.length !== apiData.price.length) {
        return {
          success: false,
          error: 'Ungültige API Antwort: Datenlängen stimmen nicht überein',
        };
      }

      const chunkPrices: EnergyChartsSpotPrice[] = apiData.unix_seconds.map((unixSeconds, index) => {
        const timestamp = new Date(unixSeconds * 1000);

        const priceEurMwh = apiData.price[index];
        const priceCtKwh = priceEurMwh / 10;

        return {
          timestamp,
          priceEurMwh,
          priceCtKwh,
        };
      });

      allSpotPrices.push(...chunkPrices);

      if (apiData.license_info && !licenseInfo) {
        licenseInfo = apiData.license_info;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (allSpotPrices.length === 0) {
      return {
        success: false,
        error: 'Keine Daten für den ausgewählten Zeitraum verfügbar',
      };
    }

    allSpotPrices.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const dateRange = {
      start: allSpotPrices[0].timestamp,
      end: allSpotPrices[allSpotPrices.length - 1].timestamp,
      totalHours: allSpotPrices.length,
    };

    return {
      success: true,
      data: allSpotPrices,
      dateRange,
      licenseInfo,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler beim API-Abruf',
    };
  }
}

function splitIntoMonthlyChunks(startDate: Date, endDate: Date): Array<{ start: Date; end: Date }> {
  const chunks: Array<{ start: Date; end: Date }> = [];

  let currentStart = new Date(startDate);
  currentStart.setHours(0, 0, 0, 0);

  const finalEnd = new Date(endDate);
  finalEnd.setHours(23, 59, 59, 999);

  while (currentStart < finalEnd) {
    const currentEnd = new Date(currentStart);
    currentEnd.setMonth(currentEnd.getMonth() + 1);
    currentEnd.setDate(0);
    currentEnd.setHours(23, 59, 59, 999);

    if (currentEnd > finalEnd) {
      currentEnd.setTime(finalEnd.getTime());
    }

    chunks.push({
      start: new Date(currentStart),
      end: new Date(currentEnd),
    });

    currentStart = new Date(currentEnd);
    currentStart.setDate(currentStart.getDate() + 1);
    currentStart.setHours(0, 0, 0, 0);
  }

  return chunks;
}

function formatDateForApi(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function validateDateRange(startDate: Date, endDate: Date): string | null {
  if (startDate >= endDate) {
    return 'Enddatum muss nach dem Startdatum liegen';
  }

  const now = new Date();
  const maxDate = new Date(now);
  maxDate.setDate(maxDate.getDate() + 2);

  if (endDate > maxDate) {
    return 'Enddatum darf höchstens 2 Tage in der Zukunft liegen';
  }

  const minDate = new Date('2020-01-01');
  if (startDate < minDate) {
    return 'Startdatum darf nicht vor dem 01.01.2020 liegen';
  }

  return null;
}

export function getDefaultDateRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 30);
  start.setHours(0, 0, 0, 0);

  const end = new Date(now);
  end.setDate(end.getDate() + 1);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}
