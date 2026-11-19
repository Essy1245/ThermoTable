import type { ThermoTableData } from '../types';

export const tableA2a: ThermoTableData = {
  type: 'specific_heat_300k',
  name: 'Table A-2(a): Ideal-gas specific heats of various common gases — At 300 K',
  substance: 'Common Gases',
  rows: [
    { substance: 'Air', formula: '—', R: { v: 0.2870, s: '0.2870' }, cp: { v: 1.005, s: '1.005' }, cv: { v: 0.718, s: '0.718' }, k: { v: 1.400, s: '1.400' } },
    { substance: 'Argon', formula: 'Ar', R: { v: 0.2081, s: '0.2081' }, cp: { v: 0.5203, s: '0.5203' }, cv: { v: 0.3122, s: '0.3122' }, k: { v: 1.667, s: '1.667' } },
    { substance: 'Butane', formula: 'C₄H₁₀', R: { v: 0.1433, s: '0.1433' }, cp: { v: 1.7164, s: '1.7164' }, cv: { v: 1.5734, s: '1.5734' }, k: { v: 1.091, s: '1.091' } },
    { substance: 'Carbon dioxide', formula: 'CO₂', R: { v: 0.1889, s: '0.1889' }, cp: { v: 0.846, s: '0.846' }, cv: { v: 0.657, s: '0.657' }, k: { v: 1.289, s: '1.289' } },
    { substance: 'Carbon monoxide', formula: 'CO', R: { v: 0.2968, s: '0.2968' }, cp: { v: 1.040, s: '1.040' }, cv: { v: 0.744, s: '0.744' }, k: { v: 1.400, s: '1.400' } },
    { substance: 'Ethane', formula: 'C₂H₆', R: { v: 0.2765, s: '0.2765' }, cp: { v: 1.7662, s: '1.7662' }, cv: { v: 1.4897, s: '1.4897' }, k: { v: 1.186, s: '1.186' } },
    { substance: 'Ethylene', formula: 'C₂H₄', R: { v: 0.2964, s: '0.2964' }, cp: { v: 1.5482, s: '1.5482' }, cv: { v: 1.2518, s: '1.2518' }, k: { v: 1.237, s: '1.237' } },
    { substance: 'Helium', formula: 'He', R: { v: 2.0769, s: '2.0769' }, cp: { v: 5.1926, s: '5.1926' }, cv: { v: 3.1156, s: '3.1156' }, k: { v: 1.667, s: '1.667' } },
    { substance: 'Hydrogen', formula: 'H₂', R: { v: 4.1240, s: '4.1240' }, cp: { v: 14.307, s: '14.307' }, cv: { v: 10.183, s: '10.183' }, k: { v: 1.405, s: '1.405' } },
    { substance: 'Methane', formula: 'CH₄', R: { v: 0.5182, s: '0.5182' }, cp: { v: 2.2537, s: '2.2537' }, cv: { v: 1.7354, s: '1.7354' }, k: { v: 1.299, s: '1.299' } },
    { substance: 'Neon', formula: 'Ne', R: { v: 0.4119, s: '0.4119' }, cp: { v: 1.0299, s: '1.0299' }, cv: { v: 0.6179, s: '0.6179' }, k: { v: 1.667, s: '1.667' } },
    { substance: 'Nitrogen', formula: 'N₂', R: { v: 0.2968, s: '0.2968' }, cp: { v: 1.039, s: '1.039' }, cv: { v: 0.743, s: '0.743' }, k: { v: 1.400, s: '1.400' } },
    { substance: 'Octane', formula: 'C₈H₁₈', R: { v: 0.0729, s: '0.0729' }, cp: { v: 1.7113, s: '1.7113' }, cv: { v: 1.6385, s: '1.6385' }, k: { v: 1.044, s: '1.044' } },
    { substance: 'Oxygen', formula: 'O₂', R: { v: 0.2598, s: '0.2598' }, cp: { v: 0.918, s: '0.918' }, cv: { v: 0.658, s: '0.658' }, k: { v: 1.395, s: '1.395' } },
    { substance: 'Propane', formula: 'C₃H₈', R: { v: 0.1885, s: '0.1885' }, cp: { v: 1.6794, s: '1.6794' }, cv: { v: 1.4909, s: '1.4909' }, k: { v: 1.126, s: '1.126' } },
    { substance: 'Steam', formula: 'H₂O', R: { v: 0.4615, s: '0.4615' }, cp: { v: 1.8723, s: '1.8723' }, cv: { v: 1.4108, s: '1.4108' }, k: { v: 1.327, s: '1.327' } },
  ],
};

export default tableA2a;
