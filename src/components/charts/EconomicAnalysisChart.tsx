import React from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface EconomicAnalysisChartProps {
  data: Array<{
    timestamp: Date;
    consumer: number;
    producer: number;
    spotPrice: number;
  }>;
  egPrice: number;
  consumerName?: string;
  producerName?: string;
}

export default function EconomicAnalysisChart({
  data,
  egPrice,
  consumerName = 'Verbraucher',
  producerName = 'Erzeuger',
}: EconomicAnalysisChartProps) {
  const chartData = data.map((point) => ({
    name: format(point.timestamp, 'dd.MM HH:mm', { locale: de }),
    timestamp: point.timestamp,
    [consumerName]: point.consumer,
    [producerName]: point.producer,
    'Spotpreis': point.spotPrice,
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
      <div className="bg-white border border-gray-300 rounded-lg shadow-lg p-3 text-sm">
        <p className="font-semibold mb-2">{label}</p>
        {payload.map((entry: any, index: number) => {
          if (entry.dataKey === 'Spotpreis') {
            return (
              <p key={index} style={{ color: entry.color }} className="mb-1">
                {entry.name}: {entry.value.toFixed(2)} ct/kWh
              </p>
            );
          } else {
            return (
              <p key={index} style={{ color: entry.color }} className="mb-1">
                {entry.name}: {entry.value.toFixed(2)} kW
              </p>
            );
          }
        })}
        <div className="mt-2 pt-2 border-t border-gray-200">
          <p className="text-gray-600">EG-Preis: {egPrice.toFixed(2)} ct/kWh</p>
        </div>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={500} id="economic-analysis-chart">
      <ComposedChart
        data={chartData}
        margin={{ top: 20, right: 80, bottom: 20, left: 20 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

        <XAxis
          dataKey="name"
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
          angle={-45}
          textAnchor="end"
          height={80}
        />

        <YAxis
          yAxisId="left"
          stroke="#1d67a9"
          label={{ value: 'Leistung (kW)', angle: -90, position: 'insideLeft', style: { fontSize: '14px' } }}
          style={{ fontSize: '12px' }}
        />

        <YAxis
          yAxisId="right"
          orientation="right"
          stroke="#f59e0b"
          label={{ value: 'Preis (ct/kWh)', angle: 90, position: 'insideRight', style: { fontSize: '14px' } }}
          style={{ fontSize: '12px' }}
        />

        <Tooltip content={<CustomTooltip />} />

        <Legend
          wrapperStyle={{ paddingTop: '20px' }}
          iconType="line"
        />

        <ReferenceLine
          yAxisId="right"
          y={egPrice}
          stroke="#10b981"
          strokeDasharray="5 5"
          strokeWidth={2}
          label={{
            value: `EG-Preis: ${egPrice.toFixed(2)} ct/kWh`,
            position: 'right',
            fill: '#10b981',
            fontSize: 12,
          }}
        />

        <Line
          yAxisId="left"
          type="monotone"
          dataKey={consumerName}
          stroke="#1d67a9"
          strokeWidth={2}
          dot={false}
          name={consumerName}
        />

        <Line
          yAxisId="left"
          type="monotone"
          dataKey={producerName}
          stroke="#eab308"
          strokeWidth={2}
          dot={false}
          name={producerName}
        />

        <Line
          yAxisId="right"
          type="monotone"
          dataKey="Spotpreis"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={false}
          name="Spotpreis (+ Aufschlag)"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
