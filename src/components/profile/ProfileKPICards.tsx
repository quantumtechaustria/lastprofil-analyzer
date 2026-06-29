import React, { useMemo } from 'react';
import {
  Zap,
  TrendingUp,
  Activity,
  Clock,
  BarChart3,
  Sun,
  Moon,
  Euro,
  ArrowDownUp
} from 'lucide-react';
import { formatNumberGerman, formatLargeNumberGerman, formatIntegerGerman } from '../../lib/utils';
import { calculateEnergyOverlap } from '../../lib/energy-overlap';

interface ProfileKPICardsProps {
  profile: any;
  isComparisonMode?: boolean;
  selectedProfiles?: any[];
  colors?: string[];
}

export default function ProfileKPICards({ 
  profile, 
  isComparisonMode = false, 
  selectedProfiles = [],
  colors = []
}: ProfileKPICardsProps) {
  if (isComparisonMode && selectedProfiles.length > 1) {
    const consumerCount = selectedProfiles.filter(p => p.profile_type === 'consumer').length;
    const producerCount = selectedProfiles.filter(p => p.profile_type === 'producer').length;

    // Case 1: Exactly 1 consumer + 1 producer (Energiegemeinschaft)
    if (selectedProfiles.length === 2 && consumerCount === 1 && producerCount === 1) {
      const consumerProfile = selectedProfiles.find(p => p.profile_type === 'consumer')!;
      const producerProfile = selectedProfiles.find(p => p.profile_type === 'producer')!;

      const overlapResult = useMemo(() => {
        if (!consumerProfile.parsedData || !producerProfile.parsedData) {
          console.log('Missing parsedData:', {
            consumerHasData: !!consumerProfile.parsedData,
            producerHasData: !!producerProfile.parsedData,
            consumerDataLength: consumerProfile.parsedData?.length,
            producerDataLength: producerProfile.parsedData?.length
          });
          return null;
        }

        console.log('Calculating energy overlap with:', {
          consumerDataLength: consumerProfile.parsedData.length,
          producerDataLength: producerProfile.parsedData.length,
          consumerUnit: consumerProfile.unit || 'kW',
          producerUnit: producerProfile.unit || 'kW'
        });

        const result = calculateEnergyOverlap(
          consumerProfile.parsedData,
          producerProfile.parsedData,
          consumerProfile.unit || 'kW',
          producerProfile.unit || 'kW'
        );

        console.log('Energy overlap result:', result);
        return result;
      }, [consumerProfile, producerProfile]);

      if (!overlapResult) {
        return null;
      }

      return (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-white p-6 mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Profil-Zusammensetzung</h3>
            <div className="flex items-center space-x-6">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-blue-500 rounded-full mr-2"></div>
                <span className="text-sm text-gray-700">1 Verbraucher-Profil</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-green-500 rounded-full mr-2"></div>
                <span className="text-sm text-gray-700">1 Einspeiser-Profil</span>
              </div>
              <div className="text-sm text-emerald-600 font-medium">
                ⚡ Energiegemeinschafts-Analyse
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-white p-6">
              <div className="flex items-center">
                <div className="p-3 bg-sky-100 rounded-lg">
                  <Zap className="h-6 w-6 text-sky-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Jahresverbrauch</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatLargeNumberGerman(overlapResult.totalConsumptionKwh)} kWh
                  </p>
                  <p className="text-xs text-gray-500 mt-1">aus Lastprofil</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-white p-6">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Activity className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Jahreseinspeisung</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatLargeNumberGerman(overlapResult.totalProductionKwh)} kWh
                  </p>
                  <p className="text-xs text-gray-500 mt-1">erzeugte Energie</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-white p-6">
              <div className="flex items-center">
                <div className="p-3 bg-emerald-100 rounded-lg">
                  <ArrowDownUp className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Gesamt-Abnahme</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatLargeNumberGerman(overlapResult.totalActuallyConsumedKwh)} kWh
                  </p>
                  <p className="text-xs text-gray-500 mt-1">direkt vom Erzeuger</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-white p-6">
              <div className="flex items-center">
                <div className="p-3 bg-amber-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-amber-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Nutzungsgrad</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatNumberGerman(overlapResult.utilizationRate)}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">der Erzeugung genutzt</p>
                </div>
              </div>
            </div>
          </div>
        </>
      );
    }

    // Case 2: 2 profiles of the same type
    if (selectedProfiles.length === 2 && (consumerCount === 2 || producerCount === 2)) {
      const isSameType = consumerCount === 2 || producerCount === 2;
      const totalEnergy = selectedProfiles.reduce((sum, p) =>
        sum + (p.kpis?.annual_consumption_kwh || 0), 0
      );
      const profileType = consumerCount === 2 ? 'consumer' : 'producer';
      const energyLabel = profileType === 'consumer' ? 'Gesamt-Verbrauch' : 'Gesamt-Einspeisung';

      return (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-white p-6 mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Profil-Zusammensetzung</h3>
            <div className="flex items-center space-x-6">
              <div className="flex items-center">
                <div className={`w-4 h-4 ${profileType === 'consumer' ? 'bg-blue-500' : 'bg-green-500'} rounded-full mr-2`}></div>
                <span className="text-sm text-gray-700">
                  2 {profileType === 'consumer' ? 'Verbraucher' : 'Einspeiser'}-Profile
                </span>
              </div>
            </div>
          </div>

          {/* Total Energy Block */}
          <div className="bg-white rounded-xl shadow-sm border border-white p-6 mb-6">
            <div className="flex items-center">
              <div className={`p-3 ${profileType === 'consumer' ? 'bg-sky-100' : 'bg-green-100'} rounded-lg`}>
                <Zap className={`h-6 w-6 ${profileType === 'consumer' ? 'text-sky-600' : 'text-green-600'}`} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">{energyLabel}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatLargeNumberGerman(totalEnergy)} kWh
                </p>
                <p className="text-xs text-gray-500 mt-1">aus beiden Profilen</p>
              </div>
            </div>
          </div>

          {/* Individual Profile KPIs */}
          <div className="space-y-6">
            {selectedProfiles.map((profile, index) => {
              if (!profile?.kpis) return null;
              const kpis = profile.kpis;
              const profileEnergyLabel = profile.profile_type === 'producer' ? 'Jahreseinspeisung' : 'Jahresverbrauch';

              return (
                <div key={profile.id}>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">{profile.name}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-white rounded-xl shadow-sm border border-white p-6">
                      <div className="flex items-center">
                        <div className={`p-3 ${profile.profile_type === 'producer' ? 'bg-green-100' : 'bg-sky-100'} rounded-lg`}>
                          <Zap className={`h-6 w-6 ${profile.profile_type === 'producer' ? 'text-green-600' : 'text-sky-600'}`} />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-500">{profileEnergyLabel}</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {formatIntegerGerman(kpis.annual_consumption_kwh)} kWh
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatLargeNumberGerman(kpis.annual_consumption_kwh / 1000)} MWh
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-white p-6">
                      <div className="flex items-center">
                        <div className="p-3 bg-orange-100 rounded-lg">
                          <TrendingUp className="h-6 w-6 text-orange-600" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-500">Spitzenlast</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {formatNumberGerman(kpis.peak_load_kw)} kW
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatNumberGerman(kpis.peak_frequency_90_percent)}% über 90%
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-white p-6">
                      <div className="flex items-center">
                        <div className="p-3 bg-emerald-100 rounded-lg">
                          <Activity className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-500">Lastfaktor</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {formatNumberGerman(kpis.load_factor)}%
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatIntegerGerman(kpis.usage_hours)} Volllaststunden
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      );
    }

    // Case 3: More than 2 profiles or mixed types - show aggregated KPIs
    const totalConsumption = selectedProfiles.reduce((sum, p) =>
      sum + (p.kpis?.annual_consumption_kwh || 0), 0
    );
    const maxPeakLoad = Math.max(...selectedProfiles.map(p => p.kpis?.peak_load_kw || 0));
    const avgLoadFactor = selectedProfiles.reduce((sum, p) =>
      sum + (p.kpis?.load_factor || 0), 0
    ) / selectedProfiles.length;

    return (
      <>
        {/* Profile Type Summary for Comparison */}
        {(consumerCount > 0 || producerCount > 0) && (
          <div className="bg-white rounded-xl shadow-sm border border-white p-6 mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Profil-Zusammensetzung</h3>
            <div className="flex items-center space-x-6">
              {consumerCount > 0 && (
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-blue-500 rounded-full mr-2"></div>
                  <span className="text-sm text-gray-700">
                    {consumerCount} Verbraucher-{consumerCount === 1 ? 'Profil' : 'Profile'}
                  </span>
                </div>
              )}
              {producerCount > 0 && (
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-green-500 rounded-full mr-2"></div>
                  <span className="text-sm text-gray-700">
                    {producerCount} Einspeiser-{producerCount === 1 ? 'Profil' : 'Profile'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-white p-6">
            <div className="flex items-center">
              <div className="p-3 bg-sky-100 rounded-lg">
                <Zap className="h-6 w-6 text-sky-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Gesamt-Verbrauch</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatLargeNumberGerman(totalConsumption / 1000)} MWh
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-white p-6">
            <div className="flex items-center">
              <div className="p-3 bg-orange-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Max. Spitzenlast</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatNumberGerman(maxPeakLoad)} kW
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-white p-6">
            <div className="flex items-center">
              <div className="p-3 bg-emerald-100 rounded-lg">
                <Activity className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Ø Lastfaktor</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatNumberGerman(avgLoadFactor)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!profile?.kpis) {
    return null;
  }

  const kpis = profile.kpis;
  const isProducer = profile.profile_type === 'producer';
  const energyLabel = isProducer ? 'Jahreseinspeisung' : 'Jahresverbrauch';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div className="bg-white rounded-xl shadow-sm border border-white p-6">
        <div className="flex items-center">
          <div className="p-3 bg-sky-100 rounded-lg">
            <Zap className="h-6 w-6 text-sky-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500">{energyLabel}</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatIntegerGerman(kpis.annual_consumption_kwh)} kWh
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {formatLargeNumberGerman(kpis.annual_consumption_kwh / 1000)} MWh
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-white p-6">
        <div className="flex items-center">
          <div className="p-3 bg-orange-100 rounded-lg">
            <TrendingUp className="h-6 w-6 text-orange-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500">Spitzenlast</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatNumberGerman(kpis.peak_load_kw)} kW
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {formatNumberGerman(kpis.peak_frequency_90_percent)}% über 90%
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-white p-6">
        <div className="flex items-center">
          <div className="p-3 bg-emerald-100 rounded-lg">
            <Activity className="h-6 w-6 text-emerald-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500">Lastfaktor</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatNumberGerman(kpis.load_factor)}%
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {formatIntegerGerman(kpis.usage_hours)} Volllaststunden
            </p>
          </div>
        </div>
      </div>


      {/* Day/Night Ratio Card */}
      {kpis.day_night_ratio && (
        <div className="bg-white rounded-xl shadow-sm border border-white p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-4">Tag/Nacht-Verhältnis</h3>

          {/* Single combined bar */}
          <div className="flex w-full h-4 rounded-full overflow-hidden bg-gray-200">
            <div
              className="bg-yellow-500 h-full"
              style={{ width: `${kpis.day_night_ratio.day_percent}%` }}
              title={`Tag: ${formatNumberGerman(kpis.day_night_ratio.day_percent)}%`}
            />
            <div
              className="bg-blue-500 h-full"
              style={{ width: `${kpis.day_night_ratio.night_percent}%` }}
              title={`Nacht: ${formatNumberGerman(kpis.day_night_ratio.night_percent)}%`}
            />
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between mt-3 text-sm">
            <span className="flex items-center text-gray-600">
              <Sun className="h-4 w-4 text-yellow-500 mr-1" />
              Tag
              <span className="ml-1 font-semibold text-yellow-500">{formatNumberGerman(kpis.day_night_ratio.day_percent)}%</span>
            </span>
            <span className="flex items-center text-gray-600">
              <span className="font-semibold text-blue-500 mr-1">{formatNumberGerman(kpis.day_night_ratio.night_percent)}%</span>
              Nacht
              <Moon className="h-4 w-4 text-blue-500 ml-1" />
            </span>
          </div>
        </div>
      )}
    </div>
  );
}