// Default config; merged under whatever `config` block the extension doc provides.
export const DEFAULT_CONFIG = {
  chickenContactType: 'chicken',
  weightForm: 'weight_check',
  healthForm: 'health_check',
  weightField: 'weight_g',
  conditionField: 'condition',
  noteField: 'note',
  marketWeightG: 2700,
  underweightThreshold: 0.85,
  staleWeighInDays: 4,
  targetCurve: [
    { day: 0, g: 43 }, { day: 7, g: 180 }, { day: 14, g: 460 }, { day: 21, g: 930 },
    { day: 28, g: 1550 }, { day: 35, g: 2200 }, { day: 42, g: 2900 }, { day: 49, g: 3500 },
  ],
  accentColor: '#E8A33D',
};

export const STATUS = {
  healthy: { label: 'Healthy', color: '#3FA66B' },
  watch: { label: 'Watch', color: '#E8A33D' },
  sick: { label: 'Sick', color: '#E2553B' },
  deceased: { label: 'Deceased', color: '#9AA0A6' },
  processed: { label: 'Processed', color: '#5B8DEF' },
};
