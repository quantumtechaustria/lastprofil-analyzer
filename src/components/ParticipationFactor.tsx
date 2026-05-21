import { useState, useMemo } from 'react';
import { Info, AlertCircle } from 'lucide-react';
import {
  ComposedChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { aggregateDataByInterval } from '../lib/data-aggregation';

interface ParticipationFactorProps {
  loadProfiles: any[];
}

const CustomTooltip = ({ active, payload, label, tf }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  const restlast = Math.max(0, d.consumerValue - d.fixedProducerValue);
  const variableScaled = d.variableProducerMax * (tf / 100);
  const abgenommen = Math.min(variableScaled, restlast);
  const ueberschuss = Math.max(0, variableScaled - restlast);

  return (
    <div className="bg-gray-900 bg-opacity-95 border border-gray-700 rounded-lg p-4 text-sm shadow-lg">
      <div className="font-bold text-white mb-2">{label}</div>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-gray-300">Verbrauch:</span>
          <span className="text-sky-400 font-semibold">{d.consumerValue.toFixed(1)} kWh</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-300">Fix-Einspeisung:</span>
          <span className="text-amber-400 font-semibold">{d.fixedProducerValue.toFixed(1)} kWh</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-300">Restlast:</span>
          <span className="text-emerald-400 font-semibold">{restlast.toFixed(1)} kWh</span>
        </div>
        <div className="border-t border-gray-700 pt-1 mt-1"></div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-300">Variable (TF {tf}%):</span>
          <span className="text-yellow-400 font-semibold">{variableScaled.toFixed(1)} kWh</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-300">Abgenommen:</span>
          <span className="text-green-500 font-semibold">{abgenommen.toFixed(1)} kWh</span>
        </div>
        {ueberschuss > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-gray-300">Überschuss:</span>
            <span className="text-red-500 font-semibold">{ueberschuss.toFixed(1)} kWh</span>
          </div>
        )}
      </div>
    </div>
  );
};

const MetricCard = ({ label, value, unit, color, sub }: any) => (
  <div className="bg-white border border-gray-200 rounded-xl p-5 flex-1 min-w-[200px]">
    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</div>
    <div className="text-3xl font-bold" style={{ color: color || '#111827' }}>
      {value}
      <span className="text-base font-normal text-gray-500 ml-1">{unit}</span>
    </div>
    {sub && <div className="text-xs text-gray-600 mt-1">{sub}</div>}
  </div>
);

