import React, { useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Clock, Zap, ChevronDown, ChevronUp, Activity, Plug } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { formatNumberGerman, formatIntegerGerman } from '../lib/utils';
import type { EconomicAnalysisResult } from '../lib/economic-analysis';

interface EconomicResultsDisplayProps {
  results: EconomicAnalysisResult;
  consumerUnit: 'kW' | 'kWh';
  producerUnit: 'kW' | 'kWh';
  consumerProfile: any;
  producerProfile: any;
  egPrice: number;
  markup: number;
}

export default function EconomicResultsDisplay({
  results,
  consumerUnit,
  producerUnit,
  consumerProfile,
  producerProfile,
  egPrice,
  markup
}: EconomicResultsDisplayProps) {
  const [showDetailedTable, setShowDetailedTable] = useState(false);
  const {
    hoursWithProduction,
    totalHours,
    avgProduction,
    hoursEgCheaper,
    hoursSpotCheaper,
    avgSpotPrice,
    totalSavings,
    totalLoss,
    netSavings,
    totalConsumptionKwh,
    totalProductionKwh,
    totalActuallyConsumedKwh,
    topSavingsDays,
  } = results;

  const egCheaperPercentage = hoursWithProduction > 0
    ? (hoursEgCheaper / hoursWithProduction) * 100
    : 0;

  const spotCheaperPercentage = hoursWithProduction > 0
    ? (hoursSpotCheaper / hoursWithProduction) * 100
    : 0;

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mt-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <DollarSign className="h-6 w-6 text-emerald-600" />
          Spot-Preis Wirtschaftlichkeits-Analyse
        </h2>
        {results.timePeriod && (
          <p className="text-sm text-gray-600 mt-2">
            Zeitraum: {format(results.timePeriod.startDate, 'dd.MM.yyyy', { locale: de })} - {format(results.timePeriod.endDate, 'dd.MM.yyyy', { locale: de })}
            {results.timePeriod.year && ` (Jahr: ${results.timePeriod.year})`}
          </p>
        )}
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-3 text-gray-800">
            Energie-Übersicht:
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="h-5 w-5 text-blue-600" />
                <span className="text-sm text-gray-600">Jahresverbrauch</span>
              </div>
              <p className="text-2xl font-bold text-blue-700">
                {formatNumberGerman(consumerProfile.kpis.annual_consumption_kwh)} kWh
              </p>
              <p className="text-xs text-gray-500 mt-1">
                (aus Lastprofil)
              </p>
            </div>

            <div className="bg-green-50 rounded-lg p-4 border-l-4 border-green-500">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-5 w-5 text-green-600" />
                <span className="text-sm text-gray-600">Jahreseinspeisung</span>
              </div>
              <p className="text-2xl font-bold text-green-700">
                {formatNumberGerman(producerProfile.kpis.annual_consumption_kwh)} kWh
              </p>
              <p className="text-xs text-gray-500 mt-1">
                (erzeugte Energie)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-amber-50 rounded-lg p-4 border-l-4 border-amber-500">
              <div className="flex items-center gap-2 mb-1">
                <Plug className="h-5 w-5 text-amber-600" />
                <span className="text-sm text-gray-600">Gesamt-Abnahme</span>
              </div>
              <p className="text-2xl font-bold text-amber-700">
                {formatNumberGerman(totalActuallyConsumedKwh)} kWh
              </p>
              <p className="text-xs text-gray-500 mt-1">
                (direkt vom Erzeuger)
              </p>
            </div>

            <div className="bg-cyan-50 rounded-lg p-4 border-l-4 border-cyan-500">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-5 w-5 text-cyan-600" />
                <span className="text-sm text-gray-600">Nutzungsgrad</span>
              </div>
              <p className="text-2xl font-bold text-cyan-700">
                {formatNumberGerman((totalActuallyConsumedKwh / totalProductionKwh) * 100)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                (der Erzeugung genutzt)
              </p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-3 text-gray-800">
            Preisvergleich (nur Erzeugungsstunden):
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-emerald-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="h-5 w-5 text-emerald-600" />
                <span className="text-sm text-gray-600">EG günstiger</span>
              </div>
              <p className="text-2xl font-bold text-emerald-700">
                {formatIntegerGerman(hoursEgCheaper)} h
              </p>
              <p className="text-xs text-gray-500 mt-1">
                ({formatNumberGerman(egCheaperPercentage)}%)
              </p>
            </div>

            <div className="bg-orange-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-5 w-5 text-orange-600" />
                <span className="text-sm text-gray-600">Spot günstiger</span>
              </div>
              <p className="text-2xl font-bold text-orange-700">
                {formatIntegerGerman(hoursSpotCheaper)} h
              </p>
              <p className="text-xs text-gray-500 mt-1">
                ({formatNumberGerman(spotCheaperPercentage)}%)
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-5 w-5 text-gray-600" />
                <span className="text-sm text-gray-600">⌀ Spotpreis</span>
              </div>
              <p className="text-2xl font-bold text-gray-700">
                {formatNumberGerman(avgSpotPrice)} ct/kWh
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-6 border-2 border-emerald-200">
          <h3 className="text-xl font-bold mb-4 text-emerald-900 flex items-center gap-2">
            <DollarSign className="h-6 w-6" />
            Gesamtersparnis durch EG-Beitritt:
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-sm text-emerald-700 mb-1">Ersparnis:</p>
              <p className="text-3xl font-bold text-emerald-800">
                +{formatIntegerGerman(totalSavings)} €
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-sm text-orange-700 mb-1">"Verlust" in teuren Spot-Stunden:</p>
              <p className="text-3xl font-bold text-orange-700">
                -{formatIntegerGerman(totalLoss)} €
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-sm text-gray-600 mb-1">Gesamtersparnis / Jahr (netto):</p>
              <p className={`text-3xl font-bold ${netSavings >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {netSavings >= 0 ? '+' : ''}{formatIntegerGerman(netSavings)} €
              </p>
            </div>
          </div>
        </div>

        {topSavingsDays.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3 text-gray-800 flex items-center gap-2">
              🏆 Top 5 Tage mit höchster Ersparnis:
            </h3>
            <div className="space-y-2">
              {topSavingsDays.map((day, index) => (
                <div
                  key={day.date}
                  className="flex items-center justify-between bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full font-bold text-sm">
                      {index + 1}
                    </span>
                    <span className="font-medium text-gray-900">
                      {format(new Date(day.date), 'dd.MM.yyyy', { locale: de })}
                    </span>
                  </div>
                  <span className="text-lg font-bold text-emerald-700">
                    +{formatNumberGerman(day.savings)} €
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-gray-200 pt-4">
          <button
            onClick={() => setShowDetailedTable(!showDetailedTable)}
            className="flex items-center gap-2 text-gray-700 hover:text-gray-900 font-medium transition-colors"
          >
            {showDetailedTable ? (
              <>
                <ChevronUp className="h-5 w-5" />
                Stundentabelle ausblenden
              </>
            ) : (
              <>
                <ChevronDown className="h-5 w-5" />
                Detaillierte Stundentabelle anzeigen
              </>
            )}
          </button>

          {showDetailedTable && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b-2 border-gray-300">
                    <th className="px-3 py-2 text-left font-semibold">Zeit</th>
                    <th className="px-3 py-2 text-right font-semibold">Verbrauch ({consumerUnit})</th>
                    <th className="px-3 py-2 text-right font-semibold">Erzeugung ({producerUnit})</th>
                    <th className="px-3 py-2 text-right font-semibold">Abgenommen (kWh)</th>
                    <th className="px-3 py-2 text-right font-semibold">Spot+Aufschl.</th>
                    <th className="px-3 py-2 text-right font-semibold">EG-Preis</th>
                    <th className="px-3 py-2 text-right font-semibold">Ersparnis</th>
                  </tr>
                </thead>
                <tbody>
                  {results.hourlyResults.map((hour, index) => {
                    const consumerDisplay = consumerUnit === 'kW'
                      ? hour.consumptionKw
                      : hour.consumption;
                    const producerDisplay = producerUnit === 'kW'
                      ? hour.production
                      : hour.productionKwh;

                    return (
                      <tr
                        key={index}
                        className={`border-b border-gray-200 ${
                          hour.savings > 0
                            ? 'bg-emerald-50 hover:bg-emerald-100'
                            : 'bg-red-50 hover:bg-red-100'
                        } transition-colors`}
                      >
                        <td className="px-3 py-2 font-medium">
                          {format(hour.hour, 'dd.MM HH:mm', { locale: de })}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatNumberGerman(consumerDisplay)} {consumerUnit}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatNumberGerman(producerDisplay)} {producerUnit}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">
                          {formatNumberGerman(hour.actuallyConsumed)} kWh
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatNumberGerman(hour.totalSpotPrice)} ct
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatNumberGerman(hour.egPrice)} ct
                        </td>
                        <td className={`px-3 py-2 text-right font-bold ${
                          hour.savings > 0 ? 'text-emerald-700' : 'text-red-700'
                        }`}>
                          {hour.savings > 0 ? '+' : ''}{formatNumberGerman(hour.savings)} €
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
