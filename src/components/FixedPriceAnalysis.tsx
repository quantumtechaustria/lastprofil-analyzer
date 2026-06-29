import { useState, useEffect, useMemo } from 'react';
import { Calculator, Zap, DollarSign, TrendingDown, TrendingUp, Info } from 'lucide-react';
import { formatNumberGerman, formatIntegerGerman, formatLargeNumberGerman } from '../lib/utils';

export interface FixedPriceAnalysisResult {
  totalKwh: number;
  priceNow: number;
  priceNew: number;
  costNow: number;
  costNew: number;
  savings: number;
  isProducer: boolean;
  dateRange: { start: string; end: string };
}

interface FixedPriceAnalysisProps {
  profile: any;
  onResultChange?: (result: FixedPriceAnalysisResult | null) => void;
}

export default function FixedPriceAnalysis({ profile, onResultChange }: FixedPriceAnalysisProps) {
  const isProducer = profile?.profile_type === 'producer';
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateRange, setDateRange] = useState({ min: '', max: '' });
  const [fixedPriceNow, setFixedPriceNow] = useState<string>('');
  const [fixedPriceNew, setFixedPriceNew] = useState<string>('');
  const [showInfoBubble, setShowInfoBubble] = useState(false);

  useEffect(() => {
    if (profile?.parsedData && profile.parsedData.length > 0) {
      try {
        const timestamps = profile.parsedData.map((p: any) => new Date(p.timestamp));
        const minDate = new Date(Math.min(...timestamps.map((d: Date) => d.getTime())));
        const maxDate = new Date(Math.max(...timestamps.map((d: Date) => d.getTime())));

        const minStr = minDate.toISOString().split('T')[0];
        const maxStr = maxDate.toISOString().split('T')[0];

        setDateRange({ min: minStr, max: maxStr });
        setStartDate(minStr);
        setEndDate(maxStr);
      } catch (err) {
        console.error('Error setting date range:', err);
      }
    }
  }, [profile]);

  // Gesamtverbrauch / Gesamteinspeisung im gewählten Zeitraum (kWh)
  const totalKwh = useMemo(() => {
    if (!profile?.parsedData) return 0;

    const filterStartDate = startDate ? new Date(startDate + 'T00:00:00') : null;
    const filterEndDate = endDate ? new Date(endDate + 'T23:59:59') : null;

    const dataUnit = profile.data_unit || 'kW';

    return profile.parsedData.reduce((sum: number, point: any) => {
      const timestamp = new Date(point.timestamp);
      if (filterStartDate && filterEndDate) {
        if (timestamp < filterStartDate || timestamp > filterEndDate) return sum;
      }
      const energyKwh = dataUnit === 'kW' ? point.power_kw * 0.25 : point.power_kw;
      return sum + energyKwh;
    }, 0);
  }, [profile, startDate, endDate]);

  const priceNow = parseFloat(fixedPriceNow);
  const priceNew = parseFloat(fixedPriceNew);
  const hasValidPrices = !isNaN(priceNow) && !isNaN(priceNew);

  const costNow = totalKwh * priceNow / 100;
  const costNew = totalKwh * priceNew / 100;
  // Ersparnis = Kosten/Gutschrift jetzt im Vergleich zu neu
  // Verbraucher: Ersparnis wenn neue Kosten niedriger (costNow - costNew > 0)
  // Erzeuger: Vorteil wenn neue Gutschrift höher (costNew - costNow > 0)
  const savings = isProducer ? costNew - costNow : costNow - costNew;
  const isImprovement = savings > 0;

  useEffect(() => {
    if (hasValidPrices && totalKwh > 0) {
      onResultChange?.({
        totalKwh,
        priceNow,
        priceNew,
        costNow,
        costNew,
        savings,
        isProducer,
        dateRange: { start: startDate, end: endDate },
      });
    } else {
      onResultChange?.(null);
    }
  }, [totalKwh, priceNow, priceNew, costNow, costNew, savings, hasValidPrices, startDate, endDate, isProducer]);

  return (
    <div className="bg-white rounded-lg shadow-md border border-white p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-gray-900">Fixpreis-Analyse</h3>
            <div className="relative">
              <button
                onClick={() => setShowInfoBubble(!showInfoBubble)}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Berechnungsmethode"
              >
                <Info className="w-5 h-5 text-gray-600" />
              </button>
              {showInfoBubble && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowInfoBubble(false)} />
                  <div className="absolute left-0 top-full mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50">
                    <p className="font-semibold mb-2 text-sm text-gray-900">Berechnungsmethode:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs text-gray-700">
                      <li><strong>{isProducer ? 'Gesamteinspeisung' : 'Gesamtverbrauch'}:</strong> Summe aller Energiemengen im gewählten Zeitraum (kW × 0,25 h bzw. kWh direkt)</li>
                      <li><strong>{isProducer ? 'Gutschrift' : 'Kosten'} = {isProducer ? 'Gesamteinspeisung' : 'Gesamtverbrauch'} (kWh) × Fixpreis (ct/kWh) ÷ 100</strong></li>
                      <li><strong>Berechnung jetzt vs. neu:</strong> Dieselbe Energiemenge wird mit dem aktuellen und dem neuen Fixpreis gerechnet</li>
                      <li><strong>{isProducer ? 'Vorteil' : 'Ersparnis'}:</strong> Differenz zwischen {isProducer ? 'neuer und aktueller Gutschrift' : 'aktuellen und neuen Kosten'}</li>
                    </ul>
                  </div>
                </>
              )}
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Vergleichen Sie Ihren aktuellen Fixpreis mit einem optimierten Fixpreis für {profile.name}
          </p>
        </div>
        <Calculator className="h-8 w-8 text-emerald-600" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label htmlFor="fixStartDate" className="block text-sm font-medium text-gray-700 mb-2">
            Von
          </label>
          <input
            type="date"
            id="fixStartDate"
            value={startDate}
            min={dateRange.min}
            max={dateRange.max}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        <div>
          <label htmlFor="fixEndDate" className="block text-sm font-medium text-gray-700 mb-2">
            Bis
          </label>
          <input
            type="date"
            id="fixEndDate"
            value={endDate}
            min={dateRange.min}
            max={dateRange.max}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        <div>
          <label htmlFor="fixedPriceNow" className="block text-sm font-medium text-gray-700 mb-2">
            Fixpreis jetzt (ct/kWh)
          </label>
          <input
            type="number"
            step="0.001"
            id="fixedPriceNow"
            value={fixedPriceNow}
            onChange={(e) => setFixedPriceNow(e.target.value)}
            placeholder="z.B. 25,000"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        <div>
          <label htmlFor="fixedPriceNew" className="block text-sm font-medium text-gray-700 mb-2">
            Fixpreis neu (ct/kWh)
          </label>
          <input
            type="number"
            step="0.001"
            id="fixedPriceNew"
            value={fixedPriceNew}
            onChange={(e) => setFixedPriceNew(e.target.value)}
            placeholder="z.B. 22,000"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
      </div>

      {hasValidPrices && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-5 border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-5 w-5 text-blue-600" />
              <p className="text-sm font-medium text-blue-900">
                {isProducer ? 'Gesamteinspeisung' : 'Gesamtverbrauch'}
              </p>
            </div>
            <p className="text-2xl font-bold text-blue-900">
              {formatIntegerGerman(totalKwh)} kWh
            </p>
            <p className="text-xs text-blue-700 mt-1">
              {formatLargeNumberGerman(totalKwh / 1000)} MWh
            </p>
          </div>

          <div className="bg-gradient-to-br from-sky-50 to-sky-100 rounded-lg p-5 border border-sky-200">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-5 w-5 text-sky-600" />
              <p className="text-sm font-medium text-sky-900">
                {isProducer ? 'Gutschrift jetzt' : 'Kosten jetzt'}
              </p>
            </div>
            <p className="text-2xl font-bold text-sky-900">
              {formatNumberGerman(costNow)} €
            </p>
            <p className="text-xs text-sky-700 mt-1">
              Fixpreis: {fixedPriceNow} ct/kWh
            </p>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-5 border border-amber-200">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-5 w-5 text-amber-600" />
              <p className="text-sm font-medium text-amber-900">
                {isProducer ? 'Gutschrift neu' : 'Kosten neu'}
              </p>
            </div>
            <p className="text-2xl font-bold text-amber-900">
              {formatNumberGerman(costNew)} €
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Fixpreis: {fixedPriceNew} ct/kWh
            </p>
          </div>

          <div className={`bg-gradient-to-br rounded-lg p-5 border ${
            isImprovement
              ? 'from-emerald-50 to-emerald-100 border-emerald-200'
              : 'from-red-50 to-red-100 border-red-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {isImprovement
                ? <TrendingDown className="h-5 w-5 text-emerald-600" />
                : <TrendingUp className="h-5 w-5 text-red-600" />
              }
              <p className={`text-sm font-medium ${isImprovement ? 'text-emerald-900' : 'text-red-900'}`}>
                {isImprovement ? 'Ersparnis' : 'Mehrkosten'}
              </p>
            </div>
            <p className={`text-2xl font-bold ${isImprovement ? 'text-emerald-900' : 'text-red-900'}`}>
              {formatNumberGerman(Math.abs(savings))} €
            </p>
            <p className={`text-xs mt-1 ${isImprovement ? 'text-emerald-700' : 'text-red-700'}`}>
              {isProducer
                ? (isImprovement ? 'Höhere Gutschrift mit neuem Fixpreis' : 'Geringere Gutschrift mit neuem Fixpreis')
                : (isImprovement ? 'Einsparung mit neuem Fixpreis' : 'Mehrkosten mit neuem Fixpreis')
              }
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
