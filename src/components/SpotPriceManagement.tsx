import { useState, useEffect, useMemo } from 'react';
import { Upload, Trash2, RefreshCw, AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Cloud, Info } from 'lucide-react';
import { utcToCETDate } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { parseEPEXSpotPricesFromFile, EPEXSpotPrice } from '../lib/epex-parser';
import { fetchSpotPricesFromEnergyCharts } from '../lib/energy-charts-api';
import { format, startOfMonth, startOfWeek, addYears, subYears, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from 'date-fns';
import { de } from 'date-fns/locale';
import SpotPriceChart from './charts/SpotPriceChart';
import ApiDateRangeModal from './ApiDateRangeModal';
import {
  aggregateSpotPricesByYear,
  aggregateSpotPricesByMonth,
  aggregateSpotPricesByWeek,
  getSpotPricesByDay,
} from '../lib/spot-price-aggregation';
import type { SpotPriceData } from '../lib/spot-price-aggregation';

export default function SpotPriceManagement() {
  const [status, setStatus] = useState<'loading' | 'empty' | 'loaded'>('loading');
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date; totalHours: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showChart, setShowChart] = useState(false);
  const [spotPriceData, setSpotPriceData] = useState<SpotPriceData[]>([]);
  const [viewType, setViewType] = useState<'year' | 'month' | 'week' | 'day'>('day');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [yearViewMode, setYearViewMode] = useState<'months' | 'days'>('months');
  const [showApiModal, setShowApiModal] = useState(false);
  const [isLoadingFromApi, setIsLoadingFromApi] = useState(false);
  const [showInfoBubble, setShowInfoBubble] = useState(false);
  const [showCsvInfoBubble, setShowCsvInfoBubble] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    async function initialize() {
      await loadSpotPriceStatus();
      setHasInitialized(true);
    }
    initialize();
  }, []);

  useEffect(() => {
    if (!hasInitialized) return;

    if (status === 'empty') {
      autoFetchDayAheadData();
    } else if (status === 'loaded' && dateRange) {
      if (!showChart && spotPriceData.length === 0) {
        loadFullSpotPriceData();
      }
    }
  }, [status, hasInitialized]);

  async function autoFetchDayAheadData() {
    console.log('🔄 Automatisches Laden der aktuellen Spotpreise...');

    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 1);
    end.setHours(23, 59, 59, 999);

    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);

    console.log(`📅 Lade Daten von ${start.toLocaleDateString('de-DE')} bis ${end.toLocaleDateString('de-DE')} (inkl. Day-Ahead)`);
    await handleApiFetch(start, end);
  }

  async function loadSpotPriceStatus() {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        const localData = localStorage.getItem('spot_prices_local');
        if (localData) {
          const parsed = JSON.parse(localData);
          setStatus('loaded');
          setDateRange(parsed.dateRange);
        } else {
          setStatus('empty');
        }
        return;
      }

      const { count, error: countError } = await supabase
        .from('spot_prices')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (countError) throw countError;

      if (!count || count === 0) {
        setStatus('empty');
        setDateRange(null);
      } else {
        const { data: firstData, error: firstError } = await supabase
          .from('spot_prices')
          .select('timestamp')
          .eq('user_id', user.id)
          .order('timestamp', { ascending: true })
          .limit(1);

        if (firstError) throw firstError;

        const { data: lastData, error: lastError } = await supabase
          .from('spot_prices')
          .select('timestamp')
          .eq('user_id', user.id)
          .order('timestamp', { ascending: false })
          .limit(1);

        if (lastError) throw lastError;

        if (firstData && lastData && firstData.length > 0 && lastData.length > 0) {
          setStatus('loaded');
          setDateRange({
            start: utcToCETDate(new Date(firstData[0].timestamp)),
            end: utcToCETDate(new Date(lastData[0].timestamp)),
            totalHours: count,
          });
        } else {
          setStatus('empty');
          setDateRange(null);
        }
      }
    } catch (err) {
      console.error('Error loading spot price status:', err);
      setStatus('empty');
    }
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const parseResult = await parseEPEXSpotPricesFromFile(file);

      if (!parseResult.success || !parseResult.data) {
        throw new Error(parseResult.error || 'Failed to parse file');
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        localStorage.setItem('spot_prices_local', JSON.stringify({
          data: parseResult.data.map(price => ({
            timestamp: price.timestamp.toISOString(),
            price_eur_mwh: price.priceEurMwh,
            price_ct_kwh: price.priceCtKwh,
          })),
          dateRange: parseResult.dateRange,
        }));
        setSuccess(`Successfully loaded ${parseResult.data.length} spot prices`);
        await loadSpotPriceStatus();
      } else {
        const spotPriceRecords = parseResult.data.map((price: EPEXSpotPrice) => ({
          user_id: user.id,
          timestamp: price.timestamp.toISOString(),
          price_eur_mwh: price.priceEurMwh,
          price_ct_kwh: price.priceCtKwh,
        }));

        const batchSize = 1000;
        for (let i = 0; i < spotPriceRecords.length; i += batchSize) {
          const batch = spotPriceRecords.slice(i, i + batchSize);
          const { error: upsertError } = await supabase
            .from('spot_prices')
            .upsert(batch, {
              onConflict: 'user_id,timestamp',
              ignoreDuplicates: false
            });

          if (upsertError) throw upsertError;
        }

        setSuccess(`Successfully loaded ${parseResult.data.length} spot prices`);
        await loadSpotPriceStatus();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload spot prices');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete all spot price data?')) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        localStorage.removeItem('spot_prices_local');
        setSuccess('Spot prices deleted successfully');
        setShowChart(false);
        setSpotPriceData([]);
        await loadSpotPriceStatus();
      } else {
        const { error } = await supabase
          .from('spot_prices')
          .delete()
          .eq('user_id', user.id);

        if (error) throw error;

        setSuccess('Spot prices deleted successfully');
        setShowChart(false);
        setSpotPriceData([]);
        await loadSpotPriceStatus();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete spot prices');
    }
  }

  async function handleApiFetch(startDate: Date, endDate: Date) {
    setIsLoadingFromApi(true);
    setError(null);
    setSuccess(null);

    try {
      const fetchResult = await fetchSpotPricesFromEnergyCharts(startDate, endDate);

      if (!fetchResult.success || !fetchResult.data) {
        throw new Error(fetchResult.error || 'Failed to fetch data from API');
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        localStorage.setItem('spot_prices_local', JSON.stringify({
          data: fetchResult.data.map(price => ({
            timestamp: price.timestamp.toISOString(),
            price_eur_mwh: price.priceEurMwh,
            price_ct_kwh: price.priceCtKwh,
          })),
          dateRange: fetchResult.dateRange,
        }));
        const actualStart = format(fetchResult.dateRange!.start, 'dd.MM.yyyy HH:mm');
        const actualEnd = format(fetchResult.dateRange!.end, 'dd.MM.yyyy HH:mm');
        setSuccess(`Erfolgreich ${fetchResult.data.length} Preise geladen (${actualStart} - ${actualEnd})`);
        await loadSpotPriceStatus();
      } else {
        const spotPriceRecords = fetchResult.data.map(price => ({
          user_id: user.id,
          timestamp: price.timestamp.toISOString(),
          price_eur_mwh: price.priceEurMwh,
          price_ct_kwh: price.priceCtKwh,
        }));

        const batchSize = 1000;
        for (let i = 0; i < spotPriceRecords.length; i += batchSize) {
          const batch = spotPriceRecords.slice(i, i + batchSize);
          const { error: upsertError } = await supabase
            .from('spot_prices')
            .upsert(batch, {
              onConflict: 'user_id,timestamp',
              ignoreDuplicates: false
            });

          if (upsertError) throw upsertError;
        }

        const actualStart = format(fetchResult.dateRange!.start, 'dd.MM.yyyy HH:mm');
        const actualEnd = format(fetchResult.dateRange!.end, 'dd.MM.yyyy HH:mm');
        setSuccess(`Erfolgreich ${fetchResult.data.length} Preise geladen (${actualStart} - ${actualEnd})`);
        await loadSpotPriceStatus();
      }

      setShowApiModal(false);
      await loadFullSpotPriceData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'API-Abruf fehlgeschlagen');
    } finally {
      setIsLoadingFromApi(false);
    }
  }

  async function loadFullSpotPriceData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        const localData = localStorage.getItem('spot_prices_local');
        if (!localData) throw new Error('No spot prices found');

        const parsed = JSON.parse(localData);
        const data: SpotPriceData[] = parsed.data.map((sp: any) => ({
          timestamp: utcToCETDate(new Date(sp.timestamp)),
          priceCtKwh: parseFloat(sp.price_ct_kwh),
        }));

        setSpotPriceData(data);
        if (data.length > 0) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const firstDataDate = new Date(data[0].timestamp);
          firstDataDate.setHours(0, 0, 0, 0);
          const lastDataDate = new Date(data[data.length - 1].timestamp);
          lastDataDate.setHours(0, 0, 0, 0);

          if (today < firstDataDate) {
            setSelectedDate(firstDataDate);
          } else if (today > lastDataDate) {
            setSelectedDate(lastDataDate);
          } else {
            setSelectedDate(today);
          }
        }
      } else {
        let allSpotPrices: any[] = [];
        let from = 0;
        const batchSize = 1000;
        let hasMore = true;

        console.log('🔄 Starting to load all spot prices in batches...');

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
            console.log(`📦 Loaded batch ${Math.floor(from / batchSize) + 1}: ${spotPricesData.length} records (total: ${allSpotPrices.length})`);

            if (spotPricesData.length < batchSize) {
              hasMore = false;
            } else {
              from = to + 1;
            }
          }
        }

        if (allSpotPrices.length === 0) {
          throw new Error('No spot prices found');
        }

        const spotPricesData = allSpotPrices;

        const data: SpotPriceData[] = spotPricesData.map((sp: any) => ({
          timestamp: utcToCETDate(new Date(sp.timestamp)),
          priceCtKwh: parseFloat(sp.price_ct_kwh),
        }));

        console.log('✅ Loaded spot prices:', {
          total: data.length,
          first: data[0]?.timestamp,
          last: data[data.length - 1]?.timestamp
        });

        setSpotPriceData(data);
        if (data.length > 0) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const firstDataDate = new Date(data[0].timestamp);
          firstDataDate.setHours(0, 0, 0, 0);
          const lastDataDate = new Date(data[data.length - 1].timestamp);
          lastDataDate.setHours(0, 0, 0, 0);

          console.log('📅 Date selection logic:', {
            today,
            firstDataDate,
            lastDataDate,
            todayBeforeFirst: today < firstDataDate,
            todayAfterLast: today > lastDataDate
          });

          if (today < firstDataDate) {
            console.log('Setting selectedDate to firstDataDate:', firstDataDate);
            setSelectedDate(firstDataDate);
          } else if (today > lastDataDate) {
            console.log('Setting selectedDate to lastDataDate:', lastDataDate);
            setSelectedDate(lastDataDate);
          } else {
            console.log('Setting selectedDate to today:', today);
            setSelectedDate(today);
          }
        }
      }

      setShowChart(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load spot price data');
    }
  }

  const chartData = useMemo(() => {
    if (!showChart || spotPriceData.length === 0) return [];

    console.log('📊 Chart data calculation:', {
      viewType,
      selectedDate,
      spotPriceDataLength: spotPriceData.length,
      dataRange: {
        first: spotPriceData[0]?.timestamp,
        last: spotPriceData[spotPriceData.length - 1]?.timestamp
      }
    });

    let result;
    switch (viewType) {
      case 'year':
        result = aggregateSpotPricesByYear(spotPriceData, selectedDate, yearViewMode);
        break;
      case 'month':
        result = aggregateSpotPricesByMonth(spotPriceData, selectedDate);
        break;
      case 'week':
        result = aggregateSpotPricesByWeek(spotPriceData, selectedDate);
        break;
      case 'day':
        result = getSpotPricesByDay(spotPriceData, selectedDate);
        break;
      default:
        result = [];
    }

    console.log('📊 Chart data result:', {
      resultLength: result.length,
      resultRange: result.length > 0 ? {
        first: result[0]?.timestamp,
        last: result[result.length - 1]?.timestamp
      } : null
    });

    return result;
  }, [spotPriceData, viewType, selectedDate, yearViewMode, showChart]);

  function navigateDate(direction: 'prev' | 'next') {
    switch (viewType) {
      case 'year':
        setSelectedDate(direction === 'prev' ? subYears(selectedDate, 1) : addYears(selectedDate, 1));
        break;
      case 'month':
        setSelectedDate(direction === 'prev' ? subMonths(selectedDate, 1) : addMonths(selectedDate, 1));
        break;
      case 'week':
        setSelectedDate(direction === 'prev' ? subWeeks(selectedDate, 1) : addWeeks(selectedDate, 1));
        break;
      case 'day':
        setSelectedDate(direction === 'prev' ? subDays(selectedDate, 1) : addDays(selectedDate, 1));
        break;
    }
  }

  return (
    <div className="px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Spot-Preis Verwaltung</h1>
          <div className="relative">
            <button
              onClick={() => setShowInfoBubble(!showInfoBubble)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Information"
            >
              <Info className="w-5 h-5 text-gray-600" />
            </button>
            {showInfoBubble && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowInfoBubble(false)}
                />
                <div className="absolute left-0 top-full mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50">
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-semibold text-sm mb-1">Day-Ahead Preise (API)</h3>
                      <p className="text-xs text-gray-700">
                        Die Energy-Charts API liefert Day-Ahead Spot-Preise für den österreichischen Markt (AT).
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-xs mb-1">Aktualisieren</h4>
                      <p className="text-xs text-gray-600">
                        Lädt automatisch die aktuellsten verfügbaren Daten: die letzten 30 Tage plus Day-Ahead für morgen (falls verfügbar).
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-xs mb-1">Zeitraum wählen</h4>
                      <p className="text-xs text-gray-600">
                        Ermöglicht das Laden von historischen Daten für einen benutzerdefinierten Zeitraum.
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">
                        <strong>Hinweis:</strong> Day-Ahead-Preise für morgen werden normalerweise erst nach 12:00 Uhr (Mittags) veröffentlicht,
                        wenn die EPEX Spot-Auktion abgeschlossen ist. Bis dahin sind nur Daten bis heute verfügbar.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              const now = new Date();
              const end = new Date(now);
              end.setDate(end.getDate() + 1);
              end.setHours(23, 59, 59, 999);

              const start = new Date(now);
              start.setDate(start.getDate() - 30);
              start.setHours(0, 0, 0, 0);

              await handleApiFetch(start, end);
            }}
            disabled={uploading || isLoadingFromApi}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 cursor-pointer transition-colors disabled:opacity-50"
            title="Lädt aktuelle Daten (letzte 30 Tage + Day-Ahead für morgen)"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingFromApi ? 'animate-spin' : ''}`} />
            <span>Aktualisieren</span>
          </button>
          <button
            onClick={() => setShowApiModal(true)}
            disabled={uploading || isLoadingFromApi}
            className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white text-sm rounded-lg hover:bg-sky-700 cursor-pointer transition-colors disabled:opacity-50"
          >
            <Cloud className="w-4 h-4" />
            <span>Zeitraum wählen</span>
          </button>
          <div className="relative flex items-center gap-1">
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
              <Upload className="w-4 h-4" />
              <span>CSV/Excel</span>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                disabled={uploading || isLoadingFromApi}
                className="hidden"
              />
            </label>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowCsvInfoBubble(!showCsvInfoBubble);
              }}
              className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="CSV Format Information"
            >
              <Info className="w-4 h-4 text-gray-600" />
            </button>
            {showCsvInfoBubble && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowCsvInfoBubble(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50">
                  <h3 className="font-semibold text-sm mb-2">CSV Format Beispiel:</h3>
                  <pre className="text-xs text-gray-700 overflow-x-auto bg-gray-50 p-2 rounded mb-2">
{`Datum (MEZ);Preis (EUR/MWh, EUR/tCO2)
01.01.25 00:00;109
01.01.25 01:00;97,03
01.01.25 02:00;91,47`}
                  </pre>
                  <div className="text-xs text-gray-600 space-y-1">
                    <p>• Trennzeichen: Semikolon (;)</p>
                    <p>• Dezimaltrenner: Komma (,)</p>
                    <p>• Datum Format: DD.MM.YY HH:MM oder DD/MM/YY HH:MM</p>
                    <p>• Automatische Umrechnung: EUR/MWh → ct/kWh (÷ 10)</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {(error || success || status === 'loading' || (status === 'empty' && !isLoadingFromApi) || isLoadingFromApi || uploading) && (
      <div className="bg-white rounded-lg shadow-md p-6">

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-green-800 text-sm">{success}</p>
            </div>
          </div>
        )}

        {status === 'loading' && (
          <div className="text-center text-gray-500 py-8">
            <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
            <p>Loading status...</p>
          </div>
        )}

        {status === 'empty' && !isLoadingFromApi && (
          <div className="text-center py-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg border border-blue-200">
              <div className="w-3 h-3 rounded-full bg-blue-400"></div>
              <span className="text-blue-700 font-medium">Daten werden automatisch geladen...</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">Die aktuellsten Spot-Preise werden für Sie abgerufen</p>
          </div>
        )}

        {isLoadingFromApi && (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-sky-600" />
            <p className="text-sm text-gray-600">Lade Daten von API...</p>
          </div>
        )}

        {uploading && (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-blue-600" />
            <p className="text-sm text-gray-600">Verarbeite Datei...</p>
          </div>
        )}

      </div>
      )}

      {!showChart && !error && status === 'loaded' && !isLoadingFromApi && !uploading && (
        <div className="bg-white rounded-lg shadow-md p-6 text-center py-8">
          <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-sky-600" />
          <p className="text-sm text-gray-600">Lade Spot-Preis Verlauf...</p>
        </div>
      )}

      {showChart && spotPriceData.length > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Spot-Preis Verlauf</h2>
            <div className="flex items-center gap-3">
              {dateRange && (
                <>
                  {(() => {
                    const now = new Date();
                    const daysSinceLastData = Math.floor((now.getTime() - dateRange.end.getTime()) / (1000 * 60 * 60 * 24));
                    const isOutdated = daysSinceLastData > 1;

                    return isOutdated ? (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg">
                        <AlertCircle className="w-4 h-4 text-orange-600" />
                        <span className="text-xs text-orange-700 font-medium">
                          Daten sind {daysSinceLastData} {daysSinceLastData === 1 ? 'Tag' : 'Tage'} alt
                        </span>
                      </div>
                    ) : null;
                  })()}
                  <div className="text-xs text-gray-400">
                    Daten: {format(dateRange.start, 'dd.MM.yyyy HH:mm')} - {format(dateRange.end, 'dd.MM.yyyy HH:mm')} ({dateRange.totalHours} Std.)
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-4">
            <div className="flex gap-2">
              <button
                onClick={() => setViewType('year')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewType === 'year'
                    ? 'bg-sky-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Jahr
              </button>
              <button
                onClick={() => setViewType('month')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewType === 'month'
                    ? 'bg-sky-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Monat
              </button>
              <button
                onClick={() => setViewType('week')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewType === 'week'
                    ? 'bg-sky-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Woche
              </button>
              <button
                onClick={() => setViewType('day')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewType === 'day'
                    ? 'bg-sky-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Tag
              </button>
            </div>

            {viewType === 'year' && (
              <div className="flex gap-2">
                <button
                  onClick={() => setYearViewMode('months')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    yearViewMode === 'months'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Monate
                </button>
                <button
                  onClick={() => setYearViewMode('days')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    yearViewMode === 'days'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Alle Tage
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => navigateDate('prev')}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                title="Zurück"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <input
                type="date"
                value={format(selectedDate, 'yyyy-MM-dd')}
                onChange={(e) => {
                  const parsed = new Date(e.target.value + 'T00:00:00');
                  if (!isNaN(parsed.getTime())) {
                    setSelectedDate(parsed);
                  }
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-40"
              />
              <button
                onClick={() => navigateDate('next')}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                title="Weiter"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-orange-50 rounded-lg p-4">
              <p className="text-sm text-orange-700 mb-1">Durchschnittspreis</p>
              <p className="text-2xl font-bold text-orange-800">
                {chartData.length > 0
                  ? (chartData.reduce((sum, d) => sum + (d.avgPrice || d.priceCtKwh), 0) / chartData.length).toFixed(2)
                  : '0.00'} ct/kWh
              </p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-700 mb-1">Minimum</p>
              <p className="text-2xl font-bold text-blue-800">
                {chartData.length > 0
                  ? Math.min(...chartData.map(d => d.minPrice || d.priceCtKwh)).toFixed(2)
                  : '0.00'} ct/kWh
              </p>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <p className="text-sm text-red-700 mb-1">Maximum</p>
              <p className="text-2xl font-bold text-red-800">
                {chartData.length > 0
                  ? Math.max(...chartData.map(d => d.maxPrice || d.priceCtKwh)).toFixed(2)
                  : '0.00'} ct/kWh
              </p>
            </div>
          </div>

          <div className="mt-6 bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-4">
              {viewType === 'year' && (yearViewMode === 'months' ? 'Jahresübersicht - Monate' : `Jahresübersicht - Alle Tage ${format(selectedDate, 'yyyy')}`)}
              {viewType === 'month' && `Monatsübersicht - ${format(selectedDate, 'MMMM yyyy', { locale: de })}`}
              {viewType === 'week' && `Wochenübersicht - KW ${format(selectedDate, 'I/yyyy', { locale: de })}`}
              {viewType === 'day' && `Tagesübersicht - ${format(selectedDate, 'dd.MM.yyyy', { locale: de })}`}
            </h3>
            <SpotPriceChart
              data={chartData}
              viewType={viewType}
              yearViewMode={yearViewMode}
            />
          </div>
        </div>
      )}

      {showApiModal && (
        <ApiDateRangeModal
          onClose={() => setShowApiModal(false)}
          onFetch={handleApiFetch}
          isLoading={isLoadingFromApi}
        />
      )}
    </div>
  );
}
