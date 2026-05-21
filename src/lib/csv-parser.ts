import Papa from 'papaparse';
import { format, parseISO, isValid, parse } from 'date-fns';
import { de } from 'date-fns/locale';
import { parseExcelFile, ExcelParseResult } from './excel-parser';

export interface ParsedLoadData {
  timestamp: string;
  power_kw: number;
}

export interface CSVMetadata {
  customer_number?: string;
  customer_name?: string;
  metering_point?: string;
  period_start?: string;
  period_end?: string;
  energy_direction?: string;
  additional?: Record<string, string>;
}

export interface ParseResult {
  data: ParsedLoadData[];
  errors: string[];
  quality_score: number;
  metadata: {
    total_records: number;
    data_start: string;
    data_end: string;
    gaps: number;
    duplicates: number;
    data_unit?: 'kW' | 'kWh';
  };
  csvMetadata?: CSVMetadata;
}

export interface ColumnSuggestion {
  timestampField: string;
  powerField: string;
  confidence: number;
  powerUnitSuggestion?: 'kW' | 'kWh';
}

/**
 * Dekodiert einen ArrayBuffer zu Text und erkennt dabei die Zeichenkodierung.
 * Deutsche Energie-CSVs sind häufig in Windows-1252 (ISO-8859-1) kodiert.
 * Strategie: zuerst strikt als UTF-8 dekodieren; schlägt das wegen ungültiger
 * Bytefolgen fehl, wird auf Windows-1252 zurückgefallen. So bleiben Umlaute
 * (ä, ö, ü, ß) in beiden Fällen korrekt erhalten.
 */
export const decodeBuffer = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);

  // UTF-8 BOM (EF BB BF) → eindeutig UTF-8
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(buffer);
  }

  // Strikt als UTF-8 versuchen; bei ungültigen Bytefolgen Fallback auf Windows-1252
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    console.warn('Datei ist kein gültiges UTF-8 – verwende Windows-1252 (ISO-8859-1) als Fallback für Umlaute');
    return new TextDecoder('windows-1252').decode(buffer);
  }
};

/**
 * Liest eine Datei als Text mit automatischer Encoding-Erkennung (UTF-8 / Windows-1252).
 */
export const readFileAsText = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  return decodeBuffer(buffer);
};

export const detectColumns = (headers: string[]): ColumnSuggestion => {
  let timestampField = '';
  let powerField = '';
  let confidence = 0;
  let powerUnitSuggestion: 'kW' | 'kWh' = 'kW';
  let dateField = '';
  let timeField = '';

  // Erweiterte Zeitstempel-Felder (Deutsch und Englisch)
  const timestampFields = [
    'timestamp', 'datetime', 'zeit', 'time', 'datum', 'date',
    'zeitstempel', 'messzeitpunkt', 'zeitpunkt', 'von', 'bis',
    'datum_zeit', 'date_time', 'messzeit', 'startdatum', 'startdate',
    'enddatum', 'enddate', 'beginn', 'start', 'ende', 'end'
  ];

  const dateOnlyFields = ['datum', 'date'];
  const timeOnlyFields = ['zeit', 'time', 'uhrzeit'];

  // Erweiterte Leistungs-Felder
  const powerFields = [
    'power', 'leistung', 'kw', 'power_kw', 'verbrauch', 'consumption',
    'wirkleistung', 'p', 'last', 'load', 'energie', 'energy',
    'messwert', 'value', 'wert', 'kwh', 'mw', 'w'
  ];

  // Prüfe auf separate Datum/Zeit Spalten
  for (const header of headers) {
    const lowerHeader = header.toLowerCase().trim();

    if (!dateField) {
      for (const field of dateOnlyFields) {
        if (lowerHeader === field) {
          dateField = header;
          break;
        }
      }
    }

    if (!timeField) {
      for (const field of timeOnlyFields) {
        if (lowerHeader === field) {
          timeField = header;
          break;
        }
      }
    }
  }

  // Wenn separate Datum/Zeit gefunden, nutze diese
  if (dateField && timeField) {
    timestampField = `${dateField}+${timeField}`;
    confidence += 0.5;
  } else {
    // Suche nach kombiniertem Zeitstempel-Feld
    for (const header of headers) {
      const lowerHeader = header.toLowerCase().trim();
      for (const field of timestampFields) {
        if (lowerHeader.includes(field)) {
          timestampField = header;
          confidence += 0.4;
          break;
        }
      }
      if (timestampField) break;
    }
  }

  // Suche nach Leistungs-Spalte
  for (const header of headers) {
    const lowerHeader = header.toLowerCase().trim();
    for (const field of powerFields) {
      if (lowerHeader.includes(field)) {
        powerField = header;
        confidence += 0.4;
        // Prüfe auf kWh-Indikatoren im Header
        if (lowerHeader.includes('kwh') || lowerHeader.includes('energie') ||
            lowerHeader.includes('energy') || lowerHeader.includes('verbrauch')) {
          powerUnitSuggestion = 'kWh';
        }
        break;
      }
    }
    if (powerField) break;
  }

  // Bonus für typische Kombinationen
  if (timestampField && powerField) {
    confidence += 0.2;
  }

  // Fallback: Bei genau 2 Spalten, wenn noch nichts erkannt wurde
  if (!timestampField && !powerField && headers.length === 2) {
    console.log('Fallback: 2 Spalten erkannt, nehme erste als Zeitstempel, zweite als Leistung');
    timestampField = headers[0];
    powerField = headers[1];
    confidence = 0.6;
  }

  return {
    timestampField,
    powerField,
    confidence: Math.min(confidence, 1.0),
    powerUnitSuggestion
  };
};

