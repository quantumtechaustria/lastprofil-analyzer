/**
 * Formatiert Zahlen im deutschen Format:
 * - Punkt als Tausendertrennzeichen
 * - Komma als Dezimaltrennzeichen
 * - 2 Nachkommastellen
 */
export const formatNumberGerman = (value: number): string => {
  if (isNaN(value) || !isFinite(value)) {
    return '0,00';
  }
  return value.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

/**
 * Formatiert große Zahlen (MWh, etc.) im deutschen Format
 */
export const formatLargeNumberGerman = (value: number): string => {
  if (isNaN(value) || !isFinite(value)) {
    return '0,0';
  }
  return value.toLocaleString('de-DE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
};

/**
 * Formatiert Zahlen ohne Nachkommastellen im deutschen Format
 */
export const formatIntegerGerman = (value: number): string => {
  if (isNaN(value) || !isFinite(value)) {
    return '0';
  }
  return Math.round(value).toLocaleString('de-DE');
};

/**
 * Formatiert Zahlen mit 3 Nachkommastellen im deutschen Format
 */
export const formatNumberGerman3Decimals = (value: number): string => {
  if (isNaN(value) || !isFinite(value)) {
    return '0,000';
  }
  return value.toLocaleString('de-DE', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
  });
};

export function utcToCETDate(date: Date): Date {
  const localOffset = date.getTimezoneOffset();
  const isCET = localOffset === -60 || localOffset === -120;
  if (isCET) return date;

  const cetFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Vienna',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = cetFormatter.formatToParts(date);
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0');
  return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
}