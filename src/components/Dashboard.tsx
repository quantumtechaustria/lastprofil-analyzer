import React from 'react';
import { 
  Zap, 
  Upload,
  Eye,
  Download,
  MapPin,
  Calendar,
  TrendingUp,
  Activity,
  BarChart3,
  Plus,
  Check,
  X,
  Trash2,
  Edit
} from 'lucide-react';
import { formatLargeNumberGerman, formatNumberGerman, formatIntegerGerman } from '../lib/utils';

interface DashboardProps {
  loadProfiles?: any[];
  organization?: any;
  onNavigate?: (page: string) => void;
  onViewProfile?: (profile: any) => void;
  onDeleteProfile?: (profileId: string) => void;
  isComparisonMode?: boolean;
  profilesForComparison?: any[];
  onStartComparison?: () => void;
  onEndComparison?: () => void;
  onToggleProfileForComparison?: (profile: any) => void;
  onViewComparison?: () => void;
  onEditProfile?: (profile: any) => void;
}

export default function Dashboard({ 
  loadProfiles = [], 
  organization, 
  onNavigate, 
  onViewProfile,
  onDeleteProfile,
  isComparisonMode = false,
  profilesForComparison = [],
  onStartComparison,
  onEndComparison,
  onToggleProfileForComparison,
  onViewComparison,
  onEditProfile = () => {}
}: DashboardProps) {
  const handleViewProfile = (profile: any) => {
    onViewProfile?.(profile);
  };

  const handleUploadClick = () => {
    onNavigate?.('upload');
  };

  return (
    <div className="min-h-full bg-[#f6f8fb]">
      {/* Hero Section with Gradient Background */}
      <div className="bg-gradient-to-br from-sky-600 via-sky-500 to-emerald-500 mx-6 mt-6 rounded-xl p-4 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Zap className="h-5 w-5 text-white mr-2" />
            <h1 className="text-xl font-bold">
              Lastprofil-Bibliothek
            </h1>
          </div>
          {loadProfiles.length > 0 && (
            <div className="text-sky-50 text-right">
              <div className="text-lg font-bold">{loadProfiles.length}</div>
              <div className="text-xs opacity-90">
                {loadProfiles.length === 1 ? 'Lastprofil verfügbar' : 'Lastprofile verfügbar'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-6 pt-4">
        <div className="flex items-center gap-3">
          {!isComparisonMode ? (
            <>
              {loadProfiles.length > 1 && (
                <button
                  onClick={onStartComparison}
                  className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Profile vergleichen
                </button>
              )}

              <button
                onClick={handleUploadClick}
                className="inline-flex items-center px-4 py-2 bg-sky-600 text-white text-sm font-semibold rounded-lg hover:bg-sky-700 transition-all duration-200 shadow-sm hover:shadow-md ml-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                Neues Lastprofil hochladen
              </button>
            </>
          ) : (
            <button
              onClick={onEndComparison}
              className="inline-flex items-center px-4 py-2 bg-gray-600 text-white text-sm font-semibold rounded-lg hover:bg-gray-700 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <X className="h-4 w-4 mr-2" />
              Vergleich beenden
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 pb-6 pt-4">
        {/* Comparison Mode Header */}
        {isComparisonMode && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 flex-1">
                <div>
                  <h3 className="text-sm font-bold text-emerald-900">
                    Vergleichsmodus aktiv
                  </h3>
                  <p className="text-xs text-emerald-700">
                    Wählen Sie Profile aus, um sie zu vergleichen.
                  </p>
                </div>
                {profilesForComparison.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {profilesForComparison.map((profile) => (
                      <span
                        key={profile.id}
                        className="inline-flex items-center px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-medium"
                      >
                        {profile.name}
                        <button
                          onClick={() => onToggleProfileForComparison?.(profile)}
                          className="ml-1.5 text-emerald-600 hover:text-emerald-800"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <div className="text-lg font-bold text-emerald-900">
                    {profilesForComparison.length}
                  </div>
                  <div className="text-xs text-emerald-700">
                    {profilesForComparison.length === 1 ? 'Profil ausgewählt' : 'Profile ausgewählt'}
                  </div>
                </div>
                {profilesForComparison.length >= 2 && (
                  <button
                    onClick={onViewComparison}
                    className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Vergleich anzeigen
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {loadProfiles.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-xl shadow-sm border border-white p-8 text-center">
            <div className="max-w-md mx-auto">
              <div className="mx-auto h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Upload className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Noch keine Lastprofile vorhanden
              </h3>
              <p className="text-gray-600 mb-6">
                Beginnen Sie mit dem Upload Ihrer ersten CSV-Datei mit 15-Minuten-Lastdaten 
                von Ihrem Netzbetreiber. Nach dem Upload können Sie sofort mit der Analyse starten.
              </p>
              <button
                onClick={handleUploadClick}
                className="inline-flex items-center px-6 py-3 bg-sky-600 text-white font-bold rounded-xl hover:bg-sky-700 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <Upload className="h-5 w-5 mr-2" />
                Erstes Lastprofil hochladen
              </button>
            </div>
          </div>
        ) : (
          /* Load Profiles Grid */
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3">
              {loadProfiles.map((profile, index) => (
                <div
                  key={profile.id || index}
                  className="bg-white rounded-lg shadow-sm border border-white"
                >
                  <div className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="text-base font-bold text-gray-900 mb-1">
                          {profile.name || `Lastprofil ${index + 1}`}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 mb-2">
                          {profile.customer_number && (
                            <div className="flex items-center bg-gray-50 px-1.5 py-0.5 rounded">
                              <span className="font-medium text-gray-700">Kd-Nr:</span>
                              <span className="ml-1">{profile.customer_number}</span>
                            </div>
                          )}
                          {profile.metering_point && (
                            <div className="flex items-center bg-gray-50 px-1.5 py-0.5 rounded">
                              <span className="font-medium text-gray-700">ZP:</span>
                              <span className="ml-1">{profile.metering_point}</span>
                            </div>
                          )}
                          {profile.energy_direction && (
                            <div className={`flex items-center px-1.5 py-0.5 rounded font-medium ${
                              profile.profile_type === 'consumer'
                                ? 'bg-blue-50 text-blue-700'
                                : profile.profile_type === 'producer'
                                ? 'bg-yellow-50 text-yellow-700'
                                : 'bg-gray-50 text-gray-700'
                            }`}>
                              {profile.energy_direction}
                            </div>
                          )}
                          {profile.site_address && (
                            <div className="flex items-center">
                              <MapPin className="h-3 w-3 mr-1 text-gray-400" />
                              {profile.site_address}
                            </div>
                          )}
                          <div className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1 text-gray-400" />
                            {profile.data_start && profile.data_end ? (
                              `${new Date(profile.data_start).toLocaleDateString('de-DE')} - ${new Date(profile.data_end).toLocaleDateString('de-DE')}`
                            ) : (
                              'Zeitraum nicht verfügbar'
                            )}
                          </div>
                          {profile.meter_number && (
                            <div className="text-gray-400">
                              • Zähler: {profile.meter_number}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => handleViewProfile(profile)}
                          className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md ${
                            isComparisonMode
                              ? profilesForComparison.some(p => p.id === profile.id)
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-sky-600 text-white hover:bg-sky-700'
                          }`}
                        >
                          {isComparisonMode ? (
                            profilesForComparison.some(p => p.id === profile.id) ? (
                              <>
                                <Check className="h-3 w-3 mr-1" />
                                Ausgewählt
                              </>
                            ) : (
                              <>
                                <Plus className="h-3 w-3 mr-1" />
                                Auswählen
                              </>
                            )
                          ) : (
                            <>
                              <Eye className="h-3 w-3 mr-1" />
                              Analyse starten
                            </>
                          )}
                        </button>
                        {!isComparisonMode && (
                          <button className="inline-flex items-center px-2 py-1.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors">
                            <Download className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* KPI Preview Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-1.5 mb-1.5">
                      <div className="bg-gray-50 rounded p-1">
                        <div className="flex items-center">
                          <Zap className="h-3 w-3 text-sky-500 mr-1.5" />
                          <div>
                            <p className="text-[10px] text-gray-500 leading-tight">
                              {profile.profile_type === 'producer' ? 'Einspeisung' : 'Verbrauch'}
                            </p>
                            <p className="text-xs font-semibold">
                              {profile.kpis?.annual_consumption_kwh
                                ? `${formatIntegerGerman(profile.kpis.annual_consumption_kwh)} kWh`
                                : 'N/A'
                              }
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded p-1">
                        <div className="flex items-center">
                          <TrendingUp className="h-3 w-3 text-orange-500 mr-1.5" />
                          <div>
                            <p className="text-[10px] text-gray-500 leading-tight">Spitzenlast</p>
                            <p className="text-xs font-semibold">
                              {profile.kpis?.peak_load_kw
                                ? `${formatNumberGerman(profile.kpis.peak_load_kw)} kW`
                                : 'N/A'
                              }
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded p-1">
                        <div className="flex items-center">
                          <Activity className="h-3 w-3 text-emerald-500 mr-1.5" />
                          <div>
                            <p className="text-[10px] text-gray-500 leading-tight">Lastfaktor</p>
                            <p className="text-xs font-semibold">
                              {profile.kpis?.load_factor
                                ? `${formatNumberGerman(profile.kpis.load_factor)}%`
                                : 'N/A'
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quality and Stats Footer */}
                    <div className="flex items-center justify-between pt-1.5 border-t border-gray-100">
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <span>
                          {profile.total_records
                            ? `${profile.total_records.toLocaleString('de-DE')} Datenpunkte`
                            : 'Datenpunkte unbekannt'
                          }
                        </span>
                        {profile.industry_sector && (
                          <span className="px-2 py-0.5 bg-gray-100 rounded-full text-[10px] font-medium">
                            {profile.industry_sector}
                          </span>
                        )}
                        {profile.profile_type && profile.profile_type !== 'unknown' && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            profile.profile_type === 'consumer'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {profile.profile_type === 'consumer' ? '🏠 Verbraucher' : '⚡ Einspeiser'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {profile.data_quality_score && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            profile.data_quality_score >= 90
                              ? 'bg-emerald-100 text-emerald-800'
                              : profile.data_quality_score >= 80
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            Qualität: {profile.data_quality_score}%
                          </span>
                        )}
                        {!isComparisonMode && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditProfile?.(profile);
                              }}
                              className="text-gray-400 hover:text-sky-600 transition-colors p-0.5"
                              title="Profil bearbeiten"
                            >
                              <Edit className="h-3 w-3" />
                            </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Möchten Sie das Lastprofil "${profile.name}" wirklich löschen?`)) {
                                onDeleteProfile?.(profile.id);
                              }
                            }}
                            className="text-red-400 hover:text-red-600 transition-colors p-0.5"
                            title="Lastprofil löschen"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}