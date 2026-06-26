import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Download, X, Loader2 } from 'lucide-react';
import { format, parseISO, startOfMonth, startOfWeek, startOfDay, startOfHour } from 'date-fns';
import { de } from 'date-fns/locale';
import { getDateRange, getAvailableMonths, getAvailableWeeks } from '../lib/data-aggregation';
import LoadProfileChart from './charts/LoadProfileChart';
import ProfileSelector from './profile/ProfileSelector';
import ProfileKPICards from './profile/ProfileKPICards';
import ViewControls from './profile/ViewControls';
import EconomicAnalysisView from './EconomicAnalysisView';
import SpotPriceAnalysis from './SpotPriceAnalysis';
import FixedPriceAnalysis from './FixedPriceAnalysis';
import PDFExportButton from './PDFExportButton';
import { formatNumberGerman, formatLargeNumberGerman, formatIntegerGerman } from '../lib/utils';
import AggregationWorker from '../workers/aggregation.worker?worker';
import type { WorkerMessage, WorkerResponse } from '../workers/aggregation.worker';

interface LoadProfilesProps {
  profiles?: any[];
  selectedProfile?: any;
  onBackToList?: () => void;
  isComparisonMode?: boolean;
}

export default function LoadProfiles({ 
  profiles = [], 
  selectedProfile: initialSelectedProfile, 
  onBackToList,
  isComparisonMode = false 
}: LoadProfilesProps) {
  const [selectedProfiles, setSelectedProfiles] = useState<any[]>(
    initialSelectedProfile ? [initialSelectedProfile] : []
  );
  const [viewType, setViewType] = useState<'year' | 'month' | 'week' | 'day' | 'hour' | 'weekdayWeekend'>('year');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showPeakLoad, setShowPeakLoad] = useState(false);
  const [yearViewMode, setYearViewMode] = useState<'months' | 'days'>('months');
  const [error, setError] = useState<string | null>(null);
  const [isLoadingChartData, setIsLoadingChartData] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);
  const [availableMonths, setAvailableMonths] = useState<Date[]>([]);
  const [availableWeeks, setAvailableWeeks] = useState<Date[]>([]);
  const [memoizedDateRange, setMemoizedDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const [worker, setWorker] = useState<Worker | null>(null);
  const [economicAnalysisResult, setEconomicAnalysisResult] = useState<any>(null);
  const [egPrice, setEgPrice] = useState<number>(7.0);
  const [markup, setMarkup] = useState<number>(2.0);
  const [spotAnalysisResult, setSpotAnalysisResult] = useState<any>(null);
  const [spotEgComparisonPrice, setSpotEgComparisonPrice] = useState<number | undefined>(undefined);
  const [spotHandlingFee, setSpotHandlingFee] = useState<number>(0);
  const [spotDateRange, setSpotDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [fixedPriceAnalysisResult, setFixedPriceAnalysisResult] = useState<any>(null);

  // Color palette: Consumer (blue) and Producer (yellow) - start colors for gradients
  const getProfileColor = (profile: any, index: number) => {
    if (profile.profile_type === 'consumer') {
      return '#1d67a9'; // Blue gradient start
    } else if (profile.profile_type === 'producer') {
      return '#eab308'; // Yellow gradient start
    }
    // Fallback colors for unspecified types
    const fallbackColors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b'];
    return fallbackColors[index % fallbackColors.length];
  };

  const colors = selectedProfiles.map((profile, index) => getProfileColor(profile, index));

  // Calculate total energy (kWh) per profile from chart data
  const profileTotals = useMemo(() => {
    if (!chartData || chartData.length === 0 || viewType === 'weekdayWeekend') return [];

    return selectedProfiles.map((profile, index) => {
      const profileNum = index + 1;
      let totalKwh = 0;

      // All views (year, month, week, day, hour) use _kwh
      chartData.forEach(row => {
        const val = row[`profile${profileNum}_kwh`];
        if (typeof val === 'number' && !isNaN(val)) {
          totalKwh += val;
        }
      });

      return {
        name: profile.name,
        profileType: profile.profile_type,
        totalKwh,
        totalMwh: totalKwh / 1000
      };
    });
  }, [chartData, selectedProfiles, viewType]);

  // Initialize Web Worker
  useEffect(() => {
    const aggregationWorker = new AggregationWorker();
    setWorker(aggregationWorker);

    aggregationWorker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { type, payload, id } = event.data;
      
      switch (type) {
        case 'AGGREGATION_COMPLETE':
          setChartData(payload);
          setIsLoadingChartData(false);
          break;
        case 'DATE_RANGE_COMPLETE':
          setMemoizedDateRange(payload);
          break;
        case 'AVAILABLE_DATES_COMPLETE':
          setAvailableMonths(payload.availableMonths);
          setAvailableWeeks(payload.availableWeeks);
          break;
        case 'ERROR':
          console.error('Worker Error:', payload.error);
          setError(`Fehler bei der Datenverarbeitung: ${payload.error}`);
          setIsLoadingChartData(false);
          break;
      }
    };

    aggregationWorker.onerror = (error) => {
      console.error('Worker Error:', error);
      setError('Fehler beim Laden der Daten');
      setIsLoadingChartData(false);
    };

    return () => {
      aggregationWorker.terminate();
    };
  }, []);

  // Update selected profiles when props change
  useEffect(() => {
    console.log('🔄 LoadProfiles: Props geändert', {
      isComparisonMode,
      profilesCount: profiles.length,
      initialSelectedProfile: initialSelectedProfile?.name,
      profilesWithData: profiles.map(p => ({ name: p.name, hasData: !!p.parsedData, dataLength: p.parsedData?.length }))
    });
    
    setError(null); // Reset error state
    
    if (isComparisonMode) {
      // In comparison mode, use the profiles that are marked for comparison
      const profilesForComparison = profiles.filter(p => p.selectedForComparison);
      if (profilesForComparison.length > 0) {
        setSelectedProfiles(profilesForComparison);
      } else {
        // Fallback: if no profiles are marked, use all profiles for comparison
        setSelectedProfiles(profiles.slice(0, 4)); // Limit to first 4 profiles for performance
      }
    } else if (initialSelectedProfile) {
      // Single profile mode
      console.log('📊 Einzelprofil-Modus:', {
        profileName: initialSelectedProfile.name,
        hasData: !!initialSelectedProfile.parsedData,
        dataLength: initialSelectedProfile.parsedData?.length
      });
      
      // Prüfe ob das Profil gültige Daten hat
      if (!initialSelectedProfile.parsedData || initialSelectedProfile.parsedData.length === 0) {
        console.error('❌ Profil hat keine parsedData:', initialSelectedProfile);
        setError('Profil-Daten konnten nicht geladen werden. Bitte laden Sie die Datei erneut hoch.');
        return;
      }
      
      setSelectedProfiles([initialSelectedProfile]);
      if (initialSelectedProfile.data_start) {
        setSelectedDate(new Date(initialSelectedProfile.data_start));
      }
    }
  }, [initialSelectedProfile, isComparisonMode, profiles]);

  // Load available dates when profiles change
  useEffect(() => {
    console.log('📅 Berechne verfügbare Daten für Profile:', selectedProfiles.map(p => ({ name: p.name, hasData: !!p.parsedData })));
    
    if (selectedProfiles.length === 0) {
      console.log('⚠️ Keine Profile ausgewählt');
      setAvailableMonths([]);
      setAvailableWeeks([]);
      setMemoizedDateRange(null);
      return;
    }

    if (!worker) return;

    // Load date range
    const dateRangeId = `date-range-${Date.now()}`;
    worker.postMessage({
      type: 'GET_DATE_RANGE',
      payload: { profiles: selectedProfiles },
      id: dateRangeId
    } as WorkerMessage);

    // Load available dates
    const availableDatesId = `available-dates-${Date.now()}`;
    worker.postMessage({
      type: 'GET_AVAILABLE_DATES',
      payload: { profiles: selectedProfiles },
      id: availableDatesId
    } as WorkerMessage);
  }, [selectedProfiles, worker]);

  // Load chart data when view parameters change
  useEffect(() => {
    if (selectedProfiles.length === 0 || !worker) {
      setChartData([]);
      return;
    }

    // Check if all profiles have valid data
    const profilesWithoutData = selectedProfiles.filter(p => !p.parsedData || p.parsedData.length === 0);
    if (profilesWithoutData.length > 0) {
      console.error('❌ Profile ohne Daten gefunden:', profilesWithoutData.map(p => p.name));
      setError(`Profile ohne Daten gefunden: ${profilesWithoutData.map(p => p.name).join(', ')}`);
      return;
    }

    console.log('📈 Lade Chart-Daten:', {
      selectedProfilesCount: selectedProfiles.length,
      viewType,
      selectedDate: selectedDate.toISOString(),
      totalDataPoints: selectedProfiles.reduce((sum, p) => sum + (p.parsedData?.length || 0), 0)
    });

    setIsLoadingChartData(true);
    setError(null);

    const aggregationId = `aggregation-${Date.now()}`;
    worker.postMessage({
      type: 'AGGREGATE_DATA',
      payload: {
        profiles: selectedProfiles,
        viewType,
        selectedDate,
        yearViewMode
      },
      id: aggregationId
    } as WorkerMessage);
  }, [selectedProfiles]);

  // Reload chart data when view parameters change
  useEffect(() => {
    if (selectedProfiles.length === 0 || !worker) return;

    setIsLoadingChartData(true);
    const aggregationId = `aggregation-${Date.now()}`;
    worker.postMessage({
      type: 'AGGREGATE_DATA',
      payload: {
        profiles: selectedProfiles,
        viewType,
        selectedDate,
        yearViewMode
      },
      id: aggregationId
    } as WorkerMessage);
  }, [viewType, selectedDate, yearViewMode, worker]);

  const handleToggleProfileSelection = (profile: any) => {
    if (selectedProfiles.some(p => p.id === profile.id)) {
      setSelectedProfiles(prev => prev.filter(p => p.id !== profile.id));
    } else {
      setSelectedProfiles(prev => [...prev, profile]);
    }
  };

  // Reset error when profiles change
  useEffect(() => {
    if (selectedProfiles.length > 0) {
      setError(null);
    }
  }, [selectedProfiles]);

  // Error handling
  if (error) {
    return (
      <div className="p-6 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => {
                setError(null);
                onBackToList?.();
              }}
              className="text-sky-600 hover:text-sky-700 text-sm font-medium mb-2"
            >
              <ArrowLeft className="h-4 w-4 inline mr-1" />
              Zurück zur Übersicht
            </button>
            <h2 className="text-2xl font-bold text-gray-900">Fehler beim Laden der Analyse</h2>
          </div>
        </div>
        
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <X className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Daten konnten nicht geladen werden
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
              <div className="mt-4">
                <button
                  onClick={() => {
                    setError(null);
                    // Try to reload with first available profile
                    if (profiles.length > 0) {
                      setSelectedProfiles([profiles[0]]);
                    }
                  }}
                  className="text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded"
                >
                  Erneut versuchen
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => {
              onBackToList?.();
            }}
            className="text-sky-600 hover:text-sky-700 text-sm font-medium mb-2"
          >
            <ArrowLeft className="h-4 w-4 inline mr-1" />
            Zurück zur Übersicht
          </button>
          <h2 className="text-2xl font-bold text-gray-900">
            {isComparisonMode ? 'Profil-Vergleich' : selectedProfiles[0]?.name || 'Lastprofil-Analyse'}
          </h2>
          {!isComparisonMode && selectedProfiles[0]?.profile_type && selectedProfiles[0].profile_type !== 'unknown' && (
            <div className="mt-2">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                selectedProfiles[0].profile_type === 'consumer' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-green-100 text-green-800'
              }`}>
                {selectedProfiles[0].profile_type === 'consumer' ? '🏠 Verbraucher-Profil' : '⚡ Einspeiser-Profil'}
              </span>
            </div>
          )}
          {isComparisonMode && (
            <p className="text-gray-600 mt-1">
              {selectedProfiles.length} Profile ausgewählt
            </p>
          )}
        </div>
        <div className="flex space-x-3">
          <PDFExportButton
            profiles={selectedProfiles}
            economicAnalysis={economicAnalysisResult}
            egPrice={egPrice}
            markup={markup}
            loadProfileChartId="load-profile-chart"
            economicChartId="economic-analysis-chart"
            spotAnalysis={spotAnalysisResult}
            spotHandlingFee={spotHandlingFee}
            spotDateRange={spotDateRange}
            spotEgComparisonPrice={spotEgComparisonPrice}
            fixedPriceAnalysis={fixedPriceAnalysisResult}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <ProfileKPICards
        profile={selectedProfiles[0]}
        isComparisonMode={isComparisonMode}
        selectedProfiles={selectedProfiles}
        colors={colors}
      />

      {/* Economic Analysis - Only show in comparison mode with exactly 2 profiles */}
      {isComparisonMode && selectedProfiles.length === 2 && (
        <EconomicAnalysisView
          consumerProfile={selectedProfiles[0]}
          producerProfile={selectedProfiles[1]}
          onAnalysisComplete={(result, priceParams) => {
            setEconomicAnalysisResult(result);
            if (priceParams) {
              setEgPrice(priceParams.egPrice);
              setMarkup(priceParams.markup);
            }
          }}
        />
      )}

      {/* View Controls */}
      <ViewControls
        viewType={viewType}
        onViewTypeChange={setViewType}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        memoizedDateRange={memoizedDateRange}
        showPeakLoad={showPeakLoad}
        onTogglePeakLoad={() => setShowPeakLoad(!showPeakLoad)}
        availableMonths={availableMonths}
        availableWeeks={availableWeeks}
        isComparisonMode={isComparisonMode}
        yearViewMode={yearViewMode}
        onYearViewModeChange={setYearViewMode}
      />

      {/* Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 relative">
        {/* Legend top-right corner of card */}
        {selectedProfiles.length > 0 && !isLoadingChartData && (
          <div className="absolute top-6 right-6 z-10 bg-white rounded-lg border border-gray-200 px-3 py-2 shadow-sm">
            {selectedProfiles.map((profile, index) => {
              const profileType = profile.profile_type || 'unknown';
              const profilesByType = selectedProfiles.filter(p => (p.profile_type || 'unknown') === profileType);
              const hasMultiple = isComparisonMode && profilesByType.length > 1;
              let color = colors[index % colors.length];

              if (hasMultiple) {
                const indexInType = profilesByType.findIndex(p => p.id === profile.id);
                if (profileType === 'consumer') {
                  const blueShades = ['#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af'];
                  color = blueShades[indexInType % blueShades.length];
                } else if (profileType === 'producer') {
                  const yellowShades = ['#fde047', '#facc15', '#eab308', '#f59e0b', '#f97316'];
                  color = yellowShades[indexInType % yellowShades.length];
                }
              }

              return (
                <div key={profile.id} className="flex items-center gap-2 py-0.5">
                  <div
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs text-gray-700 whitespace-nowrap">{profile.name}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900">
            {viewType === 'year' && (yearViewMode === 'months' ? 'Jahresübersicht - Monate' : `Jahresübersicht - Alle Tage ${format(selectedDate, 'yyyy')}`)}
            {viewType === 'month' && `Monatsübersicht - ${format(selectedDate, 'MMMM yyyy', { locale: de })}`}
            {viewType === 'week' && `Wochenübersicht - KW ${format(selectedDate, 'I/yyyy', { locale: de })}`}
            {viewType === 'day' && `Tagesübersicht - ${format(selectedDate, 'dd.MM.yyyy', { locale: de })}`}
            {viewType === 'hour' && `15-Minuten-Profil - ${format(selectedDate, 'dd.MM.yyyy', { locale: de })}`}
            {viewType === 'weekdayWeekend' && 'Werktag vs. Wochenende - Durchschnittsprofile'}
          </h3>

          {/* Total energy per profile */}
          {profileTotals.length > 0 && !isLoadingChartData && (
            <div className="flex flex-wrap gap-3 items-center mt-2">
              {profileTotals.map((pt, index) => {
                const profile = selectedProfiles[index];
                const profileType = profile?.profile_type || 'unknown';
                const profilesOfSameType = selectedProfiles.filter(p => (p.profile_type || 'unknown') === profileType);
                const hasMultiple = isComparisonMode && profilesOfSameType.length > 1;
                let color = colors[index % colors.length];

                if (hasMultiple) {
                  const indexInType = profilesOfSameType.findIndex(p => p.id === profile.id);
                  if (profileType === 'consumer') {
                    const blueShades = ['#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af'];
                    color = blueShades[indexInType % blueShades.length];
                  } else if (profileType === 'producer') {
                    const yellowShades = ['#fde047', '#facc15', '#eab308', '#f59e0b', '#f97316'];
                    color = yellowShades[indexInType % yellowShades.length];
                  }
                }

                return (
                  <div
                    key={index}
                    className="px-3 py-1.5 rounded-lg border"
                    style={{ backgroundColor: `${color}15`, borderColor: `${color}40` }}
                  >
                    <div className="text-xs" style={{ color }}>
                      {selectedProfiles.length > 1 && <span className="font-medium">{pt.name} – </span>}
                      {pt.profileType === 'producer' ? 'Gesamteinspeisung' : 'Gesamtverbrauch'}
                    </div>
                    <div className="text-sm font-semibold text-gray-900">
                      {formatLargeNumberGerman(pt.totalKwh)} kWh
                      <span className="text-xs font-normal text-gray-400 ml-1">
                        ({formatNumberGerman(pt.totalMwh)} MWh)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {isLoadingChartData ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-sky-500 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">Daten werden verarbeitet...</p>
              <p className="text-sm text-gray-500">
                {selectedProfiles.length > 1 
                  ? `${selectedProfiles.length} Profile mit ${selectedProfiles.reduce((sum, p) => sum + (p.parsedData?.length || 0), 0).toLocaleString()} Datenpunkten`
                  : `${selectedProfiles[0]?.parsedData?.length?.toLocaleString() || 0} Datenpunkte`
                }
              </p>
            </div>
          </div>
        ) : (
          <LoadProfileChart
            data={chartData}
            selectedProfiles={selectedProfiles}
            viewType={viewType}
            showPeakLoad={showPeakLoad}
            colors={colors}
            yearViewMode={yearViewMode}
            isComparisonMode={isComparisonMode}
          />
        )}
      </div>

      {/* Spot Price Analysis - Show for single profile mode */}
      {!isComparisonMode && selectedProfiles.length === 1 && (
        <SpotPriceAnalysis
          profile={selectedProfiles[0]}
          onResultChange={(result, fee, start, end, egPrice) => {
            setSpotAnalysisResult(result);
            setSpotHandlingFee(fee);
            setSpotDateRange({ start, end });
            setSpotEgComparisonPrice(egPrice);
          }}
        />
      )}

      {/* Fixed Price Analysis - Show for single profile mode */}
      {!isComparisonMode && selectedProfiles.length === 1 && (
        <FixedPriceAnalysis
          profile={selectedProfiles[0]}
          onResultChange={setFixedPriceAnalysisResult}
        />
      )}
    </div>
  );
}