export type ProfileType = 'consumer' | 'producer' | 'unknown';

export const mapEnergyDirectionToProfileType = (energyDirection?: string): ProfileType => {
  if (!energyDirection) return 'unknown';

  const normalized = energyDirection.toLowerCase().trim();

  if (normalized.includes('verbrauch') || normalized.includes('consumption')) {
    return 'consumer';
  }

  if (normalized.includes('einspeisung') || normalized.includes('erzeugung') ||
      normalized.includes('production') || normalized.includes('generation')) {
    return 'producer';
  }

  return 'unknown';
};