export const parseFileData = async (
  file: File, 
  timestampField?: string, 
  powerField?: string,
  powerUnit: 'kW' | 'kWh' = 'kW'
): Promise<ParseResult> => {
  // Für große Dateien: Streaming-Parser verwenden
  if (file.size > 5 * 1024 * 1024) { // > 5MB
    console.log(`Große Datei erkannt (${(file.size / 1024 / 1024).toFixed(1)}MB), verwende Streaming-Parser`);
  }
  
  const isExcel = file.name.toLowerCase().endsWith('.xlsx') || 
                  file.name.toLowerCase().endsWith('.xls');
  
  if (isExcel) {
    try {
      const excelResult = await parseExcelFile(file);
      return parseDataArray(excelResult.data, timestampField, powerField, excelResult.headers, powerUnit);
    } catch (error) {
      return {
        data: [],
        errors: [`Excel-Parsing-Fehler: ${error}`],
        quality_score: 0,
        metadata: {
          total_records: 0,
          data_start: '',
          data_end: '',
          gaps: 0,
          duplicates: 0
        }
      };
    }
  } else {
    return parseLoadProfileCSVOptimized(file, timestampField, powerField, powerUnit);
  }
};

export const detectAndSkipMetadataRows = (text: string): { cleanedText: string; metadataRows: number; extractedMetadata: CSVMetadata } => {
  const lines = text.split('\n');
  let metadataRows = 0;
  const cleanedLines: string[] = [];
  let foundDataHeader = false;
  const extractedMetadata: CSVMetadata = {
    additional: {}
  };

  const metadataKeyMap: Record<string, keyof CSVMetadata> = {
    'kundennummer': 'customer_number',
    'kundenname': 'customer_name',
    'zp-nummer': 'metering_point',
    'zählpunktnummer': 'metering_point',
    'beginn': 'period_start',
    'ende': 'period_end',
    'energierichtung': 'energy_direction'
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(';');

    if (!foundDataHeader) {
      const isMetadataRow = parts.length === 2 && parts[0] && !parts[0].match(/^\d/);

      const possibleHeaders = ['datum', 'date', 'zeit', 'time', 'timestamp', 'kw', 'kwh', 'power', 'leistung'];
      const isHeaderRow = parts.some(part =>
        possibleHeaders.some(h => part.toLowerCase().trim().includes(h))
      );

      if (isHeaderRow) {
        foundDataHeader = true;
        cleanedLines.push(line);
      } else if (isMetadataRow) {
        metadataRows++;
        const key = parts[0].trim();
        const value = parts[1].trim();
        const lowerKey = key.toLowerCase();

        const mappedKey = metadataKeyMap[lowerKey];
        if (mappedKey && mappedKey !== 'additional') {
          extractedMetadata[mappedKey] = value;
        } else {
          extractedMetadata.additional![key] = value;
        }
      }
    } else {
      cleanedLines.push(line);
    }
  }

  return {
    cleanedText: cleanedLines.join('\n'),
    metadataRows,
    extractedMetadata
  };
};

