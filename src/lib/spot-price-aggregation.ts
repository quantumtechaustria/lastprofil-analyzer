import {
  startOfYear,
  startOfMonth,
  startOfWeek,
  endOfYear,
  endOfMonth,
  endOfWeek,
  eachDayOfInterval,
  eachMonthOfInterval,
  isSameDay,
  isSameMonth,
} from 'date-fns';

export interface SpotPriceData {
  timestamp: Date;
  priceCtKwh: number;
}

export interface AggregatedSpotPrice {
  timestamp: Date;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  priceCtKwh: number;
}

export function aggregateSpotPricesByYear(
  data: SpotPriceData[],
  selectedDate: Date,
  mode: 'months' | 'days'
): AggregatedSpotPrice[] {
  if (isNaN(selectedDate.getTime())) return [];
  const yearStart = startOfYear(selectedDate);
  const yearEnd = endOfYear(selectedDate);

  if (mode === 'months') {
    const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });

    return months.map(month => {
      const monthData = data.filter(d => isSameMonth(d.timestamp, month));

      if (monthData.length === 0) {
        return {
          timestamp: month,
          avgPrice: 0,
          minPrice: 0,
          maxPrice: 0,
          priceCtKwh: 0,
        };
      }

      const prices = monthData.map(d => d.priceCtKwh);
      const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);

      return {
        timestamp: month,
        avgPrice,
        minPrice,
        maxPrice,
        priceCtKwh: avgPrice,
      };
    });
  } else {
    const days = eachDayOfInterval({ start: yearStart, end: yearEnd });

    return days
      .map(day => {
        const dayData = data.filter(d => isSameDay(d.timestamp, day));

        if (dayData.length === 0) return null;

        const prices = dayData.map(d => d.priceCtKwh);
        const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);

        return {
          timestamp: day,
          avgPrice,
          minPrice,
          maxPrice,
          priceCtKwh: avgPrice,
        };
      })
      .filter((d): d is AggregatedSpotPrice => d !== null);
  }
}

export function aggregateSpotPricesByMonth(
  data: SpotPriceData[],
  selectedDate: Date
): AggregatedSpotPrice[] {
  if (isNaN(selectedDate.getTime())) return [];
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  return days
    .map(day => {
      const dayData = data.filter(d => isSameDay(d.timestamp, day));

      if (dayData.length === 0) return null;

      const prices = dayData.map(d => d.priceCtKwh);
      const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);

      return {
        timestamp: day,
        avgPrice,
        minPrice,
        maxPrice,
        priceCtKwh: avgPrice,
      };
    })
    .filter((d): d is AggregatedSpotPrice => d !== null);
}

export function aggregateSpotPricesByWeek(
  data: SpotPriceData[],
  selectedDate: Date
): AggregatedSpotPrice[] {
  if (isNaN(selectedDate.getTime())) return [];
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  return days
    .map(day => {
      const dayData = data.filter(d => isSameDay(d.timestamp, day));

      if (dayData.length === 0) return null;

      const prices = dayData.map(d => d.priceCtKwh);
      const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);

      return {
        timestamp: day,
        avgPrice,
        minPrice,
        maxPrice,
        priceCtKwh: avgPrice,
      };
    })
    .filter((d): d is AggregatedSpotPrice => d !== null);
}

export function getSpotPricesByDay(
  data: SpotPriceData[],
  selectedDate: Date
): SpotPriceData[] {
  if (isNaN(selectedDate.getTime())) {
    return [];
  }

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const day = selectedDate.getDate();

  const dayStart = new Date(year, month, day, 0, 0, 0, 0);
  const dayEnd = new Date(year, month, day + 1, 0, 0, 0, 0);

  return data
    .filter(d => d.timestamp >= dayStart && d.timestamp < dayEnd)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}
