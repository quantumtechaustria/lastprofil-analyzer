import React, { useState, useRef } from 'react';
import { Upload, File, CheckCircle, AlertCircle, X, Settings, Check } from 'lucide-react';
import { parseFileData, ParseResult, detectColumns, ColumnSuggestion, detectAndSkipMetadataRows, readFileAsText } from '../lib/csv-parser';
import { parseExcelFile } from '../lib/excel-parser';
import { calculateKPIs } from '../lib/kpi-calculator';
import { mapEnergyDirectionToProfileType } from '../lib/profile-type-mapper';
import ColumnMapper from './ColumnMapper';
import { formatLargeNumberGerman, formatNumberGerman } from '../lib/utils';

interface FileUploadProps {
  onUploadComplete?: (result: any) => void;
  maxUploads?: number;
  currentUploads?: number;
}

export default function FileUpload({ 
  onUploadComplete, 
  maxUploads, 
  currentUploads = 0 
}: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState<boolean[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number[]>([]);
  const [results, setResults] = useState<(ParseResult | null)[]>([]);
  const [showColumnMapper, setShowColumnMapper] = useState<number | null>(null);
  const [fileHeaders, setFileHeaders] = useState<string[][]>([]);
  const [fileSampleData, setFileSampleData] = useState<any[][]>([]);
  const [columnSuggestions, setColumnSuggestions] = useState<(ColumnSuggestion | null)[]>([]);
  const [metadata, setMetadata] = useState<{[key: number]: {
    name: string;
    site_address: string;
    meter_number: string;
    industry_sector: string;
    profile_type: string;
  }}>({});
  const [columnMappings, setColumnMappings] = useState<{[key: number]: {
    timestampField: string;
    powerField: string;
    powerUnit: 'kW' | 'kWh';
  }}>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canUpload = !maxUploads || currentUploads < maxUploads;
  const remainingUploads = maxUploads ? maxUploads - currentUploads : Infinity;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type === 'text/csv' || 
              file.name.endsWith('.csv') || 
              file.name.endsWith('.xlsx') || 
              file.name.endsWith('.xls')
    );
    
    if (droppedFiles.length > 0) {
      addFiles(droppedFiles);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  };

  const addFiles = (newFiles: File[]) => {
    if (!canUpload) return;
    
    const filesToAdd = newFiles.slice(0, Math.max(0, remainingUploads - files.length));
    setFiles(prev => [...prev, ...filesToAdd]);
    setProcessing(prev => [...prev, ...filesToAdd.map(() => false)]);
    setUploadProgress(prev => [...prev, ...filesToAdd.map(() => 0)]);
    setResults(prev => [...prev, ...filesToAdd.map(() => null)]);
    setFileHeaders(prev => [...prev, ...filesToAdd.map(() => [])]);
    setFileSampleData(prev => [...prev, ...filesToAdd.map(() => [])]);
    setColumnSuggestions(prev => [...prev, ...filesToAdd.map(() => null)]);
    
    // Initialize metadata for new files
    const newMetadata = { ...metadata };
    filesToAdd.forEach((file, index) => {
      const fileIndex = files.length + index;
      newMetadata[fileIndex] = {
        name: file.name.replace(/\.(csv|xlsx|xls)$/i, ''),
        site_address: '',
        meter_number: '',
        industry_sector: '',
        profile_type: 'unknown'
      };
    });
    setMetadata(newMetadata);
    
    // Automatisch Header und Beispieldaten für neue Dateien laden
    filesToAdd.forEach((file, index) => {
      const fileIndex = files.length + index;
      loadFilePreview(file, fileIndex);
      handleFileAdded(file, fileIndex);
    });
  };

  const loadFilePreview = async (file: File, index: number) => {
    try {
      const isExcel = file.name.toLowerCase().endsWith('.xlsx') || 
                      file.name.toLowerCase().endsWith('.xls');
      
      if (isExcel) {
        const excelResult = await parseExcelFile(file);
        const newHeaders = [...fileHeaders];
        const newSampleData = [...fileSampleData];
        const newSuggestions = [...columnSuggestions];
        
        newHeaders[index] = excelResult.headers;
        newSampleData[index] = excelResult.data.slice(0, 10);
        newSuggestions[index] = detectColumns(excelResult.headers);
        
        setFileHeaders(newHeaders);
        setFileSampleData(newSampleData);
        setColumnSuggestions(newSuggestions);
      } else {
        // Für CSV-Dateien eine kleine Vorschau laden (mit Encoding-Erkennung UTF-8/Windows-1252)
        const text = await readFileAsText(file);

        // Metadaten-Zeilen überspringen und echten Header finden
        const { cleanedText, metadataRows, extractedMetadata } = detectAndSkipMetadataRows(text);
        console.log(`Übersprungen: ${metadataRows} Metadaten-Zeilen`);
        console.log('Extrahierte Metadaten:', extractedMetadata);

        const lines = cleanedText.split('\n').slice(0, 11); // Header + 10 Zeilen
        if (lines.length > 0) {
          const delimiter = lines[0].includes(';') ? ';' : ',';
          const headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, ''));
          const sampleRows = lines.slice(1).map(line => {
            const values = line.split(delimiter).map(v => v.trim().replace(/"/g, ''));
            const obj: any = {};
            headers.forEach((header, i) => {
              obj[header] = values[i] || '';
            });
            return obj;
          });

          const newHeaders = [...fileHeaders];
          const newSampleData = [...fileSampleData];
          const newSuggestions = [...columnSuggestions];

          newHeaders[index] = headers;
          newSampleData[index] = sampleRows;
          newSuggestions[index] = detectColumns(headers);

          setFileHeaders(newHeaders);
          setFileSampleData(newSampleData);
          setColumnSuggestions(newSuggestions);

          // Update metadata with extracted values
          const newMetadata = { ...metadata };
          if (extractedMetadata.customer_number || extractedMetadata.customer_name) {
            newMetadata[index] = {
              ...newMetadata[index],
              name: extractedMetadata.customer_name || newMetadata[index].name,
              meter_number: extractedMetadata.metering_point || newMetadata[index].meter_number,
              profile_type: extractedMetadata.energy_direction
                ? mapEnergyDirectionToProfileType(extractedMetadata.energy_direction)
                : newMetadata[index].profile_type
            };
            setMetadata(newMetadata);
          }
        }
      }
    } catch (error) {
      console.error('Fehler beim Laden der Dateivorschau:', error);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setProcessing(prev => prev.filter((_, i) => i !== index));
    setUploadProgress(prev => prev.filter((_, i) => i !== index));
    setResults(prev => prev.filter((_, i) => i !== index));
    setFileHeaders(prev => prev.filter((_, i) => i !== index));
    setFileSampleData(prev => prev.filter((_, i) => i !== index));
    setColumnSuggestions(prev => prev.filter((_, i) => i !== index));
    
    // Remove metadata for this file
    const newMetadata = { ...metadata };
    delete newMetadata[index];
    // Reindex remaining metadata
    const reindexedMetadata: typeof metadata = {};
    Object.keys(newMetadata).forEach(key => {
      const oldIndex = parseInt(key);
      const newIndex = oldIndex > index ? oldIndex - 1 : oldIndex;
      reindexedMetadata[newIndex] = newMetadata[oldIndex];
    });
    setMetadata(reindexedMetadata);
    
    if (showColumnMapper === index) {
      setShowColumnMapper(null);
    }
  };

  const processFile = async (index: number, timestampField?: string, powerField?: string, powerUnit: 'kW' | 'kWh' = 'kW') => {
    const file = files[index];
    if (!file || processing[index]) return;

    console.log(`🚀 Starte Verarbeitung von: ${file.name}`);
    
    // Warnung für große Dateien
    if (file.size > 5 * 1024 * 1024) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(1);
      console.log(`Verarbeite große Datei: ${file.name} (${sizeMB}MB)`);
    }

    const newProcessing = [...processing];
    newProcessing[index] = true;
    setProcessing(newProcessing);
    
    // Fortschritt auf 10% setzen (Parsing startet)
    const newProgress = [...uploadProgress];
    newProgress[index] = 10;
    setUploadProgress(newProgress);

    try {
      // Für große Dateien: Fortschrittsanzeige
      const startTime = Date.now();
      
      // Fortschritt auf 30% (Parsing läuft)
      newProgress[index] = 30;
      setUploadProgress([...newProgress]);
      
      const parseResult = await parseFileData(file, timestampField, powerField, powerUnit);
      
      // Fortschritt auf 70% (KPI-Berechnung)
      newProgress[index] = 70;
      setUploadProgress([...newProgress]);
      
      const processingTime = Date.now() - startTime;
      
      if (processingTime > 5000) {
        console.log(`Verarbeitung abgeschlossen in ${(processingTime / 1000).toFixed(1)}s`);
      }
      
      const kpis = calculateKPIs(parseResult.data);
      
      // Fortschritt auf 90% (Daten vorbereiten)
      newProgress[index] = 90;
      setUploadProgress([...newProgress]);
      
      const newResults = [...results];
      newResults[index] = parseResult;
      setResults(newResults);

      const csvMetadata = parseResult.csvMetadata;
      const autoDetectedProfileType = mapEnergyDirectionToProfileType(csvMetadata?.energy_direction);

      const uploadResult = {
        fileName: file.name,
        parseResult,
        kpis,
        metadata: {
          name: metadata[index]?.name || csvMetadata?.customer_name || file.name.replace(/\.(csv|xlsx|xls)$/i, ''),
          file_name: file.name,
          site_address: metadata[index]?.site_address,
          meter_number: metadata[index]?.meter_number,
          industry_sector: metadata[index]?.industry_sector,
          profile_type: metadata[index]?.profile_type || autoDetectedProfileType,
          customer_number: csvMetadata?.customer_number,
          customer_name: csvMetadata?.customer_name,
          metering_point: csvMetadata?.metering_point,
          period_start: csvMetadata?.period_start,
          period_end: csvMetadata?.period_end,
          energy_direction: csvMetadata?.energy_direction,
          csv_metadata: csvMetadata?.additional,
          ...parseResult.metadata
        }
      };
      
      console.log(`✅ Verarbeitung erfolgreich:`, uploadResult);
      
      // Fortschritt auf 100%
      newProgress[index] = 100;
      setUploadProgress([...newProgress]);
      
      // Kurz warten, damit der Benutzer den 100%-Fortschritt sieht
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Erfolgreiche Verarbeitung - Daten an Parent weitergeben
      onUploadComplete?.(uploadResult);

    } catch (error) {
      console.error('Error processing file:', error);
      
      // Fortschritt zurücksetzen bei Fehler
      newProgress[index] = 0;
      setUploadProgress([...newProgress]);
      
      const newResults = [...results];
      newResults[index] = {
        data: [],
        errors: [`Fehler beim Verarbeiten der Datei: ${error}`],
        quality_score: 0,
        metadata: {
          total_records: 0,
          data_start: '',
          data_end: '',
          gaps: 0,
          duplicates: 0
        }
      };
      setResults(newResults);
    } finally {
      const newProcessing = [...processing];
      newProcessing[index] = false;
      setProcessing(newProcessing);
    }
  };

  const handleColumnMapping = (index: number, timestampField: string, powerField: string, powerUnit: 'kW' | 'kWh') => {
    // Speichere die Spaltenzuordnung
    const newMappings = { ...columnMappings };
    newMappings[index] = { timestampField, powerField, powerUnit };
    setColumnMappings(newMappings);
    
    setShowColumnMapper(null);
    // Verarbeitung erfolgt erst nach Metadaten-Eingabe
  };

  const handleProcessFile = (index: number) => {
    const mapping = columnMappings[index];
    if (mapping) {
      processFile(index, mapping.timestampField, mapping.powerField, mapping.powerUnit);
    }
  };

  const shouldShowColumnMapper = (index: number) => {
    const suggestion = columnSuggestions[index];
    return suggestion && (suggestion.confidence < 0.8 || !suggestion.timestampField || !suggestion.powerField);
  };

  const updateMetadata = (index: number, field: string, value: string) => {
    setMetadata(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        [field]: value
      }
    }));
  };

  const handleFileAdded = (file: File, index: number) => {
    // Automatically open column mapper for new files
    setTimeout(() => {
      setShowColumnMapper(index);
    }, 100);
  };
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Lastprofil hochladen</h2>
        <p className="text-gray-600">
          Laden Sie CSV-Dateien mit 15-Minuten-Lastprofildaten von Ihrem Netzbetreiber hoch.
        </p>
        {maxUploads && (
          <p className="text-sm text-gray-500 mt-1">
            {remainingUploads} von {maxUploads} Uploads verbleibend
          </p>
        )}
      </div>

      {!canUpload && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Upload-Limit erreicht</h3>
              <p className="text-sm text-yellow-700 mt-1">
                Sie haben Ihr Upload-Limit erreicht. Upgraden Sie Ihren Plan für unbegrenzte Uploads.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
          dragOver
            ? 'border-sky-400 bg-sky-50'
            : canUpload 
              ? 'border-gray-300 hover:border-gray-400 bg-white' 
              : 'border-gray-200 bg-gray-50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".csv,.xlsx,.xls"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={!canUpload}
        />
        
        <div className="text-center">
          <Upload className={`mx-auto h-12 w-12 ${canUpload ? 'text-gray-400' : 'text-gray-300'}`} />
          <div className="mt-4">
            <p className={`text-sm font-medium ${canUpload ? 'text-gray-900' : 'text-gray-500'}`}>
              {canUpload ? 'CSV- oder Excel-Dateien hier ablegen oder klicken zum Auswählen' : 'Upload deaktiviert'}
            </p>
            <p className={`text-sm ${canUpload ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
              Unterstützt CSV- und Excel-Dateien (.csv, .xlsx) mit Zeitstempel- und Leistungsspalten
            </p>
          </div>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <>
          {/* Column Mapper Modal */}
          {showColumnMapper !== null && (
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
              <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <ColumnMapper
                  headers={fileHeaders[showColumnMapper] || []}
                  sampleData={fileSampleData[showColumnMapper] || []}
                  suggestedMapping={columnSuggestions[showColumnMapper] || undefined}
                  onMapping={(timestampField, powerField, powerUnit) => 
                    handleColumnMapping(showColumnMapper, timestampField, powerField, powerUnit)
                  }
                  onCancel={() => setShowColumnMapper(null)}
                />
              </div>
            </div>
          )}

        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Dateien verarbeiten</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {files.map((file, index) => {
              const result = results[index];
              const isProcessing = processing[index];
              
              return (
                <div key={index}>
                <div className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    <File className="h-8 w-8 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                      {result && (
                        <div className="mt-1">
                          <p className="text-xs text-gray-500">
                            {result.data.length.toLocaleString()} Datensätze, Qualität: {result.quality_score}%
                          </p>
                          <div className="mt-1 text-xs text-emerald-600 font-medium">
                            <div>Jahresverbrauch: {formatLargeNumberGerman(result.data.reduce((sum, d) => sum + d.power_kw * 0.25, 0) / 1000)} MWh</div>
                            <div>Spitzenlast: {formatNumberGerman(Math.max(...result.data.map(d => d.power_kw)))} kW</div>
                          </div>
                          {result.errors.length > 0 && (
                            <details className="mt-1">
                              <summary className="text-xs text-red-600 cursor-pointer">
                                {result.errors.length} Meldungen anzeigen
                              </summary>
                              <div className="mt-1 max-h-32 overflow-y-auto text-xs text-gray-600 bg-gray-50 p-2 rounded">
                                {result.errors.slice(0, 10).map((error, i) => (
                                  <div key={i} className="mb-1">{error}</div>
                                ))}
                                {result.errors.length > 10 && (
                                  <div className="text-gray-500">... und {result.errors.length - 10} weitere</div>
                                )}
                              </div>
                            </details>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Metadata Fields */}
                  <div className="flex items-center space-x-3">
                    {!result && !isProcessing && fileHeaders[index]?.length > 0 && !columnMappings[index] && (
                      <button
                        onClick={() => setShowColumnMapper(index)}
                        className="inline-flex items-center px-3 py-1.5 bg-orange-500 text-white text-sm font-medium rounded-md hover:bg-orange-600 transition-colors"
                      >
                        <Settings className="h-4 w-4 mr-1" />
                        Spalten zuordnen
                      </button>
                    )}
                    
                    {!result && !isProcessing && columnMappings[index] && !metadata[index]?.name && (
                      <div className="text-sm text-orange-600 font-medium">
                        Name erforderlich →
                      </div>
                    )}
                    
                    {!result && !isProcessing && columnMappings[index] && metadata[index]?.name && (
                      <button
                        onClick={() => handleProcessFile(index)}
                        className="inline-flex items-center px-3 py-1.5 bg-emerald-500 text-white text-sm font-medium rounded-md hover:bg-emerald-600 transition-colors"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Verarbeitung starten
                      </button>
                    )}
                    
                    {isProcessing && (
                      <div className="flex items-center space-x-2">
                        <div className="w-32">
                          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                            <span>Verarbeitung...</span>
                            <span>{uploadProgress[index] || 0}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div 
                              className="bg-sky-600 h-1.5 rounded-full transition-all duration-300" 
                              style={{ width: `${uploadProgress[index] || 0}%` }}
                            />
                          </div>
                        </div>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-sky-600"></div>
                      </div>
                    )}
                    
                    {result && (
                      <CheckCircle className={`h-5 w-5 ${
                        result.quality_score >= 80 ? 'text-emerald-500' : 
                        result.quality_score >= 60 ? 'text-yellow-500' : 'text-red-500'
                      }`} />
                    )}
                    
                    <button
                      onClick={() => removeFile(index)}
                      className="text-gray-400 hover:text-gray-600 p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                {/* Metadata Fields - Now below the main row */}
                {!result && !isProcessing && columnMappings[index] && showColumnMapper !== index && (
                  <div className="px-6 pb-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-3 border-t border-gray-100">
                      <input
                        type="text"
                        placeholder="Name des Lastprofils"
                        value={metadata[index]?.name || ''}
                        onChange={(e) => updateMetadata(index, 'name', e.target.value)}
                        className="text-sm px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                      />
                      <input
                        type="text"
                        placeholder="Standort/Adresse (optional)"
                        value={metadata[index]?.site_address || ''}
                        onChange={(e) => updateMetadata(index, 'site_address', e.target.value)}
                        className="text-sm px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                      />
                      <input
                        type="text"
                        placeholder="Zählpunktnummer (optional)"
                        value={metadata[index]?.meter_number || ''}
                        onChange={(e) => updateMetadata(index, 'meter_number', e.target.value)}
                        className="text-sm px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                      />
                      <select
                        value={metadata[index]?.industry_sector || ''}
                        onChange={(e) => updateMetadata(index, 'industry_sector', e.target.value)}
                        className="text-sm px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                      >
                        <option value="">Branche auswählen (optional)</option>
                        <option value="Manufacturing">Produktion</option>
                        <option value="Commercial">Gewerbe</option>
                        <option value="Office">Büro</option>
                        <option value="Retail">Einzelhandel</option>
                        <option value="Healthcare">Gesundheitswesen</option>
                        <option value="Education">Bildung</option>
                        <option value="Hospitality">Gastgewerbe</option>
                        <option value="Other">Sonstige</option>
                      </select>
                      <select
                        value={metadata[index]?.profile_type || 'unknown'}
                        onChange={(e) => updateMetadata(index, 'profile_type', e.target.value)}
                        className="text-sm px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                      >
                        <option value="unknown">Typ auswählen</option>
                        <option value="consumer">🏠 Verbraucher</option>
                        <option value="producer">⚡ Einspeiser</option>
                      </select>
                    </div>
                  </div>
                )}
                </div>
              );
            })}
          </div>
        </div>
        </>
      )}
    </div>
  );
}