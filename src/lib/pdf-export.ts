import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { formatNumberGerman, formatIntegerGerman, formatLargeNumberGerman } from './utils';

interface ProfileData {
  name: string;
  profile_type: 'consumer' | 'producer';
  kpis: {
    annual_consumption_kwh: number;
    peak_load_kw: number;
    load_factor: number;
    avg_power_kw: number;
    peak_frequency_90_percent?: number;
    usage_hours?: number;
    day_night_ratio?: { day_percent: number; night_percent: number };
  };
  site_address?: string;
  meter_number?: string;
  industry_sector?: string;
}

interface EconomicAnalysisData {
  totalConsumptionKwh: number;
  totalProductionKwh: number;
  totalActuallyConsumedKwh: number;
  hoursEgCheaper: number;
  hoursSpotCheaper: number;
  hoursWithProduction: number;
  avgSpotPrice: number;
  totalSavings: number;
  totalLoss: number;
  netSavings: number;
  topSavingsDays: Array<{ date: string; savings: number }>;
}

export interface SpotAnalysisData {
  totalConsumptionKwh: number;
  totalCostEur: number;
  averagePriceCtKwh: number;
  monthlyResults: Array<{
    month: string;
    consumptionKwh: number;
    costEur: number;
    avgPriceCtKwh: number;
  }>;
}

export interface PDFReportData {
  profiles: ProfileData[];
  economicAnalysis?: EconomicAnalysisData;
  egPrice?: number;
  markup?: number;
  chartElements?: {
    loadProfileChart?: HTMLElement;
    economicChart?: HTMLElement;
  };
  spotAnalysis?: SpotAnalysisData;
  spotHandlingFee?: number;
  spotDateRange?: { start: string; end: string };
  spotEgComparisonPrice?: number;
  fixedPriceAnalysis?: FixedPriceAnalysisData;
}

export interface FixedPriceAnalysisData {
  totalKwh: number;
  priceNow: number;
  priceNew: number;
  costNow: number;
  costNew: number;
  savings: number;
  isProducer: boolean;
  dateRange: { start: string; end: string };
}

const colors = {
  blue600: '#2563eb',
  blue700: '#1e40af',
  blue50: '#eff6ff',
  blue100: '#dbeafe',
  blue300: '#93c5fd',
  green600: '#10b981',
  green700: '#047857',
  green50: '#f0fdf4',
  green100: '#d1fae5',
  green300: '#86efac',
  amber500: '#f59e0b',
  yellow50: '#fffbeb',
  yellow100: '#fef3c7',
  red600: '#ef4444',
  orange700: '#c2410c',
  slate900: '#0f172a',
  slate700: '#334155',
  slate600: '#475569',
  slate500: '#64748b',
  slate300: '#cbd5e1',
  slate100: '#f1f5f9',
  slate50: '#f8fafc',
  cyan500: '#06b6d4',
  cyan50: '#ecfeff',
  cyan100: '#cffafe',
};

export async function generateComparisonReport(data: PDFReportData): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const consumerProfile = data.profiles.find(p => p.profile_type === 'consumer') || data.profiles[0];
  const producerProfile = data.profiles.find(p => p.profile_type === 'producer') || data.profiles[1];
  const isSingleProfile = data.profiles.length === 1;

  const avgPowerConsumer = consumerProfile.kpis.annual_consumption_kwh / 8760;
  const loadFactorConsumer = (avgPowerConsumer / consumerProfile.kpis.peak_load_kw) * 100;

  let avgPowerProducer = 0;
  let loadFactorProducer = 0;
  if (producerProfile && !isSingleProfile) {
    avgPowerProducer = producerProfile.kpis.annual_consumption_kwh / 8760;
    loadFactorProducer = (avgPowerProducer / producerProfile.kpis.peak_load_kw) * 100;
  }

  await generatePage1(pdf, data, consumerProfile, isSingleProfile ? undefined : producerProfile, avgPowerConsumer, loadFactorConsumer, avgPowerProducer, loadFactorProducer);

  if (data.economicAnalysis) {
    pdf.addPage();
    await generatePage2(pdf, data, consumerProfile, producerProfile, data.egPrice, data.markup);
  }

  if (data.spotAnalysis) {
    const spotProfile = data.profiles.length === 1 ? data.profiles[0] : consumerProfile;
    pdf.addPage();
    generateSpotAnalysisPage(pdf, data, spotProfile);
  }

  if (data.fixedPriceAnalysis) {
    pdf.addPage();
    generateFixedPriceAnalysisPage(pdf, data);
  }

  addFooters(pdf, !!data.economicAnalysis || !!data.spotAnalysis || !!data.fixedPriceAnalysis);

  const fileName = `Lastprofil_Analyse_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`;
  pdf.save(fileName);
}