export default function ParticipationFactor({ loadProfiles }: ParticipationFactorProps) {
  const [consumerProfile, setConsumerProfile] = useState<string>('');
  const [fixedProducerProfile, setFixedProducerProfile] = useState<string>('');
  const [variableProducerProfile, setVariableProducerProfile] = useState<string>('');
  const [tf, setTf] = useState(58);
  const [showMode, setShowMode] = useState<'stacked' | 'restlast'>('stacked');
  const [viewMode, setViewMode] = useState<'day' | 'month'>('day');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [showInfoBubble, setShowInfoBubble] = useState(false);

  const consumerProfiles = loadProfiles.filter(p => p.profile_type === 'consumer');
  const producerProfiles = loadProfiles.filter(p => p.profile_type === 'producer');

  const analysis = useMemo(() => {
    if (!consumerProfile || !fixedProducerProfile || !variableProducerProfile || !selectedDate) {
      return null;
    }

    const consumer = loadProfiles.find(p => p.id === consumerProfile);
    const fixedProducer = loadProfiles.find(p => p.id === fixedProducerProfile);
    const variableProducer = loadProfiles.find(p => p.id === variableProducerProfile);

    if (!consumer?.parsedData || !fixedProducer?.parsedData || !variableProducer?.parsedData) {
      return null;
    }

    const targetDate = new Date(selectedDate);
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    const filterByDate = (data: any[]) => {
      return data.filter(d => {
        const timestamp = new Date(d.timestamp);
        return timestamp >= dayStart && timestamp <= dayEnd;
      });
    };

    const consumerDayData = filterByDate(consumer.parsedData);
    const fixedDayData = filterByDate(fixedProducer.parsedData);
    const variableDayData = filterByDate(variableProducer.parsedData);

    if (consumerDayData.length === 0 || fixedDayData.length === 0 || variableDayData.length === 0) {
      return null;
    }

    const aggregatedConsumer = aggregateDataByInterval(consumerDayData, 'hour');
    const aggregatedFixed = aggregateDataByInterval(fixedDayData, 'hour');
    const aggregatedVariable = aggregateDataByInterval(variableDayData, 'hour');

    const variableMax = Math.max(...aggregatedVariable.map(d => d.avg_kw));

    let totalVariable = 0;
    let totalAbgenommen = 0;
    let totalUeberschuss = 0;
    let minRestlast = Infinity;
    let maxRestlast = -Infinity;
    let ueberschussStunden = 0;

    const chartData = aggregatedConsumer.map((consumerPoint, idx) => {
      const fixedPoint = aggregatedFixed[idx] || { avg_kw: 0 };
      const variablePoint = aggregatedVariable[idx] || { avg_kw: 0 };

      const consumerValue = consumerPoint.avg_kw;
      const fixedProducerValue = fixedPoint.avg_kw;
      const variableProducerMax = variablePoint.avg_kw;

      const restlast = Math.max(0, consumerValue - fixedProducerValue);
      const variableScaled = variableProducerMax * (tf / 100);
      const abgenommen = Math.min(variableScaled, restlast);
      const ueberschuss = Math.max(0, variableScaled - restlast);

      totalVariable += variableScaled;
      totalAbgenommen += abgenommen;
      totalUeberschuss += ueberschuss;

      if (restlast < minRestlast) minRestlast = restlast;
      if (restlast > maxRestlast) maxRestlast = restlast;
      if (ueberschuss > 0) ueberschussStunden++;

      return {
        time: consumerPoint.label,
        hour: idx,
        consumerValue,
        fixedProducerValue,
        variableProducerMax,
        restlast,
        variableScaled,
        abgenommen,
        ueberschuss,
      };
    });

    const abnahmeQuote = totalVariable > 0 ? (totalAbgenommen / totalVariable) * 100 : 100;
    const garantierterTF = minRestlast > 0 && variableMax > 0 ? Math.floor((minRestlast / variableMax) * 100) : 0;

    const findTfForConfidence = (targetPct: number) => {
      for (let testTf = 100; testTf >= 0; testTf--) {
        let ok = 0;
        chartData.forEach(d => {
          const rl = d.restlast;
          const ps = d.variableProducerMax * (testTf / 100);
          if (ps <= rl) ok++;
        });
        if ((ok / chartData.length) * 100 >= targetPct) return testTf;
      }
      return 0;
    };

    const tf95 = findTfForConfidence(95);
    const tf90 = findTfForConfidence(90);

    return {
      chartData,
      abnahmeQuote,
      garantierterTF,
      totalVariable,
      totalAbgenommen,
      totalUeberschuss,
      ueberschussStunden,
      tf95,
      tf90,
      minRestlast,
      maxRestlast,
    };
  }, [consumerProfile, fixedProducerProfile, variableProducerProfile, selectedDate, tf, loadProfiles]);

  const monthAnalysis = useMemo(() => {
    if (!consumerProfile || !fixedProducerProfile || !variableProducerProfile || !selectedDate || viewMode !== 'month') {
      return null;
    }

    const consumer = loadProfiles.find(p => p.id === consumerProfile);
    const fixedProducer = loadProfiles.find(p => p.id === fixedProducerProfile);
    const variableProducer = loadProfiles.find(p => p.id === variableProducerProfile);

    if (!consumer?.parsedData || !fixedProducer?.parsedData || !variableProducer?.parsedData) {
      return null;
    }

    const targetDate = new Date(selectedDate);
    const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);

    const daysInMonth = monthEnd.getDate();
    const dailyResults = [];
    let monthTotalVariable = 0;
    let monthTotalAbgenommen = 0;
    let monthTotalUeberschuss = 0;
    let monthMinRestlast = Infinity;
    let monthMaxVariable = -Infinity;

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), day, 0, 0, 0, 0);
      const dayEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), day, 23, 59, 59, 999);

      const filterByDay = (data: any[]) => {
        return data.filter(d => {
          const timestamp = new Date(d.timestamp);
          return timestamp >= dayStart && timestamp <= dayEnd;
        });
      };

      const consumerDayData = filterByDay(consumer.parsedData);
      const fixedDayData = filterByDay(fixedProducer.parsedData);
      const variableDayData = filterByDay(variableProducer.parsedData);

      if (consumerDayData.length === 0 || fixedDayData.length === 0 || variableDayData.length === 0) {
        continue;
      }

      const aggregatedConsumer = aggregateDataByInterval(consumerDayData, 'hour');
      const aggregatedFixed = aggregateDataByInterval(fixedDayData, 'hour');
      const aggregatedVariable = aggregateDataByInterval(variableDayData, 'hour');

      let dayTotalVariable = 0;
      let dayTotalAbgenommen = 0;
      let dayTotalUeberschuss = 0;
      let dayMinRestlast = Infinity;
      let dayMaxVariable = -Infinity;

      aggregatedConsumer.forEach((consumerPoint, idx) => {
        const fixedPoint = aggregatedFixed[idx] || { avg_kw: 0 };
        const variablePoint = aggregatedVariable[idx] || { avg_kw: 0 };

        const consumerValue = consumerPoint.avg_kw;
        const fixedProducerValue = fixedPoint.avg_kw;
        const variableProducerMax = variablePoint.avg_kw;

        const restlast = Math.max(0, consumerValue - fixedProducerValue);
        const variableScaled = variableProducerMax * (tf / 100);
        const abgenommen = Math.min(variableScaled, restlast);
        const ueberschuss = Math.max(0, variableScaled - restlast);

        dayTotalVariable += variableScaled;
        dayTotalAbgenommen += abgenommen;
        dayTotalUeberschuss += ueberschuss;

        if (restlast < dayMinRestlast) dayMinRestlast = restlast;
        if (variableProducerMax > dayMaxVariable) dayMaxVariable = variableProducerMax;
      });

      monthTotalVariable += dayTotalVariable;
      monthTotalAbgenommen += dayTotalAbgenommen;
      monthTotalUeberschuss += dayTotalUeberschuss;

      if (dayMinRestlast < monthMinRestlast) monthMinRestlast = dayMinRestlast;
      if (dayMaxVariable > monthMaxVariable) monthMaxVariable = dayMaxVariable;

      const dayAbnahmeQuote = dayTotalVariable > 0 ? (dayTotalAbgenommen / dayTotalVariable) * 100 : 100;

      dailyResults.push({
        date: dayStart,
        day: day,
        label: `${day}.${(targetDate.getMonth() + 1).toString().padStart(2, '0')}`,
        totalVariable: dayTotalVariable,
        totalAbgenommen: dayTotalAbgenommen,
        totalUeberschuss: dayTotalUeberschuss,
        abnahmeQuote: dayAbnahmeQuote,
        minRestlast: dayMinRestlast,
      });
    }

    if (dailyResults.length === 0) {
      return null;
    }

    const monthAbnahmeQuote = monthTotalVariable > 0 ? (monthTotalAbgenommen / monthTotalVariable) * 100 : 100;
    const monthGarantierterTF = monthMinRestlast > 0 && monthMaxVariable > 0
      ? Math.floor((monthMinRestlast / monthMaxVariable) * 100)
      : 0;

    return {
      dailyResults,
      monthTotalVariable,
      monthTotalAbgenommen,
      monthTotalUeberschuss,
      monthAbnahmeQuote,
      monthGarantierterTF,
      monthMinRestlast,
      monthMaxVariable,
    };
  }, [consumerProfile, fixedProducerProfile, variableProducerProfile, selectedDate, tf, loadProfiles, viewMode]);

  const currentAnalysis = viewMode === 'month' ? monthAnalysis : analysis;
  const abnahmeQuote = viewMode === 'month' ? monthAnalysis?.monthAbnahmeQuote : analysis?.abnahmeQuote;

  const sliderColor = abnahmeQuote && abnahmeQuote >= 99.5
    ? '#10b981'
    : abnahmeQuote && abnahmeQuote >= 90
    ? '#f59e0b'
    : '#ef4444';

  const canAnalyze = consumerProfile && fixedProducerProfile && variableProducerProfile && selectedDate;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">Teilnahmefaktor Optimizer</h1>
          <div
            className="relative"
            onMouseEnter={() => setShowInfoBubble(true)}
            onMouseLeave={() => setShowInfoBubble(false)}
          >
            <div className="p-2 hover:bg-gray-100 rounded-full transition-colors cursor-help">
              <Info className="w-5 h-5 text-gray-600" />
            </div>
            {showInfoBubble && (
              <div className="absolute left-0 top-full mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50">
                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-sm mb-1">Wie funktioniert der Teilnahmefaktor?</h3>
                    <p className="text-xs text-gray-700">
                      Wählen Sie ein Verbrauchsprofil und zwei Einspeiseprofile (ein fixes und ein variables).
                      Der Teilnahmefaktor bestimmt, wie viel % des variablen Einspeiseprofils tatsächlich eingespeist wird
                      und berechnet, wie viel davon vom Verbraucher abgenommen werden kann.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <p className="text-gray-600 mt-2">
          Optimieren Sie den Teilnahmefaktor für variable Einspeiseprofile
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Profil-Auswahl</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Verbrauchsprofil
            </label>
            <select
              value={consumerProfile}
              onChange={(e) => setConsumerProfile(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            >
              <option value="">Wählen...</option>
              {consumerProfiles.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fixes Einspeiseprofil
            </label>
            <select
              value={fixedProducerProfile}
              onChange={(e) => setFixedProducerProfile(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            >
              <option value="">Wählen...</option>
              {producerProfiles.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Variables Einspeiseprofil
            </label>
            <select
              value={variableProducerProfile}
              onChange={(e) => setVariableProducerProfile(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            >
              <option value="">Wählen...</option>
              {producerProfiles.filter(p => p.id !== fixedProducerProfile).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Zeitraum
            </label>
            <div className="flex gap-2">
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as 'day' | 'month')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              >
                <option value="day">Tag</option>
                <option value="month">Monat</option>
              </select>
              <input
                type={viewMode === 'month' ? 'month' : 'date'}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      {!canAnalyze ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">
            Bitte wählen Sie alle Profile und einen Zeitraum aus, um die Analyse zu starten
          </p>
        </div>
      ) : !currentAnalysis ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">
            Keine Daten für den ausgewählten Zeitraum gefunden
          </p>
        </div>
      ) : viewMode === 'month' && monthAnalysis ? (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex justify-between items-end mb-4">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                  Teilnahmefaktor {variableProducerProfile && loadProfiles.find(p => p.id === variableProducerProfile)?.name}
                </div>
                <div className="text-5xl font-bold font-mono" style={{ color: sliderColor }}>
                  {tf}<span className="text-2xl text-gray-400">%</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500">Monatliche Produktion</div>
                <div className="text-xl font-bold font-mono" style={{ color: '#eab308' }}>
                  {monthAnalysis.monthTotalVariable.toFixed(0)} kWh
                </div>
              </div>
            </div>

            <div className="relative mb-5">
              <div className="absolute top-2 left-0 right-0 h-1.5 rounded-full bg-gray-200" />
              <div
                className="absolute top-2 left-0 h-1.5 rounded-full transition-all duration-150"
                style={{
                  width: `${tf}%`,
                  background: `linear-gradient(90deg, #3b82f6, ${sliderColor})`,
                }}
              />
              <div
                className="absolute top-2 h-1.5 w-0.5 rounded"
                style={{ left: `${monthAnalysis.monthGarantierterTF}%`, background: '#10b981' }}
                title={`100% Garantie: ${monthAnalysis.monthGarantierterTF}%`}
              />
              <input
                type="range"
                min={0}
                max={100}
                value={tf}
                onChange={(e) => setTf(Number(e.target.value))}
                className="relative w-full h-6 bg-transparent appearance-none cursor-pointer z-10"
                style={{
                  WebkitAppearance: 'none',
                }}
              />
              <style>{`
                input[type=range]::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  width: 20px;
                  height: 20px;
                  border-radius: 50%;
                  background: ${sliderColor};
                  border: 3px solid #ffffff;
                  box-shadow: 0 0 10px ${sliderColor}66;
                  cursor: pointer;
                }
                input[type=range]::-moz-range-thumb {
                  width: 20px;
                  height: 20px;
                  border-radius: 50%;
                  background: ${sliderColor};
                  border: 3px solid #ffffff;
                  box-shadow: 0 0 10px ${sliderColor}66;
                  cursor: pointer;
                }
              `}</style>
            </div>

            <div className="flex justify-between text-xs text-gray-600">
              <span>0%</span>
              <div className="flex gap-6">
                <span>
                  <span className="inline-block w-2 h-2 rounded-sm bg-green-500 mr-1" />
                  100% Garantie: {monthAnalysis.monthGarantierterTF}%
                </span>
              </div>
              <span>100%</span>
            </div>
          </div>

          <div className="flex gap-4 mb-6 flex-wrap">
            <MetricCard
              label="Abnahme-Quote (Monat)"
              value={monthAnalysis.monthAbnahmeQuote.toFixed(1)}
              unit="%"
              color={sliderColor}
              sub={monthAnalysis.monthAbnahmeQuote >= 99.5 ? 'Vollständige Abnahme' : `${monthAnalysis.dailyResults.filter(d => d.totalUeberschuss > 0).length} Tage mit Überschuss`}
            />
            <MetricCard
              label="Monatsproduktion (variabel)"
              value={monthAnalysis.monthTotalVariable.toFixed(0)}
              unit="kWh"
              sub={`bei TF ${tf}%`}
            />
            <MetricCard
              label="Davon abgenommen"
              value={monthAnalysis.monthTotalAbgenommen.toFixed(0)}
              unit="kWh"
              color="#10b981"
              sub={`${(monthAnalysis.monthTotalAbgenommen / monthAnalysis.dailyResults.length).toFixed(1)} kWh/Tag Ø`}
            />
            <MetricCard
              label="Überschuss"
              value={monthAnalysis.monthTotalUeberschuss.toFixed(0)}
              unit="kWh"
              color={monthAnalysis.monthTotalUeberschuss > 0 ? '#ef4444' : '#10b981'}
              sub={monthAnalysis.monthTotalUeberschuss > 0 ? `${(monthAnalysis.monthTotalUeberschuss / monthAnalysis.monthTotalVariable * 100).toFixed(1)}% nicht abgenommen` : 'Kein Überschuss'}
            />
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tägliche Abnahme im Monat</h3>
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={monthAnalysis.dailyResults} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} unit=" kWh" />
                <Tooltip
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    return (
                      <div className="bg-gray-900 bg-opacity-95 border border-gray-700 rounded-lg p-4 text-sm shadow-lg">
                        <div className="font-bold text-white mb-2">{d.label}</div>
                        <div className="space-y-1">
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-300">Variable (TF {tf}%):</span>
                            <span className="text-yellow-400 font-semibold">{d.totalVariable.toFixed(1)} kWh</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-300">Abgenommen:</span>
                            <span className="text-green-500 font-semibold">{d.totalAbgenommen.toFixed(1)} kWh</span>
                          </div>
                          {d.totalUeberschuss > 0 && (
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-300">Überschuss:</span>
                              <span className="text-red-500 font-semibold">{d.totalUeberschuss.toFixed(1)} kWh</span>
                            </div>
                          )}
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-300">Quote:</span>
                            <span className="text-sky-400 font-semibold">{d.abnahmeQuote.toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend />
                <Bar dataKey="totalAbgenommen" stackId="prod" fill="#fbbf24" name="Variable (abgenommen)" barSize={24} />
                <Bar dataKey="totalUeberschuss" stackId="prod" fill="#ef4444" name="Variable (Überschuss)" barSize={24} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Monats-Statistik</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex gap-3 items-center p-4 bg-gray-50 rounded-lg" style={{ borderLeft: `4px solid #10b981` }}>
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center font-bold text-sm font-mono flex-shrink-0"
                  style={{ background: '#10b98122', color: '#10b981' }}
                >
                  {monthAnalysis.monthGarantierterTF}%
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">100% Abnahmegarantie</div>
                  <div className="text-xs text-gray-600">Für alle Stunden im Monat</div>
                </div>
              </div>
              <div className="flex gap-3 items-center p-4 bg-gray-50 rounded-lg" style={{ borderLeft: `4px solid #3b82f6` }}>
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center font-bold text-sm font-mono flex-shrink-0"
                  style={{ background: '#3b82f622', color: '#3b82f6' }}
                >
                  {monthAnalysis.dailyResults.length}
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">Tage analysiert</div>
                  <div className="text-xs text-gray-600">Mit vollständigen Daten</div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : analysis ? (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex justify-between items-end mb-4">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                  Teilnahmefaktor {variableProducerProfile && loadProfiles.find(p => p.id === variableProducerProfile)?.name}
                </div>
                <div className="text-5xl font-bold font-mono" style={{ color: sliderColor }}>
                  {tf}<span className="text-2xl text-gray-400">%</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500">Effektive Einspeisung Ø</div>
                <div className="text-xl font-bold font-mono" style={{ color: '#eab308' }}>
                  {analysis.chartData.length > 0
                    ? (analysis.chartData.reduce((sum, d) => sum + d.variableScaled, 0) / analysis.chartData.length).toFixed(1)
                    : '0.0'} kWh/h
                </div>
              </div>
            </div>

            <div className="relative mb-5">
              <div className="absolute top-2 left-0 right-0 h-1.5 rounded-full bg-gray-200" />
              <div
                className="absolute top-2 left-0 h-1.5 rounded-full transition-all duration-150"
                style={{
                  width: `${tf}%`,
                  background: `linear-gradient(90deg, #3b82f6, ${sliderColor})`,
                }}
              />
              <div
                className="absolute top-2 h-1.5 w-0.5 rounded"
                style={{ left: `${analysis.garantierterTF}%`, background: '#10b981' }}
                title={`100% Garantie: ${analysis.garantierterTF}%`}
              />
              <div
                className="absolute top-2 h-1.5 w-0.5 rounded"
                style={{ left: `${analysis.tf95}%`, background: '#f59e0b' }}
                title={`95% Konfidenz: ${analysis.tf95}%`}
              />
              <input
                type="range"
                min={0}
                max={100}
                value={tf}
                onChange={(e) => setTf(Number(e.target.value))}
                className="relative w-full h-6 bg-transparent appearance-none cursor-pointer z-10"
                style={{
                  WebkitAppearance: 'none',
                }}
              />
              <style>{`
                input[type=range]::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  width: 20px;
                  height: 20px;
                  border-radius: 50%;
                  background: ${sliderColor};
                  border: 3px solid #ffffff;
                  box-shadow: 0 0 10px ${sliderColor}66;
                  cursor: pointer;
                }
                input[type=range]::-moz-range-thumb {
                  width: 20px;
                  height: 20px;
                  border-radius: 50%;
                  background: ${sliderColor};
                  border: 3px solid #ffffff;
                  box-shadow: 0 0 10px ${sliderColor}66;
                  cursor: pointer;
                }
              `}</style>
            </div>

            <div className="flex justify-between text-xs text-gray-600">
              <span>0%</span>
              <div className="flex gap-6">
                <span>
                  <span className="inline-block w-2 h-2 rounded-sm bg-green-500 mr-1" />
                  100% Garantie: {analysis.garantierterTF}%
                </span>
                <span>
                  <span className="inline-block w-2 h-2 rounded-sm bg-amber-500 mr-1" />
                  95% Konfidenz: {analysis.tf95}%
                </span>
              </div>
              <span>100%</span>
            </div>
          </div>

          <div className="flex gap-4 mb-6 flex-wrap">
            <MetricCard
              label="Abnahme-Quote"
              value={analysis.abnahmeQuote.toFixed(1)}
              unit="%"
              color={sliderColor}
              sub={analysis.abnahmeQuote >= 99.5 ? 'Vollständige Abnahme' : `${analysis.ueberschussStunden}h mit Überschuss`}
            />
            <MetricCard
              label="Tagesproduktion (variabel)"
              value={analysis.totalVariable.toFixed(0)}
              unit="kWh"
              sub={`bei TF ${tf}%`}
            />
            <MetricCard
              label="Davon abgenommen"
              value={analysis.totalAbgenommen.toFixed(0)}
              unit="kWh"
              color="#10b981"
              sub={`${(analysis.totalAbgenommen / 24).toFixed(1)} kWh/h Ø`}
            />
            <MetricCard
              label="Überschuss"
              value={analysis.totalUeberschuss.toFixed(0)}
              unit="kWh"
              color={analysis.totalUeberschuss > 0 ? '#ef4444' : '#10b981'}
              sub={analysis.totalUeberschuss > 0 ? `${(analysis.totalUeberschuss / analysis.totalVariable * 100).toFixed(1)}% nicht abgenommen` : 'Kein Überschuss'}
            />
          </div>

          <div className="flex gap-3 mb-4">
            {[
              { key: 'stacked', label: 'Gestapelte Ansicht' },
              { key: 'restlast', label: 'Restlast vs. Variable' },
            ].map(m => (
              <button
                key={m.key}
                onClick={() => setShowMode(m.key as any)}
                className={`px-4 py-2 rounded-lg border font-medium text-sm transition-all ${
                  showMode === m.key
                    ? 'bg-sky-100 border-sky-400 text-sky-700'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <ResponsiveContainer width="100%" height={400}>
              {showMode === 'stacked' ? (
                <ComposedChart data={analysis.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} unit=" kWh" />
                  <Tooltip content={<CustomTooltip tf={tf} />} />
                  <Legend />
                  <Bar dataKey="fixedProducerValue" stackId="prod" fill="#f59e0b" name="Fix-Einspeisung" barSize={24} />
                  <Bar dataKey="abgenommen" stackId="prod" fill="#fbbf24" name="Variable (abgenommen)" barSize={24} />
                  <Bar dataKey="ueberschuss" stackId="prod" fill="#ef4444" name="Variable (Überschuss)" barSize={24} />
                  <Line type="monotone" dataKey="consumerValue" stroke="#3b82f6" strokeWidth={2.5} dot={false} name="Verbrauch" />
                </ComposedChart>
              ) : (
                <ComposedChart data={analysis.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} unit=" kWh" />
                  <Tooltip content={<CustomTooltip tf={tf} />} />
                  <Legend />
                  <Area type="monotone" dataKey="restlast" fill="#3b82f6" fillOpacity={0.2} stroke="#3b82f6" strokeWidth={2} name="Restlast" />
                  <Line type="monotone" dataKey="variableScaled" stroke="#fbbf24" strokeWidth={2.5} strokeDasharray="6 3" dot={false} name={`Variable @ ${tf}%`} />
                  <Area type="monotone" dataKey="ueberschuss" fill="#ef4444" fillOpacity={0.3} stroke="#ef4444" strokeWidth={1.5} name="Überschuss" />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Teilnahmefaktor-Referenz</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: '100% Abnahmegarantie', value: `${analysis.garantierterTF}%`, color: '#10b981', desc: 'Kein Intervall mit Überschuss' },
                { label: '95% Konfidenz', value: `${analysis.tf95}%`, color: '#f59e0b', desc: 'In 95% der Stunden voll abgenommen' },
                { label: '90% Konfidenz', value: `${analysis.tf90}%`, color: '#ef4444', desc: 'In 90% der Stunden voll abgenommen' },
              ].map((item, i) => (
                <div key={i} className="flex gap-3 items-center p-4 bg-gray-50 rounded-lg" style={{ borderLeft: `4px solid ${item.color}` }}>
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center font-bold text-sm font-mono flex-shrink-0"
                    style={{ background: `${item.color}22`, color: item.color }}
                  >
                    {item.value}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{item.label}</div>
                    <div className="text-xs text-gray-600">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
