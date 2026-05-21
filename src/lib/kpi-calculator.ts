import { ParsedLoadData } from './csv-parser';
import { LoadProfileKPIs } from '../types';
import { format, startOfMonth, endOfMonth, getHours } from 'date-fns';

interface AggregatedKPIs {
  total_consumption_kwh: number;
  total_peak_load_kw: number;
  avg_load_factor: number;
  total_cost_potential_eur: number;
  active_profiles: number;
  monthly_consumption: { month: string; kwh: number; cost_eur: number }[];
  profile_summary: {
    manufacturing: number;
    commercial: number;
    office: number;
    other: number;
  };
}

export const calculateKPIs = (data: ParsedLoadData[]): LoadProfileKPIs => {
  if (data.length === 0) {
    return {
      annual_consumption_kwh: 0,
      peak_load_kw: 0,
      usage_hours: 0,
      load_factor: 0,
      peak_frequency_90_percent: 0,
      monthly_consumption: [],
      day_night_ratio: { day_percent: 0, night_percent: 0 },
      cost_potential_eur: 0
    };
  }

  // Basic calculations
  const powers = data.map(d => d.power_kw);
  const peak_load_kw = Math.max(...powers);
  const average_load = powers.reduce((sum, p) => sum + p, 0) / powers.length;
  
  // Annual consumption (kWh) - 15-minute intervals
  const annual_consumption_kwh = powers.reduce((sum, p) => sum + p, 0) * 0.25;
  
  // Usage hours and load factor
  const usage_hours = peak_load_kw > 0 ? annual_consumption_kwh / peak_load_kw : 0;
  const load_factor = peak_load_kw > 0 ? (average_load / peak_load_kw) * 100 : 0;
  
  // Peak frequency (>90% of peak load)
  const peak_threshold = peak_load_kw * 0.9;
  const peak_frequency_90_percent = (powers.filter(p => p >= peak_threshold).length / powers.length) * 100;

  // Monthly consumption
  const monthlyData = new Map<string, { kwh: number; cost: number }>();
  
  data.forEach(point => {
    const date = new Date(point.timestamp);
    const monthKey = format(date, 'yyyy-MM');
    const existing = monthlyData.get(monthKey) || { kwh: 0, cost: 0 };
    existing.kwh += point.power_kw * 0.25; // 15-minute interval to kWh
    existing.cost += point.power_kw * 0.25 * 0.30; // Assume 30ct/kWh
    monthlyData.set(monthKey, existing);
  });

  const monthly_consumption = Array.from(monthlyData.entries()).map(([month, data]) => ({
    month,
    kwh: data.kwh,
    cost_eur: data.cost
  })).sort((a, b) => a.month.localeCompare(b.month));

  // Day/night ratio (day: 6-22h, night: 22-6h)
  let dayConsumption = 0;
  let nightConsumption = 0;
  
  data.forEach(point => {
    const hour = getHours(new Date(point.timestamp));
    const consumption = point.power_kw * 0.25;
    if (hour >= 6 && hour < 22) {
      dayConsumption += consumption;
    } else {
      nightConsumption += consumption;
    }
  });

  const totalConsumption = dayConsumption + nightConsumption;
  const day_night_ratio = {
    day_percent: totalConsumption > 0 ? (dayConsumption / totalConsumption) * 100 : 0,
    night_percent: totalConsumption > 0 ? (nightConsumption / totalConsumption) * 100 : 0
  };

  // Cost potential from peak load reduction (simplified)
  const cost_potential_eur = peak_load_kw * 100; // €100 per kW peak reduction potential

  return {
    annual_consumption_kwh: annual_consumption_kwh,
    peak_load_kw: Math.round(peak_load_kw * 100) / 100,
    usage_hours: usage_hours,
    load_factor: Math.round(load_factor * 100) / 100,
    peak_frequency_90_percent: Math.round(peak_frequency_90_percent * 100) / 100,
    monthly_consumption,
    day_night_ratio: {
      day_percent: Math.round(day_night_ratio.day_percent * 100) / 100,
      night_percent: Math.round(day_night_ratio.night_percent * 100) / 100
    },
    cost_potential_eur: cost_potential_eur
  };
};

const calculateAggregatedKPIs = (profiles: any[]): AggregatedKPIs => {
  if (profiles.length === 0) {
    return {
      total_consumption_kwh: 0,
      total_peak_load_kw: 0,
      avg_load_factor: 0,
      total_cost_potential_eur: 0,
      active_profiles: 0,
      monthly_consumption: [],
      profile_summary: {
        manufacturing: 0,
        commercial: 0,
        office: 0,
        other: 0
      }
    };
  }

  // Aggregiere KPIs über alle Profile
  let totalConsumption = 0;
  let maxPeakLoad = 0;
  let totalLoadFactor = 0;
  let totalCostPotential = 0;
  const monthlyMap = new Map<string, { kwh: number; cost: number }>();
  
  // Zähle Profile nach Branchen
  const profileSummary = {
    manufacturing: 0,
    commercial: 0,
    office: 0,
    other: 0
  };

  profiles.forEach(profile => {
    if (profile.kpis) {
      totalConsumption += profile.kpis.annual_consumption_kwh || 0;
      maxPeakLoad = Math.max(maxPeakLoad, profile.kpis.peak_load_kw || 0);
      totalLoadFactor += profile.kpis.load_factor || 0;
      totalCostPotential += profile.kpis.cost_potential_eur || 0;
      
      // Aggregiere monatliche Daten falls vorhanden
      if (profile.kpis.monthly_consumption) {
        profile.kpis.monthly_consumption.forEach((month: any) => {
          const existing = monthlyMap.get(month.month) || { kwh: 0, cost: 0 };
          existing.kwh += month.kwh || 0;
          existing.cost += month.cost_eur || 0;
          monthlyMap.set(month.month, existing);
        });
      }
    }
    
    // Zähle Branchen
    const sector = profile.industry_sector?.toLowerCase() || 'other';
    if (sector.includes('manufacturing') || sector.includes('produktion')) {
      profileSummary.manufacturing++;
    } else if (sector.includes('commercial') || sector.includes('gewerbe')) {
      profileSummary.commercial++;
    } else if (sector.includes('office') || sector.includes('büro')) {
      profileSummary.office++;
    } else {
      profileSummary.other++;
    }
  });

  // Berechne Durchschnittswerte
  const avgLoadFactor = profiles.length > 0 ? totalLoadFactor / profiles.length : 0;
  
  // Konvertiere monatliche Daten zu Array
  const monthlyConsumption = Array.from(monthlyMap.entries())
    .map(([month, data]) => ({
      month,
      kwh: data.kwh,
      cost_eur: data.cost
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    total_consumption_kwh: totalConsumption,
    total_peak_load_kw: maxPeakLoad,
    avg_load_factor: avgLoadFactor,
    total_cost_potential_eur: totalCostPotential,
    active_profiles: profiles.length,
    monthly_consumption: monthlyConsumption,
    profile_summary: profileSummary
  };
};