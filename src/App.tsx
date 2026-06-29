import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import AuthModal from './components/AuthModal';
import Dashboard from './components/Dashboard';
import FileUpload from './components/FileUpload';
import LoadProfiles from './components/LoadProfiles';
import BillingPage from './components/BillingPage';
import SpotPriceManagement from './components/SpotPriceManagement';
import ParticipationFactor from './components/ParticipationFactor';
import EditProfileModal from './components/profile/EditProfileModal';
import { getCurrentUser, signOut } from './lib/supabase';

// Funktion zum Laden der initialen Profile aus localStorage
const getInitialLoadProfiles = (): any[] => {
  console.log('🔄 Lade Profile aus localStorage beim Start...');
  try {
    const savedProfiles = localStorage.getItem('loadAnalyzer_profiles');
    if (savedProfiles) {
      const profiles = JSON.parse(savedProfiles);
      console.log(`${profiles.length} gespeicherte Profile geladen`);
      return profiles;
    } else {
      console.log('📭 Keine gespeicherten Profile gefunden');
      return [];
    }
  } catch (error) {
    console.error('Fehler beim Laden der gespeicherten Profile:', error);
    localStorage.removeItem('loadAnalyzer_profiles');
    return [];
  }
};

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [loadProfiles, setLoadProfiles] = useState<any[]>(getInitialLoadProfiles());
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  const [profilesForComparison, setProfilesForComparison] = useState<any[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any>(null);
  
  // Speichere Profile bei Änderungen
  useEffect(() => {
    console.log('💾 Speichere Profile im localStorage:', loadProfiles.length, 'Profile', loadProfiles.map(p => ({ id: p.id, name: p.name, hasData: !!p.parsedData })));
    try {
      localStorage.setItem('loadAnalyzer_profiles', JSON.stringify(loadProfiles));
      console.log(`✅ ${loadProfiles.length} Profile erfolgreich gespeichert`);
    } catch (error) {
      console.error('Fehler beim Speichern der Profile:', error);
      // Wenn localStorage voll ist, lösche alte Daten
      if (error.name === 'QuotaExceededError') {
        console.warn('⚠️ localStorage voll - lösche alle Profile');
        localStorage.removeItem('loadAnalyzer_profiles');
        alert('Speicher voll. Alte Profile wurden gelöscht. Bitte laden Sie Ihre Dateien erneut hoch.');
        setLoadProfiles([]); // Setze auch den In-Memory-Zustand zurück
      }
    }
  }, [loadProfiles]);

  // Mock organization for demo
  const organization = {
    id: '1',
    name: 'QuantumTech',
    subscription_plan: 'pro'
  };

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    const handleNavigate = (event: any) => {
      setCurrentPage(event.detail);
    };

    window.addEventListener('navigate', handleNavigate);
    return () => {
      window.removeEventListener('navigate', handleNavigate);
    };
  }, []);

  const checkUser = async () => {
    try {
      const { user } = await getCurrentUser();
      setUser(user);
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setUser(null);
    setCurrentPage('dashboard');
  };

  const handleUploadComplete = (result: any) => {
    console.log('📥 Upload Complete Handler aufgerufen:', result);
    
    // In a real app, this would save to database
    const newProfile = {
      id: Date.now().toString(),
      name: result.metadata.name,
      file_name: result.fileName,
      site_address: result.metadata.site_address,
      meter_number: result.metadata.meter_number,
      industry_sector: result.metadata.industry_sector,
      profile_type: result.metadata.profile_type,
      total_records: result.parseResult.metadata.total_records,
      data_quality_score: result.parseResult.quality_score,
      data_start: result.parseResult.metadata.data_start,
      data_end: result.parseResult.metadata.data_end,
      kpis: result.kpis,
      created_at: new Date().toISOString(),
      parsedData: result.parseResult.data
    };
    
    console.log('💾 Neues Profil erstellt:', {
      ...newProfile,
      parsedData: `${newProfile.parsedData?.length || 0} Datenpunkte`
    });
    
    setLoadProfiles(prev => [newProfile, ...prev]);
    
    // Erfolgreiche Verarbeitung anzeigen
    const recordCount = result.parseResult.metadata.total_records.toLocaleString();
    const qualityScore = result.parseResult.quality_score;
    
    setTimeout(() => {
      alert(`Lastprofil erfolgreich verarbeitet!\n\n${recordCount} Datensätze\nQualität: ${qualityScore}%\n\nSehen Sie es im Dashboard an.`);
      // Automatisch zum Dashboard wechseln
      setCurrentPage('dashboard');
    }, 100);
  };

  const handleStartComparison = () => {
    setIsComparisonMode(true);
    setProfilesForComparison([]);
  };

  const handleEndComparison = () => {
    setIsComparisonMode(false);
    setProfilesForComparison([]);
  };

  const handleToggleProfileForComparison = (profile: any) => {
    setProfilesForComparison(prev => {
      const isAlreadySelected = prev.some(p => p.id === profile.id);
      if (isAlreadySelected) {
        return prev.filter(p => p.id !== profile.id);
      } else {
        return [...prev, profile];
      }
    });
  };

  const handleViewComparison = () => {
    // Navigiere zur Vergleichsansicht mit den ausgewählten Profilen
    setCurrentPage('dashboard');
    setSelectedProfile(null);
    setCurrentPage('profiles'); // Wechsle zur Profil-Ansicht für den Vergleich
  };

  const handleEditProfile = (profile: any) => {
    setEditingProfile(profile);
    setShowEditModal(true);
  };

  const handleUpdateProfile = (updatedProfile: any) => {
    setLoadProfiles(prev => prev.map(p => 
      p.id === updatedProfile.id ? updatedProfile : p
    ));
    setShowEditModal(false);
    setEditingProfile(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-600 via-sky-500 to-emerald-500 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold text-white mb-4">
              Lastprofil Analyzer
            </h1>
            <p className="text-xl text-sky-50">
              Professionelle Energielastprofil-Analyse
            </p>
          </div>

          <AuthModal
            isOpen={true}
            onClose={() => {}}
            onSuccess={() => {
              checkUser();
            }}
          />
        </div>
      </div>
    );
  }

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <Dashboard 
            loadProfiles={loadProfiles} 
            organization={organization} 
            onNavigate={setCurrentPage}
            isComparisonMode={isComparisonMode}
            profilesForComparison={profilesForComparison}
            onStartComparison={handleStartComparison}
            onEndComparison={handleEndComparison}
            onToggleProfileForComparison={handleToggleProfileForComparison}
            onViewComparison={handleViewComparison}
            onViewProfile={(profile) => {
              if (isComparisonMode) {
                handleToggleProfileForComparison(profile);
              } else {
                setSelectedProfile(profile);
                setCurrentPage('profiles');
              }
            }}
            onDeleteProfile={(profileId) => {
              setLoadProfiles(prev => prev.filter(p => p.id !== profileId));
            }}
            onEditProfile={handleEditProfile}
          />
        );
      case 'upload':
        return (
          <FileUpload 
            onUploadComplete={handleUploadComplete}
            maxUploads={organization.subscription_plan === 'free' ? 1 : undefined}
            currentUploads={loadProfiles.length}
          />
        );
      case 'profiles':
        return (
          <LoadProfiles 
            profiles={loadProfiles.map(profile => ({
              ...profile,
              selectedForComparison: profilesForComparison.some(p => p.id === profile.id)
            }))} 
            selectedProfile={selectedProfile} 
            isComparisonMode={isComparisonMode}
            onBackToList={() => {
              setSelectedProfile(null);
              setCurrentPage('dashboard');
            }} 
          />
        );
      case 'spot-prices':
        return <SpotPriceManagement />;
      case 'participation-factor':
        return <ParticipationFactor loadProfiles={loadProfiles} />;
      case 'billing':
        return <BillingPage organization={organization} />;
      case 'settings':
        return (
          <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Einstellungen</h2>
            <p className="text-gray-600">Konfigurieren Sie Ihre Kontoeinstellungen (Demnächst verfügbar)</p>
          </div>
        );
      default:
        return <Dashboard loadProfiles={loadProfiles} organization={organization} onNavigate={setCurrentPage} />;
    }
  };

  return (
    <Layout
      currentPage={currentPage}
      onNavigate={setCurrentPage}
      user={user}
      organization={organization}
      onSignOut={handleSignOut}
    >
      {renderCurrentPage()}
      
      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={showEditModal}
        profile={editingProfile}
        onClose={() => {
          setShowEditModal(false);
          setEditingProfile(null);
        }}
        onSave={handleUpdateProfile}
      />
    </Layout>
  );
}

export default App;