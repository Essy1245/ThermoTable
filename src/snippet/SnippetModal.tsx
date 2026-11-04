import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  X,
  Copy,
  Check,
  Download,
  Share2,
  Highlighter,
  Trash2,
  Crop,
  PenLine,
  Plus,
  Minus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { TableMeta } from '../data/tablesMeta';
import type {
  ThermoTableData,
  ThermoValue,
  IdealGasAirRow,
  IdealGasMolarRow,
} from '../data/types';
import {
  renderSnippetCanvas,
  type SnippetColumnDef,
  type SnippetRowGroup,
  type SnippetRowItem,
  type SnippetRenderResult,
} from './renderSnippetCanvas';

type TempUnit = 'C' | 'K';
type PressUnit = 'kPa' | 'MPa' | 'bar';

interface SnippetModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableMeta: TableMeta;
  tableData: ThermoTableData | null | undefined;
  tempUnit: TempUnit;
  pressUnit: PressUnit;
  visibleCols: Record<string, boolean>;
  pinnedRows: Set<string>;
  pinnedTemps: Set<string>;
  pinnedBlocks: Set<number>;
  touchedBlocks: Set<number>;
  disabledBlocks: Set<number>;
  selectedCols: Set<string>;
  onClearAllSelections: () => void;
}

function buildAllColumns(
  tableMeta: TableMeta,
  tableData: ThermoTableData | null | undefined,
  tempUnit: TempUnit,
  pressUnit: PressUnit,
  visibleCols: Record<string, boolean>
): SnippetColumnDef[] {
  if (!tableData) return [];

  if (tableData.type === 'saturated') {
    const isIce = tableMeta.id === 'A-8';
    const tCol: SnippetColumnDef = {
      id: 'T',
      symbol: 'T',
      subscript: tableData.indexProperty === 'P' ? 'sat' : undefined,
      unit: tempUnit === 'K' ? 'K' : '°C',
      label: tableData.indexProperty === 'P' ? 'Tsat' : 'Temp',
      isIndex: true,
    };
    const pCol: SnippetColumnDef = {
      id: 'P',
      symbol: 'P',
      subscript: tableData.indexProperty === 'T' ? 'sat' : undefined,
      unit: pressUnit,
      label: tableData.indexProperty === 'T' ? 'Psat' : 'Press',
      isIndex: true,
    };

    const cols: SnippetColumnDef[] =
      tableData.indexProperty === 'T' ? [tCol, pCol] : [pCol, tCol];

    if (visibleCols.volume) {
      cols.push(
        isIce
          ? { id: 'vi', symbol: 'v', subscript: 'i', unit: 'm³/kg', label: 'vi' }
          : { id: 'vf', symbol: 'v', subscript: 'f', unit: 'm³/kg', label: 'vf' },
        { id: 'vg', symbol: 'v', subscript: 'g', unit: 'm³/kg', label: 'vg' }
      );
    }
    if (visibleCols.energy) {
      cols.push(
        isIce
          ? { id: 'ui', symbol: 'u', subscript: 'i', unit: 'kJ/kg', label: 'ui' }
          : { id: 'uf', symbol: 'u', subscript: 'f', unit: 'kJ/kg', label: 'uf' },
        isIce
          ? { id: 'uig', symbol: 'u', subscript: 'ig', unit: 'kJ/kg', label: 'uig' }
          : { id: 'ufg', symbol: 'u', subscript: 'fg', unit: 'kJ/kg', label: 'ufg' },
        { id: 'ug', symbol: 'u', subscript: 'g', unit: 'kJ/kg', label: 'ug' }
      );
    }
    if (visibleCols.enthalpy) {
      cols.push(
        isIce
          ? { id: 'hi', symbol: 'h', subscript: 'i', unit: 'kJ/kg', label: 'hi' }
          : { id: 'hf', symbol: 'h', subscript: 'f', unit: 'kJ/kg', label: 'hf' },
        isIce
          ? { id: 'hig', symbol: 'h', subscript: 'ig', unit: 'kJ/kg', label: 'hig' }
          : { id: 'hfg', symbol: 'h', subscript: 'fg', unit: 'kJ/kg', label: 'hfg' },
        { id: 'hg', symbol: 'h', subscript: 'g', unit: 'kJ/kg', label: 'hg' }
      );
    }
    if (visibleCols.entropy) {
      cols.push(
        isIce
          ? { id: 'si', symbol: 's', subscript: 'i', unit: 'kJ/kg · K', label: 'si' }
          : { id: 'sf', symbol: 's', subscript: 'f', unit: 'kJ/kg · K', label: 'sf' },
        isIce
          ? { id: 'sig', symbol: 's', subscript: 'ig', unit: 'kJ/kg · K', label: 'sig' }
          : { id: 'sfg', symbol: 's', subscript: 'fg', unit: 'kJ/kg · K', label: 'sfg' },
        { id: 'sg', symbol: 's', subscript: 'g', unit: 'kJ/kg · K', label: 'sg' }
      );
    }
    return cols;
  }

  if (tableData.type === 'superheated' || tableData.type === 'compressed') {
    return [
      {
        id: 'T',
        symbol: 'T',
        unit: tempUnit === 'K' ? 'K' : '°C',
        label: 'Temp',
        isIndex: true,
      },
      { id: 'v', symbol: 'v', unit: 'm³/kg', label: 'v' },
      { id: 'u', symbol: 'u', unit: 'kJ/kg', label: 'u' },
      { id: 'h', symbol: 'h', unit: 'kJ/kg', label: 'h' },
      { id: 's', symbol: 's', unit: 'kJ/kg · K', label: 's' },
    ];
  }

  if (tableData.type === 'ideal_gas_air') {
    return [
      { id: 'T', symbol: 'T', unit: 'K', label: 'T', isIndex: true },
      { id: 'h', symbol: 'h', unit: 'kJ/kg', label: 'h' },
      { id: 'u', symbol: 'u', unit: 'kJ/kg', label: 'u' },
      { id: 's_deg', symbol: 's', superscript: '°', unit: 'kJ/kg · K', label: 's°' },
      { id: 's_plus', symbol: 's', superscript: '+', unit: 'kJ/kg · K', label: 's+' },
    ];
  }

  if (tableData.type === 'ideal_gas_molar') {
    return [
      { id: 'T', symbol: 'T', unit: 'K', label: 'T', isIndex: true },
      { id: 'h_bar', symbol: 'h', overbar: true, unit: 'kJ/kmol', label: 'h̄' },
      { id: 'u_bar', symbol: 'u', overbar: true, unit: 'kJ/kmol', label: 'ū' },
      {
        id: 's_bar_deg',
        symbol: 's',
        overbar: true,
        superscript: '°',
        unit: 'kJ/kmol · K',
        label: 's̄°',
      },
    ];
  }

  return [];
}