async function generatePage1(
  pdf: jsPDF,
  data: PDFReportData,
  consumerProfile: ProfileData,
  producerProfile: ProfileData | undefined,
  avgPowerConsumer: number,
  loadFactorConsumer: number,
  avgPowerProducer: number,
  loadFactorProducer: number
) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  let y = 0;

  pdf.setFillColor(colors.blue600);
  pdf.rect(0, 0, pageWidth, 40, 'F');

  pdf.setTextColor('#ffffff');
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text('ANALYSE', 15, 10);

  pdf.setFontSize(32);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Lastprofil-Analyse', 15, 22);

  const isSingleProfile = !producerProfile;
  if (isSingleProfile) {
    const singleProfile = data.profiles[0];
    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'normal');
    pdf.text(singleProfile.name, 15, 30);
    if (singleProfile.meter_number) {
      pdf.setFontSize(9);
      pdf.setTextColor(colors.blue100);
      pdf.text(`ZP: ${singleProfile.meter_number}`, 15, 36);
    }
  } else {
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${consumerProfile.name} vs. ${producerProfile.name}`, 15, 32);
  }

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Erstellt am', pageWidth - 45, 10);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text(format(new Date(), 'dd.MM.yyyy', { locale: de }), pageWidth - 45, 16);
  pdf.text(format(new Date(), 'HH:mm', { locale: de }) + ' Uhr', pageWidth - 45, 21);

  y = 45;

  if (data.economicAnalysis) {
    pdf.setFillColor(colors.green50);
    pdf.rect(0, y, pageWidth, 50, 'F');
    pdf.setDrawColor(colors.green600);
    pdf.setLineWidth(1.5);
    pdf.line(0, y + 50, pageWidth, y + 50);

    pdf.setTextColor(colors.slate700);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('WIRTSCHAFTLICHKEIT AUF EINEN BLICK', pageWidth / 2, y + 10, { align: 'center' });

    pdf.setFontSize(48);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(data.economicAnalysis.netSavings >= 0 ? colors.green600 : colors.red600);
    const netSign = data.economicAnalysis.netSavings >= 0 ? '+' : '';
    pdf.text(`${netSign}${formatIntegerGerman(data.economicAnalysis.netSavings)} EUR`, pageWidth / 2, y + 28, { align: 'center' });

    pdf.setFontSize(14);
    pdf.setTextColor(colors.slate700);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Netto-Ersparnis pro Jahr durch EG-Beitritt', pageWidth / 2, y + 37, { align: 'center' });

    y += 55;

    pdf.setFillColor('#ffffff');
    pdf.roundedRect(15, y, pageWidth - 30, 22, 3, 3, 'F');
    pdf.setDrawColor(colors.slate300);
    pdf.setLineWidth(0.2);
    pdf.roundedRect(15, y, pageWidth - 30, 22, 3, 3, 'S');

    const boxWidth = (pageWidth - 30) / 3;
    const ea = data.economicAnalysis;
    const egPercent = (ea.hoursEgCheaper / ea.hoursWithProduction) * 100;
    const egAnteilVerbrauch = (ea.totalActuallyConsumedKwh / ea.totalConsumptionKwh) * 100;

    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.green600);
    pdf.text(`${formatNumberGerman(egPercent)}%`, 15 + boxWidth / 2, y + 10, { align: 'center' });
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.slate600);
    pdf.text('EG günstiger', 15 + boxWidth / 2, y + 16, { align: 'center' });

    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.blue600);
    pdf.text(`${formatNumberGerman(egAnteilVerbrauch)}%`, 15 + boxWidth + boxWidth / 2, y + 8, { align: 'center' });
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.slate600);
    pdf.text('Bezug aus EG', 15 + boxWidth + boxWidth / 2, y + 14, { align: 'center' });
    pdf.setFontSize(7);
    pdf.setTextColor(colors.slate500);
    pdf.text('(vom Gesamtverbrauch)', 15 + boxWidth + boxWidth / 2, y + 18, { align: 'center' });

    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.amber500);
    pdf.text(`${formatNumberGerman(ea.avgSpotPrice)}`, 15 + 2 * boxWidth + boxWidth / 2, y + 10, { align: 'center' });
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.slate600);
    pdf.text('Ø Spotpreis ct/kWh', 15 + 2 * boxWidth + boxWidth / 2, y + 16, { align: 'center' });

    y += 27;
  }

  y += 5;

  if (isSingleProfile) {
    // ── Kennzahlen (Einzelprofil) ──
    const singleProfile = data.profiles[0];
    const kpis = singleProfile.kpis;
    const isProducer = singleProfile.profile_type === 'producer';

    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.slate900);
    pdf.text('Kennzahlen', 15, y);
    y += 5;

    const cardCount = 3;
    const cardGap = 4;
    const cardWidth = (pageWidth - 30 - (cardCount - 1) * cardGap) / cardCount;
    const cardHeight = 36;

    // Karte 1: Jahresverbrauch / Jahreseinspeisung
    const card1X = 15;
    pdf.setFillColor(colors.blue50);
    pdf.roundedRect(card1X, y, cardWidth, cardHeight, 3, 3, 'F');
    pdf.setDrawColor(colors.blue300);
    pdf.setLineWidth(0.5);
    pdf.roundedRect(card1X, y, cardWidth, cardHeight, 3, 3, 'S');

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.blue600);
    pdf.text(isProducer ? 'Jahreseinspeisung' : 'Jahresverbrauch', card1X + cardWidth / 2, y + 8, { align: 'center' });
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.blue700);
    pdf.text(`${formatLargeNumberGerman(kpis.annual_consumption_kwh)} kWh`, card1X + cardWidth / 2, y + 20, { align: 'center' });
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.slate500);
    pdf.text(`${formatNumberGerman(kpis.annual_consumption_kwh / 1000)} MWh`, card1X + cardWidth / 2, y + 27, { align: 'center' });

    // Karte 2: Spitzenlast
    const card2X = card1X + cardWidth + cardGap;
    pdf.setFillColor(colors.yellow50);
    pdf.roundedRect(card2X, y, cardWidth, cardHeight, 3, 3, 'F');
    pdf.setDrawColor('#f59e0b');
    pdf.setLineWidth(0.5);
    pdf.roundedRect(card2X, y, cardWidth, cardHeight, 3, 3, 'S');

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor('#b45309');
    pdf.text('Spitzenlast', card2X + cardWidth / 2, y + 8, { align: 'center' });
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.slate900);
    pdf.text(`${formatLargeNumberGerman(kpis.peak_load_kw)} kW`, card2X + cardWidth / 2, y + 20, { align: 'center' });
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.slate500);
    if (kpis.peak_frequency_90_percent != null) {
      pdf.text(`${formatNumberGerman(kpis.peak_frequency_90_percent)}% über 90%`, card2X + cardWidth / 2, y + 27, { align: 'center' });
    }

    // Karte 3: Lastfaktor
    const card3X = card2X + cardWidth + cardGap;
    pdf.setFillColor(colors.green50);
    pdf.roundedRect(card3X, y, cardWidth, cardHeight, 3, 3, 'F');
    pdf.setDrawColor(colors.green600);
    pdf.setLineWidth(0.5);
    pdf.roundedRect(card3X, y, cardWidth, cardHeight, 3, 3, 'S');

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.green700);
    pdf.text('Lastfaktor', card3X + cardWidth / 2, y + 8, { align: 'center' });
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.slate900);
    pdf.text(`${formatNumberGerman(kpis.load_factor)}%`, card3X + cardWidth / 2, y + 20, { align: 'center' });
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.slate500);
    if (kpis.usage_hours != null) {
      pdf.text(`${formatIntegerGerman(kpis.usage_hours)} Volllaststunden`, card3X + cardWidth / 2, y + 27, { align: 'center' });
    }

    y += cardHeight + 10;
  } else {
    // ── Profil-Vergleich (zwei Profile) ──
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.slate900);
    pdf.text('Profil-Vergleich', 15, y);
    y += 5;

    const boxWidth = (pageWidth - 35) / 2;
    const leftBoxX = 15;
    const rightBoxX = 15 + boxWidth + 5;

    pdf.setFillColor('#e8f4f8');
    pdf.roundedRect(leftBoxX, y, boxWidth, 56, 3, 3, 'F');

    pdf.setFillColor('#1d67a9');
    pdf.circle(leftBoxX + 8, y + 8, 5, 'F');
    pdf.setTextColor('#ffffff');
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('V', leftBoxX + 8, y + 10, { align: 'center' });

    pdf.setFontSize(9);
    pdf.setTextColor(colors.slate600);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Verbraucher', leftBoxX + 16, y + 7);

    pdf.setFontSize(14);
    pdf.setTextColor(colors.slate900);
    pdf.setFont('helvetica', 'bold');
    const consumerNameLines = pdf.splitTextToSize(consumerProfile.name, boxWidth - 20);
    pdf.text(consumerNameLines, leftBoxX + 16, y + 13);

    let lineY = y + 16;
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.slate500);
    if (consumerProfile.site_address) {
      pdf.text(consumerProfile.site_address, leftBoxX + 16, lineY);
      lineY += 3;
    }
    if (consumerProfile.meter_number) {
      pdf.text(`ZP: ${consumerProfile.meter_number}`, leftBoxX + 16, lineY);
      lineY += 3;
    }

    lineY += 2;
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.slate700);

    pdf.text('Jahresenergie:', leftBoxX + 4, lineY);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${formatLargeNumberGerman(consumerProfile.kpis.annual_consumption_kwh)} kWh`, leftBoxX + boxWidth - 4, lineY, { align: 'right' });
    lineY += 5;

    pdf.setFont('helvetica', 'normal');
    pdf.text('Spitzenlast:', leftBoxX + 4, lineY);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${formatLargeNumberGerman(consumerProfile.kpis.peak_load_kw)} kW`, leftBoxX + boxWidth - 4, lineY, { align: 'right' });
    lineY += 5;

    pdf.setFont('helvetica', 'normal');
    pdf.text('Durchschnittslast:', leftBoxX + 4, lineY);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${formatNumberGerman(avgPowerConsumer)} kW`, leftBoxX + boxWidth - 4, lineY, { align: 'right' });
    lineY += 5;

    pdf.setFont('helvetica', 'normal');
    pdf.text('Lastfaktor:', leftBoxX + 4, lineY);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${formatNumberGerman(loadFactorConsumer)}%`, leftBoxX + boxWidth - 4, lineY, { align: 'right' });

    if (producerProfile) {
      pdf.setFillColor('#fef9e6');
      pdf.roundedRect(rightBoxX, y, boxWidth, 56, 3, 3, 'F');

      pdf.setFillColor('#eab308');
      pdf.circle(rightBoxX + 8, y + 8, 5, 'F');
      pdf.setTextColor('#ffffff');
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('E', rightBoxX + 8, y + 10, { align: 'center' });

      pdf.setFontSize(9);
      pdf.setTextColor(colors.slate600);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Einspeiser', rightBoxX + 16, y + 7);

      pdf.setFontSize(14);
      pdf.setTextColor(colors.slate900);
      pdf.setFont('helvetica', 'bold');
      const producerNameLines = pdf.splitTextToSize(producerProfile.name, boxWidth - 20);
      pdf.text(producerNameLines, rightBoxX + 16, y + 13);

      lineY = y + 16;
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(colors.slate500);
      if (producerProfile.site_address) {
        pdf.text(producerProfile.site_address, rightBoxX + 16, lineY);
        lineY += 3;
      }
      if (producerProfile.meter_number) {
        pdf.text(`ZP: ${producerProfile.meter_number}`, rightBoxX + 16, lineY);
        lineY += 3;
      }

      lineY += 2;
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(colors.slate700);

      pdf.text('Jahresenergie:', rightBoxX + 4, lineY);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${formatLargeNumberGerman(producerProfile.kpis.annual_consumption_kwh)} kWh`, rightBoxX + boxWidth - 4, lineY, { align: 'right' });
      lineY += 5;

      pdf.setFont('helvetica', 'normal');
      pdf.text('Spitzenlast:', rightBoxX + 4, lineY);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${formatLargeNumberGerman(producerProfile.kpis.peak_load_kw)} kW`, rightBoxX + boxWidth - 4, lineY, { align: 'right' });
      lineY += 5;

      pdf.setFont('helvetica', 'normal');
      pdf.text('Durchschnittslast:', rightBoxX + 4, lineY);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${formatNumberGerman(avgPowerProducer)} kW`, rightBoxX + boxWidth - 4, lineY, { align: 'right' });
      lineY += 5;

      pdf.setFont('helvetica', 'normal');
      pdf.text('Lastfaktor:', rightBoxX + 4, lineY);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${formatNumberGerman(loadFactorProducer)}%`, rightBoxX + boxWidth - 4, lineY, { align: 'right' });
    }

    y += 66;
  }

  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.slate900);
  pdf.text('Lastgang-Visualisierung', 15, y);
  y += 8;

  if (data.chartElements?.loadProfileChart) {
    try {
      const canvas = await html2canvas(data.chartElements.loadProfileChart, {
        scale: 2,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.85);
      const chartWidth = pageWidth - 30;
      const aspectRatio = canvas.height / canvas.width;
      const chartHeight = Math.min(90, (chartWidth * aspectRatio));

      pdf.addImage(imgData, 'JPEG', 15, y, chartWidth, chartHeight, undefined, 'FAST');
      y += chartHeight + 10;
    } catch (error) {
      console.error('Error capturing load profile chart:', error);
    }
  }

  const dayNight = consumerProfile.kpis.day_night_ratio;
  if (dayNight && (dayNight.day_percent > 0 || dayNight.night_percent > 0)) {
    const barX = 15;
    const barWidth = pageWidth - 30;
    const barHeight = 10;

    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.slate900);
    pdf.text('Tag / Nacht-Verhältnis', 15, y);
    y += 4;
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal'); 
    pdf.setTextColor(colors.slate500);
    pdf.text('Tag: 06:00–22:00 Uhr | Nacht: 22:00–06:00 Uhr', 15, y);
    y += 4;

    const dayWidth = (dayNight.day_percent / 100) * barWidth;
    const nightWidth = barWidth - dayWidth;

    pdf.setFillColor('#f59e0b');
    pdf.roundedRect(barX, y, barWidth, barHeight, 2, 2, 'F');

    pdf.setFillColor('#1e3a5f');
    if (nightWidth > 0) {
      pdf.rect(barX + dayWidth, y, nightWidth, barHeight, 'F');
      pdf.roundedRect(barX + dayWidth, y, nightWidth, barHeight, 0, 0, 'F');
      const rr = 2;
      pdf.roundedRect(barX + barWidth - rr * 2, y, rr * 2, barHeight, rr, rr, 'F');
    }

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor('#ffffff');
    if (dayWidth > 30) {
      pdf.text(`Tag ${formatNumberGerman(dayNight.day_percent)}%`, barX + dayWidth / 2, y + barHeight / 2 + 1, { align: 'center' });
    }
    if (nightWidth > 30) {
      pdf.text(`Nacht ${formatNumberGerman(dayNight.night_percent)}%`, barX + dayWidth + nightWidth / 2, y + barHeight / 2 + 1, { align: 'center' });
    }
  }
}

async function generatePage2(
  pdf: jsPDF,
  data: PDFReportData,
  consumerProfile: ProfileData,
  producerProfile: ProfileData | undefined,
  egPrice: number | undefined,
  markup: number | undefined
) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let y = 0;

  pdf.setFillColor(colors.blue600);
  pdf.rect(0, 0, pageWidth, 30, 'F');

  pdf.setTextColor('#ffffff');
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Spot-Preis Wirtschaftlichkeitsanalyse', 15, 15);

  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  const ea = data.economicAnalysis!;
  if (ea.timePeriod) {
    const startDateStr = format(ea.timePeriod.startDate, 'dd.MM.yyyy', { locale: de });
    const endDateStr = format(ea.timePeriod.endDate, 'dd.MM.yyyy', { locale: de });
    const yearStr = ea.timePeriod.year ? ` (Jahr: ${ea.timePeriod.year})` : '';
    pdf.text(`Zeitraum: ${startDateStr} - ${endDateStr}${yearStr}`, 15, 23);
  } else {
    pdf.text('Detaillierte Aufschluesselung', 15, 23);
  }

  y = 40;

  const jahresverbrauch = consumerProfile.kpis.annual_consumption_kwh;
  const jahreseinspeisung = producerProfile ? producerProfile.kpis.annual_consumption_kwh : ea.totalProductionKwh;
  const nutzungsgrad = (ea.totalActuallyConsumedKwh / ea.totalProductionKwh) * 100;

  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.slate900);
  pdf.text('Energie-Übersicht', 15, y);
  y += 6;

  pdf.setFillColor(colors.cyan50);
  pdf.roundedRect(15, y, pageWidth - 30, 45, 3, 3, 'F');
  pdf.setDrawColor(colors.cyan500);
  pdf.setLineWidth(1);
  pdf.rect(15, y, 4, 45, 'F');

  const colWidth = (pageWidth - 40) / 2;
  let colY = y + 16;

  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.blue600);
  pdf.text(`${formatLargeNumberGerman(jahresverbrauch)}`, 20 + colWidth / 2, colY, { align: 'center' });
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.slate600);
  pdf.text('Jahresverbrauch kWh', 20 + colWidth / 2, colY + 5, { align: 'center' });
  pdf.setFontSize(8);
  pdf.setTextColor(colors.slate500);
  pdf.text('(aus Lastprofil)', 20 + colWidth / 2, colY + 9, { align: 'center' });

  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.green600);
  pdf.text(`${formatLargeNumberGerman(jahreseinspeisung)}`, 20 + colWidth + colWidth / 2, colY, { align: 'center' });
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.slate600);
  pdf.text('Jahreseinspeisung kWh', 20 + colWidth + colWidth / 2, colY + 5, { align: 'center' });
  pdf.setFontSize(8);
  pdf.setTextColor(colors.slate500);
  pdf.text('(erzeugte Energie)', 20 + colWidth + colWidth / 2, colY + 9, { align: 'center' });

  pdf.setDrawColor(colors.slate300);
  pdf.setLineWidth(0.3);
  pdf.line(25, y + 27, pageWidth - 25, y + 27);

  colY = y + 34;

  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.amber500);
  pdf.text(`${formatLargeNumberGerman(ea.totalActuallyConsumedKwh)}`, 20 + colWidth / 2, colY, { align: 'center' });
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.slate600);
  pdf.text('Gesamt-Abnahme kWh', 20 + colWidth / 2, colY + 5, { align: 'center' });
  pdf.setFontSize(8);
  pdf.setTextColor(colors.slate500);
  pdf.text('(direkt vom Erzeuger)', 20 + colWidth / 2, colY + 9, { align: 'center' });

  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.cyan500);
  pdf.text(`${formatNumberGerman(nutzungsgrad)}%`, 20 + colWidth + colWidth / 2, colY, { align: 'center' });
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.slate600);
  pdf.text('Nutzungsgrad', 20 + colWidth + colWidth / 2, colY + 5, { align: 'center' });
  pdf.setFontSize(8);
  pdf.setTextColor(colors.slate500);
  pdf.text('(der Erzeugung genutzt)', 20 + colWidth + colWidth / 2, colY + 9, { align: 'center' });

  y += 53;

  if (egPrice !== undefined && markup !== undefined) {
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.slate900);
    pdf.text('Preisparameter', 15, y);
    y += 6;

    pdf.setFillColor(colors.slate50);
    pdf.roundedRect(15, y, pageWidth - 30, 16, 3, 3, 'F');

    const paramColWidth = (pageWidth - 40) / 2;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.slate600);
    pdf.text(`EG-Preis: ${formatNumberGerman(egPrice)} ct/kWh`, 20 + paramColWidth / 2, y + 10, { align: 'center' });

    pdf.text(`Spot-Aufschlag: ${formatNumberGerman(markup)} ct/kWh`, 20 + paramColWidth + paramColWidth / 2, y + 10, { align: 'center' });

    y += 25;
  }

  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.slate900);
  pdf.text('Preisvergleich', 15, y);
  y += 6;

  pdf.setFillColor(colors.yellow50);
  pdf.roundedRect(15, y, pageWidth - 30, 25, 3, 3, 'F');
  pdf.setDrawColor(colors.amber500);
  pdf.setLineWidth(1);
  pdf.rect(15, y, 4, 25, 'F');

  colY = y + 15;
  const egPercent = (ea.hoursEgCheaper / ea.hoursWithProduction) * 100;
  const spotPercent = (ea.hoursSpotCheaper / ea.hoursWithProduction) * 100;

  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.green600);
  pdf.text(`${formatIntegerGerman(ea.hoursEgCheaper)} h`, 20 + colWidth / 2, colY, { align: 'center' });
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.slate600);
  pdf.text(`EG günstiger (${formatNumberGerman(egPercent)}%)`, 20 + colWidth / 2, colY + 5, { align: 'center' });

  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.amber500);
  pdf.text(`${formatIntegerGerman(ea.hoursSpotCheaper)} h`, 20 + colWidth + colWidth / 2, colY, { align: 'center' });
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.slate600);
  pdf.text(`Spot günstiger (${formatNumberGerman(spotPercent)}%)`, 20 + colWidth + colWidth / 2, colY + 5, { align: 'center' });

  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.blue600);
  pdf.text(`${formatNumberGerman(ea.avgSpotPrice)}`, 20 + 2 * colWidth + colWidth / 2, colY, { align: 'center' });
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.slate600);
  pdf.text('O Spotpreis ct/kWh', 20 + 2 * colWidth + colWidth / 2, colY + 5, { align: 'center' });

  y += 30;

  pdf.setFillColor(colors.green50);
  pdf.roundedRect(15, y, pageWidth - 30, 35, 3, 3, 'F');
  pdf.setDrawColor(colors.green600);
  pdf.setLineWidth(0.5);
  pdf.roundedRect(15, y, pageWidth - 30, 35, 3, 3, 'S');

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.green700);
  pdf.text('GESAMTERSPARNIS DURCH EG-BEITRITT', pageWidth / 2, y + 7, { align: 'center' });

  colY = y + 15;
  const savingsBoxWidth = (pageWidth - 40) / 3;
  const gap = 2;

  // Box 1: Ersparnis
  const box1X = 20;
  pdf.setFillColor('#ffffff');
  pdf.roundedRect(box1X, colY, savingsBoxWidth, 16, 3, 3, 'F');

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.green700);
  pdf.text('Ersparnis:', box1X + savingsBoxWidth / 2, colY + 5, { align: 'center' });
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.green600);
  pdf.text(`+${formatIntegerGerman(ea.totalSavings)} EUR`, box1X + savingsBoxWidth / 2, colY + 12, { align: 'center' });

  // Box 2: Verlust
  const box2X = box1X + savingsBoxWidth + gap;
  pdf.setFillColor('#ffffff');
  pdf.roundedRect(box2X, colY, savingsBoxWidth, 16, 3, 3, 'F');

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.orange700);
  pdf.text('"Verlust" in günstigen Spot-Stunden:', box2X + savingsBoxWidth / 2, colY + 5, { align: 'center' });
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.red600);
  pdf.text(`-${formatIntegerGerman(ea.totalLoss)} EUR`, box2X + savingsBoxWidth / 2, colY + 12, { align: 'center' });

  // Box 3: Gesamtersparnis
  const box3X = box2X + savingsBoxWidth + gap;
  pdf.setFillColor('#ffffff');
  pdf.roundedRect(box3X, colY, savingsBoxWidth, 16, 3, 3, 'F');

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.green600);
  pdf.text('Gesamtersparnis / Jahr (netto):', box3X + savingsBoxWidth / 2, colY + 5, { align: 'center' });
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(ea.netSavings >= 0 ? colors.green600 : colors.red600);
  const netSign = ea.netSavings >= 0 ? '+' : '';
  pdf.text(`${netSign}${formatIntegerGerman(ea.netSavings)} EUR`, box3X + savingsBoxWidth / 2, colY + 12, { align: 'center' });


  y += 43;

  if (ea.topSavingsDays.length > 0) {
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.slate900);
    pdf.text('Top 5 Tage mit höchster Ersparnis', 15, y);
    y += 6;

    ea.topSavingsDays.slice(0, 5).forEach((day, index) => {
      pdf.setFillColor(colors.slate50);
      pdf.roundedRect(15, y, pageWidth - 30, 8, 3, 3, 'F');

      pdf.setFillColor(colors.blue600);
      pdf.circle(20, y + 4, 3, 'F');
      pdf.setTextColor('#ffffff');
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${index + 1}`, 20, y + 5, { align: 'center' });

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(colors.slate900);
      const dateStr = format(new Date(day.date), 'dd.MM.yyyy', { locale: de });
      pdf.text(dateStr, 27, y + 5);

      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(colors.green600);
      pdf.text(`+${formatNumberGerman(day.savings)} EUR`, pageWidth - 20, y + 5, { align: 'right' });

      y += 9;
    });

    y += 3;
  }

  if (data.chartElements?.economicChart && y + 110 < pageHeight - 20) {
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.slate900);
    pdf.text('Lastgang & Spot-Preis Ueberlagerung', 15, y);
    y += 5;

    try {
      const canvas = await html2canvas(data.chartElements.economicChart, {
        scale: 2,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.85);
      const chartWidth = pageWidth - 30;
      const aspectRatio = canvas.height / canvas.width;
      const chartHeight = Math.min(100, (chartWidth * aspectRatio), pageHeight - y - 20);

      pdf.setFillColor(colors.slate50);
      pdf.roundedRect(15, y, chartWidth, chartHeight, 3, 3, 'F');

      pdf.addImage(imgData, 'JPEG', 18, y + 3, chartWidth - 6, chartHeight - 6, undefined, 'FAST');
    } catch (error) {
      console.error('Error capturing economic chart:', error);
    }
  }
}