const parseLoadProfileCSVOptimized = (
  file: File,
  timestampField?: string,
  powerField?: string,
  powerUnit: 'kW' | 'kWh' = 'kW'
): Promise<ParseResult> => {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const handleError = () => {
      resolve({
        data: [],
        errors: ['Fehler beim Lesen der Datei'],
        quality_score: 0,
        metadata: {
          total_records: 0,
          data_start: '',
          data_end: '',
          gaps: 0,
          duplicates: 0
        }
      });
    };

    // Datei mit automatischer Encoding-Erkennung lesen (UTF-8 / Windows-1252)
    readFileAsText(file)
      .then((text) => {
        const { cleanedText, metadataRows, extractedMetadata } = detectAndSkipMetadataRows(text);

        if (metadataRows > 0) {
          console.log(`Überspringe ${metadataRows} Metadaten-Zeilen`);
          console.log('Extrahierte Metadaten:', extractedMetadata);
        }

        Papa.parse(cleanedText, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: false,
          complete: (results) => {
            const processingTime = Date.now() - startTime;
            console.log(`CSV-Parsing abgeschlossen in ${processingTime}ms für ${(results.data || []).length} Zeilen`);

            const headers = results.meta.fields || [];
            const result = parseDataArray(results.data || [], timestampField, powerField, headers, powerUnit);
            result.csvMetadata = extractedMetadata;
            resolve(result);
          },
          error: (error) => {
            console.error('CSV-Parsing-Fehler:', error);
            resolve({
              data: [],
              errors: [`CSV-Parsing-Fehler: ${error.message}`],
              quality_score: 0,
              metadata: {
                total_records: 0,
                data_start: '',
                data_end: '',
                gaps: 0,
                duplicates: 0
              }
            });
          }
        });
      })
      .catch(handleError);
  });
};
const parseDataArray = (
  dataArray: any[], 
  timestampField?: string, 
  powerField?: string,
  headers?: string[],
  powerUnit: 'kW' | 'kWh' = 'kW'
): ParseResult => {
  const data: ParsedLoadData[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const timestamps = new Set<string>();
  let gaps = 0;
  let duplicates = 0;
  let skippedRows = 0;
  let emptyRows = 0;
  let detectedIntervalMinutes: number | null = null;

  if (dataArray.length === 0) {
    errors.push('Keine Daten in der Datei gefunden');
    return {
      data: [],
      errors,
      quality_score: 0,
      metadata: {
        total_records: 0,
        data_start: '',
        data_end: '',
        gaps: 0,
        duplicates: 0
      }
    };
  }

  // Automatische Spaltenerkennung falls nicht angegeben
  if (!timestampField || !powerField) {
    const availableHeaders = headers || Object.keys(dataArray[0]);
    const suggestion = detectColumns(availableHeaders);
    
    if (!timestampField) timestampField = suggestion.timestampField;
    if (!powerField) powerField = suggestion.powerField;
  }

  if (!timestampField || !powerField) {
    const availableColumns = headers || Object.keys(dataArray[0]);
    errors.push(`Zeitstempel- oder Leistungsspalten konnten nicht erkannt werden. Verfügbare Spalten: ${availableColumns.join(', ')}`);
    return {
      data: [],
      errors,
      quality_score: 0,
      metadata: {
        total_records: 0,
        data_start: '',
        data_end: '',
        gaps: 0,
        duplicates: 0
      }
    };
  }

  // Deutsche und internationale Datumsformate
  // WICHTIG: Deutsche Formate (dd.MM.yyyy) müssen VOR englischen Formaten (MM/dd/yyyy) stehen!
  const dateFormats = [
    // ISO Formate (eindeutig, höchste Priorität)
    "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
    "yyyy-MM-dd'T'HH:mm:ssXXX",
    "yyyy-MM-dd'T'HH:mm:ss",
    "yyyy-MM-dd HH:mm:ss",
    "yyyy-MM-dd HH:mm",
    "yyyy-MM-dd",
    // Deutsche/Europäische Formate mit Punkt (dd.MM.yyyy)
    "dd.MM.yyyy HH:mm:ss",
    "dd.MM.yyyy HH:mm",
    "dd.MM.yyyy",
    "dd.MM.yy HH:mm:ss",
    "dd.MM.yy HH:mm",
    "dd.MM.yy",
    // Deutsche/Europäische Formate mit Schrägstrich (dd/MM/yyyy)
    "dd/MM/yyyy HH:mm:ss",
    "dd/MM/yyyy HH:mm",
    "dd/MM/yyyy",
    "dd/MM/yy HH:mm:ss",
    "dd/MM/yy HH:mm",
    "dd/MM/yy",
    // Englische/Amerikanische Formate (MM/dd/yyyy) - NIEDRIGSTE Priorität!
    "MM/dd/yyyy HH:mm:ss",
    "MM/dd/yyyy HH:mm",
    "MM/dd/yyyy",
    "yyyy/MM/dd HH:mm:ss",
    "yyyy/MM/dd HH:mm",
    "yyyy/MM/dd"
  ];

  const parseTimestamp = (timestampStr: any, row?: any): Date | null => {
    // Prüfe ZUERST ob timestampField ein kombiniertes Feld ist (Datum+Zeit)
    if (timestampField && timestampField.includes('+')) {
      const [dateFieldName, timeFieldName] = timestampField.split('+');
      if (row && row[dateFieldName] && row[timeFieldName]) {
        const dateStr = String(row[dateFieldName]).trim();
        const timeStr = String(row[timeFieldName]).trim();
        const combinedStr = `${dateStr} ${timeStr}`;

        console.log(`Kombiniere: "${dateStr}" + "${timeStr}" = "${combinedStr}"`);

        // Versuche deutsche Formate für separate Datum/Zeit
        const separateDateTimeFormats = [
          'dd.MM.yyyy HH:mm:ss',
          'dd.MM.yyyy HH:mm',
          'dd/MM/yyyy HH:mm:ss',
          'dd/MM/yyyy HH:mm',
          'yyyy-MM-dd HH:mm:ss',
          'yyyy-MM-dd HH:mm'
        ];

        for (const dateFormat of separateDateTimeFormats) {
          try {
            const parsedDate = parse(combinedStr, dateFormat, new Date(), { locale: de });
            if (isValid(parsedDate)) {
              console.log(`Erfolgreich geparst mit Format: ${dateFormat}`);
              return parsedDate;
            }
          } catch {}
        }
        console.log('Kein Format passte für kombinierten Zeitstempel');
      }
      return null;
    }

    // Für nicht-kombinierte Felder: Prüfe ob Wert vorhanden
    if (timestampStr === null || timestampStr === undefined || timestampStr === '') return null;

    // Excel speichert Daten als Zahlen (Serial Number)
    let excelSerialNumber: number | null = null;

    if (typeof timestampStr === 'number') {
      excelSerialNumber = timestampStr;
    } else {
      const cleanStr = timestampStr.toString().trim();
      const numValue = parseFloat(cleanStr);
      if (!isNaN(numValue) && numValue > 1000 && numValue < 100000) {
        excelSerialNumber = numValue;
      }
    }

    if (excelSerialNumber !== null) {
      try {
        const excelEpoch = new Date(1899, 11, 30);
        const days = Math.floor(excelSerialNumber);
        const fraction = excelSerialNumber - days;
        const milliseconds = Math.round(fraction * 24 * 60 * 60 * 1000);

        const date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000 + milliseconds);

        if (isValid(date) && date.getFullYear() > 1900 && date.getFullYear() < 2100) {
          console.log(`Excel Serial ${excelSerialNumber} → ${date.toISOString()}`);
          return date;
        }
      } catch {}
    }

    const cleanStr = timestampStr.toString().trim();

    // WICHTIG: Zuerst ISO-Format prüfen (eindeutig)
    try {
      const isoDate = parseISO(cleanStr);
      if (isValid(isoDate)) return isoDate;
    } catch {}

    // DANN deutsche/europäische Formate prüfen (dd.MM.yyyy)
    // Dies muss VOR new Date() kommen, da new Date() amerikanisches Format (MM/DD/YYYY) annimmt!
    for (const dateFormat of dateFormats) {
      try {
        const parsedDate = parse(cleanStr, dateFormat, new Date(), { locale: de });
        if (isValid(parsedDate)) {
          console.log(`Zeitstempel "${cleanStr}" erfolgreich geparst mit Format: ${dateFormat}`);
          return parsedDate;
        }
      } catch {}
    }

    // NUR als letzter Fallback: JavaScript's new Date() (interpretiert als MM/DD/YYYY!)
    // ACHTUNG: Dies kann zu falschen Interpretationen führen bei deutschen Daten!
    try {
      const autoDate = new Date(cleanStr);
      if (isValid(autoDate) && !isNaN(autoDate.getTime())) {
        console.warn(`Zeitstempel "${cleanStr}" mit JavaScript new Date() geparst - könnte falsch sein!`);
        return autoDate;
      }
    } catch {}

    return null;
  };

  // Deutschland/Österreich: Komma ist IMMER Dezimaltrennzeichen

  const parsePowerValue = (powerStr: any): number | null => {
    if (powerStr === null || powerStr === undefined || powerStr === '') return null;

    // Wenn es bereits eine Zahl ist, direkt zurückgeben und auf 4 Dezimalstellen runden
    if (typeof powerStr === 'number' && isFinite(powerStr)) {
      return Math.round(powerStr * 10000) / 10000;
    }

    // Konvertiere zu String und bereinige
    let cleanStr = powerStr.toString().trim();

    // Entferne Leerzeichen
    cleanStr = cleanStr.replace(/\s/g, '');

    // KRITISCH: Prüfe ob String ein Komma enthält
    // Wenn JA = deutsches Format mit Komma als Dezimal
    // Wenn NEIN = schon als Zahl mit Punkt als Dezimal
    if (cleanStr.includes(',')) {
      // Deutsches Format: "1.234,56" oder "0,244"
      cleanStr = cleanStr.replace(/\./g, ''); // Entferne Tausenderpunkte
      cleanStr = cleanStr.replace(/,/g, '.'); // Komma zu Punkt
    }
    // SONST: Lass es wie es ist (z.B. "0.244" oder "1234.56")

    // Entferne Einheiten (kW, MW, etc.)
    cleanStr = cleanStr.replace(/[^\d.-]/g, '');

    // Validierung
    if (cleanStr === '' || cleanStr === '.' || cleanStr === '-' || cleanStr === '-.') {
      return null;
    }

    const power = parseFloat(cleanStr);
    if (isNaN(power)) return null;

    // Auf 4 Dezimalstellen runden
    return Math.round(power * 10000) / 10000;
  };
  let lastTimestamp: Date | null = null;

  dataArray.forEach((row: any, index) => {
    const rowNumber = index + 1;
    
    // Prüfe ob Zeile komplett leer ist
    const hasAnyData = Object.values(row).some(value => 
      value !== null && value !== undefined && value !== ''
    );
    
    if (!hasAnyData) {
      emptyRows++;
      return;
    }

    try {
      const timestampStr = row[timestampField];
      const powerStr = row[powerField];

      // Special handling for combined timestamp fields (e.g., "Datum+Zeit")
      const isCombinedTimestamp = timestampField.includes('+');
      let hasValidTimestamp = false;

      if (isCombinedTimestamp) {
        const [dateField, timeField] = timestampField.split('+');
        hasValidTimestamp = !!(row[dateField] && row[timeField]);
      } else {
        hasValidTimestamp = !!timestampStr;
      }

      // KRITISCH: Beide Felder müssen vorhanden sein!
      // Skip die Zeile wenn Zeitstempel ODER Leistung fehlt
      if (!hasValidTimestamp || !powerStr) {
        emptyRows++;
        return;
      }

      // Diese Prüfungen sind jetzt redundant, aber lassen wir sie zur Sicherheit drin
      if (!hasValidTimestamp) {
        if (isCombinedTimestamp) {
          const [dateField, timeField] = timestampField.split('+');
          errors.push(`Zeile ${rowNumber}: Zeitstempel fehlt (${dateField}: '${row[dateField]}', ${timeField}: '${row[timeField]}')`);
        } else {
          errors.push(`Zeile ${rowNumber}: Zeitstempel fehlt in Spalte '${timestampField}'`);
        }
        skippedRows++;
        return;
      }
      
      if (!powerStr && powerStr !== 0) {
        errors.push(`Zeile ${rowNumber}: Leistungswert fehlt in Spalte '${powerField}'`);
        skippedRows++;
        return;
      }

      // Parse timestamp (pass row for combined date/time fields)
      const timestamp = parseTimestamp(timestampStr, row);
      if (!timestamp) {
        errors.push(`Zeile ${rowNumber}: Ungültiger Zeitstempel '${timestampStr}' in Spalte '${timestampField}'`);
        skippedRows++;
        return;
      }

      // Parse power value
      const power = parsePowerValue(powerStr);
      if (power === null) {
        errors.push(`Zeile ${rowNumber}: Ungültiger Leistungswert '${powerStr}' in Spalte '${powerField}'`);
        skippedRows++;
        return;
      }

      if (power < 0) {
        warnings.push(`Zeile ${rowNumber}: Negativer Leistungswert ${power} kW - wird als 0 gesetzt`);
      }

      // Create timestamp key WITHOUT timezone conversion
      const timestampKey = `${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, '0')}-${String(timestamp.getDate()).padStart(2, '0')}T${String(timestamp.getHours()).padStart(2, '0')}:${String(timestamp.getMinutes()).padStart(2, '0')}:${String(timestamp.getSeconds()).padStart(2, '0')}`;

      // Check for duplicates
      if (timestamps.has(timestampKey)) {
        warnings.push(`Zeile ${rowNumber}: Doppelter Zeitstempel ${timestampKey}`);
        duplicates++;
        return;
      }
      timestamps.add(timestampKey);

      // Detect interval from first two timestamps
      if (lastTimestamp && detectedIntervalMinutes === null) {
        const intervalMs = timestamp.getTime() - lastTimestamp.getTime();
        detectedIntervalMinutes = Math.round(intervalMs / (60 * 1000));
        console.log(`Erkanntes Intervall: ${detectedIntervalMinutes} Minuten`);
      }

      // Check for gaps
      if (lastTimestamp) {
        const intervalMs = detectedIntervalMinutes ? detectedIntervalMinutes * 60 * 1000 : 15 * 60 * 1000;
        const expectedNext = new Date(lastTimestamp.getTime() + intervalMs);
        const timeDiff = Math.abs(timestamp.getTime() - expectedNext.getTime());
        if (timeDiff > 5 * 60 * 1000) {
          gaps++;
        }
      }

      // Normalisierung auf kW basierend auf der Einheit
      let normalizedPower = Math.max(0, power);
      if (powerUnit === 'kWh') {
        // kWh-Werte müssen in kW umgerechnet werden basierend auf dem Intervall
        // Leistung (kW) = Energie (kWh) / Zeit (h)
        const intervalHours = (detectedIntervalMinutes || 15) / 60;
        normalizedPower = normalizedPower / intervalHours;
        console.log(`kWh Umrechnung: ${power} kWh über ${detectedIntervalMinutes || 15} min = ${normalizedPower.toFixed(2)} kW`);
      }

      data.push({
        timestamp: timestampKey,
        power_kw: normalizedPower
      });

      lastTimestamp = timestamp;
    } catch (error) {
      errors.push(`Zeile ${rowNumber}: Unerwarteter Fehler - ${error}`);
      skippedRows++;
    }
  });

  // Sort by timestamp
  data.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Verbesserte Qualitätsbewertung
  const totalInputRows = dataArray.length - emptyRows;
  const successfulRows = data.length;
  const successRate = totalInputRows > 0 ? (successfulRows / totalInputRows) * 100 : 0;
  
  let qualityScore = successRate;
  qualityScore -= (gaps / successfulRows) * 100 * 0.1; // 10% Abzug pro 1% Lücken
  qualityScore -= (duplicates / totalInputRows) * 100 * 0.05; // 5% Abzug pro 1% Duplikate
  qualityScore = Math.max(0, Math.min(100, qualityScore));
  
  // Füge Warnungen zu Fehlern hinzu für Anzeige
  const allMessages = [...errors, ...warnings];

  return {
    data,
    errors: allMessages,
    quality_score: Math.round(qualityScore),
    metadata: {
      total_records: data.length,
      data_start: data.length > 0 ? data[0].timestamp : '',
      data_end: data.length > 0 ? data[data.length - 1].timestamp : '',
      gaps,
      duplicates,
      data_unit: powerUnit
    }
  };
};

const parseLoadProfileCSV = (
  file: File, 
  timestampField?: string, 
  powerField?: string,
  powerUnit: 'kW' | 'kWh' = 'kW'
): Promise<ParseResult> => {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        const result = parseDataArray(results.data || [], timestampField, powerField, headers, powerUnit);
        resolve(result);
      }
    });
  });
};