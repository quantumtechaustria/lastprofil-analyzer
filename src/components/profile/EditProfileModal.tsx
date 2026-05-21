import React, { useState, useEffect } from 'react';
import { X, Save, MapPin, Hash, Building, Zap } from 'lucide-react';

interface EditProfileModalProps {
  isOpen: boolean;
  profile: any | null;
  onClose: () => void;
  onSave: (updatedProfile: any) => void;
}

export default function EditProfileModal({ 
  isOpen, 
  profile, 
  onClose, 
  onSave 
}: EditProfileModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    site_address: '',
    meter_number: '',
    industry_sector: '',
    profile_type: 'unknown' as 'consumer' | 'producer' | 'unknown'
  });

  const [errors, setErrors] = useState<{[key: string]: string}>({});

  // Update form data when profile changes
  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        site_address: profile.site_address || '',
        meter_number: profile.meter_number || '',
        industry_sector: profile.industry_sector || '',
        profile_type: profile.profile_type || 'unknown'
      });
      setErrors({});
    }
  }, [profile]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name ist erforderlich';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;
    
    const updatedProfile = {
      ...profile,
      ...formData
    };
    
    onSave(updatedProfile);
    onClose();
  };

  const handleCancel = () => {
    setFormData({
      name: profile?.name || '',
      site_address: profile?.site_address || '',
      meter_number: profile?.meter_number || '',
      industry_sector: profile?.industry_sector || '',
      profile_type: profile?.profile_type || 'unknown'
    });
    setErrors({});
    onClose();
  };

  if (!isOpen || !profile) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={handleCancel} />
        
        <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="p-2 bg-sky-100 rounded-lg mr-3">
                <Zap className="h-6 w-6 text-sky-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Lastprofil bearbeiten
                </h3>
                <p className="text-sm text-gray-500">
                  Metadaten des Lastprofils anpassen
                </p>
              </div>
            </div>
            <button
              type="button"
              className="rounded-md bg-white text-gray-400 hover:text-gray-500 transition-colors"
              onClick={handleCancel}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Form */}
          <div className="space-y-6">
            {/* Name Field */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                <Zap className="h-4 w-4 inline mr-2 text-gray-400" />
                Name des Lastprofils *
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-colors ${
                  errors.name ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="z.B. Hauptgebäude Verbrauch"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            {/* Site Address Field */}
            <div>
              <label htmlFor="site_address" className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="h-4 w-4 inline mr-2 text-gray-400" />
                Standort/Adresse
              </label>
              <input
                type="text"
                id="site_address"
                value={formData.site_address}
                onChange={(e) => handleInputChange('site_address', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-colors"
                placeholder="z.B. Musterstraße 123, 12345 Musterstadt"
              />
            </div>

            {/* Meter Number Field */}
            <div>
              <label htmlFor="meter_number" className="block text-sm font-medium text-gray-700 mb-2">
                <Hash className="h-4 w-4 inline mr-2 text-gray-400" />
                Zählpunktnummer
              </label>
              <input
                type="text"
                id="meter_number"
                value={formData.meter_number}
                onChange={(e) => handleInputChange('meter_number', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-colors"
                placeholder="z.B. AT0010000000000000000000000012345"
              />
            </div>

            {/* Industry Sector and Profile Type in one row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Industry Sector Field */}
              <div>
                <label htmlFor="industry_sector" className="block text-sm font-medium text-gray-700 mb-2">
                  <Building className="h-4 w-4 inline mr-2 text-gray-400" />
                  Branche
                </label>
                <select
                  id="industry_sector"
                  value={formData.industry_sector}
                  onChange={(e) => handleInputChange('industry_sector', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-colors"
                >
                  <option value="">Branche auswählen</option>
                  <option value="Manufacturing">Produktion</option>
                  <option value="Commercial">Gewerbe</option>
                  <option value="Office">Büro</option>
                  <option value="Retail">Einzelhandel</option>
                  <option value="Healthcare">Gesundheitswesen</option>
                  <option value="Education">Bildung</option>
                  <option value="Hospitality">Gastgewerbe</option>
                  <option value="Other">Sonstige</option>
                </select>
              </div>

              {/* Profile Type Field */}
              <div>
                <label htmlFor="profile_type" className="block text-sm font-medium text-gray-700 mb-2">
                  <Zap className="h-4 w-4 inline mr-2 text-gray-400" />
                  Profiltyp
                </label>
                <select
                  id="profile_type"
                  value={formData.profile_type}
                  onChange={(e) => handleInputChange('profile_type', e.target.value as 'consumer' | 'producer' | 'unknown')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-colors"
                >
                  <option value="unknown">Typ auswählen</option>
                  <option value="consumer">🏠 Verbraucher</option>
                  <option value="producer">⚡ Einspeiser</option>
                </select>
              </div>
            </div>

            {/* Profile Type Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <Zap className="h-5 w-5 text-blue-400" />
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-blue-800">
                    Profiltyp-Information
                  </h4>
                  <div className="mt-2 text-sm text-blue-700">
                    <p><strong>🏠 Verbraucher:</strong> Bezugsprofil (positive Werte = Energieverbrauch)</p>
                    <p><strong>⚡ Einspeiser:</strong> Erzeugerprofil (positive Werte = Energieeinspeisung)</p>
                    <p className="mt-1 text-xs">
                      Diese Unterscheidung ist wichtig für Energiegemeinschafts-Analysen und Vergleiche.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-sky-600 border border-transparent rounded-lg hover:bg-sky-700 focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-colors"
            >
              <Save className="h-4 w-4 mr-2" />
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}