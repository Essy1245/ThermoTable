import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { SUPPORTED_TABLES } from './data/tablesMeta';
import { getTableData } from './data/tables';
import { formatPressure } from './data/pressureUnits';
import type { 
  IdealGasAirRow, 
  IdealGasMolarRow, 
  ThermoValue,
  LiquidPropertiesRow,
  SolidPropertiesRow,
} from './data/types';
import { Info, Highlighter, Search, ChevronDown, ChevronRight, Layers, Check, X, Pin, Crop, Plus, Menu } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SnippetModal } from './snippet/SnippetModal';
import { getJumpOptions, findNearestRow } from './jump';
import { InterpolatedRowGroup, ActionMenuModal, type VisibleTableCol } from './InterpolatedRows';
import {
  isProgressiveTable,
  getProgressiveColumns,
  solveInterpolatedRow,
  findBoundingRowGap,
  type InterpolatedRowSpec,
} from './interpolation';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TooltipState {
  text: string;
  x: number;
  y: number;
}

function TooltipPortal({ tooltip }: { tooltip: TooltipState | null }) {
  if (!tooltip) return null;
  return ReactDOM.createPortal(
    <div
      style={{
        position: 'fixed',
        left: tooltip.x,
        top: tooltip.y,
        zIndex: 99999,
        pointerEvents: 'none',
        transform: 'translateX(-50%)',
      }}
      className="bg-gray-900 dark:bg-gray-800 text-white dark:text-gray-100 text-xs rounded-md shadow-2xl px-3 py-2 ring-1 ring-white/10 dark:ring-white/20 max-w-[220px] w-max whitespace-normal break-words"
    >
      {tooltip.text}
    </div>,
    document.body
  );
}

type TempUnit = 'C' | 'K';
type PressUnit = 'kPa' | 'MPa' | 'bar';

const TOOLTIPS: Record<string, string> = {
  'vf': 'The substance is 100% liquid and on the exact verge of boiling.',
  'vfg': 'The difference in specific volume between vapor and liquid phases.',
  'vg': 'The substance is 100% vapor and on the exact verge of condensing.',
  'uf': 'Internal energy of saturated liquid.',
  'ufg': 'Internal energy of vaporization.',
  'ug': 'Internal energy of saturated vapor.',
  'hf': 'Enthalpy of saturated liquid.',
  'hfg': 'The property difference between vapor and liquid phases. Represents the boiling process.',
  'hg': 'Enthalpy of saturated vapor.',
  'sf': 'Entropy of saturated liquid.',
  'sfg': 'Entropy of vaporization.',
  'sg': 'Entropy of saturated vapor.',
  'T': 'Temperature.',
  'P': 'Saturation Pressure. If actual P > Sat Press, it is a compressed liquid. If actual P < Sat Press, it is a superheated vapor.',
  'v': 'Specific Volume (m³/kg): Volume occupied per unit mass.',
  'u': 'Internal Energy (kJ/kg): Specific internal energy.',
  'h': 'Enthalpy (kJ/kg): Total heat content (h = u + Pv).',
  's': 'Entropy (kJ/kg·K): Specific entropy.',
  's_deg': 'Standard-state entropy function s° (kJ/kg·K).',
  's_plus': 'Entropy function s+ (kJ/kg·K).',
  'h_bar': 'Molar enthalpy h̄ (kJ/kmol).',
  'u_bar': 'Molar internal energy ū (kJ/kmol).',
  's_bar_deg': 'Molar standard-state entropy s̄° (kJ/kmol·K).',
  'M': 'Molar mass M (kg/kmol).',
  'R': 'Specific gas constant R = R_u / M (kJ/kg·K).',
  'T_cr': 'Critical-point temperature above which distinct liquid and gas phases do not exist.',
  'P_cr': 'Critical-point pressure required to liquefy a vapor at its critical temperature.',
  'v_cr': 'Molar specific volume at the critical point (m³/kmol).',
  'cp': 'Specific heat at constant pressure cp (kJ/kg·K).',
  'cv': 'Specific heat at constant volume cv (kJ/kg·K).',
  'k': 'Specific heat ratio k = cp / cv.',
  'a': 'Constant polynomial coefficient a in c̄p = a + bT + cT² + dT³.',
  'b': 'Linear temperature coefficient b in c̄p = a + bT + cT² + dT³.',
  'c': 'Quadratic temperature coefficient c in c̄p = a + bT + cT² + dT³.',
  'd': 'Cubic temperature coefficient d in c̄p = a + bT + cT² + dT³.',
  'tempRange': 'Valid temperature range for the polynomial correlation.',
  'errorMax': 'Maximum percentage error of the polynomial correlation over the temperature range.',
  'errorAvg': 'Average percentage error of the polynomial correlation over the temperature range.',
  'T_boil': 'Normal boiling point temperature at 1 atm.',
  'T_freeze': 'Freezing point temperature at 1 atm.',
  'h_if': 'Latent heat of fusion (melting/freezing enthalpy change) (kJ/kg).',
  'T_liq': 'Temperature at which liquid density and specific heat are evaluated.',
  'rho': 'Density ρ (kg/m³): Mass per unit volume.',
  'waterContent': 'Mass percentage of water content in the food item.',
  'cp_above': 'Specific heat above the freezing point (kJ/kg·K).',
  'cp_below': 'Specific heat below the freezing point (kJ/kg·K).',
};

const A2B_GAS_GROUPS = [
  { id: 'air', label: 'Air', short: 'Air' },
  { id: 'co2', label: 'Carbon dioxide, CO₂', short: 'CO₂' },
  { id: 'co', label: 'Carbon monoxide, CO', short: 'CO' },
  { id: 'h2', label: 'Hydrogen, H₂', short: 'H₂' },
  { id: 'n2', label: 'Nitrogen, N₂', short: 'N₂' },
  { id: 'o2', label: 'Oxygen, O₂', short: 'O₂' },
] as const;

interface PropertyColumnDef {
  id: string;
  label: string;
}

const PROPERTY_COLUMNS_BY_TYPE: Record<string, PropertyColumnDef[]> = {
  superheated: [
    { id: 'v', label: 'v' },
    { id: 'u', label: 'u' },
    { id: 'h', label: 'h' },
    { id: 's', label: 's' },
  ],
  compressed: [
    { id: 'v', label: 'v' },
    { id: 'u', label: 'u' },
    { id: 'h', label: 'h' },
    { id: 's', label: 's' },
  ],
  ideal_gas_air: [
    { id: 'h', label: 'h' },
    { id: 'u', label: 'u' },
    { id: 's_deg', label: 's°' },
    { id: 's_plus', label: 's⁺' },
  ],
  ideal_gas_molar: [
    { id: 'h_bar', label: 'h̄' },
    { id: 'u_bar', label: 'ū' },
    { id: 's_bar_deg', label: 's̄°' },
  ],
  critical_properties: [
    { id: 'formula', label: 'Formula' },
    { id: 'M', label: 'M' },
    { id: 'R', label: 'R' },
    { id: 'T_cr', label: 'T_cr' },
    { id: 'P_cr', label: 'P_cr' },
    { id: 'v_cr', label: 'v_cr' },
  ],
  specific_heat_300k: [
    { id: 'formula', label: 'Formula' },
    { id: 'R', label: 'R' },
    { id: 'cp', label: 'cp' },
    { id: 'cv', label: 'cv' },
    { id: 'k', label: 'k' },
  ],
  specific_heat_poly: [
    { id: 'formula', label: 'Formula' },
    { id: 'a', label: 'a' },
    { id: 'b', label: 'b' },
    { id: 'c', label: 'c' },
    { id: 'd', label: 'd' },
    { id: 'tempRange', label: 'Temp. Range' },
    { id: 'errorMax', label: 'Max. Error' },
    { id: 'errorAvg', label: 'Avg. Error' },
  ],
  solids: [
    { id: 'category', label: 'Category' },
    { id: 'T', label: 'Temp.' },
    { id: 'rho', label: 'Density, ρ' },
    { id: 'cp', label: 'cp' },
  ],
  foods: [
    { id: 'waterContent', label: 'Water Content' },
    { id: 'T_freeze', label: 'Freezing Point' },
    { id: 'cp_above', label: 'cp Above' },
    { id: 'cp_below', label: 'cp Below' },
    { id: 'h_if', label: 'h_if' },
  ],
};

const LIQUID_GROUPS = [
  { id: 'liq_boil', label: 'Boiling Data at 1 atm', cols: ['T_boil', 'h_fg'] },
  { id: 'liq_freeze', label: 'Freezing Data', cols: ['T_freeze', 'h_if'] },
  { id: 'liq_props', label: 'Liquid Properties', cols: ['T_liq', 'rho', 'cp'] },
] as const;

const TABLE_NOTES: Record<string, string> = {
  'A-1': 'R = Rᵤ/M, where Rᵤ = 8.31447 kJ/(kmol·K). The units kJ/(kg·K) and kPa·m³/(kg·K) are equivalent. Sources: Kobe and Lynn (1953); ASHRAE Handbook of Fundamentals (1993).',
  'A-2a': 'The units kJ/(kg·K) and kJ/(kg·°C) are equivalent for specific heat. Source: B. G. Kyle, Chemical and Process Thermodynamics, 3rd ed. (2000).',
  'A-2b': 'Source: Kenneth Wark, Thermodynamics, 4th ed. (1983), table A–4M; originally published in Tables of Thermal Properties of Gases, NBS Circular 564 (1955).',
  'A-2c': 'Use c̄p = a + bT + cT² + dT³ with T in K and c̄p in kJ/(kmol·K), even when the displayed temperature range is converted to °C. Source: B. G. Kyle, Chemical and Process Thermodynamics (1984).',
  'A-3b': 'Values are for room temperature unless a temperature is indicated. A dash in the temperature column means the source does not specify a temperature.',
  'A-4': 'Water properties were generated using Engineering Equation Solver (EES), using the IAPWS 1995 formulation for ordinary water.',
  'A-5': 'Water properties were generated using Engineering Equation Solver (EES), using the IAPWS 1995 formulation for ordinary water.',
  'A-6': 'The temperature shown beside each pressure is its saturation temperature. Sat. denotes saturated vapor at that pressure. Source: EES Steam_IAPWS, based on the IAPWS 1995 water formulation.',
  'A-7': 'The temperature shown beside each pressure is its saturation temperature. Sat. denotes saturated liquid at that pressure. Source: EES Steam_IAPWS, based on the IAPWS 1995 water formulation.',
  'A-11': 'R-134a properties were generated using EES and the Tillner-Roth and Baehr equation of state (1994). Saturated-liquid enthalpy and entropy are zero at −40 °C.',
  'A-12': 'R-134a properties were generated using EES and the Tillner-Roth and Baehr equation of state (1994). Saturated-liquid enthalpy and entropy are zero at −40 °C.',
  'A-13': 'The temperature shown beside each pressure is its saturation temperature. Sat. denotes saturated vapor at that pressure. R-134a properties use EES and the Tillner-Roth and Baehr equation of state (1994); saturated-liquid enthalpy and entropy are zero at −40 °C.',
  'A-17': 'The entropy functions are s°(T) = ∫₀ᵀ [cp(T)/T] dT and s⁺(T) = s°(T) − R ln T. Source: Kenneth Wark, Thermodynamics, 4th ed. (1983); originally published in Keenan and Kaye, Gas Tables (1948).',
  'A-18': 'Source: Kenneth Wark, Thermodynamics, 4th ed. (1983), adapted from JANAF Thermochemical Tables, NSRDS-NBS-37 (1971).',
  'A-19': 'Source: Kenneth Wark, Thermodynamics, 4th ed. (1983), adapted from JANAF Thermochemical Tables, NSRDS-NBS-37 (1971).',
};

const SubHeader = React.memo(function SubHeader({
  label,
  prop,
  colId,
  isCategoryEnd,
  isHovered,
  isSelected,
  unitType,
  tempUnit,
  onChangeTempUnit,
  onToggleHighlight,
  onMouseEnterCol,
  onMouseLeaveCol,
  onShowTooltip,
  onHideTooltip,
}: {
  label: string;
  prop: string;
  colId: string;
  isCategoryEnd?: boolean;
  isHovered: boolean;
  isSelected: boolean;
  unitType?: 'temp';
  tempUnit?: TempUnit;
  onChangeTempUnit?: (u: TempUnit) => void;
  onToggleHighlight: (colId: string) => void;
  onMouseEnterCol: (colId: string) => void;
  onMouseLeaveCol: () => void;
  onShowTooltip: (text: string, e: React.MouseEvent) => void;
  onHideTooltip: () => void;
}) {
  return (
    <th 
      data-col-id={colId}
      className={cn(
        "px-2 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-14 transition-colors h-10 select-none whitespace-nowrap cursor-pointer",
        isSelected 
          ? "z-30 bg-red-100 text-red-950 dark:bg-[#3b1d2b] dark:text-white" 
          : (isHovered ? "z-20 bg-red-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100" : "z-10"),
        isCategoryEnd ? "border-r-2 border-r-gray-300 dark:border-r-gray-700" : "border-r border-r-gray-200/60 dark:border-r-gray-800/80"
      )}
      onClick={() => onToggleHighlight(colId)}
      onMouseEnter={() => onMouseEnterCol(colId)}
      onMouseLeave={onMouseLeaveCol}
      title={isSelected ? "Remove highlight" : `Highlight ${label} column`}
    >
      <div className="flex items-center justify-between gap-1.5 w-full">
        <div className="flex items-center gap-1 min-w-0">
          <span className="truncate">{label}</span>
          {unitType === 'temp' && tempUnit && onChangeTempUnit && (
            <select
              className="bg-transparent border-b border-gray-300 dark:border-gray-600 text-xs font-semibold focus:outline-none cursor-pointer hover:border-red-600 dark:hover:border-red-400 text-gray-700 dark:text-gray-200 transition-colors"
              value={tempUnit}
              onChange={(e) => onChangeTempUnit(e.target.value as TempUnit)}
              onClick={(e) => e.stopPropagation()}
            >
              <option value="C" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">°C</option>
              <option value="K" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">K</option>
            </select>
          )}
          {TOOLTIPS[prop] && (
            <Info
              className="w-3 h-3 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 cursor-help shrink-0"
              onClick={(e) => { e.stopPropagation(); }}
              onMouseEnter={(e) => onShowTooltip(TOOLTIPS[prop], e)}
              onMouseLeave={onHideTooltip}
            />
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleHighlight(colId);
          }}
          className={cn(
            "p-1 rounded transition-colors shrink-0 cursor-pointer",
            isSelected 
              ? "text-red-700 bg-red-200/90 dark:text-rose-200 dark:bg-rose-500/30 hover:bg-red-300 dark:hover:bg-rose-500/40" 
              : "text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-200 dark:hover:bg-gray-700"
          )}
          title={isSelected ? "Remove highlight" : "Highlight column"}
        >
          <Highlighter className="w-3 h-3" />
        </button>
      </div>
    </th>
  );
});

const Td = React.memo(function Td({
  children,
  colId,
  align = 'right',
  isRowHovered,
  isPinned,
  isHighlighted,
  isCategoryEnd,
  isColHovered,
  isColSelected,
  onMouseEnterCol: _onMouseEnterCol,
  onMouseLeaveCol: _onMouseLeaveCol,
}: {
  children: React.ReactNode;
  colId: string;
  align?: 'left' | 'right' | 'center';
  isRowHovered: boolean;
  isPinned: boolean;
  isHighlighted?: boolean;
  isCategoryEnd?: boolean;
  isColHovered: boolean;
  isColSelected: boolean;
  onMouseEnterCol?: (id: string) => void;
  onMouseLeaveCol?: () => void;
}) {
  let bgStyle = "";
  if (isHighlighted) {
    bgStyle = "bg-indigo-200/90 text-indigo-950 dark:bg-indigo-500/30 dark:text-white font-bold relative z-10 ring-1 ring-inset ring-indigo-400 dark:ring-indigo-400/70";
  } else if (isPinned && isColSelected) {
    bgStyle = "bg-amber-300/90 text-gray-950 dark:bg-amber-500/[0.32] dark:text-white font-bold ring-1 ring-inset ring-amber-500/60 dark:ring-amber-400/60";
  } else if (isPinned) {
    bgStyle = isColHovered 
      ? "bg-amber-200/85 text-gray-950 dark:bg-amber-500/[0.24] dark:text-white font-semibold" 
      : "bg-amber-100/80 text-gray-900 dark:bg-amber-500/[0.15] dark:text-gray-100 font-semibold";
  } else if (isColSelected) {
    bgStyle = isRowHovered 
      ? "bg-red-200/80 text-gray-950 dark:bg-rose-500/[0.26] dark:text-white" 
      : "bg-red-100/65 text-gray-900 dark:bg-rose-500/[0.16] dark:text-gray-100";
  } else if (isRowHovered && isColHovered) {
    bgStyle = "bg-red-100/65 dark:bg-gray-700/75 text-gray-950 dark:text-white";
  } else if (isRowHovered) {
    bgStyle = "bg-red-50/55 dark:bg-gray-800/90 text-gray-900 dark:text-gray-100";
  } else if (isColHovered) {
    bgStyle = "bg-red-50/55 dark:bg-gray-800/90 text-gray-900 dark:text-gray-100";
  }

  return (
    <td 
      data-col-id={colId}
      className={cn(
        "px-2 sm:px-3 py-2 text-xs sm:text-sm text-gray-800 dark:text-gray-200 border-b border-gray-100 dark:border-gray-800 transition-colors tabular-nums whitespace-nowrap",
        align === 'left' ? "text-left font-medium" : align === 'center' ? "text-center" : "text-right",
        isCategoryEnd ? "border-r-2 border-r-gray-300 dark:border-r-gray-700" : "border-r border-r-gray-100 dark:border-r-gray-800/80",
        bgStyle
      )}
    >
      {children}
    </td>
  );
});

