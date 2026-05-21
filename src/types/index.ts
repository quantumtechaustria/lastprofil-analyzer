interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  subscription_plan: 'free' | 'pro' | 'enterprise';
  created_at: string;
  owner_id: string;
}

interface OrganizationMember {
  id: string;
  user_id: string;
  organization_id: string;
  role: 'owner' | 'admin' | 'member';
  created_at: string;
  user?: User;
}

interface LoadProfile {
  id: string;
  user_id: string;
  name: string;
  file_name: string;
  site_address?: string;
  meter_number?: string;
  industry_sector?: string;
  profile_type?: 'consumer' | 'producer' | 'unknown';
  data_unit?: 'kW' | 'kWh';
  data_start: string;
  data_end: string;
  total_records: number;
  data_quality_score: number;
  customer_number?: string;
  customer_name?: string;
  metering_point?: string;
  period_start?: string;
  period_end?: string;
  energy_direction?: string;
  metadata?: Record<string, any>;
  created_at: string;
  processed_at?: string;
  kpis?: LoadProfileKPIs;
  parsedData?: ParsedLoadData[];
}

export interface ParsedLoadData {
  timestamp: string;
  power_kw: number;
}

interface LoadProfileData {
  id: string;
  load_profile_id: string;
  timestamp: string;
  power_kw: number;
  created_at: string;
}

export interface LoadProfileKPIs {
  annual_consumption_kwh: number;
  peak_load_kw: number;
  usage_hours: number;
  load_factor: number;
  peak_frequency_90_percent: number;
  monthly_consumption: { month: string; kwh: number; cost_eur: number }[];
  day_night_ratio: { day_percent: number; night_percent: number };
  cost_potential_eur: number;
}

interface HourlyData {
  hour: string;
  time: string;
  kwh: number;
  avg_kw: number;
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

interface QuarterHourData {
  time: string;
  timestamp: string;
  kw: number;
  kwh: number;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  price_monthly: number;
  max_uploads: number | null;
  features: string[];
  stripe_price_id?: string;
}