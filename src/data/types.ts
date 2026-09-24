export interface ThermoValue {
  /** The numeric value used for mathematical operations, interpolation, and plotting. */
  v: number;
  /** The exact string representation from the PDF to preserve significant figures and trailing zeros. */
  s: string;
}

export interface SaturatedTableRow {
  T?: ThermoValue;
  P?: ThermoValue;
  
  // Specific Volume (m^3/kg)
  vf?: ThermoValue;
  vg?: ThermoValue;
  vi?: ThermoValue; // for ice-water
  
  // Internal Energy (kJ/kg)
  uf?: ThermoValue;
  ufg?: ThermoValue;
  ug?: ThermoValue;
  ui?: ThermoValue;
  uig?: ThermoValue;
  
  // Enthalpy (kJ/kg)
  hf?: ThermoValue;
  hfg?: ThermoValue;
  hg?: ThermoValue;
  hi?: ThermoValue;
  hig?: ThermoValue;
  
  // Entropy (kJ/kg·K)
  sf?: ThermoValue;
  sfg?: ThermoValue;
  sg?: ThermoValue;
  si?: ThermoValue;
  sig?: ThermoValue;
}

export interface SaturatedTable {
  type: 'saturated';
  name: string;      // e.g., "Table A-4: Saturated water—Temperature table"
  substance: string; // e.g., "Water", "Refrigerant 134a"
  indexProperty: 'T' | 'P';
  rows: SaturatedTableRow[];
}

export interface SuperheatedTableRow {
  T?: ThermoValue; // Can be undefined for the saturation state row if labeled just "Sat."
  isSaturationState: boolean;
  v: ThermoValue; // m^3/kg
  u: ThermoValue; // kJ/kg
  h: ThermoValue; // kJ/kg
  s: ThermoValue; // kJ/kg·K
}

export interface SuperheatedBlock {
  P: ThermoValue;     // Pressure of the isobar (MPa usually)
  Tsat: ThermoValue;  // Saturation temperature at pressure P (°C)
  rows: SuperheatedTableRow[];
}

export interface SuperheatedTable {
  type: 'superheated' | 'compressed';
  name: string;
  substance: string;
  blocks: SuperheatedBlock[];
}

export interface IdealGasAirRow {
  T: ThermoValue;      // K
  h: ThermoValue;      // kJ/kg
  u: ThermoValue;      // kJ/kg
  s_deg: ThermoValue;  // s° (kJ/kg·K)
  s_plus?: ThermoValue; // Additional field as mentioned (could correspond to pr/vr or other quantities)
  pr?: ThermoValue;    // Relative pressure
  vr?: ThermoValue;    // Relative specific volume
}

export interface IdealGasAirTable {
  type: 'ideal_gas_air';
  name: string;
  substance: 'Air';
  rows: IdealGasAirRow[];
}

export interface IdealGasMolarRow {
  T: ThermoValue;           // K
  h_bar: ThermoValue;       // h-bar (kJ/kmol)
  u_bar: ThermoValue;       // u-bar (kJ/kmol)
  s_bar_deg: ThermoValue;   // s-bar° (kJ/kmol·K)
}

export interface IdealGasMolarTable {
  type: 'ideal_gas_molar';
  name: string;
  substance: string; // e.g., "N2", "O2", "CO2", etc.
  rows: IdealGasMolarRow[];
}

/** 
 * A discriminated union representing any of the supported thermodynamic tables.
 */
export type ThermoTableData = 
  | SaturatedTable 
  | SuperheatedTable 
  | IdealGasAirTable 
  | IdealGasMolarTable;