export default function App() {
  const [currentTableId, setCurrentTableId] = useState<string>('A-4');
  const [isSwitcherOpen, setIsSwitcherOpen] = useState<boolean>(false);
  const [isSnippetOpen, setIsSnippetOpen] = useState<boolean>(false);
  const [isDescOpen, setIsDescOpen] = useState<boolean>(false);
  const [actionModalMode, setActionModalMode] = useState<'mobile' | 'interpolate' | null>(null);
  const [tableSearchQuery, setTableSearchQuery] = useState<string>('');

  const currentTable = SUPPORTED_TABLES.find(t => t.id === currentTableId) || SUPPORTED_TABLES[0];
  const tableData = useMemo(() => getTableData(currentTableId), [currentTableId]);

  const [tempUnit, setRawTempUnit] = useState<TempUnit>('C');
  const [pressUnit, setRawPressUnit] = useState<PressUnit>('kPa');
  const [tableInterpolatedRows, setTableInterpolatedRows] = useState<Record<string, InterpolatedRowSpec[]>>({});

  const setTempUnit = useCallback((nextUnit: TempUnit) => {
    setRawTempUnit(prevUnit => {
      if (prevUnit !== nextUnit) {
        setTableInterpolatedRows(prevMap => {
          const list = prevMap[currentTableId];
          if (!list || list.length === 0) return prevMap;
          let changed = false;
          const nextList = list.map(spec => {
            if (spec.dominatingColId !== 'T' || !spec.inputValue.trim()) return spec;
            const n = Number(spec.inputValue.trim().replace(/,/g, '').replace(/−/g, '-'));
            if (!Number.isFinite(n)) return spec;
            changed = true;
            const converted = prevUnit === 'C' && nextUnit === 'K' ? n + 273.15 : n - 273.15;
            return { ...spec, inputValue: Number(converted.toPrecision(12)).toString() };
          });
          return changed ? { ...prevMap, [currentTableId]: nextList } : prevMap;
        });
      }
      return nextUnit;
    });
  }, [currentTableId]);

  const setPressUnit = useCallback((nextUnit: PressUnit) => {
    setRawPressUnit(prevUnit => {
      if (prevUnit !== nextUnit) {
        const kpaScale: Record<PressUnit, number> = { kPa: 1, bar: 100, MPa: 1000 };
        setTableInterpolatedRows(prevMap => {
          const list = prevMap[currentTableId];
          if (!list || list.length === 0) return prevMap;
          let changed = false;
          const nextList = list.map(spec => {
            if (spec.dominatingColId !== 'P' || !spec.inputValue.trim()) return spec;
            const n = Number(spec.inputValue.trim().replace(/,/g, '').replace(/−/g, '-'));
            if (!Number.isFinite(n)) return spec;
            changed = true;
            const converted = (n * kpaScale[prevUnit]) / kpaScale[nextUnit];
            return { ...spec, inputValue: Number(converted.toPrecision(12)).toString() };
          });
          return changed ? { ...prevMap, [currentTableId]: nextList } : prevMap;
        });
      }
      return nextUnit;
    });
  }, [currentTableId]);

  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>({
    volume: true,
    energy: true,
    enthalpy: true,
    entropy: true,
    gas_air: true,
    gas_co2: true,
    gas_co: true,
    gas_h2: true,
    gas_n2: true,
    gas_o2: true,
  });

  // Keep property visibility independent for each table. Missing entries are visible.
  const [tablePropertyVisibility, setTablePropertyVisibility] = useState<Record<string, Record<string, boolean>>>({});
  const currentPropertyVisibility = tablePropertyVisibility[currentTableId];
  const snippetVisibleCols = useMemo(() => ({
    ...visibleCols,
    ...currentPropertyVisibility,
  }), [visibleCols, currentPropertyVisibility]);

  const isPropertyVisible = (id: string) => currentPropertyVisibility?.[`property_${id}`] !== false;
  const togglePropertyVisibility = (id: string) => {
    const key = `property_${id}`;
    setTablePropertyVisibility(previous => ({
      ...previous,
      [currentTableId]: {
        ...previous[currentTableId],
        [key]: previous[currentTableId]?.[key] === false,
      },
    }));
  };

  const [tablePinnedRows, setTablePinnedRows] = useState<Record<string, Set<string>>>({});
  const [tableSelectedCols, setTableSelectedCols] = useState<Record<string, Set<string>>>({});
  const selectedCols = useMemo(() => tableSelectedCols[currentTableId] || new Set<string>(), [tableSelectedCols, currentTableId]);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredCol, setHoveredCol] = useState<string | null>(null);

  const handleMouseEnterCol = useCallback((colId: string) => {
    setHoveredCol(prev => (prev === colId ? prev : colId));
  }, []);
  const handleMouseLeaveCol = useCallback(() => {
    setHoveredCol(prev => (prev !== null ? null : prev));
  }, []);
  const clearAllHover = useCallback(() => {
    setHoveredCol(prev => (prev !== null ? null : prev));
    setHoveredRow(prev => (prev !== null ? null : prev));
  }, []);
  const handleRootMouseMove = useCallback((e: React.MouseEvent) => {
    if (isSnippetOpen || isSwitcherOpen || actionModalMode !== null) {
      clearAllHover();
      return;
    }
    if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
      clearAllHover();
      return;
    }
    const target = e.target as HTMLElement | null;
    if (!target) {
      clearAllHover();
      return;
    }
    const colEl = target.closest('[data-col-id]') as HTMLElement | null;
    const cellEl = colEl || (target.closest('[data-pin-cell]') as HTMLElement | null);
    const rowEl = cellEl ? (cellEl.closest('[data-row-key]') as HTMLElement | null) : null;
    const nextCol = colEl ? colEl.getAttribute('data-col-id') : null;
    const nextRow = rowEl ? rowEl.getAttribute('data-row-key') : null;
    setHoveredCol(prev => (prev === nextCol ? prev : nextCol));
    setHoveredRow(prev => (prev === nextRow ? prev : nextRow));
  }, [clearAllHover, isSnippetOpen, isSwitcherOpen, actionModalMode]);

  useEffect(() => {
    const handleDocLeave = () => {
      setHoveredCol(prev => (prev !== null ? null : prev));
      setHoveredRow(prev => (prev !== null ? null : prev));
    };

    const handleMouseOut = (e: MouseEvent) => {
      if (!e.relatedTarget && !(e as any).toElement) {
        handleDocLeave();
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleDocLeave();
      }
    };

    // Chromium/WebKit fires mouseleave/pointerleave on document.documentElement, not document
    document.documentElement.addEventListener('mouseleave', handleDocLeave);
    document.documentElement.addEventListener('pointerleave', handleDocLeave);
    document.addEventListener('mouseleave', handleDocLeave);
    document.addEventListener('mouseout', handleMouseOut);
    window.addEventListener('mouseout', handleMouseOut);
    window.addEventListener('blur', handleDocLeave);
    window.addEventListener('pointercancel', handleDocLeave);
    window.addEventListener('touchend', handleDocLeave, { passive: true });
    window.addEventListener('touchcancel', handleDocLeave, { passive: true });
    window.addEventListener('scroll', handleDocLeave, { capture: true, passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.documentElement.removeEventListener('mouseleave', handleDocLeave);
      document.documentElement.removeEventListener('pointerleave', handleDocLeave);
      document.removeEventListener('mouseleave', handleDocLeave);
      document.removeEventListener('mouseout', handleMouseOut);
      window.removeEventListener('mouseout', handleMouseOut);
      window.removeEventListener('blur', handleDocLeave);
      window.removeEventListener('pointercancel', handleDocLeave);
      window.removeEventListener('touchend', handleDocLeave);
      window.removeEventListener('touchcancel', handleDocLeave);
      window.removeEventListener('scroll', handleDocLeave, { capture: true });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const [tablePinnedBlocks, setTablePinnedBlocks] = useState<Record<string, Set<number>>>({});
  const [tableTouchedBlocks, setTableTouchedBlocks] = useState<Record<string, Set<number>>>({});
  const [tableCollapsedBlocks, setTableCollapsedBlocks] = useState<Record<string, Set<number>>>({});
  const [tableDisabledBlocks, setTableDisabledBlocks] = useState<Record<string, Set<number>>>({});
  const [showBlockFilter, setShowBlockFilter] = useState(false);
  const [tablePinnedTemps, setTablePinnedTemps] = useState<Record<string, Set<string>>>({});

  const pinnedRows = useMemo(() => tablePinnedRows[currentTableId] || new Set<string>(), [tablePinnedRows, currentTableId]);
  const pinnedTemps = useMemo(() => tablePinnedTemps[currentTableId] || new Set<string>(), [tablePinnedTemps, currentTableId]);
  const pinnedBlocks = useMemo(() => tablePinnedBlocks[currentTableId] || new Set<number>(), [tablePinnedBlocks, currentTableId]);
  const touchedBlocks = useMemo(() => tableTouchedBlocks[currentTableId] || new Set<number>(), [tableTouchedBlocks, currentTableId]);
  const collapsedBlocks = useMemo(() => tableCollapsedBlocks[currentTableId] || new Set<number>(), [tableCollapsedBlocks, currentTableId]);
  const disabledBlocks = useMemo(() => tableDisabledBlocks[currentTableId] || new Set<number>(), [tableDisabledBlocks, currentTableId]);

  const isProgressive = useMemo(() => isProgressiveTable(tableData), [tableData]);
  const progressiveCols = useMemo(
    () => (tableData ? getProgressiveColumns(tableData, tempUnit, pressUnit) : []),
    [tableData, tempUnit, pressUnit]
  );
  const interpolatedRows = useMemo(
    () => tableInterpolatedRows[currentTableId] || [],
    [tableInterpolatedRows, currentTableId]
  );
  const solvedInterpolatedRows = useMemo(
    () =>
      tableData
        ? interpolatedRows.map((spec) => solveInterpolatedRow(tableData, spec, tempUnit, pressUnit))
        : [],
    [tableData, interpolatedRows, tempUnit, pressUnit]
  );

  const activeSnippetRowCount = useMemo(() => {
    let typicalPinnedCount = 0;
    for (const k of pinnedRows) {
      if (!k.startsWith('interp-')) typicalPinnedCount++;
    }
    const validInterpPinnedCount = solvedInterpolatedRows.filter(
      (s) => s.isValidInput && pinnedRows.has(s.spec.id)
    ).length;
    const totalRowPins = typicalPinnedCount + validInterpPinnedCount;
    if (tableData?.type === 'superheated' || tableData?.type === 'compressed') {
      return pinnedTemps.size + totalRowPins + (pinnedTemps.size === 0 && totalRowPins === 0 ? pinnedBlocks.size : 0);
    }
    return totalRowPins;
  }, [tableData, pinnedTemps, pinnedRows, pinnedBlocks, solvedInterpolatedRows]);

  const clearCurrentTableSelections = useCallback(() => {
    setTablePinnedRows(prev => ({ ...prev, [currentTableId]: new Set<string>() }));
    setTableSelectedCols(prev => ({ ...prev, [currentTableId]: new Set<string>() }));
    setTablePinnedBlocks(prev => ({ ...prev, [currentTableId]: new Set<number>() }));
    setTableTouchedBlocks(prev => ({ ...prev, [currentTableId]: new Set<number>() }));
    setTablePinnedTemps(prev => ({ ...prev, [currentTableId]: new Set<string>() }));
  }, [currentTableId]);

  const setPinnedBlocks = (action: Set<number> | ((prev: Set<number>) => Set<number>)) => {
    setTablePinnedBlocks(prev => {
      const current = prev[currentTableId] || new Set<number>();
      const next = typeof action === 'function' ? action(current) : action;
      return { ...prev, [currentTableId]: next };
    });
  };

  const setCollapsedBlocks = useCallback((action: Set<number> | ((prev: Set<number>) => Set<number>)) => {
    setTableCollapsedBlocks(prev => {
      const current = prev[currentTableId] || new Set<number>();
      const next = typeof action === 'function' ? action(current) : action;
      return { ...prev, [currentTableId]: next };
    });
  }, [currentTableId]);

  const setDisabledBlocks = useCallback((action: Set<number> | ((prev: Set<number>) => Set<number>)) => {
    setTableDisabledBlocks(prev => {
      const current = prev[currentTableId] || new Set<number>();
      const next = typeof action === 'function' ? action(current) : action;
      return { ...prev, [currentTableId]: next };
    });
  }, [currentTableId]);

  const [jumpProperty, setJumpProperty] = useState<string>('T');
  const [jumpValue, setJumpValue] = useState<string>('');
  const [jumpSuperheatedUnit, setJumpSuperheatedUnit] = useState<PressUnit>('MPa');
  const [highlightedRowIndex, setHighlightedRowIndex] = useState<string | null>(null);
  const [highlightedBlockIdx, setHighlightedBlockIdx] = useState<number | null>(null);
  
  const tableRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const blockRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const switcherRef = useRef<HTMLDivElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const jumpInputRef = useRef<HTMLInputElement>(null);
  const [menuSelectedIndex, setMenuSelectedIndex] = useState<number>(0);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const findRowEl = useCallback((key: string): HTMLTableRowElement | null => {
    const cached = rowRefs.current[key];
    if (cached && cached.isConnected) return cached;
    return (tableRef.current?.querySelector(`tr[data-row-key="${CSS.escape(key)}"]`) as HTMLTableRowElement | null) ?? null;
  }, []);

  useEffect(() => {
    tableRef.current?.scrollTo({ top: 0, left: 0 });
  }, [currentTableId]);

  const unhideColumnIfHidden = useCallback((colId: string) => {
    if (!tableData) return;
    if (tableData.type === 'saturated') {
      const group = ['vf', 'vg'].includes(colId) ? 'volume'
        : ['uf', 'ufg', 'ug'].includes(colId) ? 'energy'
        : ['hf', 'hfg', 'hg'].includes(colId) ? 'enthalpy'
        : ['sf', 'sfg', 'sg'].includes(colId) ? 'entropy' : null;
      if (group) setVisibleCols(previous => previous[group] ? previous : { ...previous, [group]: true });
    } else if (tableData.type === 'specific_heat_temp' && colId.includes('_')) {
      const gas = colId.split('_')[0];
      const key = `gas_${gas}`;
      setVisibleCols(previous => previous[key] === false ? { ...previous, [key]: true } : previous);
    } else if (currentPropertyVisibility?.[`property_${colId}`] === false) {
      setTablePropertyVisibility(previous => ({
        ...previous,
        [currentTableId]: { ...previous[currentTableId], [`property_${colId}`]: true },
      }));
    }
  }, [tableData, currentPropertyVisibility, currentTableId]);

  const updateInterpSpec = useCallback((id: string, updater: (spec: InterpolatedRowSpec) => InterpolatedRowSpec) => {
    setTableInterpolatedRows(prev => {
      const list = prev[currentTableId] || [];
      return {
        ...prev,
        [currentTableId]: list.map(s => (s.id === id ? updater(s) : s)),
      };
    });
  }, [currentTableId]);

  const handleAddInterpolatedRow = useCallback((params: {
    blockIndex?: number;
    afterIndex: number;
    dominatingColId: string;
    inputValue: string;
    startEditing?: boolean;
  }) => {
    const id = `interp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const shouldEdit = params.startEditing ?? !params.inputValue.trim();
    const newSpec: InterpolatedRowSpec = {
      id,
      blockIndex: params.blockIndex,
      afterIndex: params.afterIndex,
      dominatingColId: params.dominatingColId,
      inputValue: params.inputValue,
      showMoreDigits: false,
      showAnalytic: false,
      isEditing: shouldEdit,
    };
    setTableInterpolatedRows(prev => ({
      ...prev,
      [currentTableId]: [...(prev[currentTableId] || []), newSpec],
    }));
    // Auto-pin the newly added interpolated row so it appears in generated snippets
    setTablePinnedRows(prev => {
      const current = prev[currentTableId] || new Set<string>();
      const next = new Set(current);
      next.add(id);
      return { ...prev, [currentTableId]: next };
    });
    if (params.blockIndex !== undefined) {
      const bIdx = params.blockIndex;
      setTableTouchedBlocks(prev => {
        const current = prev[currentTableId] || new Set<number>();
        const next = new Set(current);
        next.add(bIdx);
        return { ...prev, [currentTableId]: next };
      });
      if (disabledBlocks.has(bIdx)) {
        setDisabledBlocks(prev => {
          const next = new Set(prev);
          next.delete(bIdx);
          return next;
        });
      }
      if (collapsedBlocks.has(bIdx)) {
        setCollapsedBlocks(prev => {
          const next = new Set(prev);
          next.delete(bIdx);
          return next;
        });
      }
    }
    unhideColumnIfHidden(params.dominatingColId);
    setHighlightedRowIndex(id);
    setTimeout(() => setHighlightedRowIndex(prev => (prev === id ? null : prev)), 2000);
    requestAnimationFrame(() => {
      const rowEl = findRowEl(id);
      rowEl?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      if (shouldEdit) {
        const inputEl = rowEl?.querySelector('input');
        inputEl?.focus();
      }
    });
  }, [currentTableId, disabledBlocks, collapsedBlocks, setDisabledBlocks, setCollapsedBlocks, unhideColumnIfHidden, findRowEl]);

  const handleSetInterpEditing = useCallback((id: string, editing: boolean) => {
    updateInterpSpec(id, s => ({ ...s, isEditing: editing }));
    if (editing) {
      requestAnimationFrame(() => {
        const rowEl = findRowEl(id);
        const inputEl = rowEl?.querySelector('input');
        inputEl?.focus();
      });
    }
  }, [updateInterpSpec, findRowEl]);

  const handleUpdateInterpInput = useCallback((id: string, value: string) => {
    updateInterpSpec(id, s => ({ ...s, inputValue: value }));
  }, [updateInterpSpec]);

  const handleSelectDominatingCol = useCallback((id: string, colId: string, prefill?: string) => {
    updateInterpSpec(id, s => ({
      ...s,
      dominatingColId: colId,
      inputValue: prefill !== undefined ? prefill : s.inputValue,
    }));
    requestAnimationFrame(() => {
      const rowEl = findRowEl(id);
      const inputEl = rowEl?.querySelector('input');
      inputEl?.focus();
    });
  }, [updateInterpSpec, findRowEl]);

  const handleDeleteInterpRow = useCallback((id: string) => {
    setTableInterpolatedRows(prev => ({
      ...prev,
      [currentTableId]: (prev[currentTableId] || []).filter(s => s.id !== id),
    }));
    setTablePinnedRows(prev => {
      const current = prev[currentTableId];
      if (!current?.has(id)) return prev;
      const next = new Set(current);
      next.delete(id);
      return { ...prev, [currentTableId]: next };
    });
  }, [currentTableId]);

  const handleToggleMoreDigits = useCallback((id: string) => {
    updateInterpSpec(id, s => ({ ...s, showMoreDigits: !s.showMoreDigits }));
  }, [updateInterpSpec]);

  const handleToggleAnalytic = useCallback((id: string) => {
    updateInterpSpec(id, s => ({ ...s, showAnalytic: !s.showAnalytic }));
  }, [updateInterpSpec]);

  const handleRelocateInterpRow = useCallback((id: string) => {
    if (!tableData) return;
    const solved = solvedInterpolatedRows.find(s => s.spec.id === id);
    if (!solved?.isValidInput || solved.inputNumber === undefined) return;
    const nextGap = findBoundingRowGap(
      tableData,
      solved.spec.dominatingColId,
      solved.inputNumber,
      tempUnit,
      pressUnit,
      solved.spec.blockIndex
    );
    if (nextGap < 0) return;
    updateInterpSpec(id, s => ({ ...s, afterIndex: nextGap }));
    setHighlightedRowIndex(id);
    setTimeout(() => setHighlightedRowIndex(prev => (prev === id ? null : prev)), 2000);
    requestAnimationFrame(() => {
      findRowEl(id)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    });
  }, [tableData, solvedInterpolatedRows, tempUnit, pressUnit, updateInterpSpec, findRowEl]);

  const switchTable = (id: string) => {
    clearAllHover();
    setCurrentTableId(id);
    const targetData = getTableData(id);
    if (targetData && (targetData.type === 'superheated' || targetData.type === 'compressed')) {
      setRawPressUnit('MPa');
      setJumpSuperheatedUnit('MPa');
      setRawTempUnit('C');
      setJumpProperty('T');
    } else if (
      targetData &&
      (targetData.type === 'ideal_gas_air' ||
        targetData.type === 'ideal_gas_molar' ||
        targetData.type === 'specific_heat_temp')
    ) {
      setRawTempUnit('K');
      setJumpProperty('T');
    } else if (targetData && targetData.type === 'critical_properties') {
      setRawTempUnit('K');
      setRawPressUnit('MPa');
      setJumpProperty('substance');
    } else if (
      targetData &&
      (targetData.type === 'specific_heat_300k' || targetData.type === 'specific_heat_poly')
    ) {
      setRawTempUnit('K');
      setJumpProperty('substance');
    } else if (
      targetData &&
      (targetData.type === 'liquids' || targetData.type === 'solids' || targetData.type === 'foods')
    ) {
      setRawTempUnit('C');
      setJumpProperty('substance');
    } else {
      setRawPressUnit('kPa');
      setRawTempUnit('C');
      setJumpProperty(targetData?.type === 'saturated' ? targetData.indexProperty : 'T');
    }
    setShowBlockFilter(false);
    setActionModalMode(null);
    setHighlightedRowIndex(null);
    setHighlightedBlockIdx(null);
    setIsSwitcherOpen(false);
    setTableSearchQuery('');
    setMenuSelectedIndex(0);
    setJumpValue('');
  };

  const hasActiveSelections = useMemo(() => {
    for (const s of Object.values(tableSelectedCols)) {
      if (s && s.size > 0) return true;
    }
    for (const s of Object.values(tablePinnedTemps)) {
      if (s && s.size > 0) return true;
    }
    for (const s of Object.values(tablePinnedRows)) {
      if (s && s.size > 0) return true;
    }
    for (const s of Object.values(tablePinnedBlocks)) {
      if (s && s.size > 0) return true;
    }
    for (const list of Object.values(tableInterpolatedRows)) {
      if (list && list.length > 0) return true;
    }
    return false;
  }, [tableSelectedCols, tablePinnedTemps, tablePinnedRows, tablePinnedBlocks, tableInterpolatedRows]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasActiveSelections) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasActiveSelections]);

  const showTooltip = useCallback((text: string, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ text, x: rect.left + rect.width / 2, y: rect.bottom + 8 });
  }, []);
  const hideTooltip = useCallback(() => setTooltip(null), []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(event.target as Node)) {
        setIsSwitcherOpen(false);
      }
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        setShowBlockFilter(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && actionModalMode !== null) {
        setActionModalMode(null);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        jumpInputRef.current?.focus();
      }
      
      if (e.key === 'Tab') {
        if (isSnippetOpen || actionModalMode !== null) return;
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setIsSwitcherOpen(true);
        }
      }
    };
    
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isSnippetOpen, actionModalMode]);

  const formatTempDisplay = (val?: ThermoValue) => {
    if (!val) return '-';
    if (tempUnit === 'K') {
      return (val.v + 273.15).toFixed(2);
    }
    return val.s;
  };

  const formatTempFromKDisplay = (val?: ThermoValue) => {
    if (!val) return '-';
    if (tempUnit === 'C') {
      return (val.v - 273.15).toFixed(2);
    }
    return val.s;
  };

  const formatSatTemp = (val?: ThermoValue) => {
    if (!val || val.s === 'N/A') return 'N/A';
    if (tempUnit === 'K') {
      return `Tsat = ${(val.v + 273.15).toFixed(2)} K`;
    }
    return `Tsat = ${val.s} °C`;
  };

  const formatPressDisplay = (val?: ThermoValue) => {
    return formatPressure(val, 'kPa', pressUnit);
  };

  const formatPressFromMPaDisplay = (val?: ThermoValue) => {
    return formatPressure(val, 'MPa', pressUnit);
  };

  const formatIsobarPress = (val: ThermoValue) => {
    return `${formatPressure(val, 'MPa', pressUnit)} ${pressUnit}`;
  };

  const formatLiquidBoilTemp = (row: LiquidPropertiesRow) => {
    if (!row.T_boil) return '—';
    const base = formatTempDisplay(row.T_boil);
    if (row.T_boil_max) {
      return `${base}–${formatTempDisplay(row.T_boil_max)}${row.T_boil_note || ''}`;
    }
    return `${base}${row.T_boil_note || ''}`;
  };

  const formatLiquidHfg = (row: LiquidPropertiesRow) => {
    if (!row.h_fg) return '—';
    if (row.h_fg_max) {
      return `${row.h_fg.s}–${row.h_fg_max.s}${row.h_fg_note || ''}`;
    }
    return `${row.h_fg.s}${row.h_fg_note || ''}`;
  };

  const formatSolidTemp = (row: SolidPropertiesRow) => {
    if (!row.T) return '—';
    return row.T_nativeUnit === 'K' ? formatTempFromKDisplay(row.T) : formatTempDisplay(row.T);
  };

  const normalizeChemText = (str: string) =>
    str
      .toLowerCase()
      .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (ch) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(ch)))
      .replace(/[\s\-_(),]/g, '');

  const jumpOptions = useMemo(
    () => tableData ? getJumpOptions(tableData, tempUnit, pressUnit) : [],
    [tableData, tempUnit, pressUnit]
  );

  const handleJump = () => {
    const rawQuery = jumpValue.trim();
    if (!rawQuery || !tableData) return;

    const number = Number(rawQuery.replace('−', '-'));
    const isNumeric = Number.isFinite(number);
    setJumpValue('');
    jumpInputRef.current?.blur();

    if (tableData.type === 'superheated' || tableData.type === 'compressed') {
      if (!isNumeric) return;
      const targetPressure = jumpSuperheatedUnit === 'kPa'
        ? number / 1000
        : jumpSuperheatedUnit === 'bar' ? number / 10 : number;
      let nearest = -1;
      let bestDifference = Infinity;
      tableData.blocks.forEach((block, index) => {
        const difference = Math.abs(block.P.v - targetPressure);
        if (difference < bestDifference) {
          bestDifference = difference;
          nearest = index;
        }
      });
      if (nearest === -1) return;

      if (disabledBlocks.has(nearest)) {
        setDisabledBlocks(previous => {
          const next = new Set(previous);
          next.delete(nearest);
          return next;
        });
      }
      if (collapsedBlocks.has(nearest)) {
        setCollapsedBlocks(previous => {
          const next = new Set(previous);
          next.delete(nearest);
          return next;
        });
      }
      // A disabled block has no DOM node until the state update has rendered it.
      requestAnimationFrame(() => {
        blockRefs.current[nearest]?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      });
      setHighlightedBlockIdx(nearest);
      setTimeout(() => setHighlightedBlockIdx(null), 2500);
      return;
    }

    if (!('rows' in tableData)) return;
    let option = jumpOptions.find(item => item.id === jumpProperty);
    let targetIndex = -1;

    if (jumpProperty === 'substance' && 'substance' in (tableData.rows[0] || {})) {
      const query = normalizeChemText(rawQuery);
      const normalizedRows = tableData.rows.map(row => {
        if (!('substance' in row)) return [];
        return [normalizeChemText(row.substance), 'formula' in row ? normalizeChemText(row.formula) : ''];
      });
      if (query) {
        targetIndex = normalizedRows.findIndex(values => values.some(value => value && value === query));
        if (targetIndex === -1) targetIndex = normalizedRows.findIndex(values => values.some(value => value && value.startsWith(query)));
        if (targetIndex === -1) targetIndex = normalizedRows.findIndex(values => values.some(value => value && value.includes(query)));
      }

      // Preserve the existing shortcut where a numeric query with Substance selected
      // searches the table's default numeric property.
      if (targetIndex === -1 && isNumeric) {
        const defaults: Record<string, string> = {
          critical_properties: 'M', specific_heat_300k: 'cp', specific_heat_poly: 'a',
          liquids: 'T_boil', solids: 'rho', foods: 'T_freeze',
        };
        option = jumpOptions.find(item => item.id === defaults[tableData.type]);
      }
    }

    if (targetIndex === -1 && isNumeric && option) {
      targetIndex = findNearestRow(option, tableData.rows.length, number);
    }
    if (targetIndex === -1) return;

    const columnId = option?.columnId ?? 'substance';
    if (tableData.type === 'saturated') {
      const group = ['vf', 'vg'].includes(columnId) ? 'volume'
        : ['uf', 'ufg', 'ug'].includes(columnId) ? 'energy'
        : ['hf', 'hfg', 'hg'].includes(columnId) ? 'enthalpy'
        : ['sf', 'sfg', 'sg'].includes(columnId) ? 'entropy' : null;
      if (group) setVisibleCols(previous => previous[group] ? previous : { ...previous, [group]: true });
    } else if (tableData.type === 'specific_heat_temp' && columnId.includes('_')) {
      const gas = columnId.split('_')[0];
      const key = `gas_${gas}`;
      setVisibleCols(previous => previous[key] === false ? { ...previous, [key]: true } : previous);
    } else if (tableData.type === 'liquids') {
      const group = LIQUID_GROUPS.find(g => (g.cols as readonly string[]).includes(columnId))?.id;
      if (group && !isPropertyVisible(group)) {
        setTablePropertyVisibility(previous => ({
          ...previous,
          [currentTableId]: { ...previous[currentTableId], [`property_${group}`]: true },
        }));
      }
    } else if (!isPropertyVisible(columnId)) {
      setTablePropertyVisibility(previous => ({
        ...previous,
        [currentTableId]: { ...previous[currentTableId], [`property_${columnId}`]: true },
      }));
    }

    const key = targetIndex.toString();
    setHighlightedRowIndex(key);
    requestAnimationFrame(() => {
      const row = findRowEl(key);
      const cell = row?.querySelector<HTMLElement>(`[data-col-id="${columnId}"]`);
      (cell || row)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    });
    setTimeout(() => setHighlightedRowIndex(null), 2000);
  };

  const togglePin = (key: string) => {
    setTablePinnedRows(prev => {
      const current = prev[currentTableId] || new Set<string>();
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...prev, [currentTableId]: next };
    });
  };

  const toggleColumnHighlight = useCallback((colId: string) => {
    setTableSelectedCols(prev => {
      const current = prev[currentTableId] || new Set<string>();
      const next = new Set(current);
      if (next.has(colId)) next.delete(colId);
      else next.add(colId);
      return { ...prev, [currentTableId]: next };
    });
  }, [currentTableId]);

  const toggleCol = (id: string) => {
    setVisibleCols(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const categories = [
    {
      id: 'volume',
      label: 'Specific Volume',
      unit: '(m³/kg)',
      cols: [
        { id: 'vf', label: 'Sat. liquid, vf' },
        { id: 'vg', label: 'Sat. vapor, vg' },
      ],
    },
    {
      id: 'energy',
      label: 'Int. Energy',
      unit: '(kJ/kg)',
      cols: [
        { id: 'uf', label: 'Sat. liquid, uf' },
        { id: 'ufg', label: 'Evap., ufg' },
        { id: 'ug', label: 'Sat. vapor, ug' },
      ],
    },
    {
      id: 'enthalpy',
      label: 'Enthalpy',
      unit: '(kJ/kg)',
      cols: [
        { id: 'hf', label: 'Sat. liquid, hf' },
        { id: 'hfg', label: 'Evap., hfg' },
        { id: 'hg', label: 'Sat. vapor, hg' },
      ],
    },
    {
      id: 'entropy',
      label: 'Entropy',
      unit: '(kJ/kg·K)',
      cols: [
        { id: 'sf', label: 'Sat. liquid, sf' },
        { id: 'sfg', label: 'Evap., sfg' },
        { id: 'sg', label: 'Sat. vapor, sg' },
      ],
    },
  ];

  const activeCategories = categories.filter(c => visibleCols[c.id]);
  const collapsedCategories = categories.filter(c => !visibleCols[c.id]);

  const activeA2bGases = A2B_GAS_GROUPS.filter(g => visibleCols[`gas_${g.id}`] !== false);
  const collapsedA2bGases = A2B_GAS_GROUPS.filter(g => visibleCols[`gas_${g.id}`] === false);

  const propertyColumns = tableData ? (PROPERTY_COLUMNS_BY_TYPE[tableData.type] ?? []) : [];
  const collapsedPropertyColumns = propertyColumns.filter(c => !isPropertyVisible(c.id));

  const activeLiquidGroups = LIQUID_GROUPS.filter(g => isPropertyVisible(g.id));
  const collapsedLiquidGroups = LIQUID_GROUPS.filter(g => !isPropertyVisible(g.id));

  const tableNote = (tableData?.type === 'liquids' || tableData?.type === 'foods')
    ? tableData.footnote
    : TABLE_NOTES[currentTableId];

  const filteredTables = SUPPORTED_TABLES.filter(t => {
    const q = tableSearchQuery.toLowerCase().trim();
    if (!q) return true;
    const cleanQ = q.replace(/[\s\-_]/g, '');
    const cleanId = t.id.toLowerCase().replace(/[\s\-_]/g, '');
    const cleanName = t.name.toLowerCase().replace(/[\s\-_]/g, '');

    return (
      cleanId.includes(cleanQ) ||
      cleanName.includes(cleanQ) ||
      t.name.toLowerCase().includes(q) ||
      t.title.toLowerCase().includes(q) ||
      t.state.toLowerCase().includes(q) ||
      t.substance.toLowerCase().includes(q) ||
      t.type.toLowerCase().includes(q)
    );
  });

  const handleSwitcherKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMenuSelectedIndex(prev => Math.min(prev + 1, filteredTables.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMenuSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredTables.length > 0 && filteredTables[menuSelectedIndex]) {
        switchTable(filteredTables[menuSelectedIndex].id);
      }
    }
  };

  const renderCollapsedPropertyHeaders = (rowSpan: number = 1) => {
    if (collapsedPropertyColumns.length === 0) return null;
    return (
      <>
        <th rowSpan={rowSpan} className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10 w-full" />
        {collapsedPropertyColumns.map(c => (
          <th
            key={c.id}
            rowSpan={rowSpan}
            className="w-8 sm:w-9 bg-gray-100 hover:bg-gray-200 dark:bg-gray-900 dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-800 border-l-2 border-l-gray-300 dark:border-l-gray-700 sticky top-0 z-20 transition-colors cursor-pointer"
            onClick={() => togglePropertyVisibility(c.id)}
            title={`Expand ${c.label}`}
          >
            <div className="h-full flex items-center justify-center py-2">
              <span className="[writing-mode:vertical-rl] text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider select-none">
                {c.label}
              </span>
            </div>
          </th>
        ))}
      </>
    );
  };

  const renderCollapsedPropertyCells = (rowIdx: number, totalRows: number) => {
    if (collapsedPropertyColumns.length === 0) return null;
    return (
      <>
        <td className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 p-0" />
        {rowIdx === 0 &&
          collapsedPropertyColumns.map(c => (
            <td
              key={c.id}
              rowSpan={totalRows}
              onClick={() => togglePropertyVisibility(c.id)}
              title={`Expand ${c.label}`}
              className="bg-gray-50 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800/80 border-l-2 border-l-gray-300 dark:border-l-gray-700 border-b-0 p-0 cursor-pointer transition-colors"
            />
          ))}
      </>
    );
  };

  const renderColHeader = (
    id: string,
    label: string,
    unit: string,
    widthClass: string = 'min-w-[85px]',
    unitType?: 'temp' | 'press',
    rowSpan?: number
  ) => {
    const isSelected = selectedCols.has(id);
    const isHovered = hoveredCol === id;
    const resolvedUnitType = unitType || (id === 'T' ? 'temp' : undefined);
    const isCollapsible = propertyColumns.some(c => c.id === id);

    return (
      <th
        rowSpan={rowSpan}
        data-col-id={id}
        className={cn(
          'px-2 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-20 select-none transition-colors h-12 sm:h-14 whitespace-nowrap cursor-pointer',
          widthClass,
          isSelected
            ? 'bg-red-100 text-red-950 dark:bg-[#3b1d2b] dark:text-white'
            : isHovered && 'bg-red-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
        )}
        onClick={() => toggleColumnHighlight(id)}
        onMouseEnter={() => handleMouseEnterCol(id)}
        onMouseLeave={handleMouseLeaveCol}
        title={isSelected ? 'Remove highlight' : `Highlight ${label} column`}
      >
        <div className="flex flex-col justify-center h-full gap-1.5 sm:gap-2 w-full">
          <div className="flex items-center gap-1">
            {isCollapsible && (
              <input
                type="checkbox"
                checked={true}
                onChange={() => togglePropertyVisibility(id)}
                onClick={e => e.stopPropagation()}
                aria-label={`Hide ${label} column`}
                title={`Hide ${label} column`}
                className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-[#c13726] accent-[#c13726] cursor-pointer shrink-0"
              />
            )}
            <span className="font-semibold text-xs text-gray-700 dark:text-gray-200">{label}</span>
            {resolvedUnitType === 'temp' ? (
              <select
                className="bg-transparent border-b border-gray-300 dark:border-gray-600 text-xs font-semibold focus:outline-none cursor-pointer hover:border-red-600 dark:hover:border-red-400 text-gray-700 dark:text-gray-200 transition-colors"
                value={tempUnit}
                onChange={e => setTempUnit(e.target.value as TempUnit)}
                onClick={e => e.stopPropagation()}
              >
                <option value="C" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">°C</option>
                <option value="K" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">K</option>
              </select>
            ) : resolvedUnitType === 'press' ? (
              <select
                className="bg-transparent border-b border-gray-300 dark:border-gray-600 text-xs font-semibold focus:outline-none cursor-pointer hover:border-red-600 dark:hover:border-red-400 text-gray-700 dark:text-gray-200 transition-colors"
                value={pressUnit}
                onChange={e => setPressUnit(e.target.value as PressUnit)}
                onClick={e => e.stopPropagation()}
              >
                <option value="MPa" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">MPa</option>
                <option value="kPa" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">kPa</option>
                <option value="bar" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">bar</option>
              </select>
            ) : unit ? (
              <span className="text-[10px] text-gray-500 dark:text-gray-400 font-normal">({unit})</span>
            ) : null}
          </div>
          <div className="flex items-center justify-between w-full">
            <Info
              className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 cursor-help shrink-0"
              onClick={(e) => e.stopPropagation()}
              onMouseEnter={(e) => showTooltip(TOOLTIPS[id] || label, e)}
              onMouseLeave={hideTooltip}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleColumnHighlight(id);
              }}
              className={cn(
                'p-1 rounded transition-colors shrink-0 cursor-pointer',
                isSelected
                  ? 'text-red-700 bg-red-200/90 dark:text-rose-200 dark:bg-rose-500/30 hover:bg-red-300 dark:hover:bg-rose-500/40'
                  : 'text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              )}
              title={isSelected ? 'Remove highlight' : `Highlight ${label} column`}
            >
              <Highlighter className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </th>
    );
  };

  const toggleTempHighlight = (tempStr: string, rKey: string, bIdx?: number) => {
    if (bIdx !== undefined) {
      setTableTouchedBlocks(prev => {
        const current = prev[currentTableId] || new Set<number>();
        const next = new Set(current);
        next.add(bIdx);
        return { ...prev, [currentTableId]: next };
      });
    }
    if (tempStr) {
      setTablePinnedTemps(prev => {
        const current = prev[currentTableId] || new Set<string>();
        const next = new Set(current);
        if (next.has(tempStr)) next.delete(tempStr);
        else next.add(tempStr);
        return { ...prev, [currentTableId]: next };
      });
    } else {
      togglePin(rKey);
    }
  };

  const renderProgressivePinCell = (
    onTogglePin: () => void,
    pinTitle: string,
    isPinned: boolean,
    isHighlighted: boolean,
    isHovered: boolean,
    canInsertBelow: boolean,
    onAddBelow: () => void,
    compact: boolean = false,
    addTitle: string = 'Insert interpolated row below'
  ) => (
    <td
      data-pin-cell="true"
      onClick={onTogglePin}
      className={cn(
        "w-14 min-w-[56px] px-1 border-b border-gray-100 dark:border-gray-800 sticky left-0 z-10 transition-colors cursor-pointer",
        compact ? "py-1.5" : "py-2",
        isPinned ? "bg-amber-100 dark:bg-[#332818]" : (isHovered ? "bg-red-50 dark:bg-gray-800" : "bg-white dark:bg-gray-900"),
        isHighlighted && "bg-indigo-200 dark:bg-[#23254b] border-indigo-200 dark:border-indigo-700 ring-1 ring-indigo-400 z-20"
      )}
      title={pinTitle}
    >
      <div className="flex items-center justify-center gap-0.5">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
          className={cn(
            "p-1 rounded transition-colors cursor-pointer",
            isPinned
              ? "text-amber-700 bg-amber-200/90 dark:text-amber-300 dark:bg-amber-500/30 shadow-sm"
              : "text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700",
            isHovered && !isPinned && "text-gray-500 dark:text-gray-300"
          )}
          title={pinTitle}
        >
          <Highlighter className="w-3.5 h-3.5" />
        </button>
        {canInsertBelow && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAddBelow(); }}
            className="p-0.5 rounded text-emerald-600/80 dark:text-emerald-400/80 hover:text-emerald-700 dark:hover:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition-colors cursor-pointer"
            title={addTitle}
            aria-label={addTitle}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </td>
  );

  const tUnitLabel = tempUnit === 'K' ? 'K' : '°C';
  const countInterpTrs = (rowCount: number, blockIdx?: number) =>
    solvedInterpolatedRows.filter(
      s => s.spec.blockIndex === blockIdx && s.spec.afterIndex >= 0 && s.spec.afterIndex < rowCount - 1
    ).length * 2;

  const saturatedVisibleCols: VisibleTableCol[] = tableData?.type === 'saturated'
    ? [
        ...(tableData.indexProperty === 'T'
          ? [
              { id: 'T', label: `T (${tUnitLabel})` },
              { id: 'P', label: `Psat (${pressUnit})`, isCategoryEnd: true },
            ]
          : [
              { id: 'P', label: `P (${pressUnit})` },
              { id: 'T', label: `Tsat (${tUnitLabel})`, isCategoryEnd: true },
            ]),
        ...activeCategories.flatMap((c) =>
          c.cols.map((col, colIdx) => ({
            id: col.id,
            label: col.label,
            isCategoryEnd: colIdx === c.cols.length - 1,
          }))
        ),
      ]
    : [];

  const airVisibleCols: VisibleTableCol[] = tableData?.type === 'ideal_gas_air'
    ? [
        { id: 'T', label: `Temp (${tUnitLabel})` },
        ...(isPropertyVisible('h') ? [{ id: 'h', label: 'h (kJ/kg)' }] : []),
        ...(isPropertyVisible('u') ? [{ id: 'u', label: 'u (kJ/kg)' }] : []),
        ...(isPropertyVisible('s_deg') ? [{ id: 's_deg', label: 's° (kJ/kg·K)' }] : []),
        ...(isPropertyVisible('s_plus') ? [{ id: 's_plus', label: 's+ (kJ/kg·K)' }] : []),
      ]
    : [];

  const molarVisibleCols: VisibleTableCol[] = tableData?.type === 'ideal_gas_molar'
    ? [
        { id: 'T', label: `Temp (${tUnitLabel})` },
        ...(isPropertyVisible('h_bar') ? [{ id: 'h_bar', label: 'h̄ (kJ/kmol)' }] : []),
        ...(isPropertyVisible('u_bar') ? [{ id: 'u_bar', label: 'ū (kJ/kmol)' }] : []),
        ...(isPropertyVisible('s_bar_deg') ? [{ id: 's_bar_deg', label: 's̄° (kJ/kmol·K)' }] : []),
      ]
    : [];

  const a2bVisibleCols: VisibleTableCol[] = tableData?.type === 'specific_heat_temp'
    ? [
        { id: 'T', label: `Temp (${tUnitLabel})`, isCategoryEnd: true },
        ...activeA2bGases.flatMap((g) => [
          { id: `${g.id}_cp`, label: `${g.label} cp` },
          { id: `${g.id}_cv`, label: `${g.label} cv` },
          { id: `${g.id}_k`, label: `${g.label} k`, isCategoryEnd: true },
        ]),
      ]
    : [];

  const renderIsobarBlockTable = (
    block: {
      rows: Array<{
        isSaturationState?: boolean;
        T?: ThermoValue;
        v: ThermoValue;
        u: ThermoValue;
        h: ThermoValue;
        s: ThermoValue;
      }>;
    },
    bIdx: number
  ) => {
    const isobarVisibleCols: VisibleTableCol[] = [
      { id: 'T', label: `Temp (${tUnitLabel})` },
      ...(isPropertyVisible('v') ? [{ id: 'v', label: 'v (m³/kg)' }] : []),
      ...(isPropertyVisible('u') ? [{ id: 'u', label: 'u (kJ/kg)' }] : []),
      ...(isPropertyVisible('h') ? [{ id: 'h', label: 'h (kJ/kg)' }] : []),
      ...(isPropertyVisible('s') ? [{ id: 's', label: 's (kJ/kg·K)' }] : []),
    ];
    const blockInterpTrs = countInterpTrs(block.rows.length, bIdx);

    return (
      <table className="w-full min-w-full text-left border-collapse" onMouseLeave={clearAllHover}>
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
            <th className="w-14 min-w-[56px] px-1 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 left-0 z-30 h-12 sm:h-14"></th>
            {renderColHeader('T', 'Temp', tUnitLabel, 'min-w-[68px]', 'temp')}
            {isPropertyVisible('v') && renderColHeader('v', 'v', 'm³/kg', 'min-w-[85px]')}
            {isPropertyVisible('u') && renderColHeader('u', 'u', 'kJ/kg', 'min-w-[85px]')}
            {isPropertyVisible('h') && renderColHeader('h', 'h', 'kJ/kg', 'min-w-[85px]')}
            {isPropertyVisible('s') && renderColHeader('s', 's', 'kJ/kg·K', 'min-w-[85px]')}
            {renderCollapsedPropertyHeaders()}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rIdx) => {
            const rKey = `${bIdx}-${rIdx}`;
            const tempStr = row.isSaturationState ? 'Sat' : (row.T?.s || '');
            const isRowPinned = Boolean((tempStr && pinnedTemps.has(tempStr)) || pinnedRows.has(rKey));
            const isHighlighted = highlightedRowIndex === rKey;
            const isHovered = hoveredRow === rKey;
            return (
              <React.Fragment key={rIdx}>
                <tr data-row-key={rKey} className="transition-colors bg-white dark:bg-gray-900">
                  {renderProgressivePinCell(
                    () => toggleTempHighlight(tempStr, rKey, bIdx),
                    isRowPinned ? `Unpin T = ${tempStr || 'Sat'}` : `Highlight T = ${tempStr || 'Sat'}`,
                    isRowPinned,
                    isHighlighted,
                    isHovered,
                    rIdx < block.rows.length - 1,
                    () => handleAddInterpolatedRow({
                      blockIndex: bIdx,
                      afterIndex: rIdx,
                      dominatingColId: 'T',
                      inputValue: '',
                    }),
                    true
                  )}
                  <Td colId="T" isRowHovered={isHovered} isPinned={isRowPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'T'} isColSelected={selectedCols.has('T')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.isSaturationState ? <span className="font-bold text-[#c13726] dark:text-red-400">Sat.</span> : formatTempDisplay(row.T)}</Td>
                  {isPropertyVisible('v') && <Td colId="v" isRowHovered={isHovered} isPinned={isRowPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'v'} isColSelected={selectedCols.has('v')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.v.s}</Td>}
                  {isPropertyVisible('u') && <Td colId="u" isRowHovered={isHovered} isPinned={isRowPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'u'} isColSelected={selectedCols.has('u')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.u.s}</Td>}
                  {isPropertyVisible('h') && <Td colId="h" isRowHovered={isHovered} isPinned={isRowPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'h'} isColSelected={selectedCols.has('h')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.h.s}</Td>}
                  {isPropertyVisible('s') && <Td colId="s" isRowHovered={isHovered} isPinned={isRowPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 's'} isColSelected={selectedCols.has('s')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.s.s}</Td>}
                  {renderCollapsedPropertyCells(rIdx, block.rows.length + blockInterpTrs)}
                </tr>
                {renderInterpRowsAfter(rIdx, isobarVisibleCols, collapsedPropertyColumns.length > 0, bIdx, true)}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    );
  };

  const renderInterpRowsAfter = (
    afterIdx: number,
    visibleColList: VisibleTableCol[],
    hasTrailingSpacer: boolean,
    blockIdx?: number,
    compactCard: boolean = false
  ) => {
    const matching = solvedInterpolatedRows.filter(
      s => s.spec.afterIndex === afterIdx && s.spec.blockIndex === blockIdx
    );
    if (matching.length === 0) return null;
    return matching.map(solved => (
      <InterpolatedRowGroup
        key={solved.spec.id}
        solved={solved}
        visibleCols={visibleColList}
        hasTrailingSpacer={hasTrailingSpacer}
        isPinned={pinnedRows.has(solved.spec.id)}
        isHighlighted={highlightedRowIndex === solved.spec.id}
        compactCard={compactCard}
        selectedCols={selectedCols}
        hoveredCol={hoveredCol}
        onMouseEnterCol={handleMouseEnterCol}
        onMouseLeaveCol={handleMouseLeaveCol}
        onUpdateInput={handleUpdateInterpInput}
        onSelectDominatingCol={handleSelectDominatingCol}
        onTogglePin={togglePin}
        onDelete={handleDeleteInterpRow}
        onToggleMoreDigits={handleToggleMoreDigits}
        onToggleAnalytic={handleToggleAnalytic}
        onSetEditing={handleSetInterpEditing}
        onRelocate={handleRelocateInterpRow}
      />
    ));
  };

  return (
    <>
      <TooltipPortal tooltip={tooltip} />
      <SnippetModal
        isOpen={isSnippetOpen}
        onClose={() => setIsSnippetOpen(false)}
        tableMeta={currentTable}
        tableData={tableData}
        tempUnit={tempUnit}
        pressUnit={pressUnit}
        visibleCols={snippetVisibleCols}
        pinnedRows={pinnedRows}
        pinnedTemps={pinnedTemps}
        pinnedBlocks={pinnedBlocks}
        touchedBlocks={touchedBlocks}
        disabledBlocks={disabledBlocks}
        selectedCols={selectedCols}
        interpolatedRows={solvedInterpolatedRows}
        onClearAllSelections={clearCurrentTableSelections}
      />
      {actionModalMode !== null && (
        <ActionMenuModal
          key={`${currentTableId}-${actionModalMode}`}
          isOpen={true}
          mode={actionModalMode}
          onClose={() => setActionModalMode(null)}
          tableData={tableData}
          tempUnit={tempUnit}
          pressUnit={pressUnit}
          jumpValue={jumpValue}
          onChangeJumpValue={setJumpValue}
          jumpProperty={jumpProperty}
          onChangeJumpProperty={setJumpProperty}
          jumpSuperheatedUnit={jumpSuperheatedUnit}
          onChangeJumpSuperheatedUnit={(unit) => {
            setJumpSuperheatedUnit(unit);
            setPressUnit(unit);
          }}
          jumpOptions={jumpOptions}
          onJump={handleJump}
          isProgressive={isProgressive}
          progressiveCols={progressiveCols}
          onAddInterpolatedRow={handleAddInterpolatedRow}
          activeSnippetRowCount={activeSnippetRowCount}
          onOpenSnippet={() => setIsSnippetOpen(true)}
        />
      )}
      <div
        className="h-screen h-dvh w-screen overflow-hidden bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col pt-0 pb-0 px-0 m-0 relative"
        onMouseMove={handleRootMouseMove}
        onMouseLeave={clearAllHover}
      >
        {/* Top Header / Red Bar */}
        <div
          className="bg-[#c13726] dark:bg-[#852115] text-white px-2.5 py-1.5 sm:px-4 sm:py-2 flex flex-col md:flex-row md:items-center justify-between gap-1.5 sm:gap-2.5 shrink-0 relative z-[100] shadow-md border-b border-[#a82e1f] dark:border-black/30"
          onMouseEnter={clearAllHover}
        >
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
                <span className="text-base sm:text-xl font-bold tracking-wide uppercase text-white drop-shadow-sm leading-tight">
                  {currentTable.name}
                </span>

                {/* Switch Table Compact Glyph Button */}
                <div className="relative" ref={switcherRef}>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setIsSwitcherOpen(prev => !prev)}
                      className="inline-flex items-center justify-center p-1 sm:p-1.5 text-white/90 bg-white/15 hover:bg-white/25 active:bg-white/30 rounded border border-white/25 transition-colors cursor-pointer"
                      title="Switch Table"
                    >
                      <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <ChevronDown className="w-3 h-3 ml-0.5 opacity-80" />
                    </button>
                    <span className="hidden sm:inline-block text-[9px] font-medium text-white/60 border border-white/20 rounded px-1 tracking-wider uppercase pointer-events-none">Tab</span>
                  </div>

                  {isSwitcherOpen && (
                    <div className="fixed left-3 right-3 top-12 sm:absolute sm:top-full sm:left-0 sm:right-auto sm:mt-2 sm:w-[460px] bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 z-[110] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                      <div className="p-2.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded px-2.5 py-1 flex-1">
                          <Search className="w-3.5 h-3.5 text-gray-400" />
                          <input 
                            type="text"
                            placeholder="Search table (e.g. A17, A-4, water)..."
                            value={tableSearchQuery}
                            onChange={(e) => setTableSearchQuery(e.target.value)}
                            onKeyDown={handleSwitcherKeyDown}
                            className="w-full text-xs bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none"
                            autoFocus
                          />
                        </div>
                        <button 
                          onClick={() => setIsSwitcherOpen(false)}
                          className="p-1 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="max-h-[340px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                        {filteredTables.map((t, idx) => {
                          const isSelected = t.id === currentTableId;
                          const isMenuFocused = idx === menuSelectedIndex;
                          return (
                            <div
                              key={t.id}
                              onClick={() => {
                                switchTable(t.id);
                              }}
                              className={cn(
                                "p-2.5 hover:bg-red-50/70 dark:hover:bg-red-950/40 cursor-pointer transition-colors flex flex-col gap-1 text-left",
                                isSelected && "bg-red-50/80 dark:bg-red-950/60",
                                isMenuFocused && !isSelected && "bg-gray-100 dark:bg-gray-800",
                                isMenuFocused && isSelected && "ring-2 ring-[#c13726] dark:ring-red-500 ring-inset"
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className={cn("text-xs font-bold", isSelected ? "text-[#c13726] dark:text-red-400" : "text-gray-900 dark:text-gray-100")}>
                                  {t.name}: {t.title}
                                </span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-[#c13726] dark:text-red-400 shrink-0" />}
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                  {t.state}
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800/60">
                                  {t.substance}
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200/70 dark:border-purple-800/60">
                                  {t.type}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                        {filteredTables.length === 0 && (
                          <div className="p-4 text-center text-xs text-gray-500 dark:text-gray-400">
                            No tables match your query.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Tags + Description/Notes Toggle */}
                <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-semibold bg-black/20 text-white border border-white/20 backdrop-blur-sm leading-tight">
                    {currentTable.state}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-semibold bg-black/20 text-white border border-white/20 backdrop-blur-sm leading-tight">
                    {currentTable.substance}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-semibold bg-black/20 text-white border border-white/20 backdrop-blur-sm leading-tight">
                    {currentTable.type}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsDescOpen(prev => !prev)}
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-white/15 hover:bg-white/25 active:bg-white/30 text-white border border-white/25 cursor-pointer transition-colors leading-tight"
                    title="Toggle table description & notes"
                    aria-expanded={isDescOpen}
                  >
                    <Info className="w-3 h-3" />
                    <ChevronDown className={cn("w-3 h-3 transition-transform", isDescOpen && "rotate-180")} />
                  </button>
                </div>
              </div>

              {/* Mobile Compact Action Button (+ / Menu) */}
              <button
                type="button"
                onClick={() => setActionModalMode('mobile')}
                className="md:hidden inline-flex items-center gap-1 px-2 py-1 rounded bg-white/15 hover:bg-white/25 active:bg-white/30 text-white border border-white/25 shrink-0 cursor-pointer transition-colors"
                aria-label="Open menu: jump, interpolate, snippet"
                title="Jump to row, interpolate, or capture snippet"
              >
                <Menu className="w-4 h-4" />
                {activeSnippetRowCount > 0 && (
                  <span className="inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-400 text-gray-950 leading-tight">
                    {activeSnippetRowCount}
                  </span>
                )}
              </button>
            </div>

            {isDescOpen && (
              <div className="text-[11px] sm:text-xs text-white/95 bg-black/20 border border-white/15 rounded px-2.5 py-1.5 mt-0.5 max-w-3xl leading-relaxed space-y-1">
                <p>{currentTable.description}</p>
                {tableNote && <p className="text-white/80 border-t border-white/15 pt-1">{tableNote}</p>}
              </div>
            )}
          </div>
          
          {/* Desktop Jump-to, Interpolate & Snippet Controls */}
          <div className="hidden md:flex flex-nowrap items-center gap-1.5 bg-black/15 dark:bg-black/25 p-1.5 rounded-md border border-white/20 dark:border-white/15 shrink-0 text-gray-900 dark:text-gray-100 relative">
            <Search className="w-4 h-4 text-white/80 ml-1 shrink-0" />
            
            {(tableData?.type === 'superheated' || tableData?.type === 'compressed') ? (
              <div className="flex items-center gap-1">
                <div className="relative flex items-center">
                  <input
                    ref={jumpInputRef}
                    type="number"
                    step="any"
                    aria-label="Pressure to jump to"
                    className="bg-white dark:bg-black/35 border border-white/30 dark:border-white/20 text-gray-900 dark:text-white rounded px-2 py-1 text-sm h-8 w-28 focus:outline-none focus:ring-2 focus:ring-white/50 dark:focus:ring-white/35 tabular-nums placeholder-gray-400 dark:placeholder-white/45"
                    placeholder="Pressure"
                    value={jumpValue}
                    onChange={(e) => setJumpValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleJump()}
                  />
                  {!jumpValue && <span className="absolute right-2 text-[9px] font-semibold text-gray-400 dark:text-white/45 pointer-events-none">Ctrl+K</span>}
                </div>
                <select
                  aria-label="Pressure unit"
                  className="bg-white dark:bg-black/35 border border-white/30 dark:border-white/20 text-gray-900 dark:text-white rounded px-2 py-1 text-sm h-8 focus:outline-none focus:ring-2 focus:ring-white/50 dark:focus:ring-white/35 cursor-pointer font-medium shrink-0"
                  value={jumpSuperheatedUnit}
                  onChange={(e) => {
                    const unit = e.target.value as PressUnit;
                    setJumpSuperheatedUnit(unit);
                    setPressUnit(unit);
                  }}
                >
                  <option value="MPa" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">MPa</option>
                  <option value="kPa" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">kPa</option>
                  <option value="bar" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">bar</option>
                </select>
              </div>
            ) : (
              <>
                <div className="relative flex items-center">
                  <input
                    ref={jumpInputRef}
                    type={jumpProperty === 'substance' ? 'text' : 'number'}
                    step={jumpProperty === 'substance' ? undefined : 'any'}
                    aria-label={jumpProperty === 'substance' ? 'Substance or formula to jump to' : 'Value to jump to'}
                    className="bg-white dark:bg-black/35 border border-white/30 dark:border-white/20 text-gray-900 dark:text-white rounded px-2 py-1 text-sm h-8 w-28 focus:outline-none focus:ring-2 focus:ring-white/50 dark:focus:ring-white/35 tabular-nums placeholder-gray-400 dark:placeholder-white/45"
                    placeholder={jumpProperty === 'substance' ? 'Name' : 'Value'}
                    value={jumpValue}
                    onChange={(e) => setJumpValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleJump()}
                  />
                  {!jumpValue && <span className="absolute right-2 text-[9px] font-semibold text-gray-400 dark:text-white/45 pointer-events-none">Ctrl+K</span>}
                </div>
                <select
                  aria-label="Jump property"
                  title={jumpProperty === 'substance' ? 'Substance' : jumpOptions.find(option => option.id === jumpProperty)?.label}
                  className="bg-white dark:bg-black/35 border border-white/30 dark:border-white/20 text-gray-900 dark:text-white rounded px-2 py-1 text-sm h-8 w-36 focus:outline-none focus:ring-2 focus:ring-white/50 dark:focus:ring-white/35 cursor-pointer font-medium shrink-0"
                  value={jumpProperty}
                  onChange={(e) => setJumpProperty(e.target.value)}
                >
                  {tableData && 'rows' in tableData && tableData.rows.length > 0 && 'substance' in tableData.rows[0] && (
                    <option value="substance" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">Name</option>
                  )}
                  {jumpOptions.map(option => (
                    <option key={option.id} value={option.id} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">{option.label}</option>
                  ))}
                </select>
              </>
            )}
            
            <button 
              className="bg-white dark:bg-white/15 hover:bg-red-50 dark:hover:bg-white/25 active:bg-red-100 dark:active:bg-white/30 text-[#c13726] dark:text-white border border-transparent dark:border-white/25 font-semibold px-2.5 py-0.5 h-8 rounded text-sm shadow-sm transition-colors cursor-pointer shrink-0"
              onClick={handleJump}
            >
              Jump
            </button>

            {isProgressive && (
              <>
                <div className="h-5 w-px bg-white/25 shrink-0 mx-0.5" />
                <button
                  type="button"
                  onClick={() => setActionModalMode('interpolate')}
                  className="inline-flex items-center justify-center w-8 h-8 rounded text-sm font-semibold bg-emerald-600/90 hover:bg-emerald-500 active:bg-emerald-700 text-white border border-emerald-300/40 transition-colors cursor-pointer shrink-0 shadow-sm"
                  title="Add interpolated row"
                  aria-label="Add interpolated row"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                </button>
              </>
            )}

            <div className="h-5 w-px bg-white/25 shrink-0 mx-0.5" />

            <button
              type="button"
              onClick={() => setIsSnippetOpen(true)}
              className={cn(
                "inline-flex items-center justify-center px-2.5 py-0.5 h-8 rounded text-sm font-semibold transition-colors cursor-pointer shrink-0 border",
                activeSnippetRowCount > 0
                  ? "bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-gray-950 border-amber-300 shadow-sm"
                  : "bg-white/15 hover:bg-white/25 active:bg-white/30 text-white border-white/25"
              )}
              title={
                activeSnippetRowCount > 0
                  ? `Capture snippet (${activeSnippetRowCount} rows highlighted)`
                  : "Capture snippet from highlighted rows/columns"
              }
              aria-label="Screen capture snippet"
            >
              <Crop className="w-4 h-4 shrink-0" />
              {activeSnippetRowCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[11px] font-bold bg-black/80 text-amber-300 leading-tight">
                  {activeSnippetRowCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Sub-table switcher bar for A-2(a,b,c) and A-3(a,b,c) */}
        {(currentTableId.startsWith('A-2') || currentTableId.startsWith('A-3')) && (
          <div
            className="bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-2.5 sm:px-4 py-1 flex items-center justify-between gap-2 shrink-0 flex-wrap"
            onMouseEnter={clearAllHover}
          >
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="hidden sm:inline text-xs font-semibold text-gray-500 dark:text-gray-400 mr-1">
                {currentTableId.startsWith('A-2') ? 'Table A-2 Parts:' : 'Table A-3 Parts:'}
              </span>
              {(currentTableId.startsWith('A-2')
                ? [
                    { id: 'A-2a', label: '(a) 300 K' },
                    { id: 'A-2b', label: '(b) Varying T' },
                    { id: 'A-2c', label: '(c) Polynomial' },
                  ]
                : [
                    { id: 'A-3a', label: '(a) Liquids' },
                    { id: 'A-3b', label: '(b) Solids' },
                    { id: 'A-3c', label: '(c) Foods' },
                  ]
              ).map(part => {
                const active = currentTableId === part.id;
                return (
                  <button
                    key={part.id}
                    type="button"
                    onClick={() => switchTable(part.id)}
                    className={cn(
                      'px-2 py-0.5 rounded text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer border',
                      active
                        ? 'bg-[#c13726] text-white border-[#a82e1f] shadow-sm'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-gray-700'
                    )}
                  >
                    {part.label}
                  </button>
                );
              })}
            </div>
            {currentTableId === 'A-2c' && (
              <span className="hidden md:inline-block text-xs font-mono text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 px-2.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                c̄p = a + bT + cT² + dT³ &nbsp;(T in K, c̄p in kJ/kmol·K)
              </span>
            )}
          </div>
        )}

        {/* Main Table Content */}
        <div className="flex-1 min-h-0 relative bg-white dark:bg-gray-950">
          <div ref={tableRef} className="absolute inset-0 overflow-auto" onMouseLeave={clearAllHover}>
            {/* 1. Saturated Tables View */}
            {tableData?.type === 'saturated' && (
              <table className="min-w-full border-collapse border-spacing-0 text-left" onMouseLeave={clearAllHover}>
                <thead>
                  <tr>
                    <th rowSpan={2} className="w-14 min-w-[56px] bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 left-0 z-40 h-14"></th>
                    
                    {/* Index Col 1: Temp or Pressure */}
                    {tableData.indexProperty === 'T' ? (
                      <>
                        <th 
                          rowSpan={2} 
                          data-col-id="T"
                          className={cn(
                            "px-2 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-30 transition-colors h-14 select-none min-w-[70px] whitespace-nowrap cursor-pointer", 
                            selectedCols.has('T') ? "bg-red-100 text-red-950 dark:bg-[#3b1d2b] dark:text-white" : (hoveredCol === 'T' && "bg-red-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100")
                          )} 
                          onClick={() => toggleColumnHighlight('T')}
                          onMouseEnter={() => handleMouseEnterCol('T')} 
                          onMouseLeave={handleMouseLeaveCol}
                          title={selectedCols.has('T') ? "Remove highlight" : "Highlight Temp column"}
                        >
                          <div className="flex flex-col justify-center h-full gap-2 w-full">
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <span className="font-semibold text-xs">Temp</span>
                              <select 
                                className="bg-transparent border-b border-gray-300 dark:border-gray-600 text-xs font-semibold focus:outline-none cursor-pointer hover:border-red-600 dark:hover:border-red-400 text-gray-700 dark:text-gray-200 transition-colors"
                                value={tempUnit}
                                onChange={e => setTempUnit(e.target.value as TempUnit)}
                              >
                                <option value="C" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">°C</option>
                                <option value="K" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">K</option>
                              </select>
                            </div>
                            <div className="flex items-center justify-between w-full">
                              <Info
                                className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 cursor-help"
                                onClick={(e) => e.stopPropagation()}
                                onMouseEnter={(e) => showTooltip(TOOLTIPS['T'], e)}
                                onMouseLeave={hideTooltip}
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleColumnHighlight('T');
                                }}
                                className={cn(
                                  "p-1 rounded transition-colors shrink-0 cursor-pointer",
                                  selectedCols.has('T') ? "text-red-700 bg-red-200/90 dark:text-rose-200 dark:bg-rose-500/30 hover:bg-red-300 dark:hover:bg-rose-500/40" : "text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                                )}
                                title={selectedCols.has('T') ? "Remove highlight" : "Highlight Temp column"}
                              >
                                <Highlighter className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </th>

                        <th 
                          rowSpan={2} 
                          data-col-id="P"
                          className={cn(
                            "px-2 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 border-b border-r-2 border-r-gray-300 dark:border-r-gray-700 sticky top-0 z-30 transition-colors h-14 select-none min-w-[70px] whitespace-nowrap cursor-pointer", 
                            selectedCols.has('P') ? "bg-red-100 text-red-950 dark:bg-[#3b1d2b] dark:text-white" : (hoveredCol === 'P' && "bg-red-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100")
                          )} 
                          onClick={() => toggleColumnHighlight('P')}
                          onMouseEnter={() => handleMouseEnterCol('P')} 
                          onMouseLeave={handleMouseLeaveCol}
                          title={selectedCols.has('P') ? "Remove highlight" : "Highlight Psat column"}
                        >
                          <div className="flex flex-col justify-center h-full gap-2 w-full">
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <span className="font-semibold text-xs">Psat</span>
                              <select 
                                className="bg-transparent border-b border-gray-300 dark:border-gray-600 text-xs font-semibold focus:outline-none cursor-pointer hover:border-red-600 dark:hover:border-red-400 text-gray-700 dark:text-gray-200 transition-colors"
                                value={pressUnit}
                                onChange={e => setPressUnit(e.target.value as PressUnit)}
                              >
                                <option value="kPa" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">kPa</option>
                                <option value="MPa" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">MPa</option>
                                <option value="bar" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">bar</option>
                              </select>
                            </div>
                            <div className="flex items-center justify-between w-full">
                              <Info
                                className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 cursor-help"
                                onClick={(e) => e.stopPropagation()}
                                onMouseEnter={(e) => showTooltip(TOOLTIPS['P'], e)}
                                onMouseLeave={hideTooltip}
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleColumnHighlight('P');
                                }}
                                className={cn(
                                  "p-1 rounded transition-colors shrink-0 cursor-pointer",
                                  selectedCols.has('P') ? "text-red-700 bg-red-200/90 dark:text-rose-200 dark:bg-rose-500/30 hover:bg-red-300 dark:hover:bg-rose-500/40" : "text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                                )}
                                title={selectedCols.has('P') ? "Remove highlight" : "Highlight Psat column"}
                              >
                                <Highlighter className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </th>
                      </>
                    ) : (
                      <>
                        <th 
                          rowSpan={2} 
                          data-col-id="P"
                          className={cn(
                            "px-2 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-30 transition-colors h-14 select-none min-w-[70px] whitespace-nowrap cursor-pointer", 
                            selectedCols.has('P') ? "bg-red-100 text-red-950 dark:bg-[#3b1d2b] dark:text-white" : (hoveredCol === 'P' && "bg-red-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100")
                          )} 
                          onClick={() => toggleColumnHighlight('P')}
                          onMouseEnter={() => handleMouseEnterCol('P')} 
                          onMouseLeave={handleMouseLeaveCol}
                          title={selectedCols.has('P') ? "Remove highlight" : "Highlight Press column"}
                        >
                          <div className="flex flex-col justify-center h-full gap-2 w-full">
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <span className="font-semibold text-xs">Press</span>
                              <select 
                                className="bg-transparent border-b border-gray-300 dark:border-gray-600 text-xs font-semibold focus:outline-none cursor-pointer hover:border-red-600 dark:hover:border-red-400 text-gray-700 dark:text-gray-200 transition-colors"
                                value={pressUnit}
                                onChange={e => setPressUnit(e.target.value as PressUnit)}
                              >
                                <option value="kPa" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">kPa</option>
                                <option value="MPa" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">MPa</option>
                                <option value="bar" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">bar</option>
                              </select>
                            </div>
                            <div className="flex items-center justify-between w-full">
                              <Info
                                className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 cursor-help"
                                onClick={(e) => e.stopPropagation()}
                                onMouseEnter={(e) => showTooltip(TOOLTIPS['P'], e)}
                                onMouseLeave={hideTooltip}
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleColumnHighlight('P');
                                }}
                                className={cn(
                                  "p-1 rounded transition-colors shrink-0 cursor-pointer",
                                  selectedCols.has('P') ? "text-red-700 bg-red-200/90 dark:text-rose-200 dark:bg-rose-500/30 hover:bg-red-300 dark:hover:bg-rose-500/40" : "text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                                )}
                                title={selectedCols.has('P') ? "Remove highlight" : "Highlight Press column"}
                              >
                                <Highlighter className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </th>

                        <th 
                          rowSpan={2} 
                          data-col-id="T"
                          className={cn(
                            "px-2 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 border-b border-r-2 border-r-gray-300 dark:border-r-gray-700 sticky top-0 z-30 transition-colors h-14 select-none min-w-[70px] whitespace-nowrap cursor-pointer", 
                            selectedCols.has('T') ? "bg-red-100 text-red-950 dark:bg-[#3b1d2b] dark:text-white" : (hoveredCol === 'T' && "bg-red-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100")
                          )} 
                          onClick={() => toggleColumnHighlight('T')}
                          onMouseEnter={() => handleMouseEnterCol('T')} 
                          onMouseLeave={handleMouseLeaveCol}
                          title={selectedCols.has('T') ? "Remove highlight" : "Highlight Tsat column"}
                        >
                          <div className="flex flex-col justify-center h-full gap-2 w-full">
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <span className="font-semibold text-xs">Tsat</span>
                              <select 
                                className="bg-transparent border-b border-gray-300 dark:border-gray-600 text-xs font-semibold focus:outline-none cursor-pointer hover:border-red-600 dark:hover:border-red-400 text-gray-700 dark:text-gray-200 transition-colors"
                                value={tempUnit}
                                onChange={e => setTempUnit(e.target.value as TempUnit)}
                              >
                                <option value="C" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">°C</option>
                                <option value="K" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">K</option>
                              </select>
                            </div>
                            <div className="flex items-center justify-between w-full">
                              <Info
                                className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 cursor-help"
                                onClick={(e) => e.stopPropagation()}
                                onMouseEnter={(e) => showTooltip(TOOLTIPS['T'], e)}
                                onMouseLeave={hideTooltip}
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleColumnHighlight('T');
                                }}
                                className={cn(
                                  "p-1 rounded transition-colors shrink-0 cursor-pointer",
                                  selectedCols.has('T') ? "text-red-700 bg-red-200/90 dark:text-rose-200 dark:bg-rose-500/30 hover:bg-red-300 dark:hover:bg-rose-500/40" : "text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                                )}
                                title={selectedCols.has('T') ? "Remove highlight" : "Highlight Tsat column"}
                              >
                                <Highlighter className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </th>
                      </>
                    )}

                    {/* Active Category Headers */}
                    {activeCategories.map((c) => (
                      <th key={c.id} colSpan={c.cols.length} className="px-2 py-2 text-sm font-medium text-center text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 border-r-2 border-r-gray-300 dark:border-r-gray-700 sticky top-0 z-20 h-14">
                        <div className="flex flex-col items-center justify-center h-full gap-1">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={true} onChange={() => toggleCol(c.id)} className="rounded border-gray-300 dark:border-gray-600 text-[#c13726] dark:text-red-500 focus:ring-[#c13726] dark:focus:ring-red-500 dark:bg-gray-800 cursor-pointer" />
                            <span className="font-semibold text-xs md:text-sm">{c.label} {c.unit}</span>
                          </label>
                        </div>
                      </th>
                    ))}

                    <th rowSpan={2} className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10 w-full" />

                    {collapsedCategories.map((c) => (
                      <th 
                        key={c.id} 
                        rowSpan={2} 
                        className="w-10 bg-gray-100 hover:bg-gray-200 dark:bg-gray-900 dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-800 border-l-2 border-l-gray-300 dark:border-l-gray-700 sticky top-0 z-20 transition-colors cursor-pointer"
                        onClick={() => toggleCol(c.id)}
                        title={`Expand ${c.label}`}
                      >
                        <div className="h-full flex items-center justify-center py-2">
                          <span className="[writing-mode:vertical-rl] text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider select-none">
                            {c.label}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>

                  {/* Subheaders */}
                  <tr>
                    {activeCategories.map((c) => 
                      c.cols.map((col, colIdx) => (
                        <SubHeader 
                          key={col.id} 
                          label={col.label} 
                          prop={col.id} 
                          colId={col.id} 
                          isCategoryEnd={colIdx === c.cols.length - 1} 
                          isHovered={hoveredCol === col.id}
                          isSelected={selectedCols.has(col.id)}
                          onToggleHighlight={toggleColumnHighlight}
                          onMouseEnterCol={handleMouseEnterCol}
                          onMouseLeaveCol={handleMouseLeaveCol}
                          onShowTooltip={showTooltip}
                          onHideTooltip={hideTooltip}
                        />
                      ))
                    )}
                  </tr>
                </thead>

                <tbody>
                  {tableData.rows.map((row, idx) => {
                    const rKey = idx.toString();
                    const isPinned = pinnedRows.has(rKey);
                    const isHighlighted = highlightedRowIndex === rKey;
                    const isHovered = hoveredRow === rKey;

                    return (
                      <React.Fragment key={idx}>
                        <tr
                          data-row-key={rKey}
                          ref={el => { rowRefs.current[rKey] = el; }}
                          className="transition-colors bg-white dark:bg-gray-900"
                        >
                          {renderProgressivePinCell(
                            () => togglePin(rKey),
                            isPinned ? "Unpin row" : "Highlight row",
                            isPinned,
                            isHighlighted,
                            isHovered,
                            idx < tableData.rows.length - 1,
                            () => handleAddInterpolatedRow({
                              afterIndex: idx,
                              dominatingColId: tableData.indexProperty,
                              inputValue: '',
                            })
                          )}

                        {tableData.indexProperty === 'T' ? (
                          <>
                            <Td 
                              colId="T" 
                              isRowHovered={isHovered} 
                              isPinned={isPinned} 
                              isHighlighted={isHighlighted}
                              isColHovered={hoveredCol === 'T'}
                              isColSelected={selectedCols.has('T')}
                              onMouseEnterCol={handleMouseEnterCol}
                              onMouseLeaveCol={handleMouseLeaveCol}
                            >
                              {formatTempDisplay(row.T)}
                            </Td>
                            <Td 
                              colId="P" 
                              isRowHovered={isHovered} 
                              isPinned={isPinned} 
                              isHighlighted={isHighlighted} 
                              isCategoryEnd={true}
                              isColHovered={hoveredCol === 'P'}
                              isColSelected={selectedCols.has('P')}
                              onMouseEnterCol={handleMouseEnterCol}
                              onMouseLeaveCol={handleMouseLeaveCol}
                            >
                              {formatPressDisplay(row.P)}
                            </Td>
                          </>
                        ) : (
                          <>
                            <Td 
                              colId="P" 
                              isRowHovered={isHovered} 
                              isPinned={isPinned} 
                              isHighlighted={isHighlighted}
                              isColHovered={hoveredCol === 'P'}
                              isColSelected={selectedCols.has('P')}
                              onMouseEnterCol={handleMouseEnterCol}
                              onMouseLeaveCol={handleMouseLeaveCol}
                            >
                              {formatPressDisplay(row.P)}
                            </Td>
                            <Td 
                              colId="T" 
                              isRowHovered={isHovered} 
                              isPinned={isPinned} 
                              isHighlighted={isHighlighted} 
                              isCategoryEnd={true}
                              isColHovered={hoveredCol === 'T'}
                              isColSelected={selectedCols.has('T')}
                              onMouseEnterCol={handleMouseEnterCol}
                              onMouseLeaveCol={handleMouseLeaveCol}
                            >
                              {formatTempDisplay(row.T)}
                            </Td>
                          </>
                        )}
                        
                        {activeCategories.map((c) => 
                          c.cols.map((col, colIdx) => {
                            const valObj = (row as Record<string, ThermoValue | undefined>)[col.id];
                            return (
                              <Td 
                                key={col.id} 
                                colId={col.id} 
                                isRowHovered={isHovered} 
                                isPinned={isPinned} 
                                isHighlighted={isHighlighted}
                                isCategoryEnd={colIdx === c.cols.length - 1}
                                isColHovered={hoveredCol === col.id}
                                isColSelected={selectedCols.has(col.id)}
                                onMouseEnterCol={handleMouseEnterCol}
                                onMouseLeaveCol={handleMouseLeaveCol}
                              >
                                {valObj ? valObj.s : '-'}
                              </Td>
                            );
                          })
                        )}
                        
                        <td className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 p-0" />

                        {idx === 0 && collapsedCategories.map((c) => (
                          <td
                            key={c.id}
                            rowSpan={tableData.rows.length + countInterpTrs(tableData.rows.length)}
                            className="bg-gray-50 dark:bg-gray-900 border-l-2 border-l-gray-300 dark:border-l-gray-700 border-b-0 p-0"
                          />
                        ))}
                      </tr>
                      {renderInterpRowsAfter(idx, saturatedVisibleCols, true)}
                    </React.Fragment>
                  );
                })}
                </tbody>
              </table>
            )}

{/* 2. Superheated / Compressed Tables View */}
            {(tableData?.type === 'superheated' || tableData?.type === 'compressed') && (
              <div className="flex flex-col w-full h-full bg-gray-100 dark:bg-gray-950 overflow-hidden relative">
                
                {/* Filter Menu Toggle & Actions */}
                <div className="bg-white dark:bg-gray-900 px-2.5 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 sticky top-0 z-20 shrink-0 shadow-sm flex-wrap gap-2">
                  <span className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {tableData.blocks.length - disabledBlocks.size} of {tableData.blocks.length} isobars visible
                  </span>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2 py-1 rounded text-xs">
                      <span className="font-semibold text-gray-600 dark:text-gray-300">Press:</span>
                      <select
                        aria-label="Isobar pressure unit"
                        value={pressUnit}
                        onChange={e => {
                          const unit = e.target.value as PressUnit;
                          setPressUnit(unit);
                          setJumpSuperheatedUnit(unit);
                        }}
                        className="bg-transparent border-b border-gray-300 dark:border-gray-600 font-semibold text-gray-800 dark:text-gray-200 cursor-pointer focus:outline-none hover:border-red-600 dark:hover:border-red-400 transition-colors"
                      >
                        <option value="MPa" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">MPa</option>
                        <option value="kPa" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">kPa</option>
                        <option value="bar" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">bar</option>
                      </select>
                    </div>

                    <div className="relative" ref={filterMenuRef}>
                      <button 
                        onClick={() => setShowBlockFilter(!showBlockFilter)}
                        className="px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 rounded text-gray-700 dark:text-gray-200 transition-colors cursor-pointer flex items-center gap-1"
                      >
                        Filter Isobars
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    {showBlockFilter && (
                      <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl rounded-lg z-50 flex flex-col max-h-96">
                        <div className="p-2 border-b border-gray-100 dark:border-gray-800 flex justify-between bg-gray-50 dark:bg-gray-800/80 rounded-t-lg">
                          <button onClick={() => setDisabledBlocks(new Set())} className="text-xs text-[#c13726] dark:text-red-400 hover:underline font-semibold cursor-pointer">Enable All</button>
                          <button onClick={() => setDisabledBlocks(new Set(tableData.blocks.map((_,i)=>i)))} className="text-xs text-gray-500 dark:text-gray-400 hover:underline cursor-pointer">Disable All</button>
                        </div>
                        <div className="overflow-y-auto p-2 flex flex-col gap-0.5">
                          {tableData.blocks.map((b, bIdx) => (
                            <label key={bIdx} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-1.5 rounded transition-colors">
                              <input 
                                type="checkbox" 
                                checked={!disabledBlocks.has(bIdx)} 
                                onChange={(e) => {
                                  setDisabledBlocks(prev => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.delete(bIdx);
                                    else next.add(bIdx);
                                    return next;
                                  });
                                }}
                                className="accent-[#c13726] dark:accent-red-500 w-4 h-4 cursor-pointer"
                              />
                              <span className="font-medium text-gray-700 dark:text-gray-200">P = {formatIsobarPress(b.P)}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    </div>
                  </div>
                </div>

                {/* Main Scrollable Area */}
                <div className="flex-1 overflow-y-auto relative p-1.5 sm:p-4 flex flex-col gap-3 sm:gap-6" onMouseLeave={clearAllHover}>
                  
                  {/* Pinned Section (Top Row) */}
                  {pinnedBlocks.size > 0 && (
                    <div className="flex flex-col gap-2 shrink-0">
                      <div className="flex items-center gap-2 px-1">
                        <Pin className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <h3 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Pinned Isobars</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                        {Array.from(pinnedBlocks).map(bIdx => {
                          const block = tableData.blocks[bIdx];
                          if (!block) return null;
                          const isBlockHighlighted = highlightedBlockIdx === bIdx;
                          return (
                            <div 
                              key={`pinned-${bIdx}`} 
                              className={cn(
                                "bg-white dark:bg-gray-900 border-2 rounded shadow-sm flex flex-col overflow-hidden transition-all duration-300 min-w-0 w-full",
                                isBlockHighlighted 
                                  ? "border-indigo-500 ring-4 ring-indigo-400 dark:border-indigo-400 dark:ring-indigo-500/60 shadow-xl" 
                                  : "border-amber-300 dark:border-amber-600/70"
                              )}
                            >
                               <div className="bg-amber-100 dark:bg-amber-950/70 px-2.5 sm:px-3 py-1.5 sm:py-2 flex items-center justify-between border-b border-amber-200 dark:border-amber-800/60">
                                 <span className="text-sm font-bold text-amber-900 dark:text-amber-200">
                                   P = {formatIsobarPress(block.P)} {block.Tsat.s !== 'N/A' && <span className="font-semibold text-amber-700 dark:text-amber-300 ml-1">({formatSatTemp(block.Tsat)})</span>}
                                 </span>
                                 <button onClick={() => {
                                   setPinnedBlocks(prev => { const n = new Set(prev); n.delete(bIdx); return n; });
                                 }} className="p-1 hover:bg-amber-200 dark:hover:bg-amber-900/60 rounded text-amber-700 dark:text-amber-300 cursor-pointer" title="Unpin">
                                   <X className="w-4 h-4" />
                                 </button>
                               </div>
                               <div className="overflow-x-auto w-full">
                                 {renderIsobarBlockTable(block, bIdx)}
                               </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Main Grid */}
                  <div className="flex flex-col gap-2 relative">
                    <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1">All Isobars</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                      {tableData.blocks.map((block, bIdx) => {
                        if (disabledBlocks.has(bIdx)) return null;
                        const isCollapsed = collapsedBlocks.has(bIdx);
                        const isPinned = pinnedBlocks.has(bIdx);
                        
                        const isBlockHighlighted = highlightedBlockIdx === bIdx;
                        
                        return (
                          <div 
                            key={bIdx} 
                            ref={el => { blockRefs.current[bIdx] = el; }}
                            className={cn(
                              "bg-white dark:bg-gray-900 border rounded shadow-sm flex flex-col overflow-hidden transition-all duration-300 min-w-0 w-full", 
                              isCollapsed && "col-span-full",
                              isBlockHighlighted ? "border-indigo-500 ring-4 ring-indigo-400 dark:border-indigo-400 dark:ring-indigo-500/60 shadow-xl" : "border-gray-200 dark:border-gray-800"
                            )}
                          >
                            <div className="bg-gray-50 dark:bg-gray-800/80 px-2.5 sm:px-3 py-1.5 sm:py-2 flex items-center justify-between border-b border-gray-200 dark:border-gray-800">
                               <div className="flex items-center gap-2">
                                 <button onClick={() => {
                                   setCollapsedBlocks(prev => { const n = new Set(prev); if(n.has(bIdx)) n.delete(bIdx); else n.add(bIdx); return n; });
                                 }} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400 cursor-pointer" title={isCollapsed ? "Expand" : "Collapse"}>
                                   {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                 </button>
                                 <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
                                   P = {formatIsobarPress(block.P)} {block.Tsat.s !== 'N/A' && <span className="font-semibold text-gray-500 dark:text-gray-400 ml-1">({formatSatTemp(block.Tsat)})</span>}
                                 </span>
                               </div>
                               <div className="flex items-center gap-1">
                                 <button onClick={() => {
                                   setPinnedBlocks(prev => { const n = new Set(prev); if(n.has(bIdx)) n.delete(bIdx); else n.add(bIdx); return n; });
                                 }} className={cn("p-1.5 rounded transition-colors cursor-pointer", isPinned ? "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300" : "hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500")} title={isPinned ? "Unpin block" : "Pin block to top"}>
                                   <Pin className="w-4 h-4" />
                                 </button>
                               </div>
                            </div>
                            
                            {!isCollapsed && (
                              <div className="overflow-x-auto w-full">
                                {renderIsobarBlockTable(block, bIdx)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Ideal Gas Air View (A-17) */}
            {tableData?.type === 'ideal_gas_air' && (
              <table className="w-full min-w-full text-left border-collapse" onMouseLeave={clearAllHover}>
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                    <th className="w-14 min-w-[56px] px-1 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 left-0 z-30 h-12 sm:h-14"></th>
                    {renderColHeader('T', 'Temp', tempUnit === 'C' ? '°C' : 'K', 'min-w-[70px]', 'temp')}
                    {isPropertyVisible('h') && renderColHeader('h', 'h', 'kJ/kg', 'min-w-[85px]')}
                    {isPropertyVisible('u') && renderColHeader('u', 'u', 'kJ/kg', 'min-w-[85px]')}
                    {isPropertyVisible('s_deg') && renderColHeader('s_deg', 's°', 'kJ/kg·K', 'min-w-[85px]')}
                    {isPropertyVisible('s_plus') && renderColHeader('s_plus', 's+', 'kJ/kg·K', 'min-w-[85px]')}
                    {renderCollapsedPropertyHeaders()}
                  </tr>
                </thead>
                <tbody>
                  {tableData.rows.map((row: IdealGasAirRow, idx: number) => {
                    const rKey = idx.toString();
                    const isPinned = pinnedRows.has(rKey);
                    const isHighlighted = highlightedRowIndex === rKey;
                    const isHovered = hoveredRow === rKey;
                    const tLabel = `${formatTempFromKDisplay(row.T)} ${tUnitLabel}`;
                    return (
                      <React.Fragment key={idx}>
                        <tr
                          data-row-key={rKey}
                          ref={el => { rowRefs.current[rKey] = el; }}
                          className="transition-colors bg-white dark:bg-gray-900"
                        >
                          {renderProgressivePinCell(
                            () => togglePin(rKey),
                            isPinned ? `Unpin T = ${tLabel}` : `Highlight T = ${tLabel}`,
                            isPinned,
                            isHighlighted,
                            isHovered,
                            idx < tableData.rows.length - 1,
                            () => handleAddInterpolatedRow({
                              afterIndex: idx,
                              dominatingColId: 'T',
                              inputValue: '',
                            }),
                            true
                          )}
                          <Td colId="T" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'T'} isColSelected={selectedCols.has('T')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{formatTempFromKDisplay(row.T)}</Td>
                          {isPropertyVisible('h') && <Td colId="h" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'h'} isColSelected={selectedCols.has('h')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.h.s}</Td>}
                          {isPropertyVisible('u') && <Td colId="u" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'u'} isColSelected={selectedCols.has('u')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.u.s}</Td>}
                          {isPropertyVisible('s_deg') && <Td colId="s_deg" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 's_deg'} isColSelected={selectedCols.has('s_deg')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.s_deg.s}</Td>}
                          {isPropertyVisible('s_plus') && <Td colId="s_plus" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 's_plus'} isColSelected={selectedCols.has('s_plus')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.s_plus?.s || '-'}</Td>}
                          {renderCollapsedPropertyCells(idx, tableData.rows.length + countInterpTrs(tableData.rows.length))}
                        </tr>
                        {renderInterpRowsAfter(idx, airVisibleCols, collapsedPropertyColumns.length > 0)}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* 4. Molar Ideal Gas View (A-18, A-19) */}
            {tableData?.type === 'ideal_gas_molar' && (
              <table className="w-full min-w-full text-left border-collapse" onMouseLeave={clearAllHover}>
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                    <th className="w-14 min-w-[56px] px-1 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 left-0 z-30 h-12 sm:h-14"></th>
                    {renderColHeader('T', 'Temp', tempUnit === 'C' ? '°C' : 'K', 'min-w-[70px]', 'temp')}
                    {isPropertyVisible('h_bar') && renderColHeader('h_bar', 'h̄', 'kJ/kmol', 'min-w-[90px]')}
                    {isPropertyVisible('u_bar') && renderColHeader('u_bar', 'ū', 'kJ/kmol', 'min-w-[90px]')}
                    {isPropertyVisible('s_bar_deg') && renderColHeader('s_bar_deg', 's̄°', 'kJ/kmol·K', 'min-w-[90px]')}
                    {renderCollapsedPropertyHeaders()}
                  </tr>
                </thead>
                <tbody>
                  {tableData.rows.map((row: IdealGasMolarRow, idx: number) => {
                    const rKey = idx.toString();
                    const isPinned = pinnedRows.has(rKey);
                    const isHighlighted = highlightedRowIndex === rKey;
                    const isHovered = hoveredRow === rKey;
                    const tLabel = `${formatTempFromKDisplay(row.T)} ${tUnitLabel}`;
                    return (
                      <React.Fragment key={idx}>
                        <tr
                          data-row-key={rKey}
                          ref={el => { rowRefs.current[rKey] = el; }}
                          className="transition-colors bg-white dark:bg-gray-900"
                        >
                          {renderProgressivePinCell(
                            () => togglePin(rKey),
                            isPinned ? `Unpin T = ${tLabel}` : `Highlight T = ${tLabel}`,
                            isPinned,
                            isHighlighted,
                            isHovered,
                            idx < tableData.rows.length - 1,
                            () => handleAddInterpolatedRow({
                              afterIndex: idx,
                              dominatingColId: 'T',
                              inputValue: '',
                            }),
                            true
                          )}
                          <Td colId="T" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'T'} isColSelected={selectedCols.has('T')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{formatTempFromKDisplay(row.T)}</Td>
                          {isPropertyVisible('h_bar') && <Td colId="h_bar" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'h_bar'} isColSelected={selectedCols.has('h_bar')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.h_bar.s}</Td>}
                          {isPropertyVisible('u_bar') && <Td colId="u_bar" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'u_bar'} isColSelected={selectedCols.has('u_bar')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.u_bar.s}</Td>}
                          {isPropertyVisible('s_bar_deg') && <Td colId="s_bar_deg" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 's_bar_deg'} isColSelected={selectedCols.has('s_bar_deg')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.s_bar_deg.s}</Td>}
                          {renderCollapsedPropertyCells(idx, tableData.rows.length + countInterpTrs(tableData.rows.length))}
                        </tr>
                        {renderInterpRowsAfter(idx, molarVisibleCols, collapsedPropertyColumns.length > 0)}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* 5. Critical Properties View (Table A-1) */}
            {tableData?.type === 'critical_properties' && (
              <table className="w-full min-w-full text-left border-collapse" onMouseLeave={clearAllHover}>
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                    <th className="w-8 sm:w-9 min-w-[32px] sm:min-w-[36px] px-1 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 left-0 z-30 h-12 sm:h-14"></th>
                    {renderColHeader('substance', 'Substance', '', 'min-w-[160px]')}
                    {isPropertyVisible('formula') && renderColHeader('formula', 'Formula', '', 'min-w-[90px]')}
                    {isPropertyVisible('M') && renderColHeader('M', 'Molar Mass, M', 'kg/kmol', 'min-w-[120px]')}
                    {isPropertyVisible('R') && renderColHeader('R', 'Gas Const., R', 'kJ/kg·K', 'min-w-[120px]')}
                    {isPropertyVisible('T_cr') && renderColHeader('T_cr', 'Crit. Temp., T_cr', tempUnit === 'C' ? '°C' : 'K', 'min-w-[130px]', 'temp')}
                    {isPropertyVisible('P_cr') && renderColHeader('P_cr', 'Crit. Press., P_cr', pressUnit, 'min-w-[130px]', 'press')}
                    {isPropertyVisible('v_cr') && renderColHeader('v_cr', 'Crit. Vol., v_cr', 'm³/kmol', 'min-w-[130px]')}
                    {renderCollapsedPropertyHeaders()}
                  </tr>
                </thead>
                <tbody>
                  {tableData.rows.map((row, idx) => {
                    const rKey = idx.toString();
                    const isPinned = pinnedRows.has(rKey);
                    const isHighlighted = highlightedRowIndex === rKey;
                    const isHovered = hoveredRow === rKey;
                    return (
                      <tr
                        key={idx}
                        data-row-key={rKey}
                        ref={el => { rowRefs.current[rKey] = el; }}
                        className="transition-colors bg-white dark:bg-gray-900"
                      >
                        <td
                          data-pin-cell="true"
                          onClick={() => togglePin(rKey)}
                          className={cn(
                            'w-8 sm:w-9 min-w-[32px] sm:min-w-[36px] px-1 py-1.5 border-b border-gray-100 dark:border-gray-800 sticky left-0 z-10 flex items-center justify-center transition-colors cursor-pointer',
                            isPinned ? 'bg-amber-100 dark:bg-[#332818]' : isHovered ? 'bg-red-50 dark:bg-gray-800' : 'bg-white dark:bg-gray-900',
                            isHighlighted && 'bg-indigo-200 dark:bg-[#23254b] ring-1 ring-indigo-400 z-20'
                          )}
                          title={isPinned ? `Unpin ${row.substance}` : `Highlight ${row.substance}`}
                        >
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); togglePin(rKey); }}
                            className={cn('p-1 rounded cursor-pointer transition-colors', isPinned ? 'text-amber-700 bg-amber-200/90 dark:text-amber-300 dark:bg-amber-500/30' : 'text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300')}
                            title={isPinned ? `Unpin ${row.substance}` : `Highlight ${row.substance}`}
                          >
                            <Highlighter className="w-3.5 h-3.5" />
                          </button>
                        </td>
                        <Td colId="substance" align="left" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'substance'} isColSelected={selectedCols.has('substance')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.substance}</Td>
                        {isPropertyVisible('formula') && <Td colId="formula" align="left" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'formula'} isColSelected={selectedCols.has('formula')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.formula}</Td>}
                        {isPropertyVisible('M') && <Td colId="M" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'M'} isColSelected={selectedCols.has('M')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.M.s}</Td>}
                        {isPropertyVisible('R') && <Td colId="R" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'R'} isColSelected={selectedCols.has('R')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.R.s}</Td>}
                        {isPropertyVisible('T_cr') && <Td colId="T_cr" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'T_cr'} isColSelected={selectedCols.has('T_cr')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{formatTempFromKDisplay(row.T_cr)}</Td>}
                        {isPropertyVisible('P_cr') && <Td colId="P_cr" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'P_cr'} isColSelected={selectedCols.has('P_cr')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{formatPressFromMPaDisplay(row.P_cr)}</Td>}
                        {isPropertyVisible('v_cr') && <Td colId="v_cr" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'v_cr'} isColSelected={selectedCols.has('v_cr')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.v_cr ? row.v_cr.s : '—'}</Td>}
                        {renderCollapsedPropertyCells(idx, tableData.rows.length)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* 6. Specific Heats at 300 K View (Table A-2a) */}
            {tableData?.type === 'specific_heat_300k' && (
              <table className="w-full min-w-full text-left border-collapse" onMouseLeave={clearAllHover}>
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                    <th className="w-8 sm:w-9 min-w-[32px] sm:min-w-[36px] px-1 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 left-0 z-30 h-12 sm:h-14"></th>
                    {renderColHeader('substance', 'Gas', '', 'min-w-[160px]')}
                    {isPropertyVisible('formula') && renderColHeader('formula', 'Formula', '', 'min-w-[90px]')}
                    {isPropertyVisible('R') && renderColHeader('R', 'Gas Const., R', 'kJ/kg·K', 'min-w-[120px]')}
                    {isPropertyVisible('cp') && renderColHeader('cp', 'cp', 'kJ/kg·K', 'min-w-[110px]')}
                    {isPropertyVisible('cv') && renderColHeader('cv', 'cv', 'kJ/kg·K', 'min-w-[110px]')}
                    {isPropertyVisible('k') && renderColHeader('k', 'k', '', 'min-w-[90px]')}
                    {renderCollapsedPropertyHeaders()}
                  </tr>
                </thead>
                <tbody>
                  {tableData.rows.map((row, idx) => {
                    const rKey = idx.toString();
                    const isPinned = pinnedRows.has(rKey);
                    const isHighlighted = highlightedRowIndex === rKey;
                    const isHovered = hoveredRow === rKey;
                    return (
                      <tr
                        key={idx}
                        data-row-key={rKey}
                        ref={el => { rowRefs.current[rKey] = el; }}
                        className="transition-colors bg-white dark:bg-gray-900"
                      >
                        <td
                          data-pin-cell="true"
                          onClick={() => togglePin(rKey)}
                          className={cn(
                            'w-8 sm:w-9 min-w-[32px] sm:min-w-[36px] px-1 py-1.5 border-b border-gray-100 dark:border-gray-800 sticky left-0 z-10 flex items-center justify-center transition-colors cursor-pointer',
                            isPinned ? 'bg-amber-100 dark:bg-[#332818]' : isHovered ? 'bg-red-50 dark:bg-gray-800' : 'bg-white dark:bg-gray-900',
                            isHighlighted && 'bg-indigo-200 dark:bg-[#23254b] ring-1 ring-indigo-400 z-20'
                          )}
                          title={isPinned ? `Unpin ${row.substance}` : `Highlight ${row.substance}`}
                        >
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); togglePin(rKey); }}
                            className={cn('p-1 rounded cursor-pointer transition-colors', isPinned ? 'text-amber-700 bg-amber-200/90 dark:text-amber-300 dark:bg-amber-500/30' : 'text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300')}
                            title={isPinned ? `Unpin ${row.substance}` : `Highlight ${row.substance}`}
                          >
                            <Highlighter className="w-3.5 h-3.5" />
                          </button>
                        </td>
                        <Td colId="substance" align="left" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'substance'} isColSelected={selectedCols.has('substance')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.substance}</Td>
                        {isPropertyVisible('formula') && <Td colId="formula" align="left" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'formula'} isColSelected={selectedCols.has('formula')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.formula}</Td>}
                        {isPropertyVisible('R') && <Td colId="R" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'R'} isColSelected={selectedCols.has('R')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.R.s}</Td>}
                        {isPropertyVisible('cp') && <Td colId="cp" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'cp'} isColSelected={selectedCols.has('cp')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.cp.s}</Td>}
                        {isPropertyVisible('cv') && <Td colId="cv" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'cv'} isColSelected={selectedCols.has('cv')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.cv.s}</Td>}
                        {isPropertyVisible('k') && <Td colId="k" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'k'} isColSelected={selectedCols.has('k')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.k.s}</Td>}
                        {renderCollapsedPropertyCells(idx, tableData.rows.length)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* 7. Specific Heats at Various Temperatures View (Table A-2b) */}
            {tableData?.type === 'specific_heat_temp' && (
              <table className="min-w-full border-collapse border-spacing-0 text-left" onMouseLeave={clearAllHover}>
                <thead>
                  <tr>
                    <th rowSpan={2} className="w-14 min-w-[56px] bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 left-0 z-40 h-14"></th>
                    <th
                      rowSpan={2}
                      data-col-id="T"
                      className={cn(
                        'px-2 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 border-b border-r-2 border-r-gray-300 dark:border-r-gray-700 sticky top-0 z-30 transition-colors h-14 select-none min-w-[75px] whitespace-nowrap cursor-pointer',
                        selectedCols.has('T') ? 'bg-red-100 text-red-950 dark:bg-[#3b1d2b] dark:text-white' : hoveredCol === 'T' && 'bg-red-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                      )}
                      onClick={() => toggleColumnHighlight('T')}
                      onMouseEnter={() => handleMouseEnterCol('T')}
                      onMouseLeave={handleMouseLeaveCol}
                      title={selectedCols.has('T') ? 'Remove highlight' : 'Highlight Temp column'}
                    >
                      <div className="flex flex-col justify-center h-full gap-2 w-full">
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <span className="font-semibold text-xs">Temp.</span>
                          <select
                            className="bg-transparent border-b border-gray-300 dark:border-gray-600 text-xs font-semibold focus:outline-none cursor-pointer hover:border-red-600 dark:hover:border-red-400 text-gray-700 dark:text-gray-200 transition-colors"
                            value={tempUnit}
                            onChange={e => setTempUnit(e.target.value as TempUnit)}
                          >
                            <option value="C" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">°C</option>
                            <option value="K" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">K</option>
                          </select>
                        </div>
                        <div className="flex items-center justify-between w-full">
                          <Info
                            className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 cursor-help"
                            onClick={(e) => e.stopPropagation()}
                            onMouseEnter={(e) => showTooltip(TOOLTIPS['T'], e)}
                            onMouseLeave={hideTooltip}
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleColumnHighlight('T');
                            }}
                            className={cn(
                              'p-1 rounded transition-colors shrink-0 cursor-pointer',
                              selectedCols.has('T') ? 'text-red-700 bg-red-200/90 dark:text-rose-200 dark:bg-rose-500/30 hover:bg-red-300 dark:hover:bg-rose-500/40' : 'text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                            )}
                            title={selectedCols.has('T') ? 'Remove highlight' : 'Highlight Temp column'}
                          >
                            <Highlighter className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </th>

                    {activeA2bGases.map((g) => (
                      <th
                        key={g.id}
                        colSpan={3}
                        className="px-2 py-2 text-sm font-medium text-center text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 border-r-2 border-r-gray-300 dark:border-r-gray-700 sticky top-0 z-20 h-14 whitespace-nowrap"
                      >
                        <div className="flex flex-col items-center justify-center h-full gap-1">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={true}
                              onChange={() => toggleCol(`gas_${g.id}`)}
                              className="rounded border-gray-300 dark:border-gray-600 text-[#c13726] dark:text-red-500 focus:ring-[#c13726] dark:focus:ring-red-500 dark:bg-gray-800 cursor-pointer"
                            />
                            <span className="font-semibold text-xs md:text-sm">{g.label}</span>
                          </label>
                        </div>
                      </th>
                    ))}

                    <th rowSpan={2} className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10 w-full" />

                    {collapsedA2bGases.map((g) => (
                      <th
                        key={g.id}
                        rowSpan={2}
                        className="w-10 bg-gray-100 hover:bg-gray-200 dark:bg-gray-900 dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-800 border-l-2 border-l-gray-300 dark:border-l-gray-700 sticky top-0 z-20 transition-colors cursor-pointer"
                        onClick={() => toggleCol(`gas_${g.id}`)}
                        title={`Expand ${g.label}`}
                      >
                        <div className="h-full flex items-center justify-center py-2">
                          <span className="[writing-mode:vertical-rl] text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider select-none">
                            {g.label}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>

                  <tr>
                    {activeA2bGases.map((g) => {
                      const subCols = [
                        { id: `${g.id}_cp`, label: 'cp (kJ/kg·K)', prop: 'cp' },
                        { id: `${g.id}_cv`, label: 'cv (kJ/kg·K)', prop: 'cv' },
                        { id: `${g.id}_k`, label: 'k', prop: 'k' },
                      ];
                      return subCols.map((sc, sIdx) => (
                        <SubHeader
                          key={sc.id}
                          label={sc.label}
                          prop={sc.prop}
                          colId={sc.id}
                          isCategoryEnd={sIdx === 2}
                          isHovered={hoveredCol === sc.id}
                          isSelected={selectedCols.has(sc.id)}
                          onToggleHighlight={toggleColumnHighlight}
                          onMouseEnterCol={handleMouseEnterCol}
                          onMouseLeaveCol={handleMouseLeaveCol}
                          onShowTooltip={showTooltip}
                          onHideTooltip={hideTooltip}
                        />
                      ));
                    })}
                  </tr>
                </thead>
                <tbody>
                  {tableData.rows.map((row, idx) => {
                    const rKey = idx.toString();
                    const isPinned = pinnedRows.has(rKey);
                    const isHighlighted = highlightedRowIndex === rKey;
                    const isHovered = hoveredRow === rKey;
                    const tLabel = `${formatTempFromKDisplay(row.T)} ${tUnitLabel}`;
                    return (
                      <React.Fragment key={idx}>
                        <tr
                          data-row-key={rKey}
                          ref={el => { rowRefs.current[rKey] = el; }}
                          className="transition-colors bg-white dark:bg-gray-900"
                        >
                          {renderProgressivePinCell(
                            () => togglePin(rKey),
                            isPinned ? `Unpin T = ${tLabel}` : `Highlight T = ${tLabel}`,
                            isPinned,
                            isHighlighted,
                            isHovered,
                            idx < tableData.rows.length - 1,
                            () => handleAddInterpolatedRow({
                              afterIndex: idx,
                              dominatingColId: 'T',
                              inputValue: '',
                            })
                          )}

                        <Td
                          colId="T"
                          isRowHovered={isHovered}
                          isPinned={isPinned}
                          isHighlighted={isHighlighted}
                          isCategoryEnd={true}
                          isColHovered={hoveredCol === 'T'}
                          isColSelected={selectedCols.has('T')}
                          onMouseEnterCol={handleMouseEnterCol}
                          onMouseLeaveCol={handleMouseLeaveCol}
                        >
                          {formatTempFromKDisplay(row.T)}
                        </Td>

                        {activeA2bGases.map((g) => {
                          const triplet = row[g.id];
                          const subCols: { id: string; val: ThermoValue }[] = [
                            { id: `${g.id}_cp`, val: triplet.cp },
                            { id: `${g.id}_cv`, val: triplet.cv },
                            { id: `${g.id}_k`, val: triplet.k },
                          ];
                          return subCols.map((sc, sIdx) => (
                            <Td
                              key={sc.id}
                              colId={sc.id}
                              isRowHovered={isHovered}
                              isPinned={isPinned}
                              isHighlighted={isHighlighted}
                              isCategoryEnd={sIdx === 2}
                              isColHovered={hoveredCol === sc.id}
                              isColSelected={selectedCols.has(sc.id)}
                              onMouseEnterCol={handleMouseEnterCol}
                              onMouseLeaveCol={handleMouseLeaveCol}
                            >
                              {sc.val ? sc.val.s : '—'}
                            </Td>
                          ));
                        })}

                        <td className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 p-0" />

                        {idx === 0 &&
                          collapsedA2bGases.map((g) => (
                            <td
                              key={g.id}
                              rowSpan={tableData.rows.length + countInterpTrs(tableData.rows.length)}
                              className="bg-gray-50 dark:bg-gray-900 border-l-2 border-l-gray-300 dark:border-l-gray-700 border-b-0 p-0"
                            />
                          ))}
                      </tr>
                      {renderInterpRowsAfter(idx, a2bVisibleCols, true)}
                    </React.Fragment>
                  );
                })}
                </tbody>
              </table>
            )}

            {/* 8. Polynomial Specific Heats View (Table A-2c) */}
            {tableData?.type === 'specific_heat_poly' && (
              <table className="w-full min-w-full text-left border-collapse" onMouseLeave={clearAllHover}>
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                    <th className="w-8 sm:w-9 min-w-[32px] sm:min-w-[36px] px-1 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 left-0 z-30 h-12 sm:h-14"></th>
                    {renderColHeader('substance', 'Substance', '', 'min-w-[160px]')}
                    {isPropertyVisible('formula') && renderColHeader('formula', 'Formula', '', 'min-w-[90px]')}
                    {isPropertyVisible('a') && renderColHeader('a', 'a', '', 'min-w-[90px]')}
                    {isPropertyVisible('b') && renderColHeader('b', 'b', '', 'min-w-[100px]')}
                    {isPropertyVisible('c') && renderColHeader('c', 'c', '', 'min-w-[100px]')}
                    {isPropertyVisible('d') && renderColHeader('d', 'd', '', 'min-w-[100px]')}
                    {isPropertyVisible('tempRange') && renderColHeader('tempRange', 'Temp. Range', tempUnit === 'C' ? '°C' : 'K', 'min-w-[140px]', 'temp')}
                    {isPropertyVisible('errorMax') && renderColHeader('errorMax', 'Max. Error', '%', 'min-w-[100px]')}
                    {isPropertyVisible('errorAvg') && renderColHeader('errorAvg', 'Avg. Error', '%', 'min-w-[100px]')}
                    {renderCollapsedPropertyHeaders()}
                  </tr>
                </thead>
                <tbody>
                  {tableData.rows.map((row, idx) => {
                    const rKey = idx.toString();
                    const isPinned = pinnedRows.has(rKey);
                    const isHighlighted = highlightedRowIndex === rKey;
                    const isHovered = hoveredRow === rKey;
                    return (
                      <tr
                        key={idx}
                        data-row-key={rKey}
                        ref={el => { rowRefs.current[rKey] = el; }}
                        className="transition-colors bg-white dark:bg-gray-900"
                      >
                        <td
                          data-pin-cell="true"
                          onClick={() => togglePin(rKey)}
                          className={cn(
                            'w-8 sm:w-9 min-w-[32px] sm:min-w-[36px] px-1 py-1.5 border-b border-gray-100 dark:border-gray-800 sticky left-0 z-10 flex items-center justify-center transition-colors cursor-pointer',
                            isPinned ? 'bg-amber-100 dark:bg-[#332818]' : isHovered ? 'bg-red-50 dark:bg-gray-800' : 'bg-white dark:bg-gray-900',
                            isHighlighted && 'bg-indigo-200 dark:bg-[#23254b] ring-1 ring-indigo-400 z-20'
                          )}
                          title={isPinned ? `Unpin ${row.substance}` : `Highlight ${row.substance}`}
                        >
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); togglePin(rKey); }}
                            className={cn('p-1 rounded cursor-pointer transition-colors', isPinned ? 'text-amber-700 bg-amber-200/90 dark:text-amber-300 dark:bg-amber-500/30' : 'text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300')}
                            title={isPinned ? `Unpin ${row.substance}` : `Highlight ${row.substance}`}
                          >
                            <Highlighter className="w-3.5 h-3.5" />
                          </button>
                        </td>
                        <Td colId="substance" align="left" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'substance'} isColSelected={selectedCols.has('substance')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.substance}</Td>
                        {isPropertyVisible('formula') && <Td colId="formula" align="left" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'formula'} isColSelected={selectedCols.has('formula')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.formula}</Td>}
                        {isPropertyVisible('a') && <Td colId="a" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'a'} isColSelected={selectedCols.has('a')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.a.s}</Td>}
                        {isPropertyVisible('b') && <Td colId="b" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'b'} isColSelected={selectedCols.has('b')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.b.s}</Td>}
                        {isPropertyVisible('c') && <Td colId="c" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'c'} isColSelected={selectedCols.has('c')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.c.s}</Td>}
                        {isPropertyVisible('d') && <Td colId="d" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'd'} isColSelected={selectedCols.has('d')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.d.s}</Td>}
                        {isPropertyVisible('tempRange') && <Td colId="tempRange" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'tempRange'} isColSelected={selectedCols.has('tempRange')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{`${formatTempFromKDisplay(row.T_min)}–${formatTempFromKDisplay(row.T_max)}`}</Td>}
                        {isPropertyVisible('errorMax') && <Td colId="errorMax" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'errorMax'} isColSelected={selectedCols.has('errorMax')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.errorMax.s}</Td>}
                        {isPropertyVisible('errorAvg') && <Td colId="errorAvg" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'errorAvg'} isColSelected={selectedCols.has('errorAvg')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.errorAvg.s}</Td>}
                        {renderCollapsedPropertyCells(idx, tableData.rows.length)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* 9. Properties of Common Liquids View (Table A-3a) */}
            {tableData?.type === 'liquids' && (
              <table className="min-w-full border-collapse border-spacing-0 text-left" onMouseLeave={clearAllHover}>
                <thead>
                  <tr>
                    <th rowSpan={2} className="w-10 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 left-0 z-40 h-14"></th>
                    {renderColHeader('substance', 'Substance', '', 'min-w-[160px] border-r-2 border-r-gray-300 dark:border-r-gray-700', undefined, 2)}
                    {activeLiquidGroups.map(g => (
                      <th
                        key={g.id}
                        colSpan={g.cols.length}
                        className="px-2 py-2 text-xs md:text-sm font-semibold text-center text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 border-r-2 border-r-gray-300 dark:border-r-gray-700 sticky top-0 z-20 h-12 whitespace-nowrap"
                      >
                        <div className="flex items-center justify-center h-full">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={true}
                              onChange={() => togglePropertyVisibility(g.id)}
                              className="rounded border-gray-300 dark:border-gray-600 text-[#c13726] dark:text-red-500 focus:ring-[#c13726] dark:focus:ring-red-500 dark:bg-gray-800 cursor-pointer"
                            />
                            <span>{g.label}</span>
                          </label>
                        </div>
                      </th>
                    ))}
                    {collapsedLiquidGroups.length > 0 && (
                      <th rowSpan={2} className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10 w-full" />
                    )}
                    {collapsedLiquidGroups.map(g => (
                      <th
                        key={g.id}
                        rowSpan={2}
                        className="w-9 sm:w-10 bg-gray-100 hover:bg-gray-200 dark:bg-gray-900 dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-800 border-l-2 border-l-gray-300 dark:border-l-gray-700 sticky top-0 z-20 transition-colors cursor-pointer"
                        onClick={() => togglePropertyVisibility(g.id)}
                        title={`Expand ${g.label}`}
                      >
                        <div className="h-full flex items-center justify-center py-2">
                          <span className="[writing-mode:vertical-rl] text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider select-none">
                            {g.label}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {isPropertyVisible('liq_boil') && (
                      <>
                        <SubHeader
                          label="Normal Boiling Point"
                          prop="T_boil"
                          colId="T_boil"
                          isCategoryEnd={false}
                          isHovered={hoveredCol === 'T_boil'}
                          isSelected={selectedCols.has('T_boil')}
                          onToggleHighlight={toggleColumnHighlight}
                          onMouseEnterCol={handleMouseEnterCol}
                          onMouseLeaveCol={handleMouseLeaveCol}
                          onShowTooltip={showTooltip}
                          onHideTooltip={hideTooltip}
                          unitType="temp"
                          tempUnit={tempUnit}
                          onChangeTempUnit={setTempUnit}
                        />
                        <SubHeader
                          label="h_fg (kJ/kg)"
                          prop="h_fg"
                          colId="h_fg"
                          isCategoryEnd={true}
                          isHovered={hoveredCol === 'h_fg'}
                          isSelected={selectedCols.has('h_fg')}
                          onToggleHighlight={toggleColumnHighlight}
                          onMouseEnterCol={handleMouseEnterCol}
                          onMouseLeaveCol={handleMouseLeaveCol}
                          onShowTooltip={showTooltip}
                          onHideTooltip={hideTooltip}
                        />
                      </>
                    )}
                    {isPropertyVisible('liq_freeze') && (
                      <>
                        <SubHeader
                          label="Freezing Point"
                          prop="T_freeze"
                          colId="T_freeze"
                          isCategoryEnd={false}
                          isHovered={hoveredCol === 'T_freeze'}
                          isSelected={selectedCols.has('T_freeze')}
                          onToggleHighlight={toggleColumnHighlight}
                          onMouseEnterCol={handleMouseEnterCol}
                          onMouseLeaveCol={handleMouseLeaveCol}
                          onShowTooltip={showTooltip}
                          onHideTooltip={hideTooltip}
                          unitType="temp"
                          tempUnit={tempUnit}
                          onChangeTempUnit={setTempUnit}
                        />
                        <SubHeader
                          label="h_if (kJ/kg)"
                          prop="h_if"
                          colId="h_if"
                          isCategoryEnd={true}
                          isHovered={hoveredCol === 'h_if'}
                          isSelected={selectedCols.has('h_if')}
                          onToggleHighlight={toggleColumnHighlight}
                          onMouseEnterCol={handleMouseEnterCol}
                          onMouseLeaveCol={handleMouseLeaveCol}
                          onShowTooltip={showTooltip}
                          onHideTooltip={hideTooltip}
                        />
                      </>
                    )}
                    {isPropertyVisible('liq_props') && (
                      <>
                        <SubHeader
                          label="Temp."
                          prop="T_liq"
                          colId="T_liq"
                          isCategoryEnd={false}
                          isHovered={hoveredCol === 'T_liq'}
                          isSelected={selectedCols.has('T_liq')}
                          onToggleHighlight={toggleColumnHighlight}
                          onMouseEnterCol={handleMouseEnterCol}
                          onMouseLeaveCol={handleMouseLeaveCol}
                          onShowTooltip={showTooltip}
                          onHideTooltip={hideTooltip}
                          unitType="temp"
                          tempUnit={tempUnit}
                          onChangeTempUnit={setTempUnit}
                        />
                        <SubHeader
                          label="Density, ρ (kg/m³)"
                          prop="rho"
                          colId="rho"
                          isCategoryEnd={false}
                          isHovered={hoveredCol === 'rho'}
                          isSelected={selectedCols.has('rho')}
                          onToggleHighlight={toggleColumnHighlight}
                          onMouseEnterCol={handleMouseEnterCol}
                          onMouseLeaveCol={handleMouseLeaveCol}
                          onShowTooltip={showTooltip}
                          onHideTooltip={hideTooltip}
                        />
                        <SubHeader
                          label="cp (kJ/kg·K)"
                          prop="cp"
                          colId="cp"
                          isCategoryEnd={true}
                          isHovered={hoveredCol === 'cp'}
                          isSelected={selectedCols.has('cp')}
                          onToggleHighlight={toggleColumnHighlight}
                          onMouseEnterCol={handleMouseEnterCol}
                          onMouseLeaveCol={handleMouseLeaveCol}
                          onShowTooltip={showTooltip}
                          onHideTooltip={hideTooltip}
                        />
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {tableData.rows.map((row, idx) => {
                    const rKey = idx.toString();
                    const isPinned = pinnedRows.has(rKey);
                    const isHighlighted = highlightedRowIndex === rKey;
                    const isHovered = hoveredRow === rKey;
                    return (
                      <tr
                        key={idx}
                        data-row-key={rKey}
                        ref={el => { rowRefs.current[rKey] = el; }}
                        className="transition-colors bg-white dark:bg-gray-900"
                      >
                        <td
                          data-pin-cell="true"
                          onClick={() => togglePin(rKey)}
                          className={cn(
                            'px-2 py-2 border-b border-gray-100 dark:border-gray-800 sticky left-0 z-10 flex items-center justify-center transition-colors cursor-pointer',
                            isPinned ? 'bg-amber-100 dark:bg-[#332818]' : isHovered ? 'bg-red-50 dark:bg-gray-800' : 'bg-white dark:bg-gray-900',
                            isHighlighted && 'bg-indigo-200 dark:bg-[#23254b] border-indigo-200 dark:border-indigo-700 ring-1 ring-indigo-400 z-20'
                          )}
                          title={isPinned ? `Unpin ${row.substance}` : `Highlight ${row.substance}`}
                        >
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); togglePin(rKey); }}
                            className={cn(
                              'p-1.5 rounded transition-colors cursor-pointer',
                              isPinned
                                ? 'text-amber-700 bg-amber-200/90 dark:text-amber-300 dark:bg-amber-500/30 shadow-sm'
                                : 'text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                            )}
                            title={isPinned ? `Unpin ${row.substance}` : `Highlight ${row.substance}`}
                          >
                            <Highlighter className="w-4 h-4" />
                          </button>
                        </td>
                        <Td colId="substance" align="left" isCategoryEnd={true} isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'substance'} isColSelected={selectedCols.has('substance')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.substance}</Td>
                        {isPropertyVisible('liq_boil') && (
                          <>
                            <Td colId="T_boil" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'T_boil'} isColSelected={selectedCols.has('T_boil')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{formatLiquidBoilTemp(row)}</Td>
                            <Td colId="h_fg" isCategoryEnd={true} isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'h_fg'} isColSelected={selectedCols.has('h_fg')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{formatLiquidHfg(row)}</Td>
                          </>
                        )}
                        {isPropertyVisible('liq_freeze') && (
                          <>
                            <Td colId="T_freeze" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'T_freeze'} isColSelected={selectedCols.has('T_freeze')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.T_freeze ? formatTempDisplay(row.T_freeze) : '—'}</Td>
                            <Td colId="h_if" isCategoryEnd={true} isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'h_if'} isColSelected={selectedCols.has('h_if')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.h_if ? row.h_if.s : '—'}</Td>
                          </>
                        )}
                        {isPropertyVisible('liq_props') && (
                          <>
                            <Td colId="T_liq" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'T_liq'} isColSelected={selectedCols.has('T_liq')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{formatTempDisplay(row.T_liq)}</Td>
                            <Td colId="rho" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'rho'} isColSelected={selectedCols.has('rho')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.rho.s}</Td>
                            <Td colId="cp" isCategoryEnd={true} isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'cp'} isColSelected={selectedCols.has('cp')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.cp.s}</Td>
                          </>
                        )}
                        {collapsedLiquidGroups.length > 0 && (
                          <td className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 p-0" />
                        )}
                        {idx === 0 &&
                          collapsedLiquidGroups.map(g => (
                            <td
                              key={g.id}
                              rowSpan={tableData.rows.length}
                              onClick={() => togglePropertyVisibility(g.id)}
                              title={`Expand ${g.label}`}
                              className="bg-gray-50 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800/80 border-l-2 border-l-gray-300 dark:border-l-gray-700 border-b-0 p-0 cursor-pointer transition-colors"
                            />
                          ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* 10. Properties of Common Solids View (Table A-3b) */}
            {tableData?.type === 'solids' && (
              <table className="w-full min-w-full text-left border-collapse" onMouseLeave={clearAllHover}>
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                    <th className="w-8 sm:w-9 min-w-[32px] sm:min-w-[36px] px-1 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 left-0 z-30 h-12 sm:h-14"></th>
                    {isPropertyVisible('category') && renderColHeader('category', 'Category', '', 'min-w-[110px]')}
                    {renderColHeader('substance', 'Substance', '', 'min-w-[200px]')}
                    {isPropertyVisible('T') && renderColHeader('T', 'Temp.', tempUnit === 'C' ? '°C' : 'K', 'min-w-[110px]', 'temp')}
                    {isPropertyVisible('rho') && renderColHeader('rho', 'Density, ρ', 'kg/m³', 'min-w-[120px]')}
                    {isPropertyVisible('cp') && renderColHeader('cp', 'Specific Heat, cp', 'kJ/kg·K', 'min-w-[130px]')}
                    {renderCollapsedPropertyHeaders()}
                  </tr>
                </thead>
                <tbody>
                  {tableData.rows.map((row, idx) => {
                    const rKey = idx.toString();
                    const isPinned = pinnedRows.has(rKey);
                    const isHighlighted = highlightedRowIndex === rKey;
                    const isHovered = hoveredRow === rKey;
                    return (
                      <tr
                        key={idx}
                        data-row-key={rKey}
                        ref={el => { rowRefs.current[rKey] = el; }}
                        className="transition-colors bg-white dark:bg-gray-900"
                      >
                        <td
                          data-pin-cell="true"
                          onClick={() => togglePin(rKey)}
                          className={cn(
                            'w-8 sm:w-9 min-w-[32px] sm:min-w-[36px] px-1 py-1.5 border-b border-gray-100 dark:border-gray-800 sticky left-0 z-10 flex items-center justify-center transition-colors cursor-pointer',
                            isPinned ? 'bg-amber-100 dark:bg-[#332818]' : isHovered ? 'bg-red-50 dark:bg-gray-800' : 'bg-white dark:bg-gray-900',
                            isHighlighted && 'bg-indigo-200 dark:bg-[#23254b] ring-1 ring-indigo-400 z-20'
                          )}
                          title={isPinned ? `Unpin ${row.substance}` : `Highlight ${row.substance}`}
                        >
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); togglePin(rKey); }}
                            className={cn('p-1 rounded cursor-pointer transition-colors', isPinned ? 'text-amber-700 bg-amber-200/90 dark:text-amber-300 dark:bg-amber-500/30' : 'text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300')}
                            title={isPinned ? `Unpin ${row.substance}` : `Highlight ${row.substance}`}
                          >
                            <Highlighter className="w-3.5 h-3.5" />
                          </button>
                        </td>
                        {isPropertyVisible('category') && <Td colId="category" align="left" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'category'} isColSelected={selectedCols.has('category')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.category}</Td>}
                        <Td colId="substance" align="left" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'substance'} isColSelected={selectedCols.has('substance')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.substance}</Td>
                        {isPropertyVisible('T') && <Td colId="T" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'T'} isColSelected={selectedCols.has('T')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{formatSolidTemp(row)}</Td>}
                        {isPropertyVisible('rho') && <Td colId="rho" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'rho'} isColSelected={selectedCols.has('rho')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.rho ? row.rho.s : '—'}</Td>}
                        {isPropertyVisible('cp') && <Td colId="cp" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'cp'} isColSelected={selectedCols.has('cp')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.cp.s}</Td>}
                        {renderCollapsedPropertyCells(idx, tableData.rows.length)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* 11. Properties of Common Foods View (Table A-3c) */}
            {tableData?.type === 'foods' && (
              <table className="w-full min-w-full text-left border-collapse" onMouseLeave={clearAllHover}>
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                    <th className="w-8 sm:w-9 min-w-[32px] sm:min-w-[36px] px-1 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 left-0 z-30 h-12 sm:h-14"></th>
                    {renderColHeader('substance', 'Food', '', 'min-w-[160px]')}
                    {isPropertyVisible('waterContent') && renderColHeader('waterContent', 'Water Content', '% (mass)', 'min-w-[120px]')}
                    {isPropertyVisible('T_freeze') && renderColHeader('T_freeze', 'Freezing Point', tempUnit === 'C' ? '°C' : 'K', 'min-w-[130px]', 'temp')}
                    {isPropertyVisible('cp_above') && renderColHeader('cp_above', 'cp Above Freezing', 'kJ/kg·K', 'min-w-[140px]')}
                    {isPropertyVisible('cp_below') && renderColHeader('cp_below', 'cp Below Freezing', 'kJ/kg·K', 'min-w-[140px]')}
                    {isPropertyVisible('h_if') && renderColHeader('h_if', 'Latent Heat of Fusion, h_if', 'kJ/kg', 'min-w-[160px]')}
                    {renderCollapsedPropertyHeaders()}
                  </tr>
                </thead>
                <tbody>
                  {tableData.rows.map((row, idx) => {
                    const rKey = idx.toString();
                    const isPinned = pinnedRows.has(rKey);
                    const isHighlighted = highlightedRowIndex === rKey;
                    const isHovered = hoveredRow === rKey;
                    return (
                      <tr
                        key={idx}
                        data-row-key={rKey}
                        ref={el => { rowRefs.current[rKey] = el; }}
                        className="transition-colors bg-white dark:bg-gray-900"
                      >
                        <td
                          data-pin-cell="true"
                          onClick={() => togglePin(rKey)}
                          className={cn(
                            'w-8 sm:w-9 min-w-[32px] sm:min-w-[36px] px-1 py-1.5 border-b border-gray-100 dark:border-gray-800 sticky left-0 z-10 flex items-center justify-center transition-colors cursor-pointer',
                            isPinned ? 'bg-amber-100 dark:bg-[#332818]' : isHovered ? 'bg-red-50 dark:bg-gray-800' : 'bg-white dark:bg-gray-900',
                            isHighlighted && 'bg-indigo-200 dark:bg-[#23254b] ring-1 ring-indigo-400 z-20'
                          )}
                          title={isPinned ? `Unpin ${row.substance}` : `Highlight ${row.substance}`}
                        >
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); togglePin(rKey); }}
                            className={cn('p-1 rounded cursor-pointer transition-colors', isPinned ? 'text-amber-700 bg-amber-200/90 dark:text-amber-300 dark:bg-amber-500/30' : 'text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300')}
                            title={isPinned ? `Unpin ${row.substance}` : `Highlight ${row.substance}`}
                          >
                            <Highlighter className="w-3.5 h-3.5" />
                          </button>
                        </td>
                        <Td colId="substance" align="left" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'substance'} isColSelected={selectedCols.has('substance')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.substance}</Td>
                        {isPropertyVisible('waterContent') && <Td colId="waterContent" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'waterContent'} isColSelected={selectedCols.has('waterContent')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.waterContent.s}</Td>}
                        {isPropertyVisible('T_freeze') && <Td colId="T_freeze" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'T_freeze'} isColSelected={selectedCols.has('T_freeze')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{formatTempDisplay(row.T_freeze)}</Td>}
                        {isPropertyVisible('cp_above') && <Td colId="cp_above" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'cp_above'} isColSelected={selectedCols.has('cp_above')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.cp_above ? row.cp_above.s : '—'}</Td>}
                        {isPropertyVisible('cp_below') && <Td colId="cp_below" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'cp_below'} isColSelected={selectedCols.has('cp_below')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.cp_below.s}</Td>}
                        {isPropertyVisible('h_if') && <Td colId="h_if" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'h_if'} isColSelected={selectedCols.has('h_if')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.h_if.s}</Td>}
                        {renderCollapsedPropertyCells(idx, tableData.rows.length)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
