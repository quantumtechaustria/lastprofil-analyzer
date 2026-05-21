import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Loader2 } from 'lucide-react';
import { formatNumberGerman, formatLargeNumberGerman } from '../../lib/utils';

interface LoadProfileChartProps {
  data: any[];
  selectedProfiles: any[];
  viewType: string;
  showPeakLoad: boolean;
  colors: string[];
  yearViewMode?: string;
  isComparisonMode?: boolean;
}

const CustomTooltip = ({ active, payload, label, selectedProfiles, viewType, areProfilesStacked }: any) => {
  if (active && payload && payload.length) {
    const totalValue = payload.reduce((sum: number, entry: any) => sum + entry.value, 0);

    return (
      <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-medium text-gray-900 mb-2">
          {viewType === 'weekdayWeekend' ? `${label} Uhr` : label}
        </p>
        {payload.map((entry: any, index: number) => {
          const profileIndex = parseInt(entry.dataKey.split('_')[0].replace('profile', '')) - 1;
          const profile = selectedProfiles[profileIndex];
          const isWeekend = entry.dataKey.includes('weekend');
          const isWeekday = entry.dataKey.includes('weekday');

          let displayName = profile?.name || `Profil ${profileIndex + 1}`;
          if (isWeekday) displayName += ' (Werktag)';
          if (isWeekend) displayName += ' (Wochenende)';

          let unit = 'kW'; // Default unit
          if (entry.dataKey.includes('_kwh')) {
            unit = 'kWh';
          } else if (entry.dataKey.includes('_kw') || entry.dataKey.includes('peak')) {
            unit = 'kW';
          }

          return (
            <div key={index} className="flex items-center space-x-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm">
                {displayName}: {formatNumberGerman(entry.value)} {unit}
              </span>
            </div>
          );
        })}

        {areProfilesStacked && payload.length > 1 && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <span className="text-sm font-medium text-gray-900">
              Gesamt: {formatNumberGerman(totalValue)} {payload[0].dataKey.includes('_kwh') ? 'kWh' : 'kW'}
            </span>
          </div>
        )}

        {viewType === 'weekdayWeekend' && payload.length >= 2 && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <span className="text-xs text-gray-600">
              Differenz: {formatNumberGerman(Math.abs(payload[0].value - payload[1].value))} kW
            </span>
          </div>
        )}
      </div>
    );
  }
  return null;
};

