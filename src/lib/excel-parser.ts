import * as XLSX from 'xlsx';

export interface ExcelParseResult {
  data: any[];
  headers: string[];
  sheetNames: string[];
  selectedSheet: string;
}

export const parseExcelFile = (file: File, sheetName?: string): Promise<ExcelParseResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const sheetNames = workbook.SheetNames;
        const targetSheet = sheetName || sheetNames[0];
        
        if (!workbook.Sheets[targetSheet]) {
          reject(new Error(`Arbeitsblatt "${targetSheet}" nicht gefunden`));
          return;
        }
        
        const worksheet = workbook.Sheets[targetSheet];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: null,
          raw: true,
          dateNF: 'yyyy-mm-dd hh:mm:ss'
        });
        
        if (jsonData.length === 0) {
          reject(new Error('Arbeitsblatt ist leer'));
          return;
        }
        
        // Erste Zeile als Header verwenden
        const headers = (jsonData[0] as string[]).map(h => String(h).trim());
        
        // Weniger aggressive Filterung - nur komplett leere Zeilen entfernen
        const dataRows = jsonData.slice(1).filter(row => {
          if (!Array.isArray(row)) return false;
          // Zeile behalten wenn mindestens eine Zelle einen Wert hat
          return row.some(cell => cell !== null && cell !== undefined && cell !== '');
        });
        
        // Daten in Objekte umwandeln mit besserer Behandlung leerer Zellen
        const parsedData = dataRows.map((row, rowIndex) => {
          const obj: any = {};
          headers.forEach((header, colIndex) => {
            const cellValue = row[colIndex];
            // Behalte null/undefined für leere Zellen, konvertiere aber andere Werte zu Strings
            obj[header] = (cellValue === null || cellValue === undefined) ? null : String(cellValue);
          });
          return obj;
        });
        
        console.log(`Excel-Parsing: ${headers.length} Spalten, ${dataRows.length} Datenzeilen, ${parsedData.length} geparste Objekte`);
        
        // Debug: Zeige erste paar Zeilen
        if (parsedData.length > 0) {
          console.log('Erste 3 Zeilen:', parsedData.slice(0, 3));
        }
        
        resolve({
          data: parsedData,
          headers,
          sheetNames,
          selectedSheet: targetSheet
        });
        
      } catch (error) {
        reject(new Error(`Fehler beim Lesen der Excel-Datei: ${error}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Fehler beim Lesen der Datei'));
    };
    
    reader.readAsArrayBuffer(file);
  });
};

const detectBestSheet = (sheetNames: string[]): string => {
  // Priorisiere Arbeitsblätter mit typischen Namen für Lastprofile
  const preferredNames = [
    'lastprofil', 'lastgang', 'verbrauch', 'consumption', 'load', 'data', 'daten'
  ];
  
  for (const preferred of preferredNames) {
    const found = sheetNames.find(name => 
      name.toLowerCase().includes(preferred)
    );
    if (found) return found;
  }
  
  // Fallback: erstes Arbeitsblatt
  return sheetNames[0];
};