import { useState, useEffect } from 'react';
import { AlertCircle, Calculator, Loader2, TrendingDown, TrendingUp, Zap, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { calculateSpotPriceCosts } from '../lib/spot-price-cost-calculator';
import type { SpotPriceCostResult } from '../lib/spot-price-cost-calculator';
import { formatNumberGerman, formatLargeNumberGerman, formatIntegerGerman, formatNumberGerman3Decimals, utcToCETDate } from '../lib/utils';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface SpotPriceAnalysisProps {
  profile: any;
  onResultChange?: (result: SpotPriceCostResult | null, handlingFee: number, startDate: string, endDate: string, egComparisonPrice?: number) => void;
}

export default function SpotPriceAnalysis({ profile, onResultChange }: SpotPriceAnalysisProps) {
  const isProducer = profile?.profile_type === 'producer';
  const [spotPricesAvailable, setSpotPricesAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SpotPriceCostResult | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateRange, setDateRange] = useState({ min: '', max: '' });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showDetailedView, setShowDetailedView] = useState(false);
  const [handlingFee, setHandlingFee] = useState<string>('');
  const [egComparisonEnabled, setEgComparisonEnabled] = useState(false);
  const [egComparisonPrice, setEgComparisonPrice] = useState<string>('');

  useEffect(() => {
    if (result) {
      const egPrice = egComparisonEnabled && parseFloat(egComparisonPrice) > 0 ? parseFloat(egComparisonPrice) : undefined;
      onResultChange?.(result, parseFloat(handlingFee) || 0, startDate, endDate, egPrice);
    }
  }, [handlingFee, egComparisonEnabled, egComparisonPrice]);

  useEffect(() => {
    checkSpotPricesAvailable();
  }, []);

  useEffect(() => {
    if (profile?.parsedData && profile.parsedData.length > 0) {
      try {
        const timestamps = profile.parsedData.map((p: any) => new Date(p.timestamp));
        const minDate = new Date(Math.min(...timestamps.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...timestamps.map(d => d.getTime())));

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

  async function checkSpotPricesAvailable() {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        const localData = localStorage.getItem('spot_prices_local');
        setSpotPricesAvailable(!!localData);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('spot_prices')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (error) throw error;

      setSpotPricesAvailable(data && data.length > 0);
    } catch (err) {
      console.error('Error checking spot prices:', err);
      setSpotPricesAvailable(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleCalculate() {
    if (!profile?.parsedData) {
      setError('Profil-Daten nicht verfügbar');
      return;
    }

    setCalculating(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      let spotPrices: Array<{ timestamp: Date; priceCtKwh: number }>;

      if (!user) {
        const localData = localStorage.getItem('spot_prices_local');
        if (!localData) throw new Error('Keine Spot-Preise gefunden');

        const parsed = JSON.parse(localData);
        spotPrices = parsed.data.map((sp: any) => ({
          timestamp: utcToCETDate(new Date(sp.timestamp)),
          priceCtKwh: parseFloat(sp.price_ct_kwh),
        }));
      } else {
        let allSpotPrices: any[] = [];
        let from = 0;
        const batchSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const to = from + batchSize - 1;
          const { data: spotPricesData, error: spotError } = await supabase
            .from('spot_prices')
            .select('timestamp, price_ct_kwh')
            .eq('user_id', user.id)
            .order('timestamp', { ascending: true })
            .range(from, to);

          if (spotError) throw spotError;

          if (!spotPricesData || spotPricesData.length === 0) {
            hasMore = false;
          } else {
            allSpotPrices.push(...spotPricesData);

            if (spotPricesData.length < batchSize) {
              hasMore = false;
            } else {
              from = to + 1;
            }
          }
        }

        if (allSpotPrices.length === 0) {
          throw new Error('Keine Spot-Preise gefunden');
        }

        spotPrices = allSpotPrices.map((sp: any) => ({
          timestamp: utcToCETDate(new Date(sp.timestamp)),
          priceCtKwh: parseFloat(sp.price_ct_kwh),
        }));
      }

      const filterStartDate = startDate ? new Date(startDate + 'T00:00:00') : null;
      const filterEndDate = endDate ? new Date(endDate + 'T23:59:59') : null;

      console.log('Starting spot price calculation with:', {
        profileDataLength: profile.parsedData.length,
        spotPricesLength: spotPrices.length,
        dataUnit: profile.data_unit,
        filterStartDate,
        filterEndDate,
      });

      let filteredProfileData = profile.parsedData;

      if (filterStartDate && filterEndDate) {
        filteredProfileData = profile.parsedData.filter((point: any) => {
          const timestamp = new Date(point.timestamp);
          return timestamp >= filterStartDate && timestamp <= filterEndDate;
        });

        console.log(`Filtered profile data from ${profile.parsedData.length} to ${filteredProfileData.length} entries`);
      }

      const loadProfileData = filteredProfileData.map((point: any) => ({
        timestamp: new Date(point.timestamp),
        power_kw: point.power_kw,
      }));

      const filteredSpotPrices = filterStartDate && filterEndDate
        ? spotPrices.filter(sp => sp.timestamp >= filterStartDate && sp.timestamp <= filterEndDate)
        : spotPrices;

      console.log('Filtered spot prices:', {
        original: spotPrices.length,
        filtered: filteredSpotPrices.length,
      });

      const calculationResult = calculateSpotPriceCosts(
        loadProfileData,
        filteredSpotPrices,
        profile.data_unit || 'kW'
      );

      setResult(calculationResult);
      const egPrice = egComparisonEnabled && parseFloat(egComparisonPrice) > 0 ? parseFloat(egComparisonPrice) : undefined;
      onResultChange?.(calculationResult, parseFloat(handlingFee) || 0, startDate, endDate, egPrice);
    } catch (err) {
      console.error('Error calculating spot price costs:', err);
      setError(err instanceof Error ? err.message : 'Fehler bei der Berechnung');
    } finally {
      setCalculating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
      </div>
    );
  }

  if (!spotPricesAvailable) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-yellow-900 mb-2">
              Keine Spot-Preise verfügbar
            </h3>
            <p className="text-yellow-800 text-sm mb-4">
              Um die Spotpreis-Analyse durchzuführen, müssen Sie zuerst EPEX Spot-Preise laden.
            </p>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent('navigate', { detail: 'spot-prices' }));
              }}
              className="text-yellow-900 underline font-medium text-sm hover:text-yellow-700"
            >
              Jetzt Spot-Preise laden →
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Spotpreis-Analyse</h3>
            <p className="text-sm text-gray-600 mt-1">
              Berechnen Sie die tatsächlichen {isProducer ? 'Gutschriften' : 'Kosten'} für {profile.name} basierend auf den Spotmarkt-Preisen
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-2">
              Von Datum
            </label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={dateRange.min}
              max={dateRange.max}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-2">
              Bis Datum
            </label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={dateRange.min}
              max={dateRange.max}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
          <div>
            <label htmlFor="handlingFee" className="block text-sm font-medium text-gray-700 mb-2">
              Handling Fee (ct/kWh)
            </label>
            <input
              type="number"
              id="handlingFee"
              value={handlingFee}
              onChange={(e) => setHandlingFee(e.target.value)}
              placeholder="z.B. 0,50"
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
        </div>

        {dateRange.min && dateRange.max && (
          <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              Verfügbarer Zeitraum: <span className="font-semibold">{format(new Date(dateRange.min), 'dd.MM.yyyy', { locale: de })}</span> bis <span className="font-semibold">{format(new Date(dateRange.max), 'dd.MM.yyyy', { locale: de })}</span>
            </p>
          </div>
        )}

        <button
          onClick={handleCalculate}
          disabled={calculating || !startDate || !endDate}
          className="inline-flex items-center gap-2 px-6 py-3 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {calculating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Berechne...
            </>
          ) : (
            <>
              <Calculator className="h-5 w-5" />
              {isProducer ? 'Gutschrift berechnen' : 'Kosten berechnen'}
            </>
          )}
        </button>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}
      </div>

      {result && (
        <>
          <div className={`grid grid-cols-1 gap-4 ${parseFloat(handlingFee) > 0 ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-blue-600" />
                  <p className="text-sm font-medium text-blue-900">{isProducer ? 'Gesamteinspeisung' : 'Gesamtverbrauch'}</p>
                </div>
              </div>
              <p className="text-3xl font-bold text-blue-900">
                {formatIntegerGerman(result.totalConsumptionKwh)} kWh
              </p>
              <p className="text-xs text-blue-700 mt-1">
                {formatLargeNumberGerman(result.totalConsumptionKwh / 1000)} MWh
              </p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-6 border border-orange-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-orange-600" />
                  <p className="text-sm font-medium text-orange-900">Ø Spotpreis</p>
                </div>
              </div>
              <p className="text-3xl font-bold text-orange-900">
                {formatNumberGerman(result.averagePriceCtKwh)} ct/kWh
              </p>
              <p className="text-xs text-orange-700 mt-1">
                Summe aller 15-Min-{isProducer ? 'Gutschriften' : 'Kosten'} / {isProducer ? 'Gesamteinspeisung' : 'Gesamtverbrauch'}
              </p>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-6 border border-emerald-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                  <p className="text-sm font-medium text-emerald-900">{isProducer ? 'Gesamtgutschrift' : 'Gesamtkosten'}</p>
                </div>
              </div>
              <p className="text-3xl font-bold text-emerald-900">
                {formatNumberGerman(result.totalCostEur)} €
              </p>
              <p className="text-xs text-emerald-700 mt-1">
                Σ ({isProducer ? 'Einspeisung' : 'Verbrauch'}₁₅ₘᵢₙ × Spotpreis₁₅ₘᵢₙ)
              </p>
            </div>

            {parseFloat(handlingFee) > 0 && (
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-6 border border-amber-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-amber-600" />
                    <p className="text-sm font-medium text-amber-900">Handling Fee</p>
                  </div>
                </div>
                <p className="text-3xl font-bold text-amber-900">
                  {formatNumberGerman(result.totalConsumptionKwh * parseFloat(handlingFee) / 100)} €
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  {formatIntegerGerman(result.totalConsumptionKwh)} kWh × {handlingFee} ct/kWh
                </p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <h4 className="text-lg font-bold text-gray-900 mb-4">Monatliche Auswertung</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Monat
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {isProducer ? 'Einspeisung (kWh)' : 'Verbrauch (kWh)'}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ø Preis (ct/kWh)
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {isProducer ? 'Gutschrift (€)' : 'Kosten (€)'}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {result.monthlyResults && result.monthlyResults.length > 0 ? (
                    result.monthlyResults.map((monthData) => {
                      try {
                        const [year, month] = monthData.month.split('-');
                        const monthName = format(new Date(parseInt(year), parseInt(month) - 1), 'MMMM yyyy', { locale: de });

                        return (
                          <tr key={monthData.month} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {monthName}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 text-right">
                              {formatIntegerGerman(monthData.consumptionKwh)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 text-right">
                              {formatNumberGerman(monthData.avgPriceCtKwh)}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                              {formatNumberGerman(monthData.costEur)}
                            </td>
                          </tr>
                        );
                      } catch (error) {
                        console.error('Error rendering month row:', monthData, error);
                        return null;
                      }
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-sm text-gray-500 text-center">
                        Keine monatlichen Daten verfügbar
                      </td>
                    </tr>
                  )}
                  <tr className="bg-gray-100 font-bold">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      Gesamt
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {formatIntegerGerman(result.totalConsumptionKwh)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {formatNumberGerman(result.averagePriceCtKwh)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {formatNumberGerman(result.totalCostEur)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* EG-Vergleich Section */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="egComparisonToggle"
                  checked={egComparisonEnabled}
                  onChange={(e) => setEgComparisonEnabled(e.target.checked)}
                  className="w-5 h-5 text-sky-600 rounded focus:ring-sky-500"
                />
                <label htmlFor="egComparisonToggle" className="text-lg font-semibold text-gray-900 cursor-pointer">
                  Vergleich: Spot vs. EG-Preis
                </label>
              </div>
            </div>

            {egComparisonEnabled && (
              <div className="space-y-6">
                <div className="max-w-xs">
                  <label htmlFor="egComparisonPrice" className="block text-sm font-medium text-gray-700 mb-1">
                    EG-Preis (ct/kWh)
                  </label>
                  <input
                    type="number"
                    id="egComparisonPrice"
                    value={egComparisonPrice}
                    onChange={(e) => setEgComparisonPrice(e.target.value)}
                    step="0.1"
                    min="0"
                    placeholder="z.B. 7,0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  />
                </div>

                {parseFloat(egComparisonPrice) > 0 && (() => {
                  const egPrice = parseFloat(egComparisonPrice);
                  const fee = parseFloat(handlingFee) || 0;
                  const spotTotal = result.totalCostEur + (result.totalConsumptionKwh * fee / 100);
                  const egTotal = result.totalConsumptionKwh * egPrice / 100;
                  const difference = egTotal - spotTotal;
                  const spotIsBetter = isProducer ? spotTotal > egTotal : spotTotal < egTotal;

                  return (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gradient-to-br from-sky-50 to-sky-100 rounded-lg p-5 border border-sky-200">
                          <p className="text-sm font-medium text-sky-800 mb-1">
                            Spot-{isProducer ? 'Gutschrift' : 'Kosten'}{fee > 0 ? ' (inkl. Handling Fee)' : ''}
                          </p>
                          <p className="text-2xl font-bold text-sky-900">
                            {formatNumberGerman(spotTotal)} €
                          </p>
                          <p className="text-xs text-sky-700 mt-1">
                            Ø {formatNumberGerman(result.averagePriceCtKwh + fee)} ct/kWh
                          </p>
                        </div>

                        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-5 border border-amber-200">
                          <p className="text-sm font-medium text-amber-800 mb-1">
                            EG-{isProducer ? 'Gutschrift' : 'Kosten'}
                          </p>
                          <p className="text-2xl font-bold text-amber-900">
                            {formatNumberGerman(egTotal)} €
                          </p>
                          <p className="text-xs text-amber-700 mt-1">
                            Festpreis: {egComparisonPrice} ct/kWh
                          </p>
                        </div>

                        <div className={`bg-gradient-to-br rounded-lg p-5 border ${
                          spotIsBetter
                            ? 'from-red-50 to-red-100 border-red-200'
                            : 'from-emerald-50 to-emerald-100 border-emerald-200'
                        }`}>
                          <p className={`text-sm font-medium mb-1 ${spotIsBetter ? 'text-red-800' : 'text-emerald-800'}`}>
                            {spotIsBetter ? 'Vorteil Spot' : 'Vorteil EG'}
                          </p>
                          <p className={`text-2xl font-bold ${spotIsBetter ? 'text-red-900' : 'text-emerald-900'}`}>
                            {formatNumberGerman(Math.abs(difference))} €
                          </p>
                          <p className={`text-xs mt-1 ${spotIsBetter ? 'text-red-700' : 'text-emerald-700'}`}>
                            {isProducer
                              ? (spotIsBetter ? 'Spot-Gutschrift höher als EG' : 'EG-Gutschrift höher als Spot')
                              : (spotIsBetter ? 'Spot-Kosten niedriger als EG' : 'EG-Kosten niedriger als Spot')
                            }
                          </p>
                        </div>
                      </div>

                      {result.monthlyResults && result.monthlyResults.length > 0 && (
                        <div className="overflow-x-auto">
                          <h5 className="text-sm font-semibold text-gray-800 mb-3">Monatlicher Vergleich</h5>
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Monat
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  {isProducer ? 'Einspeisung (kWh)' : 'Verbrauch (kWh)'}
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Spot{fee > 0 ? ' + Fee' : ''} (€)
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  EG (€)
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Differenz (€)
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {result.monthlyResults.map((monthData) => {
                                try {
                                  const [year, month] = monthData.month.split('-');
                                  const monthName = format(new Date(parseInt(year), parseInt(month) - 1), 'MMM yyyy', { locale: de });
                                  const monthSpot = monthData.costEur + (monthData.consumptionKwh * fee / 100);
                                  const monthEg = monthData.consumptionKwh * egPrice / 100;
                                  const monthDiff = monthEg - monthSpot;
                                  const monthSpotBetter = monthDiff < 0;

                                  return (
                                    <tr key={monthData.month} className="hover:bg-gray-50">
                                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                        {monthName}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-700 text-right">
                                        {formatIntegerGerman(monthData.consumptionKwh)}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-700 text-right">
                                        {formatNumberGerman(monthSpot)}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-700 text-right">
                                        {formatNumberGerman(monthEg)}
                                      </td>
                                      <td className={`px-4 py-3 text-sm font-semibold text-right ${monthDiff >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                        {formatNumberGerman(monthDiff)}
                                      </td>
                                    </tr>
                                  );
                                } catch {
                                  return null;
                                }
                              })}
                              <tr className="bg-gray-100 font-bold">
                                <td className="px-4 py-3 text-sm text-gray-900">Gesamt</td>
                                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                  {formatIntegerGerman(result.totalConsumptionKwh)}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                  {formatNumberGerman(spotTotal)}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                  {formatNumberGerman(egTotal)}
                                </td>
                                <td className={`px-4 py-3 text-sm font-bold text-right ${difference >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                  {formatNumberGerman(difference)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Berechnungsmethode:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li><strong>Exakte 15-Minuten-Berechnung:</strong> Jeder Lastprofilwert wird individuell mit seinem Spotpreis multipliziert</li>
                  <li><strong>Bei stündlichen Spotpreisen:</strong> Alle 4 Viertelstunden einer Stunde nutzen denselben Stundenpreis</li>
                  <li><strong>Bei viertelstündlichen Spotpreisen (ab Okt 2025):</strong> Direkte 1:1 Zuordnung Lastprofil ↔ Spotpreis</li>
                  <li><strong>{isProducer ? 'Gesamtgutschrift' : 'Gesamtkosten'} = Σ (kWh₁₅ₘᵢₙ × Preis₁₅ₘᵢₙ)</strong> - Summe aller einzelnen 15-Min-Berechnungen</li>
                  <li><strong>Durchschnittspreis:</strong> Ergebnis aus {isProducer ? 'Gesamtgutschrift' : 'Gesamtkosten'} ÷ {isProducer ? 'Gesamteinspeisung' : 'Gesamtverbrauch'} (keine simple Preismittelung!)</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-bold text-gray-900">Detaillierte 15-Minuten-Ansicht</h4>
              <button
                onClick={() => setShowDetailedView(!showDetailedView)}
                className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
              >
                {showDetailedView ? 'Ausblenden' : 'Anzeigen'}
              </button>
            </div>

            {showDetailedView && (
              <>
                <div className="mb-4">
                  <label htmlFor="detailDate" className="block text-sm font-medium text-gray-700 mb-2">
                    Datum auswählen
                  </label>
                  <input
                    type="date"
                    id="detailDate"
                    value={selectedDate || startDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    min={startDate}
                    max={endDate}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  />
                </div>

                {(() => {
                  const dateToShow = selectedDate || startDate;
                  const dayData = result.quarterHourResults.filter(qh => {
                    const ts = qh.timestamp;
                    const year = ts.getFullYear();
                    const month = String(ts.getMonth() + 1).padStart(2, '0');
                    const day = String(ts.getDate()).padStart(2, '0');
                    const dateStr = `${year}-${month}-${day}`;
                    return dateStr === dateToShow;
                  }).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

                  if (dayData.length === 0) {
                    return (
                      <div className="text-center py-8 text-gray-500">
                        Keine Daten für diesen Tag verfügbar
                      </div>
                    );
                  }

                  const dayTotalConsumption = dayData.reduce((sum, d) => sum + d.consumptionKwh, 0);
                  const dayTotalCost = dayData.reduce((sum, d) => sum + d.costEur, 0);
                  const dayAvgPrice = dayTotalConsumption > 0 ? (dayTotalCost / dayTotalConsumption) * 100 : 0;

                  return (
                    <>
                      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                        <h5 className="font-semibold text-gray-900 mb-2">
                          Tagessummen für {format(new Date(dateToShow), 'dd.MM.yyyy', { locale: de })}
                        </h5>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">{isProducer ? 'Einspeisung:' : 'Verbrauch:'}</span>{' '}
                            <span className="font-semibold">{formatNumberGerman(dayTotalConsumption)} kWh</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Ø Preis:</span>{' '}
                            <span className="font-semibold">{formatNumberGerman(dayAvgPrice)} ct/kWh</span>
                          </div>
                          <div>
                            <span className="text-gray-600">{isProducer ? 'Gutschrift:' : 'Kosten:'}</span>{' '}
                            <span className="font-semibold">{formatNumberGerman(dayTotalCost)} €</span>
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto max-h-96 overflow-y-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Zeitpunkt
                              </th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                {isProducer ? 'Einspeisung (kWh)' : 'Verbrauch (kWh)'}
                              </th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                Spotpreis (ct/kWh)
                              </th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                {isProducer ? 'Gutschrift (€)' : 'Kosten (€)'}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {dayData.map((qh, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-gray-900 font-mono">
                                  {String(qh.timestamp.getHours()).padStart(2, '0')}:{String(qh.timestamp.getMinutes()).padStart(2, '0')}
                                </td>
                                <td className="px-3 py-2 text-right text-gray-700">
                                  {formatNumberGerman3Decimals(qh.consumptionKwh)}
                                </td>
                                <td className="px-3 py-2 text-right text-gray-700">
                                  {formatNumberGerman(qh.priceCtKwh)}
                                </td>
                                <td className="px-3 py-2 text-right font-semibold text-gray-900">
                                  {formatNumberGerman3Decimals(qh.costEur)}
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-gray-100 font-bold">
                              <td className="px-3 py-2 text-gray-900">
                                Summe
                              </td>
                              <td className="px-3 py-2 text-right text-gray-900">
                                {formatNumberGerman(dayTotalConsumption)}
                              </td>
                              <td className="px-3 py-2 text-right text-gray-900">
                                Ø {formatNumberGerman(dayAvgPrice)}
                              </td>
                              <td className="px-3 py-2 text-right text-gray-900">
                                {formatNumberGerman3Decimals(dayTotalCost)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </>
                  );
                })()}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
