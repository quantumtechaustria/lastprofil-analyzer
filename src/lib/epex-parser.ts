import Papa from 'papaparse';
import { parse } from 'date-fns';
import * as XLSX from 'xlsx';

export interface EPEXSpotPrice {
  timestamp: Date;
  priceEurMwh: number;
  priceCtKwh: number;
}

export interface EPEXParseResult {
  success: boolean;
  data?: EPEXSpotPrice[];
  error?: string;
  dateRange?: {
    start: Date;
    end: Date;
    totalHours: number;
  };
}

export async function parseEPEXSpotPricesFromFile(file: File): Promise<EPEXParseResult> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return parseExcelFile(file);
  } else {
    const content = await file.text();
    return parseCSVContent(content);
  }
}

async function parseExcelFile(file: File): Promise<EPEXParseResult> {
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const csvContent = XLSX.utils.sheet_to_csv(firstSheet, { FS: ';' });
    return parseCSVContent(csvContent);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse Excel file',
    };
  }
}

export function parseEPEXSpotPrices(csvContent: string): EPEXParseResult {
  return parseCSVContent(csvContent);
}

function parseCSVContent(csvContent: string): EPEXParseResult {
  try {
    const parsed = Papa.parse(csvContent, {
      delimiter: ';',
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    if (parsed.errors.length > 0) {
      return {
        success: false,
        error: `CSV parsing error: ${parsed.errors[0].message}`,
      };
    }

    const rows = parsed.data as string[][];

    if (rows.length < 2) {
      return {
        success: false,
        error: 'CSV file is empty or has no data rows',
      };
    }

    const spotPrices: EPEXSpotPrice[] = [];
    const errors: string[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      if (!row || row.length < 2) continue;

      const dateStr = row[0]?.trim();
      const priceStr = row[1]?.trim();

      if (!dateStr || !priceStr) continue;

      try {
        let timestamp: Date;

        if (dateStr.includes('.')) {
          timestamp = parse(dateStr, 'dd.MM.yy HH:mm', new Date());
        } else if (dateStr.includes('/')) {
          timestamp = parse(dateStr, 'dd/MM/yy HH:mm', new Date());
        } else {
          errors.push(`Row ${i + 1}: Invalid date format "${dateStr}"`);
          continue;
        }

        if (isNaN(timestamp.getTime())) {
          errors.push(`Row ${i + 1}: Invalid date format "${dateStr}"`);
          continue;
        }

        const priceEurMwh = parseFloat(priceStr.replace(',', '.'));

        if (isNaN(priceEurMwh)) {
          errors.push(`Row ${i + 1}: Invalid price "${priceStr}"`);
          continue;
        }

        const priceCtKwh = priceEurMwh / 10;

        spotPrices.push({
          timestamp,
          priceEurMwh,
          priceCtKwh,
        });
      } catch (error) {
        errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (spotPrices.length === 0) {
      return {
        success: false,
        error: errors.length > 0 ? errors.join('; ') : 'No valid data rows found',
      };
    }

    spotPrices.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const dateRange = {
      start: spotPrices[0].timestamp,
      end: spotPrices[spotPrices.length - 1].timestamp,
      totalHours: spotPrices.length,
    };

    return {
      success: true,
      data: spotPrices,
      dateRange,
      error: errors.length > 0 ? `Parsed with ${errors.length} errors` : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown parsing error',
    };
  }
}
