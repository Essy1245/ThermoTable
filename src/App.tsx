import React, { useState, useEffect, useRef, useMemo } from 'react';
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
      className="bg-gray-900 text-white text-xs rounded-md shadow-2xl px-3 py-2 ring-1 ring-white/10 max-w-[220px] w-max whitespace-normal break-words"
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
  const [selectedCols, setSelectedCols] = useState<Set<string>>(new Set());
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredCol, setHoveredCol] = useState<string | null>(null);

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
  const [jumpSuperheatedUnit, setJumpSuperheatedUnit] = useState<'MPa' | 'kPa'>('MPa');
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
    setShowBlockFilter(false);
    setHighlightedRowIndex(null);
    setHighlightedBlockIdx(null);
    setIsSwitcherOpen(false);
    setTableSearchQuery('');
    setMenuSelectedIndex(0);
    setJumpValue('');
  };

  const showTooltip = (text: string, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ text, x: rect.left + rect.width / 2, y: rect.bottom + 8 });
  };
  const hideTooltip = () => setTooltip(null);

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

  const handleJump = () => {
    const val1 = parseFloat(jumpValue);
    if (isNaN(val1) || !tableData) return;

    let targetKey: string | null = null;

    if (tableData.type === 'saturated') {
      let minDiff = Infinity;
      let targetIndex = -1;
      tableData.rows.forEach((row, idx) => {
        let rowVal = row.T?.v;
        if (jumpProperty === 'P' && row.P) rowVal = row.P.v;
        if (rowVal !== undefined) {
          const diff = Math.abs(rowVal - val1);
          if (diff < minDiff) {
            minDiff = diff;
            targetIndex = idx;
          }
        }
      });
      if (targetIndex !== -1) targetKey = targetIndex.toString();
    } else if (tableData.type === 'superheated' || tableData.type === 'compressed') {
      const targetP_MPa = jumpSuperheatedUnit === 'kPa' ? val1 / 1000 : val1;

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

  const toggleColumnHighlight = (colId: string) => {
    setSelectedCols(prev => {
      const next = new Set(prev);
      if (next.has(colId)) next.delete(colId);
      else next.add(colId);
      return next;
    });
  };

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

  const SubHeader = ({ label, prop, colId, isCategoryEnd }: { label: string, prop: string, colId: string, isCategoryEnd?: boolean }) => {
    const isHovered = hoveredCol === colId;
    const isSelected = selectedCols.has(colId);
    return (
      <th 
        className={cn(
          "px-2 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 border-b border-gray-200 sticky top-14 transition-colors h-10 select-none whitespace-nowrap",
          isSelected ? "z-30 bg-red-100/90 text-red-950" : (isHovered ? "z-20 bg-red-50 text-red-900" : "z-10"),
          isCategoryEnd ? "border-r-2 border-r-gray-300" : "border-r border-r-gray-200/60"
        )}
        onMouseEnter={() => setHoveredCol(colId)}
        onMouseLeave={() => setHoveredCol(null)}
      >
        <div className="flex items-center justify-between gap-1.5 w-full">
          <div className="flex items-center gap-1 min-w-0">
            <span className="truncate">{label}</span>
            {TOOLTIPS[prop] && (
              <Info
                className="w-3 h-3 text-gray-400 hover:text-red-600 cursor-help shrink-0"
                onMouseEnter={(e) => showTooltip(TOOLTIPS[prop], e)}
                onMouseLeave={hideTooltip}
              />
            )}
          </div>
          <button
            onClick={() => toggleColumnHighlight(colId)}
            className={cn(
              "p-1 rounded transition-colors shrink-0 cursor-pointer",
              isSelected 
                ? "text-red-700 bg-red-200/90 hover:bg-red-300" 
                : "text-gray-400 hover:text-red-600 hover:bg-gray-200"
            )}
            title="Highlight column"
          >
            <Highlighter className="w-3 h-3" />
          </button>
        </div>
      </th>
    );
  };

  const Td = ({ children, colId, isRowHovered, isPinned, isHighlighted, isCategoryEnd }: { children: React.ReactNode, colId: string, isRowHovered: boolean, isPinned: boolean, isHighlighted?: boolean, isCategoryEnd?: boolean }) => {
    const isColHovered = hoveredCol === colId;
    const isColSelected = selectedCols.has(colId);

    let bgStyle = "";
    if (isHighlighted) {
      bgStyle = "bg-indigo-200/80 text-indigo-950 font-bold relative z-10 ring-1 ring-indigo-400";
    } else if (isPinned && isColSelected) {
      bgStyle = "bg-amber-300/90 text-amber-950 font-bold ring-1 ring-amber-400/50";
    } else if (isPinned) {
      bgStyle = isColHovered ? "bg-amber-200/90 font-semibold" : "bg-amber-100 font-semibold";
    } else if (isColSelected) {
      bgStyle = isRowHovered ? "bg-red-200/90 font-medium" : "bg-red-100/70";
    } else if (isRowHovered && isColHovered) {
      bgStyle = "bg-red-100/70";
    } else if (isRowHovered) {
      bgStyle = "bg-red-50/50";
    } else if (isColHovered) {
      bgStyle = "bg-red-50/60";
    }

    return (
      <td 
        className={cn(
          "px-3 py-2.5 text-sm text-gray-800 border-b border-gray-100 text-right transition-colors tabular-nums whitespace-nowrap",
          isCategoryEnd ? "border-r-2 border-r-gray-300" : "border-r border-r-gray-100",
          bgStyle
        )}
        onMouseEnter={() => setHoveredCol(colId)}
        onMouseLeave={() => setHoveredCol(null)}
      >
        {children}
      </td>
    );
  };

  const renderColHeader = (id: string, label: string, unit: string, widthClass: string = "w-[22%]") => {
    const isSelected = selectedCols.has(id);
    const isHovered = hoveredCol === id;
    return (
      <th 
        className={cn(
          "px-2 py-2 text-xs font-semibold text-gray-700 bg-gray-50 border-b border-gray-200 select-none transition-colors h-14",
          widthClass,
          isSelected ? "bg-red-100/90 text-red-950" : (isHovered && "bg-red-50 text-red-900")
        )}
        onMouseEnter={() => setHoveredCol(id)}
        onMouseLeave={() => setHoveredCol(null)}
      >
        <div className="flex flex-col justify-center h-full gap-2 w-full">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-xs text-gray-700">{label}</span>
            {id === 'T' ? (
              <select 
                className="bg-transparent border-b border-gray-300 text-xs font-semibold focus:outline-none cursor-pointer hover:border-red-600 transition-colors"
                value={tempUnit}
                onChange={e => setTempUnit(e.target.value as TempUnit)}
                onClick={e => e.stopPropagation()}
              >
                <option value="C">°C</option>
                <option value="K">K</option>
              </select>
            ) : (
              <span className="text-[10px] text-gray-500 font-normal">({unit})</span>
            )}
          </div>
          <div className="flex items-center justify-between w-full">
            <Info
              className="w-3.5 h-3.5 text-gray-400 hover:text-red-600 cursor-help shrink-0"
              onMouseEnter={(e) => showTooltip(TOOLTIPS[id] || label, e)}
              onMouseLeave={hideTooltip}
            />
            <button 
              onClick={(e) => { e.stopPropagation(); toggleColumnHighlight(id); }}
              className={cn(
                "p-1 rounded transition-colors shrink-0 cursor-pointer",
                isSelected ? "text-red-700 bg-red-200/90 hover:bg-red-300" : "text-gray-400 hover:text-red-600 hover:bg-gray-100"
              )}
              title={`Highlight ${label} column`}
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
      <div className="h-screen w-screen overflow-hidden bg-gray-50 flex flex-col pt-0 pb-0 px-0 m-0 relative">
        {/* Top Header / Red Bar */}
        <div className="bg-[#c13726] text-white px-4 py-2 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0 relative z-[100] shadow-md">
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
                  <div className="absolute top-full left-0 mt-2 w-[380px] sm:w-[460px] bg-white text-gray-900 rounded-lg shadow-2xl border border-gray-200 z-[110] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <div className="p-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 bg-white border border-gray-300 rounded px-2.5 py-1 flex-1">
                        <Search className="w-3.5 h-3.5 text-gray-400" />
                        <input 
                          type="text"
                          placeholder="Search table (e.g. A17, A-4, water)..."
                          value={tableSearchQuery}
                          onChange={(e) => setTableSearchQuery(e.target.value)}
                          onKeyDown={handleSwitcherKeyDown}
                          className="w-full text-xs bg-transparent focus:outline-none"
                          autoFocus
                        />
                      </div>
                      <button 
                        onClick={() => setIsSwitcherOpen(false)}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-200 transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="max-h-[340px] overflow-y-auto divide-y divide-gray-100">
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
                              "p-2.5 hover:bg-red-50/70 cursor-pointer transition-colors flex flex-col gap-1 text-left",
                              isSelected && "bg-red-50/80",
                              isMenuFocused && !isSelected && "bg-gray-100",
                              isMenuFocused && isSelected && "ring-2 ring-[#c13726] ring-inset"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className={cn("text-xs font-bold", isSelected ? "text-[#c13726]" : "text-gray-900")}>
                                {t.name}: {t.title}
                              </span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-[#c13726] shrink-0" />}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700">
                                {t.state}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-800 border border-blue-200/70">
                                {t.substance}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-800 border border-purple-200/70">
                                {t.type}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {filteredTables.length === 0 && (
                        <div className="p-4 text-center text-xs text-gray-500">
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
          <div className="flex flex-wrap items-center gap-2 bg-black/15 p-1.5 rounded border border-white/20 shrink-0 text-gray-900 relative">
            <Search className="w-4 h-4 text-white/80 ml-1" />
            
            {(tableData?.type === 'superheated' || tableData?.type === 'compressed') ? (
              <div className="flex items-center gap-1.5">
                <div className="relative flex items-center">
                  <input 
                    ref={jumpInputRef}
                    type="number" 
                    step="any"
                    className="bg-white border border-gray-300 rounded px-2 py-1 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-red-400 tabular-nums"
                    placeholder="Pressure"
                    title="Pressure value to jump to"
                    value={jumpValue}
                    onChange={(e) => setJumpValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleJump()}
                  />
                  {!jumpValue && <span className="absolute right-2 text-[9px] font-semibold text-gray-400 pointer-events-none">Ctrl+K</span>}
                </div>
                <select 
                  className="bg-white border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 cursor-pointer font-medium"
                  value={jumpSuperheatedUnit}
                  onChange={(e) => setJumpSuperheatedUnit(e.target.value as 'MPa' | 'kPa')}
                >
                  <option value="MPa">MPa</option>
                  <option value="kPa">kPa</option>
                </select>
              </div>
            ) : (
              <>
                <div className="relative flex items-center">
                  <input 
                    ref={jumpInputRef}
                    type="number" 
                    className="bg-white border border-gray-300 rounded px-2 py-1 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-red-400 tabular-nums"
                    placeholder="Value"
                    value={jumpValue}
                    onChange={(e) => setJumpValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleJump()}
                  />
                  {!jumpValue && <span className="absolute right-2 text-[9px] font-semibold text-gray-400 pointer-events-none">Ctrl+K</span>}
                </div>
                <select 
                  className="bg-white border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 max-w-[140px]"
                  value={jumpProperty}
                  onChange={(e) => setJumpProperty(e.target.value)}
                >
                  <option value="T">Temp ({tempUnit})</option>
                  {tableData?.type === 'saturated' && <option value="P">Psat ({pressUnit})</option>}
                </select>
              </>
            )}
            
            <button 
              className="bg-white hover:bg-white/90 active:bg-white/80 text-[#c13726] font-semibold px-3 py-1 rounded text-sm shadow-sm transition-colors cursor-pointer"
              onClick={handleJump}
            >
              Jump
            </button>
          </div>
        </div>

        {/* Main Table Content */}
        <div className="flex-1 min-h-0 relative bg-white">
          <div ref={tableRef} className="absolute inset-0 overflow-auto">
            {/* 1. Saturated Tables View */}
            {tableData?.type === 'saturated' && (
              <table className="w-full border-collapse border-spacing-0 text-left">
                <thead>
                  <tr>
                    <th rowSpan={2} className="w-10 bg-gray-50 border-b border-gray-200 sticky top-0 left-0 z-40 h-14"></th>
                    
                    {/* Index Col 1: Temp or Pressure */}
                    {tableData.indexProperty === 'T' ? (
                      <>
                        <th 
                          rowSpan={2} 
                          className={cn(
                            "px-2 py-2 text-sm font-medium text-gray-700 bg-gray-50 border-b border-gray-200 sticky top-0 z-30 transition-colors h-14 select-none", 
                            selectedCols.has('T') ? "bg-red-100/90 text-red-950" : (hoveredCol === 'T' && "bg-red-50 text-red-900")
                          )} 
                          onMouseEnter={() => setHoveredCol('T')} 
                          onMouseLeave={() => setHoveredCol(null)}
                        >
                          <div className="flex flex-col justify-center h-full gap-2 w-full">
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <span className="font-semibold text-xs">Temp</span>
                              <select 
                                className="bg-transparent border-b border-gray-300 text-xs font-semibold focus:outline-none cursor-pointer hover:border-red-600 transition-colors"
                                value={tempUnit}
                                onChange={e => setTempUnit(e.target.value as TempUnit)}
                              >
                                <option value="C">°C</option>
                                <option value="K">K</option>
                              </select>
                            </div>
                            <div className="flex items-center justify-between w-full">
                              <Info
                                className="w-3.5 h-3.5 text-gray-400 hover:text-red-600 cursor-help"
                                onMouseEnter={(e) => showTooltip(TOOLTIPS['T'], e)}
                                onMouseLeave={hideTooltip}
                              />
                              <button
                                onClick={() => toggleColumnHighlight('T')}
                                className={cn(
                                  "p-1 rounded transition-colors shrink-0 cursor-pointer",
                                  selectedCols.has('T') ? "text-red-700 bg-red-200/90 hover:bg-red-300" : "text-gray-400 hover:text-red-600 hover:bg-gray-100"
                                )}
                                title="Highlight Temp column"
                              >
                                <Highlighter className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </th>

                        <th 
                          rowSpan={2} 
                          className={cn(
                            "px-2 py-2 text-sm font-medium text-gray-700 bg-gray-50 border-b border-r-2 border-r-gray-300 sticky top-0 z-30 transition-colors h-14 select-none", 
                            selectedCols.has('P') ? "bg-red-100/90 text-red-950" : (hoveredCol === 'P' && "bg-red-50 text-red-900")
                          )} 
                          onMouseEnter={() => setHoveredCol('P')} 
                          onMouseLeave={() => setHoveredCol(null)}
                        >
                          <div className="flex flex-col justify-center h-full gap-2 w-full">
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <span className="font-semibold text-xs">Psat</span>
                              <select 
                                className="bg-transparent border-b border-gray-300 text-xs font-semibold focus:outline-none cursor-pointer hover:border-red-600 transition-colors"
                                value={pressUnit}
                                onChange={e => setPressUnit(e.target.value as PressUnit)}
                              >
                                <option value="kPa">kPa</option>
                                <option value="MPa">MPa</option>
                                <option value="bar">bar</option>
                              </select>
                            </div>
                            <div className="flex items-center justify-between w-full">
                              <Info
                                className="w-3.5 h-3.5 text-gray-400 hover:text-red-600 cursor-help"
                                onMouseEnter={(e) => showTooltip(TOOLTIPS['P'], e)}
                                onMouseLeave={hideTooltip}
                              />
                              <button
                                onClick={() => toggleColumnHighlight('P')}
                                className={cn(
                                  "p-1 rounded transition-colors shrink-0 cursor-pointer",
                                  selectedCols.has('P') ? "text-red-700 bg-red-200/90 hover:bg-red-300" : "text-gray-400 hover:text-red-600 hover:bg-gray-100"
                                )}
                                title="Highlight Psat column"
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
                          className={cn(
                            "px-2 py-2 text-sm font-medium text-gray-700 bg-gray-50 border-b border-gray-200 sticky top-0 z-30 transition-colors h-14 select-none", 
                            selectedCols.has('P') ? "bg-red-100/90 text-red-950" : (hoveredCol === 'P' && "bg-red-50 text-red-900")
                          )} 
                          onMouseEnter={() => setHoveredCol('P')} 
                          onMouseLeave={() => setHoveredCol(null)}
                        >
                          <div className="flex flex-col justify-center h-full gap-2 w-full">
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <span className="font-semibold text-xs">Press</span>
                              <select 
                                className="bg-transparent border-b border-gray-300 text-xs font-semibold focus:outline-none cursor-pointer hover:border-red-600 transition-colors"
                                value={pressUnit}
                                onChange={e => setPressUnit(e.target.value as PressUnit)}
                              >
                                <option value="kPa">kPa</option>
                                <option value="MPa">MPa</option>
                                <option value="bar">bar</option>
                              </select>
                            </div>
                          </div>
                        </th>

                        <th 
                          rowSpan={2} 
                          className={cn(
                            "px-2 py-2 text-sm font-medium text-gray-700 bg-gray-50 border-b border-r-2 border-r-gray-300 sticky top-0 z-30 transition-colors h-14 select-none", 
                            selectedCols.has('T') ? "bg-red-100/90 text-red-950" : (hoveredCol === 'T' && "bg-red-50 text-red-900")
                          )} 
                          onMouseEnter={() => setHoveredCol('T')} 
                          onMouseLeave={() => setHoveredCol(null)}
                        >
                          <div className="flex flex-col justify-center h-full gap-2 w-full">
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <span className="font-semibold text-xs">Tsat</span>
                              <select 
                                className="bg-transparent border-b border-gray-300 text-xs font-semibold focus:outline-none cursor-pointer hover:border-red-600 transition-colors"
                                value={tempUnit}
                                onChange={e => setTempUnit(e.target.value as TempUnit)}
                              >
                                <option value="C">°C</option>
                                <option value="K">K</option>
                              </select>
                            </div>
                          </div>
                        </th>
                      </>
                    )}

                    {/* Active Category Headers */}
                    {activeCategories.map((c) => (
                      <th key={c.id} colSpan={c.cols.length} className="px-2 py-2 text-sm font-medium text-center text-gray-700 bg-gray-50 border-b border-gray-200 border-r-2 border-r-gray-300 sticky top-0 z-20 h-14">
                        <div className="flex flex-col items-center justify-center h-full gap-1">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={true} onChange={() => toggleCol(c.id)} className="rounded border-gray-300 text-[#c13726] focus:ring-[#c13726] cursor-pointer" />
                            <span className="font-semibold text-xs md:text-sm">{c.label} {c.unit}</span>
                          </label>
                        </div>
                      </th>
                    ))}

                    <th rowSpan={2} className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 w-full" />

                    {collapsedCategories.map((c) => (
                      <th 
                        key={c.id} 
                        rowSpan={2} 
                        className="w-10 bg-gray-100 hover:bg-gray-200 border-b border-gray-200 border-l-2 border-l-gray-300 sticky top-0 z-20 transition-colors cursor-pointer"
                        onClick={() => toggleCol(c.id)}
                        title={`Expand ${c.label}`}
                      >
                        <div className="h-full flex items-center justify-center py-2">
                          <span className="[writing-mode:vertical-rl] text-[11px] font-bold text-gray-500 uppercase tracking-wider select-none">
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
                        ref={el => { rowRefs.current[rKey] = el; }}
                        className={cn("transition-colors", isPinned ? "bg-amber-50" : (isHovered ? "bg-red-50/40" : "bg-white"))}
                        onMouseEnter={() => setHoveredRow(rKey)}
                        onMouseLeave={() => setHoveredRow(null)}
                      >
                        <td className={cn("px-2 py-2 border-b border-gray-100 bg-white sticky left-0 z-10 flex items-center justify-center transition-colors", isHighlighted && "bg-indigo-200/80 border-indigo-200 ring-1 ring-indigo-400 z-20")}>
                          <button 
                            onClick={() => togglePin(rKey)}
                            className={cn(
                              "p-1.5 rounded transition-colors cursor-pointer",
                              isPinned 
                                ? "text-amber-700 bg-amber-200/90 hover:bg-amber-300 shadow-sm" 
                                : "text-gray-300 hover:text-gray-600 hover:bg-gray-100",
                              isHovered && !isPinned && "text-gray-400"
                            )}
                            title={isPinned ? "Unpin row" : "Highlight row"}
                          >
                            <Highlighter className="w-4 h-4" />
                          </button>
                        </td>

                        {tableData.indexProperty === 'T' ? (
                          <>
                            <Td colId="T" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted}>
                              {formatTempDisplay(row.T)}
                            </Td>
                            <Td colId="P" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isCategoryEnd={true}>
                              {formatPressDisplay(row.P)}
                            </Td>
                          </>
                        ) : (
                          <>
                            <Td colId="P" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted}>
                              {formatPressDisplay(row.P)}
                            </Td>
                            <Td colId="T" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted} isCategoryEnd={true}>
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
                              >
                                {valObj ? valObj.s : '-'}
                              </Td>
                            );
                          })
                        )}
                        
                        <td className={cn("bg-white border-b border-gray-100 p-0", isHighlighted && "bg-indigo-200/80 border-indigo-200")} />

                        {idx === 0 && collapsedCategories.map((c) => (
                          <td 
                            key={c.id} 
                            rowSpan={tableData.rows.length} 
                            className="bg-gray-50 border-l-2 border-l-gray-300 border-b-0 p-0"
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
              <div className="flex flex-col w-full h-full bg-gray-100 overflow-hidden relative">
                
                {/* Filter Menu Toggle & Actions */}
                <div className="bg-white px-4 py-2 flex items-center justify-between border-b border-gray-200 sticky top-0 z-20 shrink-0 shadow-sm">
                  <span className="text-sm font-semibold text-gray-700">
                    {tableData.blocks.length - disabledBlocks.size} of {tableData.blocks.length} isobars visible
                  </span>
                  <div className="relative" ref={filterMenuRef}>
                    <button 
                      onClick={() => setShowBlockFilter(!showBlockFilter)}
                      className="px-3 py-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded text-gray-700 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      Filter Isobars
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    {showBlockFilter && (
                      <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 shadow-xl rounded-lg z-50 flex flex-col max-h-96">
                        <div className="p-2 border-b border-gray-100 flex justify-between bg-gray-50 rounded-t-lg">
                          <button onClick={() => setDisabledBlocks(new Set())} className="text-xs text-[#c13726] hover:underline font-semibold cursor-pointer">Enable All</button>
                          <button onClick={() => setDisabledBlocks(new Set(tableData.blocks.map((_,i)=>i)))} className="text-xs text-gray-500 hover:underline cursor-pointer">Disable All</button>
                        </div>
                        <div className="overflow-y-auto p-2 flex flex-col gap-0.5">
                          {tableData.blocks.map((b, bIdx) => (
                            <label key={bIdx} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1.5 rounded transition-colors">
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
                                className="accent-[#c13726] w-4 h-4 cursor-pointer"
                              />
                              <span className="font-medium text-gray-700">P = {b.P.s} MPa</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Main Scrollable Area */}
                <div className="flex-1 overflow-y-auto relative p-4 flex flex-col gap-6">
                  
                  {/* Pinned Section (Top Row) */}
                  {pinnedBlocks.size > 0 && (
                    <div className="flex flex-col gap-2 shrink-0">
                      <div className="flex items-center gap-2 px-1">
                        <Pin className="w-4 h-4 text-amber-600" />
                        <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider">Pinned Isobars</h3>
                      </div>
                      <div className="flex flex-col md:flex-row gap-4 overflow-x-auto pb-2 items-start">
                        {Array.from(pinnedBlocks).map(bIdx => {
                          const block = tableData.blocks[bIdx];
                          if (!block) return null;
                          return (
                            <div key={`pinned-${bIdx}`} className="bg-white border-2 border-amber-300 rounded shadow-sm shrink-0 min-w-[340px] md:w-[380px] w-full flex flex-col overflow-hidden">
                               <div className="bg-amber-100 px-3 py-2 flex items-center justify-between border-b border-amber-200">
                                 <span className="text-sm font-bold text-amber-900">
                                   P = {block.P.s} MPa {block.Tsat.s !== 'N/A' && <span className="font-semibold text-amber-700 ml-1">({block.Tsat.s} °C)</span>}
                                 </span>
                                 <button onClick={() => {
                                   setPinnedBlocks(prev => { const n = new Set(prev); n.delete(bIdx); return n; });
                                 }} className="p-1 hover:bg-amber-200 rounded text-amber-700 cursor-pointer" title="Unpin">
                                   <X className="w-4 h-4" />
                                 </button>
                               </div>
                               <table className="w-full text-left border-collapse table-fixed">
                                   <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                      <th className="w-8 min-w-[32px] max-w-[32px] px-1 bg-gray-50 border-b border-gray-200 h-14"></th>
                                      {renderColHeader('T', 'Temp', '°C', 'w-16 min-w-[64px] max-w-[64px]')}
                                      {renderColHeader('v', 'v', 'm³/kg', 'w-[21%]')}
                                      {renderColHeader('u', 'u', 'kJ/kg', 'w-[21%]')}
                                      {renderColHeader('h', 'h', 'kJ/kg', 'w-[24%]')}
                                      {renderColHeader('s', 's', 'kJ/kg·K', 'w-[24%]')}
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
                                         <tr key={rIdx} ref={el => { rowRefs.current[rKey] = el; }} className={cn("transition-colors", isHovered ? "bg-red-50/40" : "bg-white")} onMouseEnter={() => setHoveredRow(rKey)} onMouseLeave={() => setHoveredRow(null)}>
                                           <td className={cn("w-8 min-w-[32px] max-w-[32px] px-1 py-1.5 border-b border-gray-100 flex items-center justify-center", isHighlighted && "bg-indigo-200/80 ring-1 ring-indigo-400 z-10")}>
                                             <button 
                                               onClick={() => toggleTempHighlight(tempStr, rKey)} 
                                               className={cn("p-1 rounded cursor-pointer transition-colors", isRowPinned ? "text-amber-700 bg-amber-200" : "text-gray-300 hover:text-gray-600")}
                                               title={isRowPinned ? `Unpin T = ${tempStr || 'Sat'}` : `Highlight T = ${tempStr || 'Sat'}`}
                                             >
                                               <Highlighter className="w-3.5 h-3.5" />
                                             </button>
                                           </td>
                                           <Td colId="T" isRowHovered={isHovered} isPinned={isRowPinned} isHighlighted={isHighlighted}>{row.isSaturationState ? <span className="font-bold text-[#c13726]">Sat.</span> : formatTempDisplay(row.T)}</Td>
                                          <Td colId="v" isRowHovered={isHovered} isPinned={isRowPinned} isHighlighted={isHighlighted}>{row.v.s}</Td>
                                          <Td colId="u" isRowHovered={isHovered} isPinned={isRowPinned} isHighlighted={isHighlighted}>{row.u.s}</Td>
                                          <Td colId="h" isRowHovered={isHovered} isPinned={isRowPinned} isHighlighted={isHighlighted}>{row.h.s}</Td>
                                          <Td colId="s" isRowHovered={isHovered} isPinned={isRowPinned} isHighlighted={isHighlighted}>{row.s.s}</Td>
                                        </tr>
                                      );
                                   })}
                                 </tbody>
                               </table>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Main Grid */}
                  <div className="flex flex-col gap-2 relative">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">All Isobars</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
                              "bg-white border rounded shadow-sm flex flex-col overflow-hidden transition-all duration-300", 
                              isCollapsed && "col-span-full",
                              isBlockHighlighted ? "border-indigo-500 ring-4 ring-indigo-400 shadow-xl" : "border-gray-200"
                            )}
                          >
                            <div className="bg-gray-50 px-3 py-2 flex items-center justify-between border-b border-gray-200">
                               <div className="flex items-center gap-2">
                                 <button onClick={() => {
                                   setCollapsedBlocks(prev => { const n = new Set(prev); if(n.has(bIdx)) n.delete(bIdx); else n.add(bIdx); return n; });
                                 }} className="p-1 hover:bg-gray-200 rounded text-gray-500 cursor-pointer" title={isCollapsed ? "Expand" : "Collapse"}>
                                   {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                 </button>
                                 <span className="text-sm font-bold text-gray-800">
                                   P = {block.P.s} MPa {block.Tsat.s !== 'N/A' && <span className="font-semibold text-gray-500 ml-1">({block.Tsat.s} °C)</span>}
                                 </span>
                               </div>
                               <div className="flex items-center gap-1">
                                 <button onClick={() => {
                                   setPinnedBlocks(prev => { const n = new Set(prev); if(n.has(bIdx)) n.delete(bIdx); else n.add(bIdx); return n; });
                                 }} className={cn("p-1.5 rounded transition-colors cursor-pointer", isPinned ? "bg-amber-100 text-amber-700" : "hover:bg-gray-200 text-gray-400")} title={isPinned ? "Unpin block" : "Pin block to top"}>
                                   <Pin className="w-4 h-4" />
                                 </button>
                               </div>
                            </div>
                            
                            {!isCollapsed && (
                              <table className="w-full text-left border-collapse table-fixed">
                                <thead>
                                  <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="w-8 min-w-[32px] max-w-[32px] px-1 bg-gray-50 border-b border-gray-200 h-14"></th>
                                    {renderColHeader('T', 'Temp', '°C', 'w-16 min-w-[64px] max-w-[64px]')}
                                    {renderColHeader('v', 'v', 'm³/kg', 'w-[21%]')}
                                    {renderColHeader('u', 'u', 'kJ/kg', 'w-[21%]')}
                                    {renderColHeader('h', 'h', 'kJ/kg', 'w-[24%]')}
                                    {renderColHeader('s', 's', 'kJ/kg·K', 'w-[24%]')}
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
                                        <tr key={rIdx} ref={el => { rowRefs.current[rKey] = el; }} className={cn("transition-colors", isHovered ? "bg-red-50/40" : "bg-white")} onMouseEnter={() => setHoveredRow(rKey)} onMouseLeave={() => setHoveredRow(null)}>
                                          <td className={cn("w-8 min-w-[32px] max-w-[32px] px-1 py-1.5 border-b border-gray-100 flex items-center justify-center", isHighlighted && "bg-indigo-200/80 ring-1 ring-indigo-400 z-10")}>
                                            <button 
                                              onClick={() => toggleTempHighlight(tempStr, rKey)} 
                                              className={cn("p-1 rounded cursor-pointer transition-colors", isRowPinned ? "text-amber-700 bg-amber-200" : "text-gray-300 hover:text-gray-600")}
                                              title={isRowPinned ? `Unpin T = ${tempStr || 'Sat'}` : `Highlight T = ${tempStr || 'Sat'}`}
                                            >
                                              <Highlighter className="w-3.5 h-3.5" />
                                            </button>
                                          </td>
                                          <Td colId="T" isRowHovered={isHovered} isPinned={isRowPinned} isHighlighted={isHighlighted}>{row.isSaturationState ? <span className="font-bold text-[#c13726]">Sat.</span> : formatTempDisplay(row.T)}</Td>
                                          <Td colId="v" isRowHovered={isHovered} isPinned={isRowPinned} isHighlighted={isHighlighted}>{row.v.s}</Td>
                                          <Td colId="u" isRowHovered={isHovered} isPinned={isRowPinned} isHighlighted={isHighlighted}>{row.u.s}</Td>
                                          <Td colId="h" isRowHovered={isHovered} isPinned={isRowPinned} isHighlighted={isHighlighted}>{row.h.s}</Td>
                                          <Td colId="s" isRowHovered={isHovered} isPinned={isRowPinned} isHighlighted={isHighlighted}>{row.s.s}</Td>
                                        </tr>
                                      );
                                  })}
                                </tbody>
                              </table>
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
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="w-8 min-w-[32px] max-w-[32px] px-1 bg-gray-50 border-b border-gray-200 h-14"></th>
                    {renderColHeader('T', 'Temp', 'K', 'w-16 min-w-[64px] max-w-[64px]')}
                    {renderColHeader('h', 'h', 'kJ/kg', 'w-[20%]')}
                    {renderColHeader('u', 'u', 'kJ/kg', 'w-[20%]')}
                    {renderColHeader('s_deg', 's°', 'kJ/kg·K', 'w-[20%]')}
                    {renderColHeader('s_plus', 's+', 'kJ/kg·K', 'w-[20%]')}
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
                        ref={el => { rowRefs.current[rKey] = el; }}
                        className={cn("transition-colors", isHovered ? "bg-red-50/40" : "bg-white")}
                        onMouseEnter={() => setHoveredRow(rKey)}
                        onMouseLeave={() => setHoveredRow(null)}
                      >
                        <td className={cn("w-8 min-w-[32px] max-w-[32px] px-1 py-1.5 border-b border-gray-100 flex items-center justify-center", isHighlighted && "bg-indigo-200/80 ring-1 ring-indigo-400 z-10")}>
                          <button 
                            onClick={() => togglePin(rKey)}
                            className={cn("p-1 rounded cursor-pointer transition-colors", isPinned ? "text-amber-700 bg-amber-200" : "text-gray-300 hover:text-gray-600")}
                            title={isPinned ? `Unpin T = ${row.T.s}` : `Highlight T = ${row.T.s}`}
                          >
                            <Highlighter className="w-3.5 h-3.5" />
                          </button>
                        </td>
                        <Td colId="T" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted}>{row.T.s}</Td>
                        <Td colId="h" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted}>{row.h.s}</Td>
                        <Td colId="u" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted}>{row.u.s}</Td>
                        <Td colId="s_deg" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted}>{row.s_deg.s}</Td>
                        <Td colId="s_plus" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted}>{row.s_plus?.s || '-'}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* 4. Molar Ideal Gas View (A-18 .. A-25) */}
            {tableData?.type === 'ideal_gas_molar' && (
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="w-8 min-w-[32px] max-w-[32px] px-1 bg-gray-50 border-b border-gray-200 h-14"></th>
                    {renderColHeader('T', 'Temp', 'K', 'w-16 min-w-[64px] max-w-[64px]')}
                    {renderColHeader('h_bar', 'h̄', 'kJ/kmol', 'w-[25%]')}
                    {renderColHeader('u_bar', 'ū', 'kJ/kmol', 'w-[25%]')}
                    {renderColHeader('s_bar_deg', 's̄°', 'kJ/kmol·K', 'w-[25%]')}
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
                        ref={el => { rowRefs.current[rKey] = el; }}
                        className={cn("transition-colors", isHovered ? "bg-red-50/40" : "bg-white")}
                        onMouseEnter={() => setHoveredRow(rKey)}
                        onMouseLeave={() => setHoveredRow(null)}
                      >
                        <td className={cn("w-8 min-w-[32px] max-w-[32px] px-1 py-1.5 border-b border-gray-100 flex items-center justify-center", isHighlighted && "bg-indigo-200/80 ring-1 ring-indigo-400 z-10")}>
                          <button 
                            onClick={() => togglePin(rKey)}
                            className={cn("p-1 rounded cursor-pointer transition-colors", isPinned ? "text-amber-700 bg-amber-200" : "text-gray-300 hover:text-gray-600")}
                            title={isPinned ? `Unpin T = ${row.T.s}` : `Highlight T = ${row.T.s}`}
                          >
                            <Highlighter className="w-3.5 h-3.5" />
                          </button>
                        </td>
                        <Td colId="T" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted}>{row.T.s}</Td>
                        <Td colId="h_bar" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted}>{row.h_bar.s}</Td>
                        <Td colId="u_bar" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted}>{row.u_bar.s}</Td>
                        <Td colId="s_bar_deg" isRowHovered={isHovered} isPinned={isPinned} isHighlighted={isHighlighted}>{row.s_bar_deg.s}</Td>
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
