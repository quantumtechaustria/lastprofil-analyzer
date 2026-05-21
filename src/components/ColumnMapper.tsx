import React, { useState } from 'react';
import { Check, AlertCircle, Eye, X } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';

interface ColumnMapperProps {
  headers: string[];
  sampleData: any[];
  onMapping: (timestampField: string, powerField: string, powerUnit: 'kW' | 'kWh') => void;
  onCancel: () => void;
  suggestedMapping?: {
    timestampField: string;
    powerField: string;
    confidence: number;
    powerUnitSuggestion?: 'kW' | 'kWh';
  };
}

export default function ColumnMapper({ 
  headers, 
  sampleData, 
  onMapping, 
  onCancel,
  suggestedMapping 
}: ColumnMapperProps) {
  const [timestampField, setTimestampField] = useState(suggestedMapping?.timestampField || '');
  const [powerField, setPowerField] = useState(suggestedMapping?.powerField || '');
  const [powerUnit, setPowerUnit] = useState<'kW' | 'kWh'>(suggestedMapping?.powerUnitSuggestion || 'kW');
  const [showPreview, setShowPreview] = useState(false);

  const canProceed = timestampField && powerField && timestampField !== powerField;

  const handleConfirm = () => {
    if (canProceed) {
      onMapping(timestampField, powerField, powerUnit);
    }
  };

  const formatTimestampPreview = (value: any, row?: any): string => {
    // Check if this is a combined field (Datum+Zeit)
    if (timestampField?.includes('+') && row) {
      const [dateField, timeField] = timestampField.split('+');
      const dateValue = row[dateField];
      const timeValue = row[timeField];
      if (!dateValue || !timeValue) return 'leer';
      return `${dateValue} ${timeValue}`;
    }

    if (!value) return 'leer';

    const numValue = parseFloat(String(value));
    if (!isNaN(numValue) && numValue > 1000 && numValue < 100000) {
      const excelEpoch = new Date(1899, 11, 30);
      const days = Math.floor(numValue);
      const fraction = numValue - days;
      const milliseconds = Math.round(fraction * 24 * 60 * 60 * 1000);
      const date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000 + milliseconds);
      if (isValid(date)) {
        return format(date, 'dd.MM.yyyy HH:mm');
      }
    }

    try {
      const date = parseISO(String(value));
      if (isValid(date)) {
        return format(date, 'dd.MM.yyyy HH:mm');
      }
    } catch {}

    return String(value);
  };

  const formatPowerPreview = (value: any): string => {
    if (!value) return 'leer';

    let numValue: number;

    if (typeof value === 'number') {
      numValue = value;
    } else {
      const strValue = String(value).trim();

      if (strValue.includes(',')) {
        const cleaned = strValue.replace(/\./g, '').replace(/,/g, '.');
        numValue = parseFloat(cleaned);
      } else {
        numValue = parseFloat(strValue);
      }
    }

    if (isNaN(numValue)) return String(value);

    return numValue.toFixed(4).replace('.', ',');
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Spalten zuordnen</h3>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {suggestedMapping && (
        <div className={`mb-4 p-3 rounded-md ${
          suggestedMapping.confidence >= 0.8
            ? 'bg-green-50 border border-green-200'
            : 'bg-yellow-50 border border-yellow-200'
        }`}>
          <div className="flex">
            <AlertCircle className={`h-5 w-5 mt-0.5 ${
              suggestedMapping.confidence >= 0.8 ? 'text-green-400' : 'text-yellow-400'
            }`} />
            <div className="ml-3">
              <p className={`text-sm ${
                suggestedMapping.confidence >= 0.8 ? 'text-green-800' : 'text-yellow-800'
              }`}>
                {suggestedMapping.confidence >= 0.8
                  ? 'Automatische Spaltenerkennung erfolgreich. Bitte überprüfen Sie die Zuordnung.'
                  : 'Automatische Spaltenerkennung unsicher. Bitte überprüfen Sie die Zuordnung.'
                }
              </p>
              <div className="mt-2 text-xs space-y-1">
                <div><strong>Zeitstempel:</strong> {suggestedMapping.timestampField || 'Nicht erkannt'}</div>
                <div><strong>Leistung:</strong> {suggestedMapping.powerField || 'Nicht erkannt'}</div>
                <div><strong>Einheit:</strong> {suggestedMapping.powerUnitSuggestion || 'kW'}</div>
                <div><strong>Konfidenz:</strong> {Math.round(suggestedMapping.confidence * 100)}%</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Zeitstempel-Spalte */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Zeitstempel-Spalte {timestampField && <span className="text-green-600">(✓ Ausgewählt)</span>}
          </label>
          <select
            value={timestampField}
            onChange={(e) => setTimestampField(e.target.value)}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500"
          >
            <option value="">Spalte auswählen...</option>
            {headers.map((header, index) => (
              <option key={index} value={header}>
                {header}
              </option>
            ))}
            {headers.some(h => h.toLowerCase() === 'datum') && headers.some(h => h.toLowerCase() === 'zeit') && (
              <option value={`${headers.find(h => h.toLowerCase() === 'datum')}+${headers.find(h => h.toLowerCase() === 'zeit')}`}>
                {headers.find(h => h.toLowerCase() === 'datum')} + {headers.find(h => h.toLowerCase() === 'zeit')} (kombiniert)
              </option>
            )}
            {headers.some(h => h.toLowerCase() === 'date') && headers.some(h => h.toLowerCase() === 'time') && (
              <option value={`${headers.find(h => h.toLowerCase() === 'date')}+${headers.find(h => h.toLowerCase() === 'time')}`}>
                {headers.find(h => h.toLowerCase() === 'date')} + {headers.find(h => h.toLowerCase() === 'time')} (kombiniert)
              </option>
            )}
          </select>
          {timestampField && sampleData.length > 0 && (
            <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
              <strong>Beispielwerte:</strong>
              <div className="mt-1 space-y-1">
                {sampleData.slice(0, 3).map((row, i) => (
                  <div key={i} className="text-gray-600">
                    {formatTimestampPreview(row[timestampField], row)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Leistungs-Spalte */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Leistungs-Spalte (kW) {powerField && <span className="text-green-600">(✓ Ausgewählt)</span>}
          </label>
          <select
            value={powerField}
            onChange={(e) => setPowerField(e.target.value)}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500"
          >
            <option value="">Spalte auswählen...</option>
            {headers.map((header, index) => (
              <option key={index} value={header}>
                {header}
              </option>
            ))}
          </select>
          {powerField && sampleData.length > 0 && (
            <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
              <strong>Beispielwerte:</strong>
              <div className="mt-1 space-y-1">
                {sampleData.slice(0, 3).map((row, i) => (
                  <div key={i} className="text-gray-600">
                    {formatPowerPreview(row[powerField])} {powerUnit}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Einheiten-Auswahl */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Einheit der Leistungsspalte
        </label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="radio"
              name="powerUnit"
              value="kW"
              checked={powerUnit === 'kW'}
              onChange={(e) => setPowerUnit(e.target.value as 'kW' | 'kWh')}
              className="h-4 w-4 text-sky-600 focus:ring-sky-500 border-gray-300"
            />
            <span className="ml-2 text-sm text-gray-700">
              <strong>Leistung (kW)</strong> - Momentane Leistung zum Zeitpunkt
            </span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="powerUnit"
              value="kWh"
              checked={powerUnit === 'kWh'}
              onChange={(e) => setPowerUnit(e.target.value as 'kW' | 'kWh')}
              className="h-4 w-4 text-sky-600 focus:ring-sky-500 border-gray-300"
            />
            <span className="ml-2 text-sm text-gray-700">
              <strong>Energie (kWh pro Intervall)</strong> - Verbrauch im 15-Minuten-Intervall
            </span>
          </label>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {powerUnit === 'kW' 
            ? 'Die Werte werden mit 0,25h multipliziert um kWh zu berechnen'
            : 'Die Werte werden durch 0,25h dividiert um kW zu berechnen'
          }
        </p>
      </div>

      {/* Datenvorschau */}
      <div className="mb-6">
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="flex items-center text-sm text-sky-600 hover:text-sky-700"
        >
          <Eye className="h-4 w-4 mr-1" />
          {showPreview ? 'Vorschau ausblenden' : 'Datenvorschau anzeigen'}
        </button>

        {showPreview && sampleData.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {headers.slice(0, 6).map((header, index) => {
                    const isCombinedTimestampPart = timestampField?.includes('+') &&
                      timestampField.split('+').includes(header);
                    return (
                      <th
                        key={index}
                        className={`px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                          isCombinedTimestampPart ? 'bg-blue-100' :
                          header === timestampField ? 'bg-blue-100' :
                          header === powerField ? 'bg-green-100' : ''
                        }`}
                      >
                        {header}
                      </th>
                    );
                  })}
                  {headers.length > 6 && (
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                      ... (+{headers.length - 6} weitere)
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sampleData.slice(0, 5).map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {headers.slice(0, 6).map((header, colIndex) => {
                      const isCombinedTimestampPart = timestampField?.includes('+') &&
                        timestampField.split('+').includes(header);
                      let cellValue = String(row[header] || '');

                      if (header === timestampField) {
                        cellValue = formatTimestampPreview(row[header], row);
                      } else if (header === powerField) {
                        cellValue = formatPowerPreview(row[header]);
                      }

                      return (
                        <td
                          key={colIndex}
                          className={`px-3 py-2 whitespace-nowrap text-sm text-gray-900 ${
                            isCombinedTimestampPart ? 'bg-blue-50' :
                            header === timestampField ? 'bg-blue-50' :
                            header === powerField ? 'bg-green-50' : ''
                          }`}
                        >
                          {cellValue}
                        </td>
                      );
                    })}
                    {headers.length > 6 && (
                      <td className="px-3 py-2 text-sm text-gray-500">...</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Aktionsbuttons */}
      <div className="flex justify-end space-x-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Abbrechen
        </button>
        <button
          onClick={handleConfirm}
          disabled={!canProceed}
          className={`px-4 py-2 text-sm font-medium rounded-md ${
            canProceed
              ? 'text-white bg-sky-600 hover:bg-sky-700'
              : 'text-gray-400 bg-gray-100 cursor-not-allowed'
          }`}
        >
          <Check className="h-4 w-4 mr-1 inline" />
          Zuordnung bestätigen
        </button>
      </div>
    </div>
  );
}