import React, { useState, useEffect } from 'react';
import { AlertCircle, Calculator, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { utcToCETDate } from '../lib/utils';
import { performEconomicAnalysis } from '../lib/economic-analysis';
import EconomicAnalysisChart from './charts/EconomicAnalysisChart';
import EconomicResultsDisplay from './EconomicResultsDisplay';
import type { EconomicAnalysisResult } from '../lib/economic-analysis';

interface EconomicAnalysisViewProps {
  consumerProfile: any;
  producerProfile: any;
  onAnalysisComplete?: (result: EconomicAnalysisResult, priceParams: { egPrice: number; markup: number }) => void;
}

export default function EconomicAnalysisView({
  consumerProfile: profile1,
  producerProfile: profile2,
  onAnalysisComplete,
}: EconomicAnalysisViewProps) {
  // Determine which profile is consumer and which is producer based on profile_type
  const consumerProfile = profile1.profile_type === 'consumer' ? profile1 : profile2;
  const producerProfile = profile1.profile_type === 'producer' ? profile1 : profile2;

  // Validate that we have both types
  if (consumerProfile.profile_type !== 'consumer' || producerProfile.profile_type !== 'producer') {
    console.warn('Profile types mismatch:', {
      profile1: profile1.profile_type,
      profile2: profile2.profile_type
    });
  }

  const [spotPricesAvailable, setSpotPricesAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analysisEnabled, setAnalysisEnabled] = useState(false);
  const [egPrice, setEgPrice] = useState(7.0);
  const [markup, setMarkup] = useState(2.0);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<EconomicAnalysisResult | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    checkSpotPricesAvailable();
  }, []);

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
    if (!consumerProfile?.parsedData || !producerProfile?.parsedData) {
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
        const { data: spotPricesData, error: spotError } = await supabase
          .from('spot_prices')
          .select('timestamp, price_ct_kwh')
          .eq('user_id', user.id)
          .order('timestamp', { ascending: true });

        if (spotError) throw spotError;

        if (!spotPricesData || spotPricesData.length === 0) {
          throw new Error('Keine Spot-Preise gefunden');
        }

        spotPrices = spotPricesData.map((sp: any) => ({
          timestamp: utcToCETDate(new Date(sp.timestamp)),
          priceCtKwh: parseFloat(sp.price_ct_kwh),
        }));
      }

      const consumerData = consumerProfile.parsedData.map((point: any) => ({
        timestamp: new Date(point.timestamp),
        value: point.power_kw,
      }));

      const producerData = producerProfile.parsedData.map((point: any) => ({
        timestamp: new Date(point.timestamp),
        value: point.power_kw,
      }));

      const result = performEconomicAnalysis({
        consumerData,
        producerData,
        spotPrices,
        egPrice,
        markup,
        consumerUnit: consumerProfile.data_unit || 'kW',
        producerUnit: producerProfile.data_unit || 'kW',
      });

      setAnalysisResult(result);

      onAnalysisComplete?.(result, { egPrice, markup });

      const limitedChartData = result.hourlyResults
        .filter((_, index) => index % 4 === 0)
        .slice(0, 500)
        .map((hourResult) => ({
          timestamp: hourResult.hour,
          consumer: hourResult.consumptionKw,
          producer: hourResult.production,
          spotPrice: hourResult.totalSpotPrice,
        }));

      setChartData(limitedChartData);
    } catch (err) {
      console.error('Error calculating economic analysis:', err);
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
              Um die Wirtschaftlichkeitsanalyse durchzuführen, müssen Sie zuerst EPEX Spot-Preise hochladen.
            </p>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent('navigate', { detail: 'spot-prices' }));
              }}
              className="text-yellow-900 underline font-medium text-sm hover:text-yellow-700"
            >
              Jetzt Spot-Preise hochladen →
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
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="spotAnalysisToggle"
              checked={analysisEnabled}
              onChange={(e) => setAnalysisEnabled(e.target.checked)}
              className="w-5 h-5 text-sky-600 rounded focus:ring-sky-500"
            />
            <label htmlFor="spotAnalysisToggle" className="text-lg font-semibold text-gray-900 cursor-pointer">
              Spot-Preis Wirtschaftlichkeit
            </label>
          </div>
          {analysisEnabled && (
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle className="h-5 w-5" />
              <span>Aktiviert</span>
            </div>
          )}
        </div>

        {analysisEnabled && (
          <div className="mt-4 space-y-4">
            <div className="text-xs text-gray-600 p-3 bg-gray-50 rounded-lg mb-4">
              <div className="font-medium mb-1">Profil-Zuordnung:</div>
              <div className="flex gap-4">
                <span><strong>Verbraucher:</strong> {consumerProfile.name} ({consumerProfile.data_unit})</span>
                <span><strong>Erzeuger:</strong> {producerProfile.name} ({producerProfile.data_unit})</span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="egPrice" className="block text-sm font-medium text-gray-700 mb-1">
                  EG-Preis (ct/kWh)
                </label>
                <input
                  type="number"
                  id="egPrice"
                  value={egPrice}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setEgPrice(isNaN(val) ? 0 : val);
                  }}
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>

              <div>
                <label htmlFor="markup" className="block text-sm font-medium text-gray-700 mb-1">
                  Aufschlag (ct/kWh)
                </label>
                <input
                  type="number"
                  id="markup"
                  value={markup}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setMarkup(isNaN(val) ? 0 : val);
                  }}
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>
            </div>

            <button
              onClick={handleCalculate}
              disabled={calculating}
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
                  Berechnung starten
                </>
              )}
            </button>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {analysisResult && chartData.length > 0 && (
        <>
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <h2 className="text-xl font-bold mb-4">Lastprofil & Spot-Preis Überlagerung</h2>
            <EconomicAnalysisChart
              data={chartData}
              egPrice={egPrice}
              consumerName={consumerProfile.name}
              producerName={producerProfile.name}
            />
          </div>

          <EconomicResultsDisplay
            results={analysisResult}
            consumerUnit={consumerProfile.data_unit || 'kW'}
            producerUnit={producerProfile.data_unit || 'kW'}
            consumerProfile={consumerProfile}
            producerProfile={producerProfile}
            egPrice={egPrice}
            markup={markup}
          />
        </>
      )}
    </div>
  );
}
