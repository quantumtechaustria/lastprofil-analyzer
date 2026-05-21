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
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  LabelList,
} from 'recharts';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface SpotPriceChartProps {
  data: Array<{
    timestamp: Date;
    priceCtKwh: number;
    avgPrice?: number;
    minPrice?: number;
    maxPrice?: number;
  }>;
  viewType: 'year' | 'month' | 'week' | 'day';
  yearViewMode?: 'months' | 'days';
}

export default function SpotPriceChart({
  data,
  viewType,
  yearViewMode = 'months'
}: SpotPriceChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        Keine Daten verfügbar
      </div>
    );
  }

  const avgPrice = data.reduce((sum, d) => sum + (d.avgPrice || d.priceCtKwh), 0) / data.length;

  const formatXAxis = (timestamp: any) => {
    const date = new Date(timestamp);

    switch (viewType) {
      case 'year':
        return yearViewMode === 'months'
          ? format(date, 'MMM', { locale: de })
          : format(date, 'dd.MM', { locale: de });
      case 'month':
        return format(date, 'dd.MM', { locale: de });
      case 'week':
        return format(date, 'EEE dd.MM', { locale: de });
      case 'day':
        return format(date, 'HH:mm', { locale: de });
      default:
        return format(date, 'dd.MM', { locale: de });
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;

    return (
      <div className="bg-white border border-gray-300 rounded-lg shadow-lg p-3 text-sm">
        <p className="font-semibold mb-2">
          {format(data.timestamp, 'dd.MM.yyyy HH:mm', { locale: de })}
        </p>
        {data.avgPrice !== undefined ? (
          <>
            <p className="text-orange-600">
              Ø Preis: <span className="font-bold">{data.avgPrice.toFixed(2)} ct/kWh</span>
            </p>
            {data.minPrice !== undefined && (
              <p className="text-blue-600">
                Min: <span className="font-bold">{data.minPrice.toFixed(2)} ct/kWh</span>
              </p>
            )}
            {data.maxPrice !== undefined && (
              <p className="text-red-600">
                Max: <span className="font-bold">{data.maxPrice.toFixed(2)} ct/kWh</span>
              </p>
            )}
          </>
        ) : (
          <p className="text-orange-600">
            Preis: <span className="font-bold">{data.priceCtKwh.toFixed(2)} ct/kWh</span>
          </p>
        )}
      </div>
    );
  };

  const getPriceColor = (price: number): string => {
    const minPrice = 0;
    const maxPrice = 20;

    const normalizedPrice = Math.max(minPrice, Math.min(maxPrice, price < 0 ? 0 : price));
    const ratio = (normalizedPrice - minPrice) / (maxPrice - minPrice);

    let r: number, g: number, b: number;

    if (ratio < 0.33) {
      const localRatio = ratio / 0.33;
      r = Math.round(34 + (132 - 34) * localRatio);
      g = Math.round(197 + (204 - 197) * localRatio);
      b = Math.round(94 + (22 - 94) * localRatio);
    } else if (ratio < 0.66) {
      const localRatio = (ratio - 0.33) / 0.33;
      r = Math.round(132 + (245 - 132) * localRatio);
      g = Math.round(204 + (158 - 204) * localRatio);
      b = Math.round(22 + (11 - 22) * localRatio);
    } else {
      const localRatio = (ratio - 0.66) / 0.34;
      r = Math.round(245 + (220 - 245) * localRatio);
      g = Math.round(158 + (38 - 158) * localRatio);
      b = Math.round(11 + (38 - 11) * localRatio);
    }

    return `rgb(${r}, ${g}, ${b})`;
  };

  const chartData = data.map(d => ({
    ...d,
    timestamp: d.timestamp.getTime(),
    displayPrice: d.avgPrice || d.priceCtKwh,
    fill: getPriceColor(d.avgPrice || d.priceCtKwh),
  }));

  const useBarChart = (viewType === 'year' && yearViewMode === 'months') || viewType === 'day';
  const ChartComponent = useBarChart ? BarChart : LineChart;

  return (
    <ResponsiveContainer width="100%" height={400}>
      <ChartComponent
        data={chartData}
        margin={{ top: 10, right: 30, left: 10, bottom: 30 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

        <XAxis
          dataKey="timestamp"
          tickFormatter={formatXAxis}
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
          angle={-45}
          textAnchor="end"
          height={70}
        />

        <YAxis
          stroke="#6b7280"
          label={{
            value: 'Preis (ct/kWh)',
            angle: -90,
            position: 'insideLeft',
            style: { fontSize: '14px' }
          }}
          style={{ fontSize: '12px' }}
        />

        <Tooltip content={<CustomTooltip />} />

        <ReferenceLine
          y={0}
          stroke="#94a3b8"
          strokeWidth={1.5}
          strokeOpacity={0.6}
        />

        {viewType !== 'day' && (
          <ReferenceLine
            y={avgPrice}
            stroke="#10b981"
            strokeDasharray="5 5"
            strokeWidth={2}
            label={{
              value: `Ø ${avgPrice.toFixed(2)} ct/kWh`,
              position: 'right',
              fill: '#10b981',
              fontSize: 12,
            }}
          />
        )}

        {useBarChart ? (
          viewType === 'day' ? (
            <Bar
              dataKey="displayPrice"
              name="Spotpreis"
              radius={[4, 4, 0, 0]}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
              <LabelList
                dataKey="displayPrice"
                position="top"
                formatter={(value: number) => value.toFixed(1)}
                style={{ fontSize: '11px', fill: '#1f2937', fontWeight: '500' }}
              />
            </Bar>
          ) : (
            <Bar
              dataKey="displayPrice"
              fill="#f59e0b"
              name="Spotpreis"
              radius={[4, 4, 0, 0]}
            />
          )
        ) : (
          <>
            <Line
              type="monotone"
              dataKey="displayPrice"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              name="Spotpreis"
            />
            {data[0]?.minPrice !== undefined && (
              <Line
                type="monotone"
                dataKey="minPrice"
                stroke="#3b82f6"
                strokeWidth={1}
                strokeDasharray="3 3"
                dot={false}
                name="Min"
              />
            )}
            {data[0]?.maxPrice !== undefined && (
              <Line
                type="monotone"
                dataKey="maxPrice"
                stroke="#ef4444"
                strokeWidth={1}
                strokeDasharray="3 3"
                dot={false}
                name="Max"
              />
            )}
          </>
        )}
      </ChartComponent>
    </ResponsiveContainer>
  );
}