function computeInitialColIds(
  allColumns: SnippetColumnDef[],
  selectedCols: Set<string>
): Set<string> {
  const initialColIds = new Set(selectedCols);
  const independentColumn = allColumns[0];
  if (independentColumn) {
    initialColIds.add(independentColumn.id);
  }
  return initialColIds;
}

function computeInitialBlockIdxs(
  tableData: ThermoTableData | null | undefined,
  pinnedBlocks: Set<number>,
  touchedBlocks: Set<number>,
  disabledBlocks: Set<number>
): Set<number> {
  if (!tableData || (tableData.type !== 'superheated' && tableData.type !== 'compressed')) {
    return new Set<number>();
  }
  if (pinnedBlocks.size > 0) {
    return new Set(pinnedBlocks);
  }
  if (touchedBlocks.size > 0) {
    return new Set(touchedBlocks);
  }
  const firstVisible = tableData.blocks.findIndex(
    (_, i) => !disabledBlocks.has(i)
  );
  return firstVisible >= 0 ? new Set([firstVisible]) : new Set([0]);
}

function buildRowGroups({
  tableData,
  pinnedRows,
  pinnedTemps,
  activeBlockIdxs,
  allColumns,
  formatTempDisplay,
  formatPressDisplay,
  formatIsobarPress,
  formatSatTemp,
}: {
  tableData: ThermoTableData | null | undefined;
  pinnedRows: Set<string>;
  pinnedTemps: Set<string>;
  activeBlockIdxs: Set<number>;
  allColumns: SnippetColumnDef[];
  formatTempDisplay: (val?: ThermoValue) => string;
  formatPressDisplay: (val?: ThermoValue) => string;
  formatIsobarPress: (val: ThermoValue) => string;
  formatSatTemp: (val?: ThermoValue) => string;
}): SnippetRowGroup[] {
  if (!tableData) return [];

  if (tableData.type === 'saturated') {
    const sortedRowIndices = Array.from(pinnedRows)
      .map((k) => parseInt(k, 10))
      .filter((n) => !isNaN(n) && n >= 0 && n < tableData.rows.length)
      .sort((a, b) => a - b);

    if (sortedRowIndices.length === 0) return [];

    return [
      {
        rows: sortedRowIndices.map((idx) => {
          const row = tableData.rows[idx];
          const cells: Record<string, string> = {
            T: formatTempDisplay(row.T),
            P: formatPressDisplay(row.P),
          };
          const rec = row as Record<string, ThermoValue | undefined>;
          for (const col of allColumns) {
            if (col.id !== 'T' && col.id !== 'P') {
              cells[col.id] = rec[col.id]?.s ?? '-';
            }
          }
          return { rowKey: idx.toString(), cells };
        }),
      },
    ];
  }

  if (tableData.type === 'superheated' || tableData.type === 'compressed') {
    const sortedBlocks = Array.from(activeBlockIdxs)
      .filter((bIdx) => bIdx >= 0 && bIdx < tableData.blocks.length)
      .sort((a, b) => a - b);

    const groups: SnippetRowGroup[] = [];

    for (const bIdx of sortedBlocks) {
      const block = tableData.blocks[bIdx];
      if (!block) continue;

      const matchingRows: { rowKey: string; cells: Record<string, string> }[] = [];

      block.rows.forEach((row, rIdx) => {
        const rKey = `${bIdx}-${rIdx}`;
        const tempStr = row.isSaturationState ? 'Sat' : row.T?.s || '';
        const isRowPinned =
          (tempStr && pinnedTemps.has(tempStr)) || pinnedRows.has(rKey);

        // Include row if it's pinned, or if no specific rows/temps are pinned at all (whole pinned block)
        const hasAnyRowPin = pinnedTemps.size > 0 || pinnedRows.size > 0;
        if (isRowPinned || !hasAnyRowPin) {
          matchingRows.push({
            rowKey: rKey,
            cells: {
              T: row.isSaturationState ? 'Sat.' : formatTempDisplay(row.T),
              v: row.v.s,
              u: row.u.s,
              h: row.h.s,
              s: row.s.s,
            },
          });
        }
      });

      if (matchingRows.length > 0) {
        const satPart =
          block.Tsat.s !== 'N/A' ? ` (${formatSatTemp(block.Tsat)})` : '';
        groups.push({
          blockTitle: `P = ${formatIsobarPress(block.P)}${satPart}`,
          rows: matchingRows,
        });
      }
    }

    return groups;
  }

  if (tableData.type === 'ideal_gas_air') {
    const sortedRowIndices = Array.from(pinnedRows)
      .map((k) => parseInt(k, 10))
      .filter((n) => !isNaN(n) && n >= 0 && n < tableData.rows.length)
      .sort((a, b) => a - b);

    if (sortedRowIndices.length === 0) return [];

    return [
      {
        rows: sortedRowIndices.map((idx) => {
          const row: IdealGasAirRow = tableData.rows[idx];
          return {
            rowKey: idx.toString(),
            cells: {
              T: row.T.s,
              h: row.h.s,
              u: row.u.s,
              s_deg: row.s_deg.s,
              s_plus: row.s_plus?.s || '-',
            },
          };
        }),
      },
    ];
  }

  if (tableData.type === 'ideal_gas_molar') {
    const sortedRowIndices = Array.from(pinnedRows)
      .map((k) => parseInt(k, 10))
      .filter((n) => !isNaN(n) && n >= 0 && n < tableData.rows.length)
      .sort((a, b) => a - b);

    if (sortedRowIndices.length === 0) return [];

    return [
      {
        rows: sortedRowIndices.map((idx) => {
          const row: IdealGasMolarRow = tableData.rows[idx];
          return {
            rowKey: idx.toString(),
            cells: {
              T: row.T.s,
              h_bar: row.h_bar.s,
              u_bar: row.u_bar.s,
              s_bar_deg: row.s_bar_deg.s,
            },
          };
        }),
      },
    ];
  }

  return [];
}

