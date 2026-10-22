import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { SUPPORTED_TABLES } from './data/tablesMeta';
import { getTableData } from './data/tables';
import type { 
  IdealGasAirRow, 
  IdealGasMolarRow, 
  ThermoValue 
} from './data/types';
import { Info, Highlighter, Search, ChevronDown, ChevronRight, Layers, Check, X, Pin } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
};

const SubHeader = React.memo(function SubHeader({
  label,
  prop,
  colId,
  isCategoryEnd,
  isHovered,
  isSelected,
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
          ? "z-30 bg-red-100/90 text-red-950 dark:bg-red-950/80 dark:text-red-200" 
          : (isHovered ? "z-20 bg-red-50 dark:bg-gray-700 text-red-900 dark:text-red-300" : "z-10"),
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
              ? "text-red-700 bg-red-200/90 dark:text-red-200 dark:bg-red-900/70 hover:bg-red-300 dark:hover:bg-red-800" 
              : "text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-200 dark:hover:bg-gray-800"
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
  isRowHovered,
  isPinned,
  isHighlighted,
  isCategoryEnd,
  isColHovered,
  isColSelected,
  onMouseEnterCol,
  onMouseLeaveCol,
}: {
  children: React.ReactNode;
  colId: string;
  isRowHovered: boolean;
  isPinned: boolean;
  isHighlighted?: boolean;
  isCategoryEnd?: boolean;
  isColHovered: boolean;
  isColSelected: boolean;
  onMouseEnterCol: (id: string) => void;
  onMouseLeaveCol: () => void;
}) {
  let bgStyle = "";
  if (isHighlighted) {
    bgStyle = "bg-indigo-200/90 text-indigo-950 dark:bg-indigo-900/80 dark:text-indigo-100 font-bold relative z-10 ring-1 ring-indigo-400 dark:ring-indigo-400";
  } else if (isPinned && isColSelected) {
    bgStyle = "bg-amber-300 text-amber-950 dark:bg-amber-500/40 dark:text-amber-100 font-bold ring-1 ring-amber-400 dark:ring-amber-400";
  } else if (isPinned) {
    bgStyle = isColHovered 
      ? "bg-amber-200/90 text-amber-950 dark:bg-amber-800/80 dark:text-amber-50 font-semibold" 
      : "bg-amber-100/90 text-amber-950 dark:bg-amber-950/70 dark:text-amber-200 font-semibold";
  } else if (isColSelected) {
    bgStyle = isRowHovered 
      ? "bg-red-200/90 text-red-950 dark:bg-red-800/75 dark:text-red-50 font-medium" 
      : "bg-red-100/70 text-red-950 dark:bg-red-950/65 dark:text-red-200";
  } else if (isRowHovered && isColHovered) {
    bgStyle = "bg-red-100/75 dark:bg-gray-600/80 text-gray-950 dark:text-white font-medium";
  } else if (isRowHovered) {
    bgStyle = "bg-red-50/65 dark:bg-gray-700/65 text-gray-900 dark:text-gray-100";
  } else if (isColHovered) {
    bgStyle = "bg-red-50/65 dark:bg-gray-700/65 text-gray-900 dark:text-gray-100";
  }

  return (
    <td 
      data-col-id={colId}
      className={cn(
        "px-2 sm:px-3 py-2 text-xs sm:text-sm text-gray-800 dark:text-gray-200 border-b border-gray-100 dark:border-gray-800 text-right transition-colors tabular-nums whitespace-nowrap",
        isCategoryEnd ? "border-r-2 border-r-gray-300 dark:border-r-gray-700" : "border-r border-r-gray-100 dark:border-r-gray-800/80",
        bgStyle
      )}
      onMouseEnter={() => onMouseEnterCol(colId)}
      onMouseLeave={onMouseLeaveCol}
    >
      {children}
    </td>
  );
});