export default function LoadProfileChart({
  data,
  selectedProfiles,
  viewType,
  showPeakLoad,
  colors,
  yearViewMode = 'months',
  isComparisonMode = false
}: LoadProfileChartProps) {
  const isBarChart = ['year', 'month', 'week', 'day'].includes(viewType);
  const ChartComponent = isBarChart ? BarChart : LineChart;
  const DataComponent = isBarChart ? Bar : Line;

  // Show loading state if no data
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center text-gray-500">
          <p>Keine Daten verfügbar</p>
        </div>
      </div>
    );
  }

  // Group profiles by type for stacking
  const profilesByType = selectedProfiles.reduce((acc, profile, index) => {
    const type = profile.profile_type || 'unknown';
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push({ profile, index });
    return acc;
  }, {} as Record<string, Array<{ profile: any; index: number }>>);

  // Determine if we should stack (at least one type has multiple profiles)
  const shouldStackByType = isBarChart && isComparisonMode &&
    Object.values(profilesByType).some(profiles => profiles.length > 1);

  // Generate color variations for profiles of the same type
  const getColorForProfile = (profile: any, typeIndex: number, profileType: string): string => {
    if (!shouldStackByType) {
      return colors[typeIndex % colors.length];
    }

    const profilesOfSameType = profilesByType[profileType] || [];
    const indexInType = profilesOfSameType.findIndex(p => p.profile === profile);

    if (profileType === 'consumer') {
      const blueShades = ['#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af'];
      return blueShades[indexInType % blueShades.length];
    } else if (profileType === 'producer') {
      const yellowShades = ['#fde047', '#facc15', '#eab308', '#f59e0b', '#f97316'];
      return yellowShades[indexInType % yellowShades.length];
    }
    return colors[typeIndex % colors.length];
  };

  const renderDataComponents = () => {
    const components = [];

    // Render main data lines/bars for each profile
    selectedProfiles.forEach((profile, index) => {
      const profileType = profile.profile_type || 'unknown';
      const color = getColorForProfile(profile, index, profileType);
      const gradientId = `gradient-${profile.id || index}`;

      // Determine if this profile type should be stacked
      const profilesOfSameType = profilesByType[profileType] || [];
      const shouldStackThisType = shouldStackByType && profilesOfSameType.length > 1;

      // Determine gradient colors based on profile type and stacking
      let gradientStart = color;
      let gradientEnd = color;

      if (shouldStackThisType) {
        // For stacked profiles, use the color variation directly
        gradientStart = color;
        gradientEnd = color;
      } else if (profile.profile_type === 'consumer') {
        gradientStart = '#1d67a9';
        gradientEnd = '#16abbd';
      } else if (profile.profile_type === 'producer') {
        gradientStart = '#eab308';
        gradientEnd = '#fbbf24';
      }
      const dataKey = `profile${index + 1}_${viewType === 'hour' || viewType === 'weekdayWeekend' ? 'avg_kw' : 'kwh'}`;

      if (viewType === 'weekdayWeekend') {
        // Special handling for weekday/weekend view
        components.push(
          <DataComponent
            key={`${profile.id}_weekday`}
            type="monotone"
            dataKey={`profile${index + 1}_weekday_avg_kw`}
            stroke={color}
            strokeWidth={2}
            dot={{ fill: color, strokeWidth: 2, r: 3 }}
            name={`${profile.name} (Werktag)`}
          />
        );
        components.push(
          <DataComponent
            key={`${profile.id}_weekend`}
            type="monotone"
            dataKey={`profile${index + 1}_weekend_avg_kw`}
            stroke={color}
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ fill: color, strokeWidth: 2, r: 3 }}
            name={`${profile.name} (Wochenende)`}
          />
        );
      } else {
        components.push(
          <DataComponent
            key={profile.id}
            type={isBarChart ? undefined : "monotone"}
            dataKey={dataKey}
            stroke={isBarChart ? undefined : gradientStart}
            fill={isBarChart ? (shouldStackThisType ? color : `url(#${gradientId})`) : undefined}
            fillOpacity={isBarChart && isComparisonMode && selectedProfiles.length > 1 && !shouldStackThisType ? 0.7 : 1}
            strokeWidth={isBarChart ? undefined : 2}
            dot={isBarChart ? undefined : { fill: gradientStart, strokeWidth: 2, r: 3 }}
            name={profile.name}
            stackId={shouldStackThisType ? `stack_${profileType}` : undefined}
          />
        );
      }

      // Add peak load overlay if enabled
      if (showPeakLoad && !['weekdayWeekend'].includes(viewType)) {
        const peakDataKey = `profile${index + 1}_peak_kw`;
        components.push(
          <DataComponent
            key={`${profile.id}_peak`}
            type={isBarChart ? undefined : "monotone"}
            dataKey={peakDataKey}
            stroke={isBarChart ? undefined : color}
            fill={isBarChart ? `${color}80` : undefined}
            fillOpacity={isBarChart && isComparisonMode && selectedProfiles.length > 1 && !shouldStackThisType ? 0.5 : 0.5}
            strokeWidth={isBarChart ? undefined : 1}
            strokeDasharray={isBarChart ? undefined : "3 3"}
            dot={isBarChart ? undefined : { fill: color, strokeWidth: 1, r: 2 }}
            name={`${profile.name} (Spitzenlast)`}
            stackId={shouldStackThisType ? `stack_${profileType}_peak` : undefined}
          />
        );
      }
    });

    return components;
  };

  return (
    <ResponsiveContainer width="100%" height={400} id="load-profile-chart">
      <ChartComponent
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        {...(isBarChart && isComparisonMode && selectedProfiles.length > 1 && !shouldStackByType ? {
          barCategoryGap: "20%",
          barGap: -10
        } : {})}
      >
        <defs>
          {selectedProfiles.map((profile, index) => {
            const gradientId = `gradient-${profile.id || index}`;
            let gradientStart, gradientEnd;

            if (profile.profile_type === 'consumer') {
              gradientStart = '#1d67a9';
              gradientEnd = '#16abbd';
            } else if (profile.profile_type === 'producer') {
              gradientStart = '#eab308';
              gradientEnd = '#fbbf24';
            } else {
              gradientStart = colors[index % colors.length];
              gradientEnd = colors[index % colors.length];
            }

            return (
              <linearGradient key={gradientId} id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={gradientStart} stopOpacity={1} />
                <stop offset="100%" stopColor={gradientEnd} stopOpacity={1} />
              </linearGradient>
            );
          })}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey={viewType === 'weekdayWeekend' ? 'time' :
                   viewType === 'year' ? (yearViewMode === 'months' ? 'month' : 'day') :
                   viewType === 'month' ? 'day' :
                   viewType === 'week' ? 'day' :
                   viewType === 'day' ? 'time' :
                   viewType === 'hour' ? 'time' : 'time'}
          stroke="#666"
          fontSize={12}
          angle={viewType === 'year' && yearViewMode === 'days' ? -45 : 0}
          textAnchor={viewType === 'year' && yearViewMode === 'days' ? 'end' : 'middle'}
          height={viewType === 'year' && yearViewMode === 'days' ? 80 : 60}
          {...((viewType === 'day') ? {
            ticks: Array.from({ length: 25 }, (_, i) => `${i.toString().padStart(2, '0')}:00`),
            interval: 0,
            tickFormatter: (value: string) => {
              const hour = parseInt(value);
              return hour % 2 === 0 ? value : '';
            }
          } : {})}
          {...((viewType === 'hour') ? {
            interval: 'preserveStartEnd' as const,
            tickFormatter: (value: string) => {
              const [h, m] = value.split(':');
              return m === '00' ? value : '';
            }
          } : {})}
        />
        <YAxis
          stroke="#666"
          fontSize={12}
          tickFormatter={(value) => formatNumberGerman(value)}
        />
        <Tooltip
          content={(props) => (
            <CustomTooltip
              {...props}
              selectedProfiles={selectedProfiles}
              viewType={viewType}
              areProfilesStacked={shouldStackByType}
            />
          )}
        />
        <Legend />
        {renderDataComponents()}
      </ChartComponent>
    </ResponsiveContainer>
  );
}