export interface ThermoValue {
  /** The numeric value used for mathematical operations, interpolation, and plotting. */
  v: number;
  /** The exact string representation from the PDF to preserve significant figures and trailing zeros. */
  s: string;
}

export interface CriticalPropertiesRow {
  substance: string;
  formula: string;
  M: ThermoValue;    // Molar mass (kg/kmol)
  R: ThermoValue;    // Gas constant (kJ/kg·K)
  T_cr: ThermoValue; // Critical-point temperature (K natively)
  P_cr: ThermoValue; // Critical-point pressure (MPa natively)
  v_cr: ThermoValue; // Critical-point volume (m³/kmol)
}

export interface CriticalPropertiesTable {
  type: 'critical_properties';
  name: string;
  substance: string;
  rows: CriticalPropertiesRow[];
}

export interface SpecificHeat300KRow {
  substance: string;
  formula: string;
  R: ThermoValue;  // Gas constant (kJ/kg·K)
  cp: ThermoValue; // Specific heat at constant pressure (kJ/kg·K)
  cv: ThermoValue; // Specific heat at constant volume (kJ/kg·K)
  k: ThermoValue;  // Specific heat ratio (cp/cv)
}

export interface SpecificHeat300KTable {
  type: 'specific_heat_300k';
  name: string;
  substance: string;
  rows: SpecificHeat300KRow[];
}

export interface GasSpecificHeatTriplet {
  cp: ThermoValue; // kJ/kg·K
  cv: ThermoValue; // kJ/kg·K
  k: ThermoValue;
}

export interface SpecificHeatTempRow {
  T: ThermoValue; // Temperature (K natively)
  air: GasSpecificHeatTriplet;
  co2: GasSpecificHeatTriplet;
  co: GasSpecificHeatTriplet;
  h2: GasSpecificHeatTriplet;
  n2: GasSpecificHeatTriplet;
  o2: GasSpecificHeatTriplet;
}

export interface SpecificHeatTempTable {
  type: 'specific_heat_temp';
  name: string;
  substance: string;
  rows: SpecificHeatTempRow[];
}

export interface SpecificHeatPolyRow {
  substance: string;
  formula: string;
  a: ThermoValue;
  b: ThermoValue;
  c: ThermoValue;
  d: ThermoValue;
  T_min: ThermoValue; // K natively
  T_max: ThermoValue; // K natively
  errorMax: ThermoValue; // % error Max.
  errorAvg: ThermoValue; // % error Avg.
}

export interface SpecificHeatPolyTable {
  type: 'specific_heat_poly';
  name: string;
  substance: string;
  rows: SpecificHeatPolyRow[];
}

export interface LiquidPropertiesRow {
  substance: string;
  isContinuation?: boolean;
  T_boil?: ThermoValue;     // Normal boiling point (°C natively)
  T_boil_max?: ThermoValue; // Upper bound when boiling point is a range (e.g., Kerosene 204–293 °C)
  T_boil_note?: string;     // Optional note suffix (e.g., "*" for Carbon dioxide sublimation temp)
  h_fg?: ThermoValue;       // Latent heat of vaporization (kJ/kg)
  h_fg_max?: ThermoValue;   // Upper bound when h_fg is a range (e.g., Petroleum 230–384 kJ/kg)
  h_fg_note?: string;       // Optional note suffix (e.g., " (at 0°C)" for Carbon dioxide)
  T_freeze?: ThermoValue;   // Freezing point (°C natively)
  h_if?: ThermoValue;       // Latent heat of fusion (kJ/kg)
  T_liq: ThermoValue;       // Liquid properties temperature (°C natively)
  rho: ThermoValue;         // Density (kg/m³)
  cp: ThermoValue;          // Specific heat (kJ/kg·K)
}

export interface LiquidPropertiesTable {
  type: 'liquids';
  name: string;
  substance: string;
  footnote?: string;
  rows: LiquidPropertiesRow[];
}

export interface SolidPropertiesRow {
  category: 'Metals' | 'Nonmetals';
  substance: string;
  isContinuation?: boolean;
  T?: ThermoValue;          // Temperature if specified (otherwise room temperature)
  T_nativeUnit?: 'K' | 'C'; // Native unit in textbook ('K' for Aluminum/Ice, 'C' for Copper/Fireclay brick)
  rho?: ThermoValue;        // Density (kg/m³)
  cp: ThermoValue;          // Specific heat (kJ/kg·K)
}

export interface SolidPropertiesTable {
  type: 'solids';
  name: string;
  substance: string;
  rows: SolidPropertiesRow[];
}

export interface FoodPropertiesRow {
  substance: string;
  waterContent: ThermoValue; // Water content, % (mass)
  T_freeze?: ThermoValue;    // Freezing point (°C natively)
  cp_above?: ThermoValue;    // Specific heat above freezing (kJ/kg·K)
  cp_below: ThermoValue;     // Specific heat below freezing (kJ/kg·K)
  h_if: ThermoValue;         // Latent heat of fusion (kJ/kg)
}

export interface FoodPropertiesTable {
  type: 'foods';
  name: string;
  substance: string;
  footnote?: string;
  rows: FoodPropertiesRow[];
}

export interface SaturatedTableRow {
  T?: ThermoValue;
  P?: ThermoValue;
  
  // Specific Volume (m^3/kg)
  vf?: ThermoValue;
  vg?: ThermoValue;
  
  // Internal Energy (kJ/kg)
  uf?: ThermoValue;
  ufg?: ThermoValue;
  ug?: ThermoValue;
  
  // Enthalpy (kJ/kg)
  hf?: ThermoValue;
  hfg?: ThermoValue;
  hg?: ThermoValue;
  
  // Entropy (kJ/kg·K)
  sf?: ThermoValue;
  sfg?: ThermoValue;
  sg?: ThermoValue;
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
  substance: string; // e.g., "N2", "O2"
  rows: IdealGasMolarRow[];
}

/** 
 * A discriminated union representing any of the supported thermodynamic tables.
 */
export type ThermoTableData = 
  | CriticalPropertiesTable
  | SpecificHeat300KTable
  | SpecificHeatTempTable
  | SpecificHeatPolyTable
  | LiquidPropertiesTable
  | SolidPropertiesTable
  | FoodPropertiesTable
  | SaturatedTable 
  | SuperheatedTable 
  | IdealGasAirTable 
  | IdealGasMolarTable;