function computeInitialEmphasizedCells(
  groups: SnippetRowGroup[],
  selectedCols: Set<string>,
  allColumns: SnippetColumnDef[]
): Set<string> {
  if (selectedCols.size === 0) return new Set();
  const initial = new Set<string>();
  for (const group of groups) {
    for (const row of group.rows) {
      for (const colId of selectedCols) {
        const colDef = allColumns.find((c) => c.id === colId);
        // Auto-emphasize non-index selected columns at pinned row intersections
        if (colDef && !colDef.isIndex) {
          initial.add(`${row.rowKey}::${colId}`);
        }
      }
    }
  }
  return initial;
}

function getRowShortLabel(
  row: { rowKey: string; cells: Record<string, string> },
  orderedActiveColumns: SnippetColumnDef[]
): string {
  const parts: string[] = [];
  for (const col of orderedActiveColumns) {
    const val = row.cells[col.id];
    if (val && val !== '-') {
      parts.push(`${col.label || col.symbol} = ${val}${col.unit ? ` ${col.unit}` : ''}`);
      if (parts.length >= 2) break;
    }
  }
  return parts.length > 0 ? parts.join(', ') : `Row ${row.rowKey}`;
}

function getRowBadgeLabel(
  row: { rowKey: string; cells: Record<string, string> },
  tableData: ThermoTableData | null | undefined,
  tempUnit: TempUnit,
  pressUnit: PressUnit
): string {
  if (!tableData) return `Row ${row.rowKey}`;
  const tUnit = tempUnit === 'K' ? 'K' : '°C';
  if (tableData.type === 'superheated' || tableData.type === 'compressed') {
    if (row.cells.T === 'Sat.') return 'Sat.';
    return row.cells.T ? `T = ${row.cells.T} ${tUnit}` : `Row ${row.rowKey}`;
  }
  if (tableData.type === 'saturated') {
    if (tableData.indexProperty === 'T') {
      return `T = ${row.cells.T} ${tUnit}${row.cells.P ? ` (${row.cells.P} ${pressUnit})` : ''}`;
    } else {
      return `P = ${row.cells.P} ${pressUnit}${row.cells.T ? ` (${row.cells.T} ${tUnit})` : ''}`;
    }
  }
  if (tableData.type === 'ideal_gas_air' || tableData.type === 'ideal_gas_molar') {
    return row.cells.T ? `T = ${row.cells.T} K` : `Row ${row.rowKey}`;
  }
  return `Row ${row.rowKey}`;
}

interface ActiveSpaceItemProps {
  label: string;
  height: number;
  onAdjust: (delta: number) => void;
  onRemove: () => void;
}

