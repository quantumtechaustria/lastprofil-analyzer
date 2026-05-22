import React from 'react';
import { Check, Plus, MapPin, Calendar, Zap, TrendingUp, Activity, BarChart3 } from 'lucide-react';
import { formatLargeNumberGerman, formatNumberGerman, formatIntegerGerman } from '../../lib/utils';

interface ProfileSelectorProps {
  profiles: any[];
  selectedProfiles: any[];
  isComparisonMode: boolean;
  onToggleProfile: (profile: any) => void;
  colors: string[];
}

export default function ProfileSelector({ 
  profiles, 
  selectedProfiles, 
  isComparisonMode, 
  onToggleProfile,
  colors 
}: ProfileSelectorProps) {
  const isProfileSelected = (profile: any) => {
    return selectedProfiles.some(p => p.id === profile.id);
  };

  // Group selected profiles by type for color variation
  const profilesByType = selectedProfiles.reduce((acc, profile) => {
    const type = profile.profile_type || 'unknown';
    if (!acc[type]) acc[type] = [];
    acc[type].push(profile);
    return acc;
  }, {} as Record<string, any[]>);

  const hasMultipleSameType = Object.values(profilesByType).some((p: any[]) => p.length > 1);

  const getProfileColor = (profile: any) => {
    const index = selectedProfiles.findIndex(p => p.id === profile.id);
    if (index < 0) return '#6b7280';

    const profileType = profile.profile_type || 'unknown';
    const profilesOfSameType = profilesByType[profileType] || [];

    if (hasMultipleSameType && profilesOfSameType.length > 1) {
      const indexInType = profilesOfSameType.findIndex((p: any) => p.id === profile.id);
      if (profileType === 'consumer') {
        const blueShades = ['#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af'];
        return blueShades[indexInType % blueShades.length];
      } else if (profileType === 'producer') {
        const yellowShades = ['#fde047', '#facc15', '#eab308', '#f59e0b', '#f97316'];
        return yellowShades[indexInType % yellowShades.length];
      }
    }

    return colors[index % colors.length];
  };

  if (!isComparisonMode) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Profile für Vergleich auswählen
        </h3>
        <p className="text-gray-600 mb-6">
          Klicken Sie auf die Profile, die Sie vergleichen möchten. Perfekt für PV-Einspeisung vs. Verbrauch oder Großverbraucher-Analysen.
        </p>
        
        {selectedProfiles.length > 0 && (
          <div className="mb-6 p-4 bg-emerald-50 rounded-lg">
            <h4 className="font-medium text-emerald-800">
              {selectedProfiles.length} {selectedProfiles.length === 1 ? 'Profil' : 'Profile'} ausgewählt
            </h4>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {profiles.map((profile, index) => {
          const selected = isProfileSelected(profile);
          const profileColor = getProfileColor(profile);
          
          return (
            <div
              key={profile.id || index}
              className={`bg-white rounded-xl shadow-sm border-2 transition-all duration-200 cursor-pointer hover:shadow-md ${
                selected 
                  ? 'border-emerald-500 bg-emerald-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => onToggleProfile(profile)}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      {selected && (
                        <div 
                          className="w-4 h-4 rounded-full mr-3 flex items-center justify-center"
                          style={{ backgroundColor: profileColor }}
                        >
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                      <h3 className="text-xl font-bold text-gray-900">
                        {profile.name || `Lastprofil ${index + 1}`}
                      </h3>
                      {profile.profile_type && profile.profile_type !== 'unknown' && (
                        <span className={`ml-3 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          profile.profile_type === 'consumer' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {profile.profile_type === 'consumer' ? '🏠' : '⚡'}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-6 text-sm text-gray-600 mb-4">
                      {profile.site_address && (
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                          {profile.site_address}
                        </div>
                      )}
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                        {profile.data_start && profile.data_end ? (
                          `${new Date(profile.data_start).toLocaleDateString('de-DE')} - ${new Date(profile.data_end).toLocaleDateString('de-DE')}`
                        ) : (
                          'Zeitraum nicht verfügbar'
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <button
                    className={`inline-flex items-center px-6 py-3 font-bold rounded-xl transition-all duration-200 ${
                      selected
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {selected ? (
                      <>
                        <Check className="h-5 w-5 mr-2" />
                        Ausgewählt
                      </>
                    ) : (
                      <>
                        <Plus className="h-5 w-5 mr-2" />
                        Auswählen
                      </>
                    )}
                  </button>
                </div>

                {/* KPI Preview Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center">
                      <Zap className="h-5 w-5 text-sky-500 mr-2" />
                      <div>
                        <p className="text-xs text-gray-500">Verbrauch</p>
                        <p className="font-semibold">
                          {profile.kpis?.annual_consumption_kwh 
                            ? `${formatLargeNumberGerman(profile.kpis.annual_consumption_kwh / 1000)} MWh`
                            : 'N/A'
                          }
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center">
                      <TrendingUp className="h-5 w-5 text-orange-500 mr-2" />
                      <div>
                        <p className="text-xs text-gray-500">Spitzenlast</p>
                        <p className="font-semibold">
                          {profile.kpis?.peak_load_kw 
                            ? `${formatNumberGerman(profile.kpis.peak_load_kw)} kW`
                            : 'N/A'
                          }
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center">
                      <Activity className="h-5 w-5 text-emerald-500 mr-2" />
                      <div>
                        <p className="text-xs text-gray-500">Lastfaktor</p>
                        <p className="font-semibold">
                          {profile.kpis?.load_factor 
                            ? `${formatNumberGerman(profile.kpis.load_factor)}%`
                            : 'N/A'
                          }
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center">
                      <BarChart3 className="h-5 w-5 text-purple-500 mr-2" />
                      <div>
                        <p className="text-xs text-gray-500">Einsparpotenzial</p>
                        <p className="font-semibold">
                          {profile.kpis?.cost_potential_eur 
                            ? `€${formatIntegerGerman(profile.kpis.cost_potential_eur)}`
                            : 'N/A'
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}