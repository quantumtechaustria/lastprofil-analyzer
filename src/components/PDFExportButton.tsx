import React, { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { generateComparisonReport, PDFReportData } from '../lib/pdf-export';

interface PDFExportButtonProps {
  profiles: any[];
  economicAnalysis?: any;
  egPrice?: number;
  markup?: number;
  loadProfileChartId?: string;
  economicChartId?: string;
  spotAnalysis?: any;
  spotHandlingFee?: number;
  spotDateRange?: { start: string; end: string };
  spotEgComparisonPrice?: number;
  fixedPriceAnalysis?: any;
}

export default function PDFExportButton({
  profiles,
  economicAnalysis,
  egPrice,
  markup,
  loadProfileChartId,
  economicChartId,
  spotAnalysis,
  spotHandlingFee,
  spotDateRange,
  spotEgComparisonPrice,
  fixedPriceAnalysis,
}: PDFExportButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleExport = async () => {
    setIsGenerating(true);

    try {
      const chartElements: any = {};

      if (loadProfileChartId) {
        const loadChart = document.getElementById(loadProfileChartId);
        if (loadChart) {
          chartElements.loadProfileChart = loadChart;
        }
      }

      if (economicChartId) {
        const econChart = document.getElementById(economicChartId);
        if (econChart) {
          chartElements.economicChart = econChart;
        }
      }

      const reportData: PDFReportData = {
        profiles: profiles.map(p => ({
          name: p.name,
          profile_type: p.profile_type,
          kpis: p.kpis,
          site_address: p.site_address,
          meter_number: p.meter_number,
          industry_sector: p.industry_sector
        })),
        economicAnalysis,
        egPrice,
        markup,
        chartElements,
        spotAnalysis,
        spotHandlingFee,
        spotDateRange,
        spotEgComparisonPrice,
        fixedPriceAnalysis,
      };

      await generateComparisonReport(reportData);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Fehler beim Erstellen des PDF-Berichts. Bitte versuchen Sie es erneut.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isGenerating}
      className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-600 to-blue-600 text-white font-semibold rounded-lg hover:from-sky-700 hover:to-blue-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isGenerating ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          PDF wird erstellt...
        </>
      ) : (
        <>
          <FileDown className="h-5 w-5" />
          PDF-Bericht exportieren
        </>
      )}
    </button>
  );
}