export default function App() {
  const [currentTableId, setCurrentTableId] = useState<string>('A-4');
  const [isSwitcherOpen, setIsSwitcherOpen] = useState<boolean>(false);
  const [tableSearchQuery, setTableSearchQuery] = useState<string>('');

  const currentTable = SUPPORTED_TABLES.find(t => t.id === currentTableId) || SUPPORTED_TABLES[0];
  const tableData = useMemo(() => getTableData(currentTableId), [currentTableId]);

  const [tempUnit, setTempUnit] = useState<TempUnit>('C');
  const [pressUnit, setPressUnit] = useState<PressUnit>('kPa');

  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>({
    volume: true,
    energy: true,
    enthalpy: true,
    entropy: true,
  });

  const [tablePinnedRows, setTablePinnedRows] = useState<Record<string, Set<string>>>({});
  const [tableSelectedCols, setTableSelectedCols] = useState<Record<string, Set<string>>>({});
  const selectedCols = useMemo(() => tableSelectedCols[currentTableId] || new Set<string>(), [tableSelectedCols, currentTableId]);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredCol, setHoveredCol] = useState<string | null>(null);

  const handleMouseEnterCol = useCallback((colId: string) => setHoveredCol(colId), []);
  const handleMouseLeaveCol = useCallback(() => setHoveredCol(null), []);
  const clearAllHover = useCallback(() => {
    setHoveredCol(prev => (prev === null ? null : null));
    setHoveredRow(prev => (prev === null ? null : null));
  }, []);
  const handleRootMouseMove = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const colEl = target.closest('[data-col-id]') as HTMLElement | null;
    const rowEl = target.closest('[data-row-key]') as HTMLElement | null;
    const nextCol = colEl ? colEl.getAttribute('data-col-id') : null;
    const nextRow = rowEl ? rowEl.getAttribute('data-row-key') : null;
    setHoveredCol(prev => (prev === nextCol ? prev : nextCol));
    setHoveredRow(prev => (prev === nextRow ? prev : nextRow));
  }, []);

  useEffect(() => {
    const handleDocLeave = () => {
      setHoveredCol(null);
      setHoveredRow(null);
    };
    document.addEventListener('mouseleave', handleDocLeave);
    window.addEventListener('blur', handleDocLeave);
    return () => {
      document.removeEventListener('mouseleave', handleDocLeave);
      window.removeEventListener('blur', handleDocLeave);
    };
  }, []);

  const [tablePinnedBlocks, setTablePinnedBlocks] = useState<Record<string, Set<number>>>({});
  const [tableCollapsedBlocks, setTableCollapsedBlocks] = useState<Record<string, Set<number>>>({});
  const [tableDisabledBlocks, setTableDisabledBlocks] = useState<Record<string, Set<number>>>({});
  const [showBlockFilter, setShowBlockFilter] = useState(false);
  const [pinnedTemps, setPinnedTemps] = useState<Set<string>>(new Set());

  const pinnedRows = useMemo(() => tablePinnedRows[currentTableId] || new Set<string>(), [tablePinnedRows, currentTableId]);
  const pinnedBlocks = useMemo(() => tablePinnedBlocks[currentTableId] || new Set<number>(), [tablePinnedBlocks, currentTableId]);
  const collapsedBlocks = useMemo(() => tableCollapsedBlocks[currentTableId] || new Set<number>(), [tableCollapsedBlocks, currentTableId]);
  const disabledBlocks = useMemo(() => tableDisabledBlocks[currentTableId] || new Set<number>(), [tableDisabledBlocks, currentTableId]);

  const setPinnedBlocks = (action: Set<number> | ((prev: Set<number>) => Set<number>)) => {
    setTablePinnedBlocks(prev => {
      const current = prev[currentTableId] || new Set<number>();
      const next = typeof action === 'function' ? action(current) : action;
      return { ...prev, [currentTableId]: next };
    });
  };

  const setCollapsedBlocks = (action: Set<number> | ((prev: Set<number>) => Set<number>)) => {
    setTableCollapsedBlocks(prev => {
      const current = prev[currentTableId] || new Set<number>();
      const next = typeof action === 'function' ? action(current) : action;
      return { ...prev, [currentTableId]: next };
    });
  };

  const setDisabledBlocks = (action: Set<number> | ((prev: Set<number>) => Set<number>)) => {
    setTableDisabledBlocks(prev => {
      const current = prev[currentTableId] || new Set<number>();
      const next = typeof action === 'function' ? action(current) : action;
      return { ...prev, [currentTableId]: next };
    });
  };

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

  const switchTable = (id: string) => {
    setCurrentTableId(id);
    const targetData = getTableData(id);
    if (targetData && (targetData.type === 'superheated' || targetData.type === 'compressed')) {
      setPressUnit('MPa');
      setJumpSuperheatedUnit('MPa');
      setTempUnit('C');
      setJumpProperty('T');
    } else if (targetData && (targetData.type === 'ideal_gas_air' || targetData.type === 'ideal_gas_molar')) {
      setTempUnit('K');
      setJumpProperty('T');
    } else {
      setPressUnit('kPa');
      setTempUnit('C');
      setJumpProperty(targetData?.type === 'saturated' ? targetData.indexProperty : 'T');
    }
    setShowBlockFilter(false);
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
    if (pinnedTemps.size > 0) return true;
    for (const s of Object.values(tablePinnedRows)) {
      if (s && s.size > 0) return true;
    }
    for (const s of Object.values(tablePinnedBlocks)) {
      if (s && s.size > 0) return true;
    }
    return false;
  }, [tableSelectedCols, pinnedTemps, tablePinnedRows, tablePinnedBlocks]);

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
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        jumpInputRef.current?.focus();
      }
      
      if (e.key === 'Tab') {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setIsSwitcherOpen(true);
        }
      }
    };
    
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const formatTempDisplay = (val?: ThermoValue) => {
    if (!val) return '-';
    if (tempUnit === 'K') {
      return (val.v + 273.15).toFixed(2);
    }
    return val.s;
  };

  const formatSatTemp = (val?: ThermoValue) => {
    if (!val || val.s === 'N/A') return 'N/A';
    if (tempUnit === 'K') {
      return `${(val.v + 273.15).toFixed(2)} K`;
    }
    return `${val.s} °C`;
  };

  const formatPressDisplay = (val?: ThermoValue) => {
    if (!val) return '-';
    if (pressUnit === 'MPa') {
      return (val.v / 1000).toFixed(4);
    }
    if (pressUnit === 'bar') {
      return (val.v / 100).toFixed(4);
    }
    return val.s;
  };

  const formatIsobarPress = (val: ThermoValue) => {
    if (pressUnit === 'kPa') {
      return `${(val.v * 1000).toFixed(val.v * 1000 >= 10 ? 0 : 1)} kPa`;
    }
    if (pressUnit === 'bar') {
      return `${(val.v * 10).toFixed(val.v * 10 >= 10 ? 0 : 2)} bar`;
    }
    return `${val.s} MPa`;
  };

  const handleJump = () => {
    const val1 = parseFloat(jumpValue);
    if (isNaN(val1) || !tableData) return;

    jumpInputRef.current?.blur();

    let targetKey: string | null = null;

    if (tableData.type === 'saturated') {
      let minDiff = Infinity;
      let targetIndex = -1;
      const targetVal = jumpProperty === 'P'
        ? (pressUnit === 'MPa' ? val1 * 1000 : pressUnit === 'bar' ? val1 * 100 : val1)
        : (tempUnit === 'K' ? val1 - 273.15 : val1);

      tableData.rows.forEach((row, idx) => {
        let rowVal = row.T?.v;
        if (jumpProperty === 'P' && row.P) rowVal = row.P.v;
        if (rowVal !== undefined) {
          const diff = Math.abs(rowVal - targetVal);
          if (diff < minDiff) {
            minDiff = diff;
            targetIndex = idx;
          }
        }
      });
      if (targetIndex !== -1) targetKey = targetIndex.toString();
    } else if (tableData.type === 'superheated' || tableData.type === 'compressed') {
      let targetP_MPa = val1;
      if (jumpSuperheatedUnit === 'kPa') targetP_MPa = val1 / 1000;
      else if (jumpSuperheatedUnit === 'bar') targetP_MPa = val1 / 10;

      let minPDiff = Infinity;
      let targetBlockIdx = -1;
      tableData.blocks.forEach((block, bIdx) => {
        const diff = Math.abs(block.P.v - targetP_MPa);
        if (diff < minPDiff) {
          minPDiff = diff;
          targetBlockIdx = bIdx;
        }
      });

      if (targetBlockIdx !== -1) {
        if (disabledBlocks.has(targetBlockIdx)) {
          setDisabledBlocks(prev => {
            const next = new Set(prev);
            next.delete(targetBlockIdx);
            return next;
          });
        }
        if (collapsedBlocks.has(targetBlockIdx)) {
          setCollapsedBlocks(prev => {
            const next = new Set(prev);
            next.delete(targetBlockIdx);
            return next;
          });
        }

        const cardEl = blockRefs.current[targetBlockIdx];
        if (cardEl) {
          cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setHighlightedBlockIdx(targetBlockIdx);
        setTimeout(() => setHighlightedBlockIdx(null), 2500);
      }
      return;
    } else if (tableData.type === 'ideal_gas_air' || tableData.type === 'ideal_gas_molar') {
      let minDiff = Infinity;
      let targetIndex = -1;
      tableData.rows.forEach((row, idx) => {
        const rowVal = row.T.v;
        const diff = Math.abs(rowVal - val1);
        if (diff < minDiff) {
          minDiff = diff;
          targetIndex = idx;
        }
      });
      if (targetIndex !== -1) targetKey = targetIndex.toString();
    }

    if (targetKey && rowRefs.current[targetKey]) {
      rowRefs.current[targetKey]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedRowIndex(targetKey);
      setTimeout(() => setHighlightedRowIndex(null), 2000);
    }
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

  const isIce = currentTableId === 'A-8';

  const categories = [
    { 
      id: 'volume', 
      label: 'Specific Volume', 
      unit: '(m³/kg)', 
      cols: isIce 
        ? [{ id: 'vi', label: 'Sat. ice, vi' }, { id: 'vg', label: 'Sat. vapor, vg' }] 
        : [{ id: 'vf', label: 'Sat. liquid, vf' }, { id: 'vg', label: 'Sat. vapor, vg' }] 
    },
    { 
      id: 'energy', 
      label: 'Int. Energy', 
      unit: '(kJ/kg)', 
      cols: isIce
        ? [{ id: 'ui', label: 'Sat. ice, ui' }, { id: 'uig', label: 'Subl., uig' }, { id: 'ug', label: 'Sat. vapor, ug' }]
        : [{ id: 'uf', label: 'Sat. liquid, uf' }, { id: 'ufg', label: 'Evap., ufg' }, { id: 'ug', label: 'Sat. vapor, ug' }] 
    },
    { 
      id: 'enthalpy', 
      label: 'Enthalpy', 
      unit: '(kJ/kg)', 
      cols: isIce
        ? [{ id: 'hi', label: 'Sat. ice, hi' }, { id: 'hig', label: 'Subl., hig' }, { id: 'hg', label: 'Sat. vapor, hg' }]
        : [{ id: 'hf', label: 'Sat. liquid, hf' }, { id: 'hfg', label: 'Evap., hfg' }, { id: 'hg', label: 'Sat. vapor, hg' }] 
    },
    { 
      id: 'entropy', 
      label: 'Entropy', 
      unit: '(kJ/kg·K)', 
      cols: isIce
        ? [{ id: 'si', label: 'Sat. ice, si' }, { id: 'sig', label: 'Subl., sig' }, { id: 'sg', label: 'Sat. vapor, sg' }]
        : [{ id: 'sf', label: 'Sat. liquid, sf' }, { id: 'sfg', label: 'Evap., sfg' }, { id: 'sg', label: 'Sat. vapor, sg' }] 
    }
  ];

  const activeCategories = categories.filter(c => visibleCols[c.id]);
  const collapsedCategories = categories.filter(c => !visibleCols[c.id]);

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

  const isIdealGas = tableData?.type === 'ideal_gas_air' || tableData?.type === 'ideal_gas_molar';

  const renderColHeader = (id: string, label: string, unit: string, widthClass: string = "min-w-[85px]") => {
    const isSelected = selectedCols.has(id);
    const isHovered = hoveredCol === id;

    return (
      <th 
        data-col-id={id}
        className={cn(
          "px-2 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 select-none transition-colors h-12 sm:h-14 whitespace-nowrap cursor-pointer",
          widthClass,
          isSelected 
            ? "bg-red-100/90 text-red-950 dark:bg-red-950/80 dark:text-red-200" 
            : (isHovered && "bg-red-50 dark:bg-gray-700 text-red-900 dark:text-red-300")
        )}
        onClick={() => toggleColumnHighlight(id)}
        onMouseEnter={() => handleMouseEnterCol(id)}
        onMouseLeave={handleMouseLeaveCol}
        title={isSelected ? "Remove highlight" : `Highlight ${label} column`}
      >
        <div className="flex flex-col justify-center h-full gap-1.5 sm:gap-2 w-full">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-xs text-gray-700 dark:text-gray-300">{label}</span>
            {id === 'T' && !isIdealGas ? (
              <select 
                className="bg-transparent border-b border-gray-300 dark:border-gray-600 text-xs font-semibold focus:outline-none cursor-pointer hover:border-red-600 dark:hover:border-red-400 text-gray-700 dark:text-gray-200 transition-colors"
                value={tempUnit}
                onChange={e => setTempUnit(e.target.value as TempUnit)}
                onClick={e => e.stopPropagation()}
              >
                <option value="C" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">°C</option>
                <option value="K" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">K</option>
              </select>
            ) : (
              <span className="text-[10px] text-gray-500 dark:text-gray-400 font-normal">({unit})</span>
            )}
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
              onClick={(e) => { e.stopPropagation(); toggleColumnHighlight(id); }}
              className={cn(
                "p-1 rounded transition-colors shrink-0 cursor-pointer",
                isSelected 
                  ? "text-red-700 bg-red-200/90 dark:text-red-200 dark:bg-red-900/70 hover:bg-red-300 dark:hover:bg-red-800" 
                  : "text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
              title={isSelected ? "Remove highlight" : `Highlight ${label} column`}
            >
              <Highlighter className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </th>
    );
  };

  const toggleTempHighlight = (tempStr: string, rKey: string) => {
    if (tempStr) {
      setPinnedTemps(prev => {
        const next = new Set(prev);
        if (next.has(tempStr)) next.delete(tempStr);
        else next.add(tempStr);
        return next;
      });
    } else {
      togglePin(rKey);
    }
  };

  return (
    <>
      <TooltipPortal tooltip={tooltip} />
      <div
        className="h-screen h-dvh w-screen overflow-hidden bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col pt-0 pb-0 px-0 m-0 relative"
        onMouseMove={handleRootMouseMove}
        onMouseLeave={clearAllHover}
      >
        {/* Top Header / Red Bar */}
        <div
          className="bg-[#c13726] dark:bg-[#852115] text-white px-4 py-2 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0 relative z-[100] shadow-md border-b border-[#a82e1f] dark:border-black/30"
          onMouseEnter={clearAllHover}
        >
          <div className="flex flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xl font-bold tracking-wide uppercase text-white drop-shadow-sm">
                {currentTable.name}
              </span>

              {/* Switch Table Compact Glyph Button */}
              <div className="relative" ref={switcherRef}>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsSwitcherOpen(prev => !prev)}
                    className="inline-flex items-center justify-center p-1.5 text-white/90 bg-white/15 hover:bg-white/25 active:bg-white/30 rounded border border-white/25 transition-colors cursor-pointer"
                    title="Switch Table"
                  >
                    <Layers className="w-4 h-4" />
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

              {/* Tags */}
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-black/20 text-white border border-white/20 backdrop-blur-sm">
                  {currentTable.state}
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-black/20 text-white border border-white/20 backdrop-blur-sm">
                  {currentTable.substance}
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-black/20 text-white border border-white/20 backdrop-blur-sm">
                  {currentTable.type}
                </span>
              </div>
            </div>

            <p className="text-xs text-white/90 mt-0.5 max-w-2xl leading-relaxed font-normal">
              {currentTable.description}
            </p>
          </div>
          
          {/* Jump-to Controls */}
          <div className="flex flex-nowrap items-center gap-1.5 sm:gap-2 bg-black/15 dark:bg-black/35 p-1.5 rounded border border-white/20 dark:border-white/10 shrink-0 w-full md:w-auto text-gray-900 dark:text-gray-100 relative">
            <Search className="w-4 h-4 text-white/80 ml-0.5 sm:ml-1 shrink-0" />
            
            {(tableData?.type === 'superheated' || tableData?.type === 'compressed') ? (
              <div className="flex items-center gap-1.5 flex-1 min-w-0 md:flex-initial">
                <div className="relative flex items-center flex-1 min-w-0 md:flex-initial">
                  <input 
                    ref={jumpInputRef}
                    type="number" 
                    step="any"
                    className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded px-2 py-1 text-sm w-full md:w-28 min-w-[60px] focus:outline-none focus:ring-2 focus:ring-red-400 dark:focus:ring-red-500 tabular-nums placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder="Pressure"
                    title="Pressure value to jump to"
                    value={jumpValue}
                    onChange={(e) => setJumpValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleJump()}
                  />
                  {!jumpValue && <span className="hidden sm:inline-block absolute right-2 text-[9px] font-semibold text-gray-400 dark:text-gray-500 pointer-events-none">Ctrl+K</span>}
                </div>
                <select 
                  className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded px-1.5 sm:px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 dark:focus:ring-red-500 cursor-pointer font-medium shrink-0"
                  value={jumpSuperheatedUnit}
                  onChange={(e) => {
                    const u = e.target.value as PressUnit;
                    setJumpSuperheatedUnit(u);
                    setPressUnit(u);
                  }}
                >
                  <option value="MPa" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">MPa</option>
                  <option value="kPa" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">kPa</option>
                  <option value="bar" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">bar</option>
                </select>
              </div>
            ) : (
              <>
                <div className="relative flex items-center flex-1 min-w-0 md:flex-initial">
                  <input 
                    ref={jumpInputRef}
                    type="number" 
                    className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded px-2 py-1 text-sm w-full md:w-28 min-w-[60px] focus:outline-none focus:ring-2 focus:ring-red-400 dark:focus:ring-red-500 tabular-nums placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder="Value"
                    value={jumpValue}
                    onChange={(e) => setJumpValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleJump()}
                  />
                  {!jumpValue && <span className="hidden sm:inline-block absolute right-2 text-[9px] font-semibold text-gray-400 dark:text-gray-500 pointer-events-none">Ctrl+K</span>}
                </div>
                <select 
                  className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded px-1.5 sm:px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 dark:focus:ring-red-500 shrink-0"
                  value={jumpProperty}
                  onChange={(e) => setJumpProperty(e.target.value)}
                >
                  <option value="T" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                    Temp ({isIdealGas ? 'K' : (tempUnit === 'C' ? '°C' : 'K')})
                  </option>
                  {tableData?.type === 'saturated' && (
                    <option value="P" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                      Psat ({pressUnit})
                    </option>
                  )}
                </select>
              </>
            )}
            
            <button 
              className="bg-white dark:bg-gray-900 hover:bg-white/90 dark:hover:bg-gray-800 active:bg-white/80 dark:active:bg-gray-700 text-[#c13726] dark:text-red-400 border border-transparent dark:border-gray-700 font-semibold px-2.5 sm:px-3 py-1 rounded text-sm shadow-sm transition-colors cursor-pointer shrink-0"
              onClick={handleJump}
            >
              Jump
            </button>
          </div>
        </div>

        {/* Main Table Content */}
        <div className="flex-1 min-h-0 relative bg-white dark:bg-gray-950">
          <div ref={tableRef} className="absolute inset-0 overflow-auto" onMouseLeave={clearAllHover}>
            {/* 1. Saturated Tables View */}
            {tableData?.type === 'saturated' && (
              <table className="min-w-full border-collapse border-spacing-0 text-left" onMouseLeave={clearAllHover}>
                <thead>
                  <tr>
                    <th rowSpan={2} className="w-10 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 left-0 z-40 h-14"></th>
                    
                    {/* Index Col 1: Temp or Pressure */}
                    {tableData.indexProperty === 'T' ? (
                      <>
                        <th 
                          rowSpan={2} 
                          data-col-id="T"
                          className={cn(
                            "px-2 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-30 transition-colors h-14 select-none min-w-[70px] whitespace-nowrap cursor-pointer", 
                            selectedCols.has('T') ? "bg-red-100/90 text-red-950 dark:bg-red-950/80 dark:text-red-200" : (hoveredCol === 'T' && "bg-red-50 dark:bg-gray-700 text-red-900 dark:text-red-300")
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
                                  selectedCols.has('T') ? "text-red-700 bg-red-200/90 dark:text-red-200 dark:bg-red-900/70 hover:bg-red-300 dark:hover:bg-red-800" : "text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800"
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
                            selectedCols.has('P') ? "bg-red-100/90 text-red-950 dark:bg-red-950/80 dark:text-red-200" : (hoveredCol === 'P' && "bg-red-50 dark:bg-gray-700 text-red-900 dark:text-red-300")
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
                                  selectedCols.has('P') ? "text-red-700 bg-red-200/90 dark:text-red-200 dark:bg-red-900/70 hover:bg-red-300 dark:hover:bg-red-800" : "text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800"
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
                            selectedCols.has('P') ? "bg-red-100/90 text-red-950 dark:bg-red-950/80 dark:text-red-200" : (hoveredCol === 'P' && "bg-red-50 dark:bg-gray-700 text-red-900 dark:text-red-300")
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
                                  selectedCols.has('P') ? "text-red-700 bg-red-200/90 dark:text-red-200 dark:bg-red-900/70 hover:bg-red-300 dark:hover:bg-red-800" : "text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800"
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
                            selectedCols.has('T') ? "bg-red-100/90 text-red-950 dark:bg-red-950/80 dark:text-red-200" : (hoveredCol === 'T' && "bg-red-50 dark:bg-gray-700 text-red-900 dark:text-red-300")
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
                                  selectedCols.has('T') ? "text-red-700 bg-red-200/90 dark:text-red-200 dark:bg-red-900/70 hover:bg-red-300 dark:hover:bg-red-800" : "text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800"
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
                      <tr 
                        key={idx}
                        data-row-key={rKey}
                        ref={el => { rowRefs.current[rKey] = el; }}
                        className={cn("transition-colors", isPinned ? "bg-amber-50 dark:bg-amber-950/20" : "bg-white dark:bg-gray-900")}
                        onMouseEnter={() => setHoveredRow(rKey)}
                        onMouseLeave={() => setHoveredRow(null)}
                      >
                        <td className={cn("px-2 py-2 border-b border-gray-100 dark:border-gray-800 sticky left-0 z-10 flex items-center justify-center transition-colors", isPinned ? "bg-amber-100/90 dark:bg-amber-950/70" : (isHovered ? "bg-red-50/65 dark:bg-gray-700" : "bg-white dark:bg-gray-900"), isHighlighted && "bg-indigo-200/80 dark:bg-indigo-900/80 border-indigo-200 dark:border-indigo-700 ring-1 ring-indigo-400 z-20")}>
                          <button 
                            onClick={() => togglePin(rKey)}
                            className={cn(
                              "p-1.5 rounded transition-colors cursor-pointer",
                              isPinned 
                                ? "text-amber-700 bg-amber-200/90 dark:text-amber-300 dark:bg-amber-900/60 shadow-sm" 
                                : "text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800",
                              isHovered && !isPinned && "text-gray-500 dark:text-gray-300"
                            )}
                            title={isPinned ? "Unpin row" : "Highlight row"}
                          >
                            <Highlighter className="w-4 h-4" />
                          </button>
                        </td>

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
                        
                        <td className={cn("bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 p-0", isHighlighted && "bg-indigo-200/80 dark:bg-indigo-900/80 border-indigo-200 dark:border-indigo-700")} />

                        {idx === 0 && collapsedCategories.map((c) => (
                          <td 
                            key={c.id} 
                            rowSpan={tableData.rows.length} 
                            className="bg-gray-50 dark:bg-gray-900 border-l-2 border-l-gray-300 dark:border-l-gray-700 border-b-0 p-0"
                          />
                        ))}
                      </tr>
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
                      <span className="font-semibold text-gray-600 dark:text-gray-300">Pressure:</span>
                      <select 
                        value={pressUnit} 
                        onChange={e => {
                          const u = e.target.value as PressUnit;
                          setPressUnit(u);
                          setJumpSuperheatedUnit(u);
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
                <div className="flex-1 overflow-y-auto relative p-1.5 sm:p-4 flex flex-col gap-3 sm:gap-6">
                  
                  {/* Pinned Section (Top Row) */}
                  {pinnedBlocks.size > 0 && (
                    <div className="flex flex-col gap-2 shrink-0">
                      <div className="flex items-center gap-2 px-1">
                        <Pin className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <h3 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Pinned Isobars</h3>
                      </div>
                      <div className="flex flex-col md:flex-row gap-3 sm:gap-4 overflow-x-auto pb-2 items-start">
                        {Array.from(pinnedBlocks).map(bIdx => {
                          const block = tableData.blocks[bIdx];
                          if (!block) return null;
                          return (
                            <div key={`pinned-${bIdx}`} className="bg-white dark:bg-gray-900 border-2 border-amber-300 dark:border-amber-600/70 rounded shadow-sm shrink-0 min-w-0 w-full md:w-[380px] flex flex-col overflow-hidden">
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
                                 <table className="w-full min-w-full text-left border-collapse" onMouseLeave={clearAllHover}>
                                   <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                                      <th className="w-7 sm:w-8 min-w-[28px] sm:min-w-[32px] px-1 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 h-12 sm:h-14"></th>
                                      {renderColHeader('T', 'Temp', '°C', 'min-w-[68px]')}
                                      {renderColHeader('v', 'v', 'm³/kg', 'min-w-[85px]')}
                                      {renderColHeader('u', 'u', 'kJ/kg', 'min-w-[85px]')}
                                      {renderColHeader('h', 'h', 'kJ/kg', 'min-w-[85px]')}
                                      {renderColHeader('s', 's', 'kJ/kg·K', 'min-w-[85px]')}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {block.rows.map((row, rIdx) => {
                                       const rKey = `${bIdx}-${rIdx}`;
                                       const tempStr = row.isSaturationState ? 'Sat' : (row.T?.s || '');
                                       const isRowPinned = (tempStr && pinnedTemps.has(tempStr)) || pinnedRows.has(rKey);
                                       const isHighlighted = highlightedRowIndex === rKey;
                                       const isHovered = hoveredRow === rKey;
                                       return (
                                         <tr key={rIdx} data-row-key={rKey} ref={el => { rowRefs.current[rKey] = el; }} className="transition-colors bg-white dark:bg-gray-900" onMouseEnter={() => setHoveredRow(rKey)} onMouseLeave={() => setHoveredRow(null)}>
                                           <td className={cn("w-7 sm:w-8 min-w-[28px] sm:min-w-[32px] px-1 py-1.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-center transition-colors", isRowPinned ? "bg-amber-100/90 dark:bg-amber-950/70" : (isHovered && "bg-red-50/65 dark:bg-gray-700/65"), isHighlighted && "bg-indigo-200/80 dark:bg-indigo-900/80 ring-1 ring-indigo-400 z-10")}>
                                             <button 
                                               onClick={() => toggleTempHighlight(tempStr, rKey)} 
                                               className={cn("p-1 rounded cursor-pointer transition-colors", isRowPinned ? "text-amber-700 bg-amber-200 dark:text-amber-200 dark:bg-amber-900/70" : "text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300")}
                                               title={isRowPinned ? `Unpin T = ${tempStr || 'Sat'}` : `Highlight T = ${tempStr || 'Sat'}`}
                                             >
                                               <Highlighter className="w-3.5 h-3.5" />
                                             </button>
                                           </td>
                                           <Td colId="T" isRowHovered={isHovered} isPinned={isRowPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'T'} isColSelected={selectedCols.has('T')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.isSaturationState ? <span className="font-bold text-[#c13726] dark:text-red-400">Sat.</span> : formatTempDisplay(row.T)}</Td>
                                          <Td colId="v" isRowHovered={isHovered} isPinned={isRowPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'v'} isColSelected={selectedCols.has('v')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.v.s}</Td>
                                          <Td colId="u" isRowHovered={isHovered} isPinned={isRowPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'u'} isColSelected={selectedCols.has('u')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.u.s}</Td>
                                          <Td colId="h" isRowHovered={isHovered} isPinned={isRowPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'h'} isColSelected={selectedCols.has('h')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.h.s}</Td>
                                          <Td colId="s" isRowHovered={isHovered} isPinned={isRowPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 's'} isColSelected={selectedCols.has('s')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.s.s}</Td>
                                        </tr>
                                      );
                                   })}
                                 </tbody>
                               </table>
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
                                <table className="w-full min-w-full text-left border-collapse" onMouseLeave={clearAllHover}>
                                  <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                                      <th className="w-7 sm:w-8 min-w-[28px] sm:min-w-[32px] px-1 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 h-12 sm:h-14"></th>
                                      {renderColHeader('T', 'Temp', '°C', 'min-w-[68px]')}
                                      {renderColHeader('v', 'v', 'm³/kg', 'min-w-[85px]')}
                                      {renderColHeader('u', 'u', 'kJ/kg', 'min-w-[85px]')}
                                      {renderColHeader('h', 'h', 'kJ/kg', 'min-w-[85px]')}
                                      {renderColHeader('s', 's', 'kJ/kg·K', 'min-w-[85px]')}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {block.rows.map((row, rIdx) => {
                                        const rKey = `${bIdx}-${rIdx}`;
                                        const tempStr = row.isSaturationState ? 'Sat' : (row.T?.s || '');
                                        const isRowPinned = (tempStr && pinnedTemps.has(tempStr)) || pinnedRows.has(rKey);
                                        const isHighlighted = highlightedRowIndex === rKey;
                                        const isHovered = hoveredRow === rKey;
                                        return (
                                          <tr key={rIdx} data-row-key={rKey} ref={el => { rowRefs.current[rKey] = el; }} className="transition-colors bg-white dark:bg-gray-900" onMouseEnter={() => setHoveredRow(rKey)} onMouseLeave={() => setHoveredRow(null)}>
                                            <td className={cn("w-7 sm:w-8 min-w-[28px] sm:min-w-[32px] px-1 py-1.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-center transition-colors", isRowPinned ? "bg-amber-100/90 dark:bg-amber-950/70" : (isHovered && "bg-red-50/65 dark:bg-gray-700/65"), isHighlighted && "bg-indigo-200/80 dark:bg-indigo-900/80 ring-1 ring-indigo-400 z-10")}>
                                              <button 
                                                onClick={() => toggleTempHighlight(tempStr, rKey)} 
                                                className={cn("p-1 rounded cursor-pointer transition-colors", isRowPinned ? "text-amber-700 bg-amber-200 dark:text-amber-200 dark:bg-amber-900/70" : "text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300")}
                                                title={isRowPinned ? `Unpin T = ${tempStr || 'Sat'}` : `Highlight T = ${tempStr || 'Sat'}`}
                                              >
                                                <Highlighter className="w-3.5 h-3.5" />
                                              </button>
                                            </td>
                                            <Td colId="T" isRowHovered={isHovered} isPinned={isRowPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'T'} isColSelected={selectedCols.has('T')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.isSaturationState ? <span className="font-bold text-[#c13726] dark:text-red-400">Sat.</span> : formatTempDisplay(row.T)}</Td>
                                            <Td colId="v" isRowHovered={isHovered} isPinned={isRowPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'v'} isColSelected={selectedCols.has('v')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.v.s}</Td>
                                            <Td colId="u" isRowHovered={isHovered} isPinned={isRowPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'u'} isColSelected={selectedCols.has('u')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.u.s}</Td>
                                            <Td colId="h" isRowHovered={isHovered} isPinned={isRowPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'h'} isColSelected={selectedCols.has('h')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.h.s}</Td>
                                            <Td colId="s" isRowHovered={isHovered} isPinned={isRowPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 's'} isColSelected={selectedCols.has('s')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.s.s}</Td>
                                          </tr>
                                        );
                                    })}
                                  </tbody>
                                </table>
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

            {/* 3. Ideal Gas Air View */}
            {tableData?.type === 'ideal_gas_air' && (
              <table className="w-full min-w-full text-left border-collapse" onMouseLeave={clearAllHover}>
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                    <th className="w-7 sm:w-8 min-w-[28px] sm:min-w-[32px] px-1 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 h-12 sm:h-14"></th>
                    {renderColHeader('T', 'Temp', 'K', 'min-w-[70px]')}
                    {renderColHeader('h', 'h', 'kJ/kg', 'min-w-[85px]')}
                    {renderColHeader('u', 'u', 'kJ/kg', 'min-w-[85px]')}
                    {renderColHeader('s_deg', 's°', 'kJ/kg·K', 'min-w-[85px]')}
                    {renderColHeader('s_plus', 's+', 'kJ/kg·K', 'min-w-[85px]')}
                  </tr>
                </thead>
                <tbody>
                  {tableData.rows.map((row: IdealGasAirRow, idx: number) => {
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
                        onMouseEnter={() => setHoveredRow(rKey)}
                        onMouseLeave={() => setHoveredRow(null)}
                      >
                        <td className={cn("w-7 sm:w-8 min-w-[28px] sm:min-w-[32px] px-1 py-1.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-center transition-colors", isPinned ? "bg-amber-100/90 dark:bg-amber-950/70" : (isHovered && "bg-red-50/65 dark:bg-gray-700/65"), isHighlighted && "bg-indigo-200/80 dark:bg-indigo-900/80 ring-1 ring-indigo-400 z-10")}>
                          <button 
                            onClick={() => togglePin(rKey)}
                            className={cn("p-1 rounded cursor-pointer transition-colors", isPinned ? "text-amber-700 bg-amber-200 dark:text-amber-200 dark:bg-amber-900/70" : "text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300")}
                            title={isPinned ? `Unpin T = ${row.T.s}` : `Highlight T = ${row.T.s}`}
                          >
                            <Highlighter className="w-3.5 h-3.5" />
                          </button>
                        </td>
                        <Td colId="T" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'T'} isColSelected={selectedCols.has('T')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.T.s}</Td>
                        <Td colId="h" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'h'} isColSelected={selectedCols.has('h')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.h.s}</Td>
                        <Td colId="u" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'u'} isColSelected={selectedCols.has('u')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.u.s}</Td>
                        <Td colId="s_deg" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 's_deg'} isColSelected={selectedCols.has('s_deg')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.s_deg.s}</Td>
                        <Td colId="s_plus" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 's_plus'} isColSelected={selectedCols.has('s_plus')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.s_plus?.s || '-'}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* 4. Molar Ideal Gas View (A-18 .. A-25) */}
            {tableData?.type === 'ideal_gas_molar' && (
              <table className="w-full min-w-full text-left border-collapse" onMouseLeave={clearAllHover}>
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                    <th className="w-7 sm:w-8 min-w-[28px] sm:min-w-[32px] px-1 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 h-12 sm:h-14"></th>
                    {renderColHeader('T', 'Temp', 'K', 'min-w-[70px]')}
                    {renderColHeader('h_bar', 'h̄', 'kJ/kmol', 'min-w-[90px]')}
                    {renderColHeader('u_bar', 'ū', 'kJ/kmol', 'min-w-[90px]')}
                    {renderColHeader('s_bar_deg', 's̄°', 'kJ/kmol·K', 'min-w-[90px]')}
                  </tr>
                </thead>
                <tbody>
                  {tableData.rows.map((row: IdealGasMolarRow, idx: number) => {
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
                        onMouseEnter={() => setHoveredRow(rKey)}
                        onMouseLeave={() => setHoveredRow(null)}
                      >
                        <td className={cn("w-7 sm:w-8 min-w-[28px] sm:min-w-[32px] px-1 py-1.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-center transition-colors", isPinned ? "bg-amber-100/90 dark:bg-amber-950/70" : (isHovered && "bg-red-50/65 dark:bg-gray-700/65"), isHighlighted && "bg-indigo-200/80 dark:bg-indigo-900/80 ring-1 ring-indigo-400 z-10")}>
                          <button 
                            onClick={() => togglePin(rKey)}
                            className={cn("p-1 rounded cursor-pointer transition-colors", isPinned ? "text-amber-700 bg-amber-200 dark:text-amber-200 dark:bg-amber-900/70" : "text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300")}
                            title={isPinned ? `Unpin T = ${row.T.s}` : `Highlight T = ${row.T.s}`}
                          >
                            <Highlighter className="w-3.5 h-3.5" />
                          </button>
                        </td>
                        <Td colId="T" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'T'} isColSelected={selectedCols.has('T')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.T.s}</Td>
                        <Td colId="h_bar" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'h_bar'} isColSelected={selectedCols.has('h_bar')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.h_bar.s}</Td>
                        <Td colId="u_bar" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 'u_bar'} isColSelected={selectedCols.has('u_bar')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.u_bar.s}</Td>
                        <Td colId="s_bar_deg" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isColHovered={hoveredCol === 's_bar_deg'} isColSelected={selectedCols.has('s_bar_deg')} onMouseEnterCol={handleMouseEnterCol} onMouseLeaveCol={handleMouseLeaveCol}>{row.s_bar_deg.s}</Td>
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