function generateSpotAnalysisPage(
  pdf: jsPDF,
  data: PDFReportData,
  spotProfile: ProfileData
) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const spot = data.spotAnalysis!;
  const handlingFee = data.spotHandlingFee || 0;
  const isProducer = spotProfile.profile_type === 'producer';
  let y = 0;

  pdf.setFillColor(colors.blue600);
  pdf.rect(0, 0, pageWidth, 30, 'F');

  pdf.setTextColor('#ffffff');
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Spotpreis-Analyse', 15, 15);

  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  if (data.spotDateRange?.start && data.spotDateRange?.end) {
    const startStr = format(new Date(data.spotDateRange.start), 'dd.MM.yyyy', { locale: de });
    const endStr = format(new Date(data.spotDateRange.end), 'dd.MM.yyyy', { locale: de });
    pdf.text(`${spotProfile.name} | Zeitraum: ${startStr} - ${endStr}`, 15, 23);
  } else {
    pdf.text(spotProfile.name, 15, 23);
  }

  y = 40;

  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.slate900);
  pdf.text('Kennzahlen', 15, y);
  y += 6;

  const hasHandlingFee = handlingFee > 0;
  const kpiCount = hasHandlingFee ? 4 : 3;
  const kpiBoxWidth = (pageWidth - 30 - (kpiCount - 1) * 4) / kpiCount;
  const kpiHeight = 32;

  pdf.setFillColor(colors.blue50);
  pdf.roundedRect(15, y, kpiBoxWidth, kpiHeight, 3, 3, 'F');
  pdf.setDrawColor(colors.blue300);
  pdf.setLineWidth(0.5);
  pdf.roundedRect(15, y, kpiBoxWidth, kpiHeight, 3, 3, 'S');

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.blue600);
  pdf.text(isProducer ? 'Gesamteinspeisung' : 'Gesamtverbrauch', 15 + kpiBoxWidth / 2, y + 8, { align: 'center' });
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.blue700);
  pdf.text(`${formatIntegerGerman(spot.totalConsumptionKwh)} kWh`, 15 + kpiBoxWidth / 2, y + 18, { align: 'center' });
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.slate500);
  pdf.text(`${formatNumberGerman(spot.totalConsumptionKwh / 1000)} MWh`, 15 + kpiBoxWidth / 2, y + 24, { align: 'center' });

  const box2X = 15 + kpiBoxWidth + 4;
  pdf.setFillColor(colors.yellow50);
  pdf.roundedRect(box2X, y, kpiBoxWidth, kpiHeight, 3, 3, 'F');
  pdf.setDrawColor('#f59e0b');
  pdf.setLineWidth(0.5);
  pdf.roundedRect(box2X, y, kpiBoxWidth, kpiHeight, 3, 3, 'S');

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor('#b45309');
  pdf.text('Ø Spotpreis', box2X + kpiBoxWidth / 2, y + 8, { align: 'center' });
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`${formatNumberGerman(spot.averagePriceCtKwh)} ct/kWh`, box2X + kpiBoxWidth / 2, y + 18, { align: 'center' });
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.slate500);
  pdf.text('gewichteter Durchschnitt', box2X + kpiBoxWidth / 2, y + 24, { align: 'center' });

  const box3X = box2X + kpiBoxWidth + 4;
  pdf.setFillColor(colors.green50);
  pdf.roundedRect(box3X, y, kpiBoxWidth, kpiHeight, 3, 3, 'F');
  pdf.setDrawColor(colors.green600);
  pdf.setLineWidth(0.5);
  pdf.roundedRect(box3X, y, kpiBoxWidth, kpiHeight, 3, 3, 'S');

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.green700);
  pdf.text(isProducer ? 'Gesamtgutschrift' : 'Gesamtkosten', box3X + kpiBoxWidth / 2, y + 8, { align: 'center' });
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`${formatNumberGerman(spot.totalCostEur)} EUR`, box3X + kpiBoxWidth / 2, y + 18, { align: 'center' });
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.slate500);
  pdf.text(isProducer ? 'Summe aller 15-Min-Gutschriften' : 'Summe aller 15-Min-Kosten', box3X + kpiBoxWidth / 2, y + 24, { align: 'center' });

  if (hasHandlingFee) {
    const box4X = box3X + kpiBoxWidth + 4;
    const handlingCostEur = -(spot.totalConsumptionKwh * handlingFee / 100);

    pdf.setFillColor(colors.yellow100);
    pdf.roundedRect(box4X, y, kpiBoxWidth, kpiHeight, 3, 3, 'F');
    pdf.setDrawColor(colors.amber500);
    pdf.setLineWidth(0.5);
    pdf.roundedRect(box4X, y, kpiBoxWidth, kpiHeight, 3, 3, 'S');

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor('#92400e');
    pdf.text('Handling Fee', box4X + kpiBoxWidth / 2, y + 8, { align: 'center' });
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${formatNumberGerman(handlingCostEur)} EUR`, box4X + kpiBoxWidth / 2, y + 18, { align: 'center' });
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.slate500);
    pdf.text(`${handlingFee} ct/kWh`, box4X + kpiBoxWidth / 2, y + 24, { align: 'center' });
  }

  y += kpiHeight + 10;

  if (hasHandlingFee) {
    const feeAmount = spot.totalConsumptionKwh * handlingFee / 100;
    const totalWithFee = isProducer ? spot.totalCostEur - feeAmount : spot.totalCostEur + feeAmount;

    pdf.setFillColor(colors.slate50);
    pdf.roundedRect(15, y, pageWidth - 30, 18, 3, 3, 'F');
    pdf.setDrawColor(colors.slate300);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(15, y, pageWidth - 30, 18, 3, 3, 'S');

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.slate900);
    pdf.text(isProducer ? 'Gesamtgutschrift inkl. Handling Fee:' : 'Gesamtkosten inkl. Handling Fee:', 20, y + 11);
    pdf.setFontSize(16);
    pdf.setTextColor(colors.blue700);
    pdf.text(`${formatNumberGerman(totalWithFee)} EUR`, pageWidth - 20, y + 11, { align: 'right' });

    y += 25;
  }

  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.slate900);
  pdf.text('Monatliche Auswertung', 15, y);
  y += 6;

  const colWidths = [45, 40, 40, 40];
  const tableWidth = pageWidth - 30;
  const headerBg = colors.slate100;

  pdf.setFillColor(headerBg);
  pdf.roundedRect(15, y, tableWidth, 8, 2, 2, 'F');

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.slate600);
  pdf.text('Monat', 20, y + 5);
  pdf.text(isProducer ? 'Einspeisung (kWh)' : 'Verbrauch (kWh)', 15 + colWidths[0] + colWidths[1] - 5, y + 5, { align: 'right' });
  pdf.text('Ø Preis (ct/kWh)', 15 + colWidths[0] + colWidths[1] + colWidths[2] - 5, y + 5, { align: 'right' });
  pdf.text(isProducer ? 'Gutschrift (EUR)' : 'Kosten (EUR)', pageWidth - 20, y + 5, { align: 'right' });
  y += 10;

  if (spot.monthlyResults && spot.monthlyResults.length > 0) {
    spot.monthlyResults.forEach((monthData, index) => {
      try {
        const [year, month] = monthData.month.split('-');
        const monthName = format(new Date(parseInt(year), parseInt(month) - 1), 'MMMM yyyy', { locale: de });

        if (index % 2 === 0) {
          pdf.setFillColor('#f8fafc');
          pdf.rect(15, y - 2, tableWidth, 7, 'F');
        }

        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(colors.slate900);
        pdf.text(monthName, 20, y + 3);

        pdf.setTextColor(colors.slate700);
        pdf.text(formatIntegerGerman(monthData.consumptionKwh), 15 + colWidths[0] + colWidths[1] - 5, y + 3, { align: 'right' });
        pdf.text(formatNumberGerman(monthData.avgPriceCtKwh), 15 + colWidths[0] + colWidths[1] + colWidths[2] - 5, y + 3, { align: 'right' });

        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(colors.slate900);
        pdf.text(formatNumberGerman(monthData.costEur), pageWidth - 20, y + 3, { align: 'right' });

        y += 7;
      } catch {
        y += 7;
      }
    });

    pdf.setDrawColor(colors.slate300);
    pdf.setLineWidth(0.5);
    pdf.line(15, y, pageWidth - 15, y);
    y += 2;

    pdf.setFillColor(colors.slate100);
    pdf.rect(15, y - 1, tableWidth, 8, 'F');

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.slate900);
    pdf.text('Gesamt', 20, y + 4);
    pdf.text(formatIntegerGerman(spot.totalConsumptionKwh), 15 + colWidths[0] + colWidths[1] - 5, y + 4, { align: 'right' });
    pdf.text(formatNumberGerman(spot.averagePriceCtKwh), 15 + colWidths[0] + colWidths[1] + colWidths[2] - 5, y + 4, { align: 'right' });
    pdf.text(formatNumberGerman(spot.totalCostEur), pageWidth - 20, y + 4, { align: 'right' });
  }

  if (data.spotEgComparisonPrice && data.spotEgComparisonPrice > 0) {
    generateSpotEgComparisonPage(pdf, data, spotProfile);
  }
}

function generateSpotEgComparisonPage(
  pdf: jsPDF,
  data: PDFReportData,
  spotProfile: ProfileData
) {
  pdf.addPage();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const spot = data.spotAnalysis!;
  const handlingFee = data.spotHandlingFee || 0;
  const egPrice = data.spotEgComparisonPrice!;
  const isProducer = spotProfile.profile_type === 'producer';
  let y = 0;

  pdf.setFillColor(colors.blue600);
  pdf.rect(0, 0, pageWidth, 30, 'F');

  pdf.setTextColor('#ffffff');
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Vergleich: Spot vs. EG-Preis', 15, 15);

  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  if (data.spotDateRange?.start && data.spotDateRange?.end) {
    const startStr = format(new Date(data.spotDateRange.start), 'dd.MM.yyyy', { locale: de });
    const endStr = format(new Date(data.spotDateRange.end), 'dd.MM.yyyy', { locale: de });
    pdf.text(`${spotProfile.name} | Zeitraum: ${startStr} - ${endStr}`, 15, 23);
  } else {
    pdf.text(spotProfile.name, 15, 23);
  }

  y = 40;

  const feeAmount = spot.totalConsumptionKwh * handlingFee / 100;
  const spotTotal = isProducer ? spot.totalCostEur - feeAmount : spot.totalCostEur + feeAmount;
  const egTotal = spot.totalConsumptionKwh * egPrice / 100;
  const difference = egTotal - spotTotal;
  const spotIsBetter = isProducer ? spotTotal > egTotal : spotTotal < egTotal;

  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.slate900);
  pdf.text('Gesamtvergleich', 15, y);
  y += 8;

  const boxWidth = (pageWidth - 38) / 3;

  // Spot box
  pdf.setFillColor(colors.blue50);
  pdf.roundedRect(15, y, boxWidth, 36, 3, 3, 'F');
  pdf.setDrawColor(colors.blue300);
  pdf.setLineWidth(0.5);
  pdf.roundedRect(15, y, boxWidth, 36, 3, 3, 'S');

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.blue600);
  const spotLabel = `Spot-${isProducer ? 'Gutschrift' : 'Kosten'}${handlingFee > 0 ? ' (inkl. Fee)' : ''}`;
  pdf.text(spotLabel, 15 + boxWidth / 2, y + 9, { align: 'center' });
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.blue700);
  pdf.text(`${formatNumberGerman(spotTotal)} EUR`, 15 + boxWidth / 2, y + 20, { align: 'center' });
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.slate500);
  pdf.text(`Ø ${formatNumberGerman(isProducer ? spot.averagePriceCtKwh - handlingFee : spot.averagePriceCtKwh + handlingFee)} ct/kWh`, 15 + boxWidth / 2, y + 28, { align: 'center' });

  // EG box
  const egBoxX = 15 + boxWidth + 4;
  pdf.setFillColor(colors.yellow50);
  pdf.roundedRect(egBoxX, y, boxWidth, 36, 3, 3, 'F');
  pdf.setDrawColor('#f59e0b');
  pdf.setLineWidth(0.5);
  pdf.roundedRect(egBoxX, y, boxWidth, 36, 3, 3, 'S');

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor('#b45309');
  pdf.text(`EG-${isProducer ? 'Gutschrift' : 'Kosten'}`, egBoxX + boxWidth / 2, y + 9, { align: 'center' });
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor('#92400e');
  pdf.text(`${formatNumberGerman(egTotal)} EUR`, egBoxX + boxWidth / 2, y + 20, { align: 'center' });
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.slate500);
  pdf.text(`Festpreis: ${formatNumberGerman(egPrice)} ct/kWh`, egBoxX + boxWidth / 2, y + 28, { align: 'center' });

  // Difference box
  const diffBoxX = egBoxX + boxWidth + 4;
  const diffBg = spotIsBetter ? '#fef2f2' : colors.green50;
  const diffBorder = spotIsBetter ? '#fca5a5' : colors.green300;
  const diffTextColor = spotIsBetter ? colors.red600 : colors.green600;

  pdf.setFillColor(diffBg);
  pdf.roundedRect(diffBoxX, y, boxWidth, 36, 3, 3, 'F');
  pdf.setDrawColor(diffBorder);
  pdf.setLineWidth(0.5);
  pdf.roundedRect(diffBoxX, y, boxWidth, 36, 3, 3, 'S');

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(diffTextColor);
  pdf.text(spotIsBetter ? 'Vorteil Spot' : 'Vorteil EG', diffBoxX + boxWidth / 2, y + 9, { align: 'center' });
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`${formatNumberGerman(Math.abs(difference))} EUR`, diffBoxX + boxWidth / 2, y + 20, { align: 'center' });
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.slate500);
  const diffDesc = isProducer
    ? (spotIsBetter ? 'Spot-Gutschrift hoeher' : 'EG-Gutschrift hoeher')
    : (spotIsBetter ? 'Spot-Kosten niedriger' : 'EG-Kosten niedriger');
  pdf.text(diffDesc, diffBoxX + boxWidth / 2, y + 28, { align: 'center' });

  y += 46;

  // Monthly comparison table
  if (spot.monthlyResults && spot.monthlyResults.length > 0) {
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.slate900);
    pdf.text('Monatlicher Vergleich', 15, y);
    y += 6;

    const tableWidth = pageWidth - 30;

    pdf.setFillColor(colors.slate100);
    pdf.roundedRect(15, y, tableWidth, 8, 2, 2, 'F');

    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.slate600);
    pdf.text('Monat', 20, y + 5);
    pdf.text(isProducer ? 'Einspeisung (kWh)' : 'Verbrauch (kWh)', 75, y + 5, { align: 'right' });
    pdf.text(`Spot${handlingFee > 0 ? ' + Fee' : ''} (EUR)`, 115, y + 5, { align: 'right' });
    pdf.text('EG (EUR)', 150, y + 5, { align: 'right' });
    pdf.text('Differenz (EUR)', pageWidth - 20, y + 5, { align: 'right' });
    y += 10;

    spot.monthlyResults.forEach((monthData, index) => {
      try {
        const [year, month] = monthData.month.split('-');
        const monthName = format(new Date(parseInt(year), parseInt(month) - 1), 'MMM yyyy', { locale: de });

        if (index % 2 === 0) {
          pdf.setFillColor('#f8fafc');
          pdf.rect(15, y - 2, tableWidth, 7, 'F');
        }

        const monthFeeAmount = monthData.consumptionKwh * handlingFee / 100;
        const monthSpot = isProducer ? monthData.costEur - monthFeeAmount : monthData.costEur + monthFeeAmount;
        const monthEg = monthData.consumptionKwh * egPrice / 100;
        const monthDiff = monthEg - monthSpot;

        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(colors.slate900);
        pdf.text(monthName, 20, y + 3);

        pdf.setTextColor(colors.slate700);
        pdf.text(formatIntegerGerman(monthData.consumptionKwh), 75, y + 3, { align: 'right' });
        pdf.text(formatNumberGerman(monthSpot), 115, y + 3, { align: 'right' });
        pdf.text(formatNumberGerman(monthEg), 150, y + 3, { align: 'right' });

        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(monthDiff >= 0 ? colors.green600 : colors.red600);
        pdf.text(formatNumberGerman(monthDiff), pageWidth - 20, y + 3, { align: 'right' });

        y += 7;
      } catch {
        y += 7;
      }
    });

    // Total row
    pdf.setDrawColor(colors.slate300);
    pdf.setLineWidth(0.5);
    pdf.line(15, y, pageWidth - 15, y);
    y += 2;

    pdf.setFillColor(colors.slate100);
    pdf.rect(15, y - 1, tableWidth, 8, 'F');

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.slate900);
    pdf.text('Gesamt', 20, y + 4);
    pdf.text(formatIntegerGerman(spot.totalConsumptionKwh), 75, y + 4, { align: 'right' });
    pdf.text(formatNumberGerman(spotTotal), 115, y + 4, { align: 'right' });
    pdf.text(formatNumberGerman(egTotal), 150, y + 4, { align: 'right' });

    pdf.setTextColor(difference >= 0 ? colors.green600 : colors.red600);
    pdf.text(formatNumberGerman(difference), pageWidth - 20, y + 4, { align: 'right' });

    y += 15;
  }

  // Parameters box
  pdf.setFillColor(colors.slate50);
  pdf.roundedRect(15, y, pageWidth - 30, 20, 3, 3, 'F');
  pdf.setDrawColor(colors.slate300);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(15, y, pageWidth - 30, 20, 3, 3, 'S');

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.slate700);
  pdf.text('Parameter', 20, y + 7);

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.slate600);
  pdf.text(`EG-Preis: ${formatNumberGerman(egPrice)} ct/kWh`, 20, y + 14);
  if (handlingFee > 0) {
    pdf.text(`Handling Fee: ${formatNumberGerman(handlingFee)} ct/kWh`, 80, y + 14);
  }
  pdf.text(`Ø Spotpreis (gewichtet): ${formatNumberGerman(spot.averagePriceCtKwh)} ct/kWh`, handlingFee > 0 ? 140 : 80, y + 14);
}

function generateFixedPriceAnalysisPage(
  pdf: jsPDF,
  data: PDFReportData
) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const fix = data.fixedPriceAnalysis!;
  const isProducer = fix.isProducer;
  let y = 0;

  pdf.setFillColor(colors.green600);
  pdf.rect(0, 0, pageWidth, 30, 'F');

  pdf.setTextColor('#ffffff');
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Fixpreis-Analyse', 15, 15);

  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  if (fix.dateRange?.start && fix.dateRange?.end) {
    const startStr = format(new Date(fix.dateRange.start), 'dd.MM.yyyy', { locale: de });
    const endStr = format(new Date(fix.dateRange.end), 'dd.MM.yyyy', { locale: de });
    pdf.text(`Zeitraum: ${startStr} - ${endStr}`, 15, 23);
  }

  y = 40;

  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.slate900);
  pdf.text('Vergleich Fixpreis jetzt vs. neu', 15, y);
  y += 6;

  // KPI-Boxen: Gesamtverbrauch, Kosten jetzt, Kosten neu, Ersparnis
  const kpiCount = 4;
  const kpiBoxWidth = (pageWidth - 30 - (kpiCount - 1) * 4) / kpiCount;
  const kpiHeight = 32;

  // Box 1: Gesamtverbrauch / Gesamteinspeisung
  pdf.setFillColor(colors.blue50);
  pdf.roundedRect(15, y, kpiBoxWidth, kpiHeight, 3, 3, 'F');
  pdf.setDrawColor(colors.blue300);
  pdf.setLineWidth(0.5);
  pdf.roundedRect(15, y, kpiBoxWidth, kpiHeight, 3, 3, 'S');
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.blue600);
  pdf.text(isProducer ? 'Gesamteinspeisung' : 'Gesamtverbrauch', 15 + kpiBoxWidth / 2, y + 8, { align: 'center' });
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.blue700);
  pdf.text(`${formatIntegerGerman(fix.totalKwh)} kWh`, 15 + kpiBoxWidth / 2, y + 18, { align: 'center' });
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.slate500);
  pdf.text(`${formatNumberGerman(fix.totalKwh / 1000)} MWh`, 15 + kpiBoxWidth / 2, y + 24, { align: 'center' });

  // Box 2: Kosten / Gutschrift jetzt
  const box2X = 15 + kpiBoxWidth + 4;
  pdf.setFillColor(colors.cyan50);
  pdf.roundedRect(box2X, y, kpiBoxWidth, kpiHeight, 3, 3, 'F');
  pdf.setDrawColor(colors.cyan500);
  pdf.setLineWidth(0.5);
  pdf.roundedRect(box2X, y, kpiBoxWidth, kpiHeight, 3, 3, 'S');
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor('#0e7490');
  pdf.text(isProducer ? 'Gutschrift jetzt' : 'Kosten jetzt', box2X + kpiBoxWidth / 2, y + 8, { align: 'center' });
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`${formatNumberGerman(fix.costNow)} EUR`, box2X + kpiBoxWidth / 2, y + 18, { align: 'center' });
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.slate500);
  pdf.text(`${formatNumberGerman(fix.priceNow)} ct/kWh`, box2X + kpiBoxWidth / 2, y + 24, { align: 'center' });

  // Box 3: Kosten / Gutschrift neu
  const box3X = box2X + kpiBoxWidth + 4;
  pdf.setFillColor(colors.yellow50);
  pdf.roundedRect(box3X, y, kpiBoxWidth, kpiHeight, 3, 3, 'F');
  pdf.setDrawColor(colors.amber500);
  pdf.setLineWidth(0.5);
  pdf.roundedRect(box3X, y, kpiBoxWidth, kpiHeight, 3, 3, 'S');
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor('#b45309');
  pdf.text(isProducer ? 'Gutschrift neu' : 'Kosten neu', box3X + kpiBoxWidth / 2, y + 8, { align: 'center' });
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`${formatNumberGerman(fix.costNew)} EUR`, box3X + kpiBoxWidth / 2, y + 18, { align: 'center' });
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.slate500);
  pdf.text(`${formatNumberGerman(fix.priceNew)} ct/kWh`, box3X + kpiBoxWidth / 2, y + 24, { align: 'center' });

  // Box 4: Ersparnis / Mehrkosten
  const isImprovement = fix.savings > 0;
  const box4X = box3X + kpiBoxWidth + 4;
  pdf.setFillColor(isImprovement ? colors.green50 : '#fef2f2');
  pdf.roundedRect(box4X, y, kpiBoxWidth, kpiHeight, 3, 3, 'F');
  pdf.setDrawColor(isImprovement ? colors.green600 : colors.red600);
  pdf.setLineWidth(0.5);
  pdf.roundedRect(box4X, y, kpiBoxWidth, kpiHeight, 3, 3, 'S');
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(isImprovement ? colors.green700 : '#b91c1c');
  pdf.text(isImprovement ? 'Ersparnis' : 'Mehrkosten', box4X + kpiBoxWidth / 2, y + 8, { align: 'center' });
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`${formatNumberGerman(Math.abs(fix.savings))} EUR`, box4X + kpiBoxWidth / 2, y + 18, { align: 'center' });
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.slate500);
  pdf.text('jetzt vs. neu', box4X + kpiBoxWidth / 2, y + 24, { align: 'center' });

  y += kpiHeight + 12;

  // Ergebnis-Zusammenfassung
  pdf.setFillColor(isImprovement ? colors.green50 : '#fef2f2');
  pdf.roundedRect(15, y, pageWidth - 30, 22, 3, 3, 'F');
  pdf.setDrawColor(isImprovement ? colors.green600 : colors.red600);
  pdf.setLineWidth(0.4);
  pdf.roundedRect(15, y, pageWidth - 30, 22, 3, 3, 'S');

  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.slate900);
  const fixPriceLabel = `neuem Fixpreis (${formatNumberGerman(fix.priceNew)} ct/kWh):`;
  const resultLabel = isImprovement
    ? (isProducer ? `Höhere Gutschrift mit ${fixPriceLabel}` : `Einsparung mit ${fixPriceLabel}`)
    : (isProducer ? `Geringere Gutschrift mit ${fixPriceLabel}` : `Mehrkosten mit ${fixPriceLabel}`);
  pdf.text(resultLabel, 20, y + 9);
  pdf.setFontSize(16);
  pdf.setTextColor(isImprovement ? colors.green700 : '#b91c1c');
  pdf.text(`${formatNumberGerman(Math.abs(fix.savings))} EUR`, pageWidth - 20, y + 9, { align: 'right' });

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.slate600);
  pdf.text(
    `${formatIntegerGerman(fix.totalKwh)} kWh x (${formatNumberGerman(fix.priceNow)} - ${formatNumberGerman(fix.priceNew)}) ct/kWh`,
    20, y + 17
  );
}

function addFooters(pdf: jsPDF, hasSpotComparison: boolean) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const totalPages = pdf.internal.pages.length - 1;

  const disclaimerText = hasSpotComparison
    ? [
        'Dieser Bericht wurde auf Basis der bereitgestellten Lastprofile und historischen EPEX Spot-Preise erstellt.',
        'Alle Berechnungen und Prognosen sind unverbindlich und stellen keine Garantie fuer zukünftige Entwicklungen dar.',
        'Eine Haftung für die Richtigkeit und Vollständigkeit wird nicht übernommen.'
      ]
    : [
        'Dieser Bericht basiert auf den bereitgestellten Lastprofilen. Alle Angaben sind unverbindlich und ohne Gewähr.',
        'Keine Haftung für Richtigkeit und Vollständigkeit.'
      ];

  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);

    const footerHeight = 15 + (disclaimerText.length * 3);

    pdf.setFillColor(colors.slate100);
    pdf.rect(0, pageHeight - footerHeight, pageWidth, footerHeight, 'F');

    pdf.setDrawColor(colors.slate300);
    pdf.setLineWidth(0.2);
    pdf.line(0, pageHeight - footerHeight, pageWidth, pageHeight - footerHeight);


    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.slate600);
    pdf.text(`Seite ${i} von ${totalPages}`, pageWidth - 15, pageHeight - footerHeight + 7, { align: 'right' });

    pdf.setFontSize(6);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.slate500);

    let textY = pageHeight - footerHeight + 13;
    disclaimerText.forEach((line) => {
      pdf.text(line, 15, textY, { maxWidth: pageWidth - 30 });
      textY += 3;
    });
  }
}