function ActiveSpaceItem({
  label,
  height,
  onAdjust,
  onRemove,
}: ActiveSpaceItemProps) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 border border-dashed border-amber-300 dark:border-amber-700/80 rounded-md">
      <div className="flex items-center gap-2 min-w-0">
        <PenLine className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="text-xs font-semibold text-amber-900 dark:text-amber-200 truncate">
          {label} ({height} row{height > 1 ? 's' : ''}, {Math.round(height * 30)}px)
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[11px] text-gray-500 dark:text-gray-400 mr-1 hidden sm:inline">
          Height:
        </span>
        <button
          type="button"
          onClick={() => onAdjust(-0.5)}
          disabled={height <= 0.5}
          className="w-5 h-5 flex items-center justify-center rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 cursor-pointer"
          title="Decrease height"
        >
          <Minus className="w-3 h-3" />
        </button>
        <span className="text-xs font-mono font-medium px-1 min-w-[32px] text-center">
          {height}x
        </span>
        <button
          type="button"
          onClick={() => onAdjust(0.5)}
          disabled={height >= 3.0}
          className="w-5 h-5 flex items-center justify-center rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 cursor-pointer"
          title="Increase height"
        >
          <Plus className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="ml-1 p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors cursor-pointer"
          title="Remove this blank space"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function SnippetModalDialog({
  onClose,
  tableMeta,
  tableData,
  tempUnit,
  pressUnit,
  visibleCols,
  pinnedRows,
  pinnedTemps,
  pinnedBlocks,
  touchedBlocks,
  disabledBlocks,
  selectedCols,
  onClearAllSelections,
}: SnippetModalProps) {
  const formatTempDisplay = useCallback(
    (val?: ThermoValue) => {
      if (!val) return '-';
      if (tempUnit === 'K') {
        return (val.v + 273.15).toFixed(2);
      }
      return val.s;
    },
    [tempUnit]
  );

  const formatSatTemp = useCallback(
    (val?: ThermoValue) => {
      if (!val || val.s === 'N/A') return 'N/A';
      if (tempUnit === 'K') {
        return `Tsat = ${(val.v + 273.15).toFixed(2)} K`;
      }
      return `Tsat = ${val.s} °C`;
    },
    [tempUnit]
  );

  const formatPressDisplay = useCallback(
    (val?: ThermoValue) => {
      if (!val) return '-';
      if (pressUnit === 'MPa') {
        return (val.v / 1000).toFixed(4);
      }
      if (pressUnit === 'bar') {
        return (val.v / 100).toFixed(4);
      }
      return val.s;
    },
    [pressUnit]
  );

  const formatIsobarPress = useCallback(
    (val: ThermoValue) => {
      if (pressUnit === 'kPa') {
        return `${(val.v * 1000).toFixed(val.v * 1000 >= 10 ? 0 : 1)} kPa`;
      }
      if (pressUnit === 'bar') {
        return `${(val.v * 10).toFixed(val.v * 10 >= 10 ? 0 : 2)} bar`;
      }
      return `${val.s} MPa`;
    },
    [pressUnit]
  );

  // Build all available columns for the current table
  const allColumns = useMemo(
    () => buildAllColumns(tableMeta, tableData, tempUnit, pressUnit, visibleCols),
    [tableMeta, tableData, tempUnit, pressUnit, visibleCols]
  );

  // Synchronous atomic initial states on modal open
  const initialColIds = useMemo(
    () => computeInitialColIds(allColumns, selectedCols),
    [allColumns, selectedCols]
  );

  const initialBlockIdxs = useMemo(
    () =>
      computeInitialBlockIdxs(
        tableData,
        pinnedBlocks,
        touchedBlocks,
        disabledBlocks
      ),
    [tableData, pinnedBlocks, touchedBlocks, disabledBlocks]
  );

  // Active columns inside the snippet modal
  const [activeColIds, setActiveColIds] = useState<Set<string>>(() => initialColIds);
  // Active block indices for superheated/compressed tables
  const [activeBlockIdxs, setActiveBlockIdxs] = useState<Set<number>>(() => initialBlockIdxs);

  // Emphasized cells "${rowKey}::${colId}" initialized synchronously from initial row groups
  const [emphasizedCells, setEmphasizedCells] = useState<Set<string>>(() => {
    const initialGroups = buildRowGroups({
      tableData,
      pinnedRows,
      pinnedTemps,
      activeBlockIdxs: initialBlockIdxs,
      allColumns,
      formatTempDisplay,
      formatPressDisplay,
      formatIsobarPress,
      formatSatTemp,
    });
    return computeInitialEmphasizedCells(initialGroups, selectedCols, allColumns);
  });

  // Build row groups based on active blocks and pinned rows / temps
  const rowGroups = useMemo<SnippetRowGroup[]>(() => {
    return buildRowGroups({
      tableData,
      pinnedRows,
      pinnedTemps,
      activeBlockIdxs,
      allColumns,
      formatTempDisplay,
      formatPressDisplay,
      formatIsobarPress,
      formatSatTemp,
    });
  }, [
    tableData,
    pinnedRows,
    pinnedTemps,
    activeBlockIdxs,
    allColumns,
    formatTempDisplay,
    formatPressDisplay,
    formatIsobarPress,
    formatSatTemp,
  ]);

  // Disabled row keys set for excluding specific rows from snippet canvas
  const [disabledRowKeys, setDisabledRowKeys] = useState<Set<string>>(() => new Set());

  // Filter candidate rowGroups to only included/enabled rows
  const enabledRowGroups = useMemo<SnippetRowGroup[]>(() => {
    return rowGroups
      .map((group) => ({
        ...group,
        rows: group.rows.filter((row) => !disabledRowKeys.has(row.rowKey)),
      }))
      .filter((group) => group.rows.length > 0);
  }, [rowGroups, disabledRowKeys]);

  const allCandidateRowKeys = useMemo(() => {
    const keys: string[] = [];
    for (const group of rowGroups) {
      for (const r of group.rows) {
        keys.push(r.rowKey);
      }
    }
    return keys;
  }, [rowGroups]);

  const totalCandidateRowCount = allCandidateRowKeys.length;

  const enabledRowCount = useMemo(() => {
    let count = 0;
    for (const group of rowGroups) {
      for (const r of group.rows) {
        if (!disabledRowKeys.has(r.rowKey)) {
          count++;
        }
      }
    }
    return count;
  }, [rowGroups, disabledRowKeys]);

  const toggleRowEnabled = useCallback((rowKey: string) => {
    setDisabledRowKeys((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) {
        next.delete(rowKey);
      } else {
        next.add(rowKey);
      }
      return next;
    });
  }, []);

  const enableAllRows = useCallback(() => {
    setDisabledRowKeys(new Set());
  }, []);

  const disableAllRows = useCallback(() => {
    setDisabledRowKeys(new Set(allCandidateRowKeys));
  }, [allCandidateRowKeys]);

  const enableGroupRows = useCallback((group: SnippetRowGroup) => {
    setDisabledRowKeys((prev) => {
      const next = new Set(prev);
      group.rows.forEach((r) => next.delete(r.rowKey));
      return next;
    });
  }, []);

  const disableGroupRows = useCallback((group: SnippetRowGroup) => {
    setDisabledRowKeys((prev) => {
      const next = new Set(prev);
      group.rows.forEach((r) => next.add(r.rowKey));
      return next;
    });
  }, []);

  // Empty vertical spaces configuration for interpolation: slotKey -> { heightInRows: number }
  const [emptySpaces, setEmptySpaces] = useState<Record<string, { heightInRows: number }>>({});
  const [isInterpolationOpen, setIsInterpolationOpen] = useState<boolean>(true);

  // Compute final row groups with empty vertical spaces woven in
  const finalRowGroups = useMemo<SnippetRowGroup[]>(() => {
    return enabledRowGroups.map((group) => {
      const rawRows = group.rows;
      if (rawRows.length === 0) return group;

      const newRows: SnippetRowItem[] = [];

      // Check for empty space before first row
      const beforeKey = `before::${rawRows[0].rowKey}`;
      if (emptySpaces[beforeKey]) {
        const hRows = emptySpaces[beforeKey].heightInRows || 1;
        newRows.push({
          rowKey: `__empty_${beforeKey}`,
          cells: {},
          isEmptySpace: true,
          emptySpaceHeight: Math.round(hRows * 30),
        });
      }

      for (let i = 0; i < rawRows.length; i++) {
        newRows.push(rawRows[i]);

        // Check for empty space between row i and row i+1
        if (i < rawRows.length - 1) {
          const betweenKey = `between::${rawRows[i].rowKey}::${rawRows[i + 1].rowKey}`;
          if (emptySpaces[betweenKey]) {
            const hRows = emptySpaces[betweenKey].heightInRows || 1;
            newRows.push({
              rowKey: `__empty_${betweenKey}`,
              cells: {},
              isEmptySpace: true,
              emptySpaceHeight: Math.round(hRows * 30),
            });
          }
        }
      }

      // Check for empty space after last row
      const afterKey = `after::${rawRows[rawRows.length - 1].rowKey}`;
      if (emptySpaces[afterKey]) {
        const hRows = emptySpaces[afterKey].heightInRows || 1;
        newRows.push({
          rowKey: `__empty_${afterKey}`,
          cells: {},
          isEmptySpace: true,
          emptySpaceHeight: Math.round(hRows * 30),
        });
      }

      return {
        ...group,
        rows: newRows,
      };
    });
  }, [enabledRowGroups, emptySpaces]);

  const addSpace = useCallback((slotKey: string, heightInRows: number = 1) => {
    setEmptySpaces((prev) => ({
      ...prev,
      [slotKey]: { heightInRows },
    }));
  }, []);

  const removeSpace = useCallback((slotKey: string) => {
    setEmptySpaces((prev) => {
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
  }, []);

  const adjustHeight = useCallback((slotKey: string, delta: number) => {
    setEmptySpaces((prev) => {
      const current = prev[slotKey]?.heightInRows ?? 1;
      const nextVal = Math.max(0.5, Math.min(3.0, Math.round((current + delta) * 10) / 10));
      return {
        ...prev,
        [slotKey]: { heightInRows: nextVal },
      };
    });
  }, []);

  const handleAddBetweenAll = useCallback(() => {
    setEmptySpaces((prev) => {
      const next = { ...prev };
      enabledRowGroups.forEach((group) => {
        const rawRows = group.rows;
        for (let i = 0; i < rawRows.length - 1; i++) {
          const betweenKey = `between::${rawRows[i].rowKey}::${rawRows[i + 1].rowKey}`;
          if (!next[betweenKey]) {
            next[betweenKey] = { heightInRows: 1 };
          }
        }
      });
      return next;
    });
  }, [enabledRowGroups]);

  const activeSpaceCount = useMemo(() => {
    let count = 0;
    enabledRowGroups.forEach((group) => {
      const rawRows = group.rows;
      if (rawRows.length === 0) return;
      if (emptySpaces[`before::${rawRows[0].rowKey}`]) count++;
      for (let i = 0; i < rawRows.length - 1; i++) {
        if (emptySpaces[`between::${rawRows[i].rowKey}::${rawRows[i + 1].rowKey}`]) count++;
      }
      if (emptySpaces[`after::${rawRows[rawRows.length - 1].rowKey}`]) count++;
    });
    return count;
  }, [enabledRowGroups, emptySpaces]);

  const canAddBetweenAll = useMemo(() => {
    let canAdd = false;
    enabledRowGroups.forEach((group) => {
      const rawRows = group.rows;
      for (let i = 0; i < rawRows.length - 1; i++) {
        const betweenKey = `between::${rawRows[i].rowKey}::${rawRows[i + 1].rowKey}`;
        if (!emptySpaces[betweenKey]) {
          canAdd = true;
        }
      }
    });
    return canAdd;
  }, [enabledRowGroups, emptySpaces]);

  const orderedActiveColumns = useMemo(
    () => allColumns.filter((c) => activeColIds.has(c.id)),
    [allColumns, activeColIds]
  );

  const isSnippetActive =
    finalRowGroups.length > 0 &&
    orderedActiveColumns.length > 0 &&
    enabledRowCount > 0;

  const [renderResult, setRenderResult] = useState<SnippetRenderResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const urlRef = useRef<string | null>(null);

  // Clean up any active object URL on unmount
  useEffect(() => {
    return () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, []);

  const canNativeShare = useMemo(() => {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function'
    );
  }, []);

  // Render canvas whenever configuration changes
  useEffect(() => {
    if (!isSnippetActive) {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
      return;
    }

    let cancelled = false;
    renderSnippetCanvas({
      tableName: tableMeta.name,
      tableTitle: tableMeta.title,
      columns: orderedActiveColumns,
      groups: finalRowGroups,
      emphasizedCells,
    })
      .then((res) => {
        if (!cancelled) {
          if (urlRef.current) {
            URL.revokeObjectURL(urlRef.current);
          }
          const url = URL.createObjectURL(res.blob);
          urlRef.current = url;
          setRenderResult(res);
          setPreviewUrl(url);
        }
      })
      .catch((err) => {
        console.error('Failed to render snippet canvas:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [isSnippetActive, tableMeta, orderedActiveColumns, finalRowGroups, emphasizedCells]);

  const handleDownloadImage = useCallback(() => {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    const cleanId = tableMeta.id.toLowerCase();
    a.download = `thermo-table-${cleanId}-snippet.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [previewUrl, tableMeta.id]);

  const handleShareImage = useCallback(async () => {
    if (!renderResult) return;
    try {
      const file = new File(
        [renderResult.blob],
        `table-${tableMeta.id.toLowerCase()}-snippet.png`,
        { type: 'image/png' }
      );
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${tableMeta.name}: ${tableMeta.title}`,
        });
      } else {
        handleDownloadImage();
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        console.error('Share failed:', err);
      }
    }
  }, [renderResult, tableMeta, handleDownloadImage]);

  const handleCopyImage = useCallback(async () => {
    if (!renderResult) return;

    let success = false;

    // 1. Try modern Async Clipboard API
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard?.write &&
      typeof window.ClipboardItem !== 'undefined'
    ) {
      try {
        // Attempt with Promise.resolve(blob) — required by WebKit / Mobile Safari (iOS)
        const item = new ClipboardItem({
          'image/png': Promise.resolve(renderResult.blob),
        });
        await navigator.clipboard.write([item]);
        success = true;
      } catch (err1) {
        console.warn('ClipboardItem with Promise failed, attempting direct Blob:', err1);
        try {
          // Fallback attempt with direct blob — accepted by standard Chromium
          const item = new ClipboardItem({
            'image/png': renderResult.blob,
          });
          await navigator.clipboard.write([item]);
          success = true;
        } catch (err2) {
          console.warn('Direct ClipboardItem also failed:', err2);
        }
      }
    }

    if (success) {
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2200);
      return;
    }

    // 2. Mobile fallback: If clipboard.write is blocked or unsupported (common on mobile browsers/webviews),
    // trigger native mobile Web Share sheet which contains native "Copy", "Save", etc.
    if (canNativeShare) {
      try {
        const file = new File(
          [renderResult.blob],
          `thermo-table-${tableMeta.id.toLowerCase()}-snippet.png`,
          { type: 'image/png' }
        );
        if (!navigator.canShare || navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `${tableMeta.name}: ${tableMeta.title}`,
          });
          setCopyStatus('copied');
          setTimeout(() => setCopyStatus('idle'), 2200);
          return;
        }
      } catch (shareErr) {
        if ((shareErr as Error)?.name === 'AbortError') {
          // User dismissed the share sheet
          return;
        }
        console.warn('Native share fallback failed:', shareErr);
      }
    }

    // 3. Direct download fallback
    handleDownloadImage();
    setCopyStatus('copied');
    setTimeout(() => setCopyStatus('idle'), 2200);
  }, [renderResult, canNativeShare, tableMeta, handleDownloadImage]);

  // Keyboard shortcuts inside modal (Escape to close, Ctrl/Cmd+C to copy image)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        const selection = window.getSelection();
        if (!selection || selection.toString().length === 0) {
          e.preventDefault();
          handleCopyImage();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, handleCopyImage]);

  const toggleColumn = (colId: string) => {
    setActiveColIds((prev) => {
      const next = new Set(prev);
      if (next.has(colId)) {
        next.delete(colId);
      } else {
        next.add(colId);
      }
      return next;
    });
  };

  const toggleCellEmphasis = (rowKey: string, colId: string) => {
    const key = `${rowKey}::${colId}`;
    setEmphasizedCells((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const hasRows = rowGroups.length > 0;
  const isSuperheated =
    tableData?.type === 'superheated' || tableData?.type === 'compressed';

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 w-full sm:max-w-2xl rounded-t-2xl sm:rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[92dvh] sm:max-h-[88vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-4 py-3 bg-[#c13726] dark:bg-[#852115] text-white flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Crop className="w-4 h-4 shrink-0 text-white/90" />
            <h2 className="text-sm sm:text-base font-bold tracking-wide truncate">
              Screen Capture Snippet — {tableMeta.name}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {hasRows && (
              <button
                type="button"
                onClick={() => {
                  onClearAllSelections();
                  onClose();
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-black/20 hover:bg-black/35 text-white/90 border border-white/20 transition-colors cursor-pointer"
                title="Clear all pinned rows and columns in this table"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear Highlights</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-3 sm:p-5 overflow-y-auto flex flex-col gap-4 flex-1">
          {!hasRows ? (
            <div className="py-10 px-4 text-center flex flex-col items-center justify-center gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                <Highlighter className="w-5 h-5" />
              </div>
              <div className="max-w-md space-y-1">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  No rows highlighted yet
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Use the <Highlighter className="w-3.5 h-3.5 inline mx-0.5 text-amber-600" /> highlighter buttons on the left of any row (and optionally column headers) to pick the rows and properties you want in your snippet.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Controls: Columns & Optional Isobar Selector */}
              <div className="flex flex-col gap-2.5 bg-gray-50 dark:bg-gray-800/60 p-3 rounded-lg border border-gray-200/80 dark:border-gray-800">
                {/* Column Toggles */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Included Columns
                    </span>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveColIds(new Set(allColumns.map((c) => c.id)))
                        }
                        className="text-[#c13726] dark:text-red-400 hover:underline font-medium cursor-pointer"
                      >
                        All
                      </button>
                      <span className="text-gray-300 dark:text-gray-600">·</span>
                      <button
                        type="button"
                        onClick={() => setActiveColIds(new Set())}
                        className="text-gray-500 dark:text-gray-400 hover:underline font-medium cursor-pointer"
                      >
                        None
                      </button>
                      {selectedCols.size > 0 && (
                        <>
                          <span className="text-gray-300 dark:text-gray-600">·</span>
                          <button
                            type="button"
                            onClick={() => setActiveColIds(new Set(selectedCols))}
                            className="text-gray-600 dark:text-gray-300 hover:underline font-medium cursor-pointer"
                          >
                            Highlighted Only
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {allColumns.map((col) => {
                      const isActive = activeColIds.has(col.id);
                      return (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => toggleColumn(col.id)}
                          className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer border ${
                            isActive
                              ? 'bg-[#c13726] text-white border-[#a82e1f] shadow-2xs'
                              : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
                        >
                          {col.label}
                          {col.isIndex && (
                            <span className="ml-1 opacity-75 text-[10px] font-normal">
                              (index)
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Isobar Block Selector for Superheated / Compressed Tables */}
                {isSuperheated && tableData && (
                  <div className="flex flex-col gap-1.5 pt-2 border-t border-gray-200 dark:border-gray-700/70">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Included Isobars
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {tableData.blocks.map((b, bIdx) => {
                        if (disabledBlocks.has(bIdx) && !activeBlockIdxs.has(bIdx)) {
                          return null;
                        }
                        const isActive = activeBlockIdxs.has(bIdx);
                        return (
                          <button
                            key={bIdx}
                            type="button"
                            onClick={() => {
                              setActiveBlockIdxs((prev) => {
                                const next = new Set(prev);
                                if (next.has(bIdx)) {
                                  if (next.size <= 1) return prev;
                                  next.delete(bIdx);
                                } else {
                                  next.add(bIdx);
                                }
                                return next;
                              });
                            }}
                            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer border ${
                              isActive
                                ? 'bg-amber-600 text-white border-amber-700'
                                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}
                          >
                            P = {formatIsobarPress(b.P)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Included Rows Selector */}
                <div className="flex flex-col gap-1.5 pt-2 border-t border-gray-200 dark:border-gray-700/70">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Included Rows
                      </span>
                      <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
                        ({enabledRowCount} of {totalCandidateRowCount})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={enableAllRows}
                        className="text-[#c13726] dark:text-red-400 hover:underline font-medium cursor-pointer"
                      >
                        All
                      </button>
                      <span className="text-gray-300 dark:text-gray-600">·</span>
                      <button
                        type="button"
                        onClick={disableAllRows}
                        className="text-gray-500 dark:text-gray-400 hover:underline font-medium cursor-pointer"
                      >
                        None
                      </button>
                    </div>
                  </div>

                  {rowGroups.length === 1 && !rowGroups[0].blockTitle ? (
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-0.5">
                      {rowGroups[0].rows.map((row) => {
                        const isEnabled = !disabledRowKeys.has(row.rowKey);
                        const label = getRowBadgeLabel(row, tableData, tempUnit, pressUnit);
                        return (
                          <label
                            key={row.rowKey}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer border select-none transition-colors ${
                              isEnabled
                                ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 shadow-2xs'
                                : 'bg-gray-100/70 dark:bg-gray-900/60 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-800 opacity-60'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isEnabled}
                              onChange={() => toggleRowEnabled(row.rowKey)}
                              className="rounded text-[#c13726] focus:ring-[#c13726] h-3.5 w-3.5 accent-[#c13726] cursor-pointer"
                            />
                            <span className={isEnabled ? '' : 'line-through'}>{label}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-0.5">
                      {rowGroups.map((group, gIdx) => {
                        return (
                          <div
                            key={gIdx}
                            className="flex flex-col gap-1.5 p-2 bg-white/70 dark:bg-gray-900/50 rounded-md border border-gray-200/60 dark:border-gray-800/60"
                          >
                            {group.blockTitle && (
                              <div className="flex items-center justify-between text-xs font-semibold text-amber-800 dark:text-amber-300">
                                <span className="truncate">{group.blockTitle}</span>
                                <div className="flex items-center gap-1 text-[10px] text-gray-500 font-normal">
                                  <button
                                    type="button"
                                    onClick={() => enableGroupRows(group)}
                                    className="hover:text-amber-700 dark:hover:text-amber-200 underline cursor-pointer"
                                  >
                                    All
                                  </button>
                                  <span>·</span>
                                  <button
                                    type="button"
                                    onClick={() => disableGroupRows(group)}
                                    className="hover:text-amber-700 dark:hover:text-amber-200 underline cursor-pointer"
                                  >
                                    None
                                  </button>
                                </div>
                              </div>
                            )}
                            <div className="flex flex-wrap gap-1.5">
                              {group.rows.map((row) => {
                                const isEnabled = !disabledRowKeys.has(row.rowKey);
                                const label = getRowBadgeLabel(row, tableData, tempUnit, pressUnit);
                                return (
                                  <label
                                    key={row.rowKey}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer border select-none transition-colors ${
                                      isEnabled
                                        ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 shadow-2xs'
                                        : 'bg-gray-100/70 dark:bg-gray-900/60 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-800 opacity-60'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isEnabled}
                                      onChange={() => toggleRowEnabled(row.rowKey)}
                                      className="rounded text-[#c13726] focus:ring-[#c13726] h-3.5 w-3.5 accent-[#c13726] cursor-pointer"
                                    />
                                    <span className={isEnabled ? '' : 'line-through'}>{label}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Interpolation Spaces (Blank Rows for handwriting) */}
              <div className="flex flex-col gap-2.5 bg-gray-50 dark:bg-gray-800/60 p-3 rounded-lg border border-gray-200/80 dark:border-gray-800">
                <div className="flex items-center justify-between gap-2">
                  <div
                    className="flex items-center gap-2 cursor-pointer select-none"
                    onClick={() => setIsInterpolationOpen((prev) => !prev)}
                  >
                    <PenLine className="w-4 h-4 text-[#c13726] dark:text-red-400" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                      Interpolation Spaces
                    </span>
                    {activeSpaceCount > 0 ? (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#c13726] text-white">
                        {activeSpaceCount} active
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-400 dark:text-gray-500 hidden sm:inline">
                        (Blank rows for handwriting)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {canAddBetweenAll && (
                      <button
                        type="button"
                        onClick={handleAddBetweenAll}
                        className="inline-flex items-center gap-1 text-[11px] text-[#c13726] dark:text-red-400 hover:underline font-semibold cursor-pointer"
                        title="Add 1-row blank space between each adjacent row"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Space Between All</span>
                      </button>
                    )}
                    {activeSpaceCount > 0 && (
                      <>
                        {canAddBetweenAll && (
                          <span className="text-gray-300 dark:text-gray-600">·</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setEmptySpaces({})}
                          className="text-[11px] text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:underline font-medium cursor-pointer"
                        >
                          Clear Spaces
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsInterpolationOpen((prev) => !prev)}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors cursor-pointer"
                      title={isInterpolationOpen ? 'Collapse' : 'Expand'}
                    >
                      {isInterpolationOpen ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {isInterpolationOpen && (
                  <div className="flex flex-col gap-2 pt-1 border-t border-gray-200 dark:border-gray-700/70">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Add empty vertical space between or before/after rows to draw in interpolated values:
                    </p>

                    <div className="max-h-60 overflow-y-auto flex flex-col gap-2 p-2 bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-800">
                      {enabledRowGroups.length === 0 ? (
                        <div className="py-6 px-4 text-center text-xs text-gray-500 dark:text-gray-400">
                          All rows are currently disabled. Check at least one row under &quot;Included Rows&quot; above to configure interpolation spaces.
                        </div>
                      ) : (
                        enabledRowGroups.map((group, gIdx) => {
                          const rawRows = group.rows;
                          if (rawRows.length === 0) return null;

                          const beforeKey = `before::${rawRows[0].rowKey}`;
                          const isBeforeActive = Boolean(emptySpaces[beforeKey]);
                          const beforeHeight = emptySpaces[beforeKey]?.heightInRows ?? 1;

                          const afterKey = `after::${rawRows[rawRows.length - 1].rowKey}`;
                          const isAfterActive = Boolean(emptySpaces[afterKey]);
                          const afterHeight = emptySpaces[afterKey]?.heightInRows ?? 1;

                          return (
                            <div key={gIdx} className="flex flex-col gap-1.5">
                              {group.blockTitle && (
                                <div className="px-2 py-1 text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 rounded border border-amber-200/60 dark:border-amber-800/60">
                                  {group.blockTitle}
                                </div>
                              )}

                              {/* Slot Before First Row */}
                              {isBeforeActive ? (
                                <ActiveSpaceItem
                                  label="Blank Space (Top / Before first row)"
                                  height={beforeHeight}
                                  onAdjust={(delta) => adjustHeight(beforeKey, delta)}
                                  onRemove={() => removeSpace(beforeKey)}
                                />
                              ) : (
                                <div className="flex justify-center py-0.5">
                                  <button
                                    type="button"
                                    onClick={() => addSpace(beforeKey)}
                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-medium text-gray-500 hover:text-amber-700 dark:text-gray-400 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-dashed border-gray-300 dark:border-gray-700 hover:border-amber-400 transition-colors cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3 text-amber-600" />
                                    <span>Space Before First Row</span>
                                  </button>
                                </div>
                              )}

                              {/* Rows and Between Slots */}
                              {rawRows.map((row, rIdx) => {
                                const betweenKey =
                                  rIdx < rawRows.length - 1
                                    ? `between::${row.rowKey}::${rawRows[rIdx + 1].rowKey}`
                                    : '';
                                const isBetweenActive = betweenKey ? Boolean(emptySpaces[betweenKey]) : false;
                                const betweenHeight = betweenKey ? (emptySpaces[betweenKey]?.heightInRows ?? 1) : 1;
                                const rowLabel = getRowShortLabel(row, orderedActiveColumns);

                                return (
                                  <div key={row.rowKey} className="flex flex-col gap-1.5">
                                    {/* Row Item Display */}
                                    <div className="flex items-center justify-between px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800/80 rounded border border-gray-200/70 dark:border-gray-700/60 text-xs font-medium text-gray-800 dark:text-gray-200">
                                      <span className="truncate">{rowLabel}</span>
                                      <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono ml-2 shrink-0">
                                        Row {rIdx + 1}
                                      </span>
                                    </div>

                                    {/* Between Slot (if not last row) */}
                                    {rIdx < rawRows.length - 1 && (
                                      isBetweenActive ? (
                                        <ActiveSpaceItem
                                          label="Blank Space (Interpolation Gap)"
                                          height={betweenHeight}
                                          onAdjust={(delta) => adjustHeight(betweenKey, delta)}
                                          onRemove={() => removeSpace(betweenKey)}
                                        />
                                      ) : (
                                        <div className="relative py-1 flex items-center justify-center group">
                                          <div className="absolute inset-x-0 h-px border-t border-dashed border-gray-200 dark:border-gray-700 group-hover:border-amber-400 transition-colors" />
                                          <button
                                            type="button"
                                            onClick={() => addSpace(betweenKey)}
                                            className="relative z-10 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:border-amber-500 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/50 shadow-2xs transition-all cursor-pointer"
                                          >
                                            <Plus className="w-3 h-3 text-amber-600" />
                                            <span>Add Blank Space</span>
                                          </button>
                                        </div>
                                      )
                                    )}
                                  </div>
                                );
                              })}

                              {/* Slot After Last Row */}
                              {isAfterActive ? (
                                <ActiveSpaceItem
                                  label="Blank Space (Bottom / After last row)"
                                  height={afterHeight}
                                  onAdjust={(delta) => adjustHeight(afterKey, delta)}
                                  onRemove={() => removeSpace(afterKey)}
                                />
                              ) : (
                                <div className="flex justify-center py-0.5">
                                  <button
                                    type="button"
                                    onClick={() => addSpace(afterKey)}
                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-medium text-gray-500 hover:text-amber-700 dark:text-gray-400 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-dashed border-gray-300 dark:border-gray-700 hover:border-amber-400 transition-colors cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3 text-amber-600" />
                                    <span>Space After Last Row</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Interactive Preview Container */}
              <div className="flex flex-col gap-1.5">
                {orderedActiveColumns.length > 0 && (
                  <div className="flex items-center justify-between gap-2 px-0.5">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                      Tap any value on the snippet to circle/emphasize it:
                    </span>
                    {emphasizedCells.size > 0 && (
                      <button
                        type="button"
                        onClick={() => setEmphasizedCells(new Set())}
                        className="text-xs text-[#c13726] dark:text-red-400 hover:underline font-medium cursor-pointer"
                      >
                        Clear circles ({emphasizedCells.size})
                      </button>
                    )}
                  </div>
                )}

                {/* Checkerboard / Neutral frame holding the light-mode PNG */}
                <div className="bg-gray-200/70 dark:bg-gray-950 border border-gray-300 dark:border-gray-800 rounded-lg p-2 sm:p-3 overflow-x-auto flex items-center justify-center min-h-[140px]">
                  {orderedActiveColumns.length === 0 ? (
                    <div className="py-10 px-4 text-center flex flex-col items-center justify-center gap-1.5">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                        No columns selected
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm">
                        Select one or more columns above (or click &quot;All&quot;) to generate your snippet.
                      </p>
                    </div>
                  ) : enabledRowCount === 0 ? (
                    <div className="py-10 px-4 text-center flex flex-col items-center justify-center gap-1.5">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                        All highlighted rows are disabled
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm">
                        Check at least one row under &quot;Included Rows&quot; above (or click &quot;All&quot;) to include it in your snippet.
                      </p>
                    </div>
                  ) : isSnippetActive && renderResult && previewUrl ? (
                    <div
                      className="relative inline-block shadow-md rounded-xs overflow-hidden select-none shrink-0"
                      style={{
                        width: renderResult.width,
                        maxWidth: '100%',
                      }}
                    >
                      {previewUrl && (
                        <img
                          src={previewUrl}
                          alt={`${tableMeta.name} snippet`}
                          className="block w-full h-auto"
                        />
                      )}
                      {/* Transparent interactive hitboxes mapped over each value cell */}
                      {renderResult.hitboxes.map((hb) => {
                        const key = `${hb.rowKey}::${hb.colId}`;
                        const isEmp = emphasizedCells.has(key);
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => toggleCellEmphasis(hb.rowKey, hb.colId)}
                            style={{
                              position: 'absolute',
                              left: `${hb.nx * 100}%`,
                              top: `${hb.ny * 100}%`,
                              width: `${hb.nw * 100}%`,
                              height: `${hb.nh * 100}%`,
                            }}
                            className="cursor-pointer rounded-xs hover:bg-red-500/10 active:bg-red-500/20 transition-colors focus:outline-none"
                            title={
                              isEmp
                                ? 'Remove emphasis circle'
                                : 'Circle this value in snippet'
                            }
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-10 text-xs text-gray-500">
                      Rendering snippet...
                    </div>
                  )}
                </div>

                {orderedActiveColumns.length > 0 && (
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center sm:hidden">
                    Tip: You can also press and hold the image directly to Copy or Save to Photos.
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer Actions */}
        {hasRows && (
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownloadImage}
              disabled={!isSnippetActive || !renderResult || !previewUrl}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs sm:text-sm font-semibold bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </button>

            {canNativeShare && (
              <button
                type="button"
                onClick={handleShareImage}
                disabled={!isSnippetActive || !renderResult || !previewUrl}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs sm:text-sm font-semibold bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyImage}
              disabled={!isSnippetActive || !renderResult}
              className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md text-xs sm:text-sm font-semibold text-white shadow-xs transition-colors cursor-pointer flex-1 sm:flex-initial disabled:opacity-50 ${
                copyStatus === 'copied'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : copyStatus === 'error'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-[#c13726] hover:bg-[#a82e1f]'
              }`}
            >
              {copyStatus === 'copied' ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : copyStatus === 'error' ? (
                <span>Use Share or Long-Press Image</span>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Image</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export function SnippetModal(props: SnippetModalProps) {
  if (!props.isOpen) return null;
  return <SnippetModalDialog {...props} />;
}
