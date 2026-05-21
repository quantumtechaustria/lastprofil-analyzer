import { ParsedLoadData } from '../types';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay, addDays, addMonths, parseISO, getHours, getDay, startOfYear, endOfYear, getWeek, getYear } from 'date-fns';
import { de } from 'date-fns/locale';

interface MonthlyData {
  month: string;
  kwh: number;
  peak_kw: number;
  avg_kw: number;
  days: number;
}

interface WeeklySummaryData {
  week: string;
  weekNumber: number;
  year: number;
  startDate: string;
  endDate: string;
  kwh: number;
  peak_kw: number;
  avg_kw: number;
  days: number;
}

interface DailyData {
  date: string;
  day: string;
  kwh: number;
  peak_kw: number;
  avg_kw: number;
  isWeekend: boolean;
}

interface HourlyData {
  hour: string;
  time: string;
  kwh: number;
  avg_kw: number;
}

interface QuarterHourData {
  time: string;
  timestamp: string;
  kw: number;
  kwh: number;
}

export const aggregateToMonthlyData = (data: ParsedLoadData[], year?: Date): MonthlyData[] => {
  if (data.length === 0) return [];
  
  // Performance-Optimierung für große Datensätze
  if (data.length > 50000) {
    console.log(`Aggregiere große Datenmenge: ${data.length.toLocaleString()} Datenpunkte`);
  }

  let filteredData = data;
  if (year) {
    const yearStart = startOfYear(year);
    const yearEnd = endOfYear(year);
    filteredData = data.filter(point => {
      const date = parseISO(point.timestamp);
      return date >= yearStart && date <= yearEnd;
    });
  }

  const monthlyMap = new Map<string, { kwh: number; peak_kw: number; total_kw: number; count: number; days: Set<string> }>();

  filteredData.forEach(point => {
    const date = parseISO(point.timestamp);
    const monthKey = format(date, 'yyyy-MM');
    const dayKey = format(date, 'yyyy-MM-dd');
    
    const existing = monthlyMap.get(monthKey) || { 
      kwh: 0, 
      peak_kw: 0, 
      total_kw: 0, 
      count: 0, 
      days: new Set<string>() 
    };
    
    existing.kwh += point.power_kw * 0.25; // 15-Minuten-Intervall: kW * 0.25h = kWh
    existing.peak_kw = Math.max(existing.peak_kw, point.power_kw);
    existing.total_kw += point.power_kw;
    existing.count += 1;
    existing.days.add(dayKey);
    
    monthlyMap.set(monthKey, existing);
  });

  return Array.from(monthlyMap.entries())
    .map(([month, data]) => ({
      month,
      kwh: data.kwh,
      peak_kw: Math.round(data.peak_kw * 100) / 100,
      avg_kw: Math.round((data.total_kw / data.count) * 100) / 100,
      days: data.days.size
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
};

const aggregateToWeeklySummaryData = (data: ParsedLoadData[], year?: Date): WeeklySummaryData[] => {
  if (data.length === 0) return [];
  
  // Performance-Optimierung für große Datensätze
  if (data.length > 50000) {
    console.log(`Aggregiere Wochendaten: ${data.length.toLocaleString()} Datenpunkte`);
  }

  let filteredData = data;
  if (year) {
    const yearStart = startOfYear(year);
    const yearEnd = endOfYear(year);
    filteredData = data.filter(point => {
      const date = parseISO(point.timestamp);
      return date >= yearStart && date <= yearEnd;
    });
  }

  const weeklyMap = new Map<string, { kwh: number; peak_kw: number; total_kw: number; count: number; days: Set<string>; startDate: Date; endDate: Date }>();

  filteredData.forEach(point => {
    const date = parseISO(point.timestamp);
    const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
    const weekNumber = getWeek(date, { weekStartsOn: 1 });
    const yearNum = getYear(date);
    const weekKey = `${yearNum}-W${weekNumber.toString().padStart(2, '0')}`;
    const dayKey = format(date, 'yyyy-MM-dd');
    
    const existing = weeklyMap.get(weekKey) || { 
      kwh: 0, 
      peak_kw: 0, 
      total_kw: 0, 
      count: 0, 
      days: new Set<string>(),
      startDate: weekStart,
      endDate: weekEnd
    };
    
    existing.kwh += point.power_kw * 0.25;
    existing.peak_kw = Math.max(existing.peak_kw, point.power_kw);
    existing.total_kw += point.power_kw;
    existing.count += 1;
    existing.days.add(dayKey);
    
    weeklyMap.set(weekKey, existing);
  });

  return Array.from(weeklyMap.entries())
    .map(([week, data]) => {
      const weekNumber = parseInt(week.split('-W')[1]);
      const year = parseInt(week.split('-W')[0]);
      return {
        week,
        weekNumber,
        year,
        startDate: format(data.startDate, 'yyyy-MM-dd'),
        endDate: format(data.endDate, 'yyyy-MM-dd'),
        kwh: data.kwh,
        peak_kw: Math.round(data.peak_kw * 100) / 100,
        avg_kw: Math.round((data.total_kw / data.count) * 100) / 100,
        days: data.days.size
      };
    })
    .sort((a, b) => a.week.localeCompare(b.week));
};

export const aggregateToDailyData = (data: ParsedLoadData[], period?: Date, periodType: 'month' | 'year' = 'month'): DailyData[] => {
  if (data.length === 0) return [];
  
  // Performance-Optimierung für große Datensätze
  if (data.length > 50000) {
    console.log(`Aggregiere Tagesdaten: ${data.length.toLocaleString()} Datenpunkte`);
  }

  let filteredData = data;
  if (period) {
    let periodStart: Date;
    let periodEnd: Date;
    
    if (periodType === 'month') {
      periodStart = startOfMonth(period);
      periodEnd = endOfMonth(period);
    } else {
      periodStart = startOfYear(period);
      periodEnd = endOfYear(period);
    }
    
    filteredData = data.filter(point => {
      const date = parseISO(point.timestamp);
      return date >= periodStart && date <= periodEnd;
    });
  }

  const dailyMap = new Map<string, { kwh: number; peak_kw: number; total_kw: number; count: number }>();

  filteredData.forEach(point => {
    const date = parseISO(point.timestamp);
    const dayKey = format(date, 'yyyy-MM-dd');
    
    const existing = dailyMap.get(dayKey) || { kwh: 0, peak_kw: 0, total_kw: 0, count: 0 };
    
    existing.kwh += point.power_kw * 0.25;
    existing.peak_kw = Math.max(existing.peak_kw, point.power_kw);
    existing.total_kw += point.power_kw;
    existing.count += 1;
    
    dailyMap.set(dayKey, existing);
  });

  return Array.from(dailyMap.entries())
    .map(([date, data]) => {
      const dateObj = parseISO(date);
      return {
        date,
        day: periodType === 'year' ? format(dateObj, 'dd.MM', { locale: de }) : format(dateObj, 'dd.MM', { locale: de }),
        kwh: data.kwh,
        peak_kw: Math.round(data.peak_kw * 100) / 100,
        avg_kw: Math.round((data.total_kw / data.count) * 100) / 100,
        isWeekend: getDay(dateObj) === 0 || getDay(dateObj) === 6
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
};

export const aggregateToWeeklyData = (data: ParsedLoadData[], week?: Date): DailyData[] => {
  if (data.length === 0) return [];

  let filteredData = data;
  if (week) {
    const weekStart = startOfWeek(week, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(week, { weekStartsOn: 1 });
    filteredData = data.filter(point => {
      const date = parseISO(point.timestamp);
      return date >= weekStart && date <= weekEnd;
    });
  }

  return aggregateToDailyData(filteredData);
};

export const aggregateToHourlyData = (data: ParsedLoadData[], day?: Date): HourlyData[] => {
  if (data.length === 0) return [];

  let filteredData = data;
  if (day) {
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);
    filteredData = data.filter(point => {
      const date = parseISO(point.timestamp);
      return date >= dayStart && date <= dayEnd;
    });
  }

  const hourlyMap = new Map<number, { kwh: number; total_kw: number; count: number }>();

  filteredData.forEach(point => {
    const date = parseISO(point.timestamp);
    const hour = getHours(date);
    
    const existing = hourlyMap.get(hour) || { kwh: 0, total_kw: 0, count: 0 };
    
    existing.kwh += point.power_kw * 0.25;
    existing.total_kw += point.power_kw;
    existing.count += 1;
    
    hourlyMap.set(hour, existing);
  });

  const result: HourlyData[] = [];
  for (let h = 0; h < 24; h++) {
    const existing = hourlyMap.get(h);
    result.push({
      hour: h.toString().padStart(2, '0'),
      time: `${h.toString().padStart(2, '0')}:00`,
      kwh: existing ? existing.kwh : 0,
      avg_kw: existing && existing.count > 0 ? Math.round((existing.total_kw / existing.count) * 100) / 100 : 0
    });
  }
  return result;
};

export const getDailyLoadProfile = (data: ParsedLoadData[], day?: Date): QuarterHourData[] => {
  if (data.length === 0) return [];

  let filteredData = data;
  if (day) {
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);
    filteredData = data.filter(point => {
      const date = parseISO(point.timestamp);
      return date >= dayStart && date <= dayEnd;
    });
  }

  const dataMap = new Map<string, { kw: number; kwh: number; timestamp: string }>();
  filteredData.forEach(point => {
    const time = format(parseISO(point.timestamp), 'HH:mm');
    dataMap.set(time, {
      kw: Math.round(point.power_kw * 100) / 100,
      kwh: point.power_kw * 0.25,
      timestamp: point.timestamp
    });
  });

  const result: QuarterHourData[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      const existing = dataMap.get(time);
      result.push({
        time,
        timestamp: existing?.timestamp || `${day ? format(day, 'yyyy-MM-dd') : '2000-01-01'}T${time}:00`,
        kw: existing?.kw || 0,
        kwh: existing?.kwh || 0
      });
    }
  }
  return result;
};

export const getDateRange = (data: ParsedLoadData[]): { start: Date; end: Date } | null => {
  if (data.length === 0) return null;
  
  const timestamps = data.map(d => parseISO(d.timestamp));
  return {
    start: new Date(Math.min(...timestamps.map(d => d.getTime()))),
    end: new Date(Math.max(...timestamps.map(d => d.getTime())))
  };
};

export const getAvailableMonths = (data: ParsedLoadData[]): Date[] => {
  if (data.length === 0) return [];
  
  const monthsSet = new Set<string>();
  data.forEach(point => {
    const date = parseISO(point.timestamp);
    monthsSet.add(format(startOfMonth(date), 'yyyy-MM-dd'));
  });
  
  return Array.from(monthsSet)
    .map(monthStr => parseISO(monthStr))
    .sort((a, b) => a.getTime() - b.getTime());
};

export const getAvailableWeeks = (data: ParsedLoadData[], month?: Date): Date[] => {
  if (data.length === 0) return [];
  
  let filteredData = data;
  if (month) {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    filteredData = data.filter(point => {
      const date = parseISO(point.timestamp);
      return date >= monthStart && date <= monthEnd;
    });
  }
  
  const weeksSet = new Set<string>();
  filteredData.forEach(point => {
    const date = parseISO(point.timestamp);
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    weeksSet.add(format(weekStart, 'yyyy-MM-dd'));
  });
  
  return Array.from(weeksSet)
    .map(weekStr => parseISO(weekStr))
    .sort((a, b) => a.getTime() - b.getTime());
};

export interface WeekdayWeekendProfile {
  weekdays: QuarterHourData[];
  weekends: QuarterHourData[];
  weekdayStats: {
    totalKwh: number;
    avgKw: number;
    peakKw: number;
    baseloadKw: number;
  };
  weekendStats: {
    totalKwh: number;
    avgKw: number;
    peakKw: number;
    baseloadKw: number;
  };
}

export const aggregateDataByInterval = (
  data: ParsedLoadData[],
  interval: 'hour' | 'day' | 'week' | 'month' = 'hour'
): Array<{ label: string; avg_kw: number; kwh: number; peak_kw: number }> => {
  if (data.length === 0) return [];

  switch (interval) {
    case 'hour': {
      const hourlyData = aggregateToHourlyData(data);
      return hourlyData.map(h => ({
        label: h.time,
        avg_kw: h.avg_kw,
        kwh: h.kwh,
        peak_kw: h.avg_kw
      }));
    }
    case 'day': {
      const dailyData = aggregateToDailyData(data);
      return dailyData.map(d => ({
        label: d.day,
        avg_kw: d.avg_kw,
        kwh: d.kwh,
        peak_kw: d.peak_kw
      }));
    }
    case 'month': {
      const monthlyData = aggregateToMonthlyData(data);
      return monthlyData.map(m => ({
        label: m.month,
        avg_kw: m.avg_kw,
        kwh: m.kwh,
        peak_kw: m.peak_kw
      }));
    }
    default:
      return [];
  }
};

export const getWeekdayWeekendAverageProfiles = (data: ParsedLoadData[]): WeekdayWeekendProfile => {
  if (data.length === 0) {
    const emptyProfile = {
      time: '',
      timestamp: '',
      kw: 0,
      kwh: 0
    };
    return {
      weekdays: Array(96).fill(0).map((_, i) => ({
        ...emptyProfile,
        time: format(new Date(0, 0, 0, Math.floor(i / 4), (i % 4) * 15), 'HH:mm')
      })),
      weekends: Array(96).fill(0).map((_, i) => ({
        ...emptyProfile,
        time: format(new Date(0, 0, 0, Math.floor(i / 4), (i % 4) * 15), 'HH:mm')
      })),
      weekdayStats: { totalKwh: 0, avgKw: 0, peakKw: 0, baseloadKw: 0 },
      weekendStats: { totalKwh: 0, avgKw: 0, peakKw: 0, baseloadKw: 0 }
    };
  }

  // Separate data into weekdays and weekends
  const weekdayData: ParsedLoadData[] = [];
  const weekendData: ParsedLoadData[] = [];

  data.forEach(point => {
    const date = parseISO(point.timestamp);
    const dayOfWeek = getDay(date);
    
    if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday = 0, Saturday = 6
      weekendData.push(point);
    } else {
      weekdayData.push(point);
    }
  });

  // Create 15-minute interval maps for averaging
  const weekdayIntervals = new Map<string, { total: number; count: number; values: number[] }>();
  const weekendIntervals = new Map<string, { total: number; count: number; values: number[] }>();

  // Initialize all 96 intervals (24 hours * 4 quarters)
  for (let hour = 0; hour < 24; hour++) {
    for (let quarter = 0; quarter < 4; quarter++) {
      const time = format(new Date(0, 0, 0, hour, quarter * 15), 'HH:mm');
      weekdayIntervals.set(time, { total: 0, count: 0, values: [] });
      weekendIntervals.set(time, { total: 0, count: 0, values: [] });
    }
  }

  // Aggregate weekday data
  weekdayData.forEach(point => {
    const date = parseISO(point.timestamp);
    const time = format(date, 'HH:mm');
    const interval = weekdayIntervals.get(time);
    if (interval) {
      interval.total += point.power_kw;
      interval.count += 1;
      interval.values.push(point.power_kw);
    }
  });

  // Aggregate weekend data
  weekendData.forEach(point => {
    const date = parseISO(point.timestamp);
    const time = format(date, 'HH:mm');
    const interval = weekendIntervals.get(time);
    if (interval) {
      interval.total += point.power_kw;
      interval.count += 1;
      interval.values.push(point.power_kw);
    }
  });

  // Calculate average profiles
  const weekdayProfile: QuarterHourData[] = [];
  const weekendProfile: QuarterHourData[] = [];

  Array.from(weekdayIntervals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([time, data]) => {
      const avgKw = data.count > 0 ? data.total / data.count : 0;
      weekdayProfile.push({
        time,
        timestamp: `2024-01-01T${time}:00Z`, // Dummy timestamp for consistency
        kw: Math.round(avgKw * 100) / 100,
        kwh: avgKw * 0.25
      });
    });

  Array.from(weekendIntervals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([time, data]) => {
      const avgKw = data.count > 0 ? data.total / data.count : 0;
      weekendProfile.push({
        time,
        timestamp: `2024-01-01T${time}:00Z`, // Dummy timestamp for consistency
        kw: Math.round(avgKw * 100) / 100,
        kwh: avgKw * 0.25
      });
    });

  // Calculate statistics
  const weekdayKwValues = weekdayProfile.map(p => p.kw);
  const weekendKwValues = weekendProfile.map(p => p.kw);

  const weekdayStats = {
    totalKwh: weekdayProfile.reduce((sum, p) => sum + p.kwh, 0),
    avgKw: weekdayKwValues.length > 0 ? weekdayKwValues.reduce((sum, kw) => sum + kw, 0) / weekdayKwValues.length : 0,
    peakKw: weekdayKwValues.length > 0 ? Math.max(...weekdayKwValues) : 0,
    baseloadKw: weekdayKwValues.length > 0 ? Math.min(...weekdayKwValues.filter(kw => kw > 0)) : 0
  };

  const weekendStats = {
    totalKwh: weekendProfile.reduce((sum, p) => sum + p.kwh, 0),
    avgKw: weekendKwValues.length > 0 ? weekendKwValues.reduce((sum, kw) => sum + kw, 0) / weekendKwValues.length : 0,
    peakKw: weekendKwValues.length > 0 ? Math.max(...weekendKwValues) : 0,
    baseloadKw: weekendKwValues.length > 0 ? Math.min(...weekendKwValues.filter(kw => kw > 0)) : 0
  };

  return {
    weekdays: weekdayProfile,
    weekends: weekendProfile,
    weekdayStats,
    weekendStats
  };
};