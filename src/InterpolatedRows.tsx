import { useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Crop,
  FunctionSquare,
  Highlighter,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type {
  PressUnit,
  SolvedInterpolatedRow,
  TempUnit,
} from './interpolation';
import { findBoundingRowGap } from './interpolation';
import { formatPressure } from './data/pressureUnits';
import type { ThermoTableData } from './data/types';

export interface VisibleTableCol {
  id: string;
  label: string;
  align?: 'left' | 'right';
  isCategoryEnd?: boolean;
}

interface InterpolatedRowGroupProps {
  solved: SolvedInterpolatedRow;
  visibleCols: VisibleTableCol[];
  hasTrailingSpacer: boolean;
  isPinned: boolean;
  isHighlighted: boolean;
  compactCard?: boolean;
  selectedCols: Set<string>;
  hoveredCol: string | null;
  rowRef?: (el: HTMLTableRowElement | null) => void;
  onMouseEnterCol: (colId: string) => void;
  onMouseLeaveCol: () => void;
  onUpdateInput: (id: string, value: string) => void;
  onSelectDominatingCol: (id: string, colId: string, prefill?: string) => void;
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleMoreDigits: (id: string) => void;
  onToggleAnalytic: (id: string) => void;
  onSetEditing: (id: string, editing: boolean) => void;
  onRelocate?: (id: string) => void;
}

export function InterpolatedRowGroup({
  solved,
  visibleCols,
  hasTrailingSpacer,
  isPinned,
  isHighlighted,
  compactCard = false,
  selectedCols,
  hoveredCol,
  rowRef,
  onMouseEnterCol,
  onMouseLeaveCol,
  onUpdateInput,
  onSelectDominatingCol,
  onTogglePin,
  onDelete,
  onToggleMoreDigits,
  onToggleAnalytic,
  onSetEditing,
  onRelocate,
}: InterpolatedRowGroupProps) {
  const { spec } = solved;
  const isEditing = Boolean(spec.isEditing);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (key: string, text: string) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const knownCol = visibleCols.find((c) => c.id === spec.dominatingColId);
  const weightText =
    solved.isValidInput && solved.weight !== undefined
      ? solved.weight.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')
      : null;

  return (
    <>
      <tr
        data-row-key={spec.id}
        ref={rowRef}
        className={`${
          isEditing
            ? 'bg-emerald-50 dark:bg-[#102c21]'
            : 'bg-emerald-50/70 dark:bg-[#0d241b]'
        } transition-colors`}
      >
        <td
          data-pin-cell="true"
          className={`px-1 py-1.5 border-t border-b border-dashed [border-left-style:solid] border-emerald-400/80 dark:border-emerald-700/70 border-l-4 border-l-emerald-500 sticky left-0 z-10 ${
            isEditing
              ? 'bg-emerald-50 dark:bg-[#102c21]'
              : 'bg-emerald-50/95 dark:bg-[#0d241b]'
          } ${isHighlighted ? 'ring-1 ring-indigo-400' : ''}`}
        >
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(spec.id);
              }}
              className={`p-1 rounded cursor-pointer transition-colors ${
                isPinned
                  ? 'text-amber-700 bg-amber-200/90 dark:text-amber-300 dark:bg-amber-500/30 shadow-sm'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
              }`}
              title={isPinned ? 'Exclude interpolated row from snippet' : 'Include interpolated row in snippet'}
            >
              <Highlighter className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>

        {visibleCols.map((col) => {
          const isKnown = col.id === spec.dominatingColId;
          const solvedCell = solved.cells[col.id];
          const isColSel = selectedCols.has(col.id);
          const isColHov = hoveredCol === col.id;
          const valueText =
            solved.isValidInput && solvedCell
              ? spec.showMoreDigits
                ? solvedCell.fullPrecision
                : solvedCell.display
              : '—';
          const lockedKnownText =
            solved.isValidInput && solvedCell
              ? spec.showMoreDigits
                ? spec.inputValue.trim() || solvedCell.fullPrecision
                : solvedCell.display
              : spec.inputValue.trim() || '—';

          return (
            <td
              key={col.id}
              data-col-id={col.id}
              onMouseEnter={() => onMouseEnterCol(col.id)}
              onMouseLeave={onMouseLeaveCol}
              onClick={
                isEditing && !isKnown
                  ? () => {
                      const prefill =
                        solved.isValidInput && solvedCell
                          ? solvedCell.fullPrecision.replace(/,/g, '')
                          : undefined;
                      onSelectDominatingCol(spec.id, col.id, prefill);
                    }
                  : undefined
              }
              className={`px-1.5 py-1 text-xs font-mono tabular-nums whitespace-nowrap border-t border-b border-dashed [border-right-style:solid] border-emerald-400/80 dark:border-emerald-700/70 transition-colors ${
                col.align === 'left' ? 'text-left' : 'text-right'
              } ${
                col.isCategoryEnd
                  ? 'border-r-2 border-r-emerald-300/80 dark:border-r-emerald-700/70'
                  : 'border-r border-r-emerald-200/50 dark:border-r-emerald-800/40'
              } ${
                isKnown
                  ? 'bg-emerald-100/90 dark:bg-emerald-900/45'
                  : isColSel
                    ? `bg-red-100/70 dark:bg-[#3b1d2b]/70 ${isEditing ? 'cursor-pointer' : ''}`
                    : isColHov
                      ? `bg-emerald-100/60 dark:bg-emerald-900/30 ${isEditing ? 'cursor-pointer' : ''}`
                      : isEditing
                        ? 'cursor-pointer hover:bg-emerald-100/60 dark:hover:bg-emerald-900/25'
                        : ''
              }`}
              title={
                isEditing
                  ? isKnown
                    ? 'Known parameter — enter as many decimals as needed'
                    : 'Click to use this property as the known parameter'
                  : isKnown
                    ? `Known parameter (${spec.inputValue.trim() || 'empty'}) — click Edit below to modify`
                    : 'Interpolated value — click Edit below to modify'
              }
            >
              {isKnown && isEditing ? (
                <div className="flex items-center justify-end gap-1">
                  <span className="text-[9px] font-sans font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-emerald-600 text-white shrink-0">
                    Known
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={spec.inputValue}
                    onChange={(e) => onUpdateInput(spec.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && solved.isValidInput) {
                        onSetEditing(spec.id, false);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={(e) => e.target.select()}
                    placeholder="Value..."
                    aria-label={`Known value for ${col.label}`}
                    className="w-20 sm:w-24 px-1.5 py-0.5 text-right text-xs font-semibold font-mono tabular-nums bg-white dark:bg-gray-900 text-gray-900 dark:text-white border-2 border-emerald-500 rounded focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
              ) : isKnown ? (
                <div className="flex items-center justify-end gap-1">
                  <span className="text-[9px] font-sans font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-emerald-600/15 dark:bg-emerald-500/25 text-emerald-800 dark:text-emerald-200 border border-emerald-400/60 dark:border-emerald-500/40 shrink-0">
                    Known
                  </span>
                  <span className="font-bold text-emerald-950 dark:text-emerald-100">
                    {lockedKnownText}
                  </span>
                </div>
              ) : (
                <span
                  className={
                    solved.isValidInput && solvedCell
                      ? 'italic font-semibold text-emerald-950 dark:text-emerald-200'
                      : 'text-emerald-700/50 dark:text-emerald-400/50'
                  }
                >
                  {valueText}
                </span>
              )}
            </td>
          );
        })}

        {hasTrailingSpacer && (
          <td className="bg-emerald-50/40 dark:bg-[#0d241b] border-t border-b border-dashed border-emerald-400/80 dark:border-emerald-700/70 p-0" />
        )}
      </tr>

      {/* Companion Info / Precision / Analytic Formula Bar */}
      <tr className="bg-emerald-50/55 dark:bg-[#0a1c15]">
        <td className="sticky left-0 z-10 bg-emerald-50/90 dark:bg-[#0a1c15] border-b border-dashed [border-left-style:solid] border-emerald-400/80 dark:border-emerald-700/70 border-l-4 border-l-emerald-500" />
        <td
          colSpan={visibleCols.length + (hasTrailingSpacer ? 1 : 0)}
          className="border-b border-dashed border-emerald-400/80 dark:border-emerald-700/70 p-0"
        >
          <div
            className={`sticky left-14 w-fit ${
              compactCard
                ? 'max-w-[min(calc(100vw-4.5rem),22rem)]'
                : 'max-w-[min(calc(100vw-3.75rem),60rem)]'
            } px-2 py-1 flex flex-col gap-1.5 text-[11px]`}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              {isEditing ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 dark:bg-amber-500/25 text-amber-900 dark:text-amber-200 font-bold uppercase tracking-wider text-[10px]">
                  <Pencil className="w-2.5 h-2.5" />
                  Editing
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-600/15 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold uppercase tracking-wider text-[10px]">
                  <Sparkles className="w-2.5 h-2.5" />
                  Interp
                </span>
              )}

              <span className="text-emerald-900 dark:text-emerald-200 font-medium">
                {solved.isValidInput && weightText ? (
                  <>
                    Known: <strong>{knownCol?.label ?? spec.dominatingColId}</strong> · w ={' '}
                    <span className="font-mono">{weightText}</span>
                    {!compactCard && !isEditing && (
                      <span className="text-emerald-700/80 dark:text-emerald-300/70 ml-1">
                        ({solved.x1Str} ↔ {solved.x2Str})
                      </span>
                    )}
                    {!compactCard && isEditing && (
                      <span className="text-emerald-700/80 dark:text-emerald-300/70 ml-1">
                        (click any cell to change known parameter)
                      </span>
                    )}
                  </>
                ) : isEditing ? (
                  <>
                    Enter decimals in <strong>{knownCol?.label ?? spec.dominatingColId}</strong> or tap any cell to switch known parameter
                  </>
                ) : (
                  <>No value entered — click Edit to enter a known value</>
                )}
              </span>

              {solved.isExtrapolated && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-medium text-[10px]">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  Outside immediate row bounds
                  {onRelocate && (
                    <button
                      type="button"
                      onClick={() => onRelocate(spec.id)}
                      className="ml-1 underline font-bold hover:text-amber-950 dark:hover:text-white cursor-pointer"
                    >
                      Auto-relocate
                    </button>
                  )}
                </span>
              )}

              <div className="flex items-center gap-1 ml-auto">
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onSetEditing(spec.id, false)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 text-[10px] font-semibold transition-colors cursor-pointer shadow-xs"
                      title="Lock row values and exit edit mode"
                    >
                      <Check className="w-3 h-3" />
                      Finish editing
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(spec.id)}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white dark:bg-gray-900 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800/80 hover:bg-red-50 dark:hover:bg-red-950/60 text-[10px] font-semibold transition-colors cursor-pointer"
                      title="Remove interpolated row"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remove
                    </button>
                  </>
                ) : (
                  <>
                    {solved.isValidInput && (
                      <>
                        <button
                          type="button"
                          onClick={() => onToggleMoreDigits(spec.id)}
                          className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold transition-colors cursor-pointer ${
                            spec.showMoreDigits
                              ? 'bg-emerald-600 text-white border-emerald-700'
                              : 'bg-white dark:bg-gray-900 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                          }`}
                          title="Show extra unrounded digits for intermediate calculations"
                        >
                          {spec.showMoreDigits ? 'Col precision' : 'More digits'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleAnalytic(spec.id)}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold transition-colors cursor-pointer ${
                            spec.showAnalytic
                              ? 'bg-emerald-600 text-white border-emerald-700'
                              : 'bg-white dark:bg-gray-900 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                          }`}
                          title="Show step-by-step linear interpolation equation"
                        >
                          <FunctionSquare className="w-3 h-3" />
                          Analytic
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => onSetEditing(spec.id, true)}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-[10px] font-semibold transition-colors cursor-pointer"
                      title="Edit known parameter, value, or remove this row"
                    >
                      <Pencil className="w-2.5 h-2.5" />
                      Edit
                    </button>
                  </>
                )}
              </div>
            </div>

            {spec.showAnalytic && solved.isValidInput && (
              <div className="bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-800/70 rounded p-2 text-xs space-y-1.5 shadow-sm">
                <div className="font-mono text-[11px] text-emerald-800 dark:text-emerald-300 border-b border-gray-100 dark:border-gray-800 pb-1 break-words whitespace-normal">
                  y = y₁ + ((x − x₁) / (x₂ − x₁)) × (y₂ − y₁) &nbsp;|&nbsp; w = ({spec.inputValue.trim()} −{' '}
                  {solved.x1Str}) / ({solved.x2Str} − {solved.x1Str}) = {weightText}
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {visibleCols.map((col) => {
                    const cell = solved.cells[col.id];
                    if (!cell) return null;
                    return (
                      <div
                        key={col.id}
                        className="flex items-start justify-between gap-2 font-mono text-[11px] leading-snug text-gray-800 dark:text-gray-200"
                      >
                        <div className="break-all whitespace-normal">
                          <span className="font-sans font-bold text-emerald-700 dark:text-emerald-400 mr-1.5">
                            {col.label}:
                          </span>
                          <span>{cell.analyticSubstituted}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(col.id, cell.fullPrecision.replace(/,/g, ''))}
                          className="shrink-0 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-pointer"
                          title={`Copy full precision (${cell.fullPrecision})`}
                        >
                          {copiedKey === col.id ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </td>
      </tr>
    </>
  );
}

interface ActionMenuModalProps {
  isOpen: boolean;
  mode: 'mobile' | 'interpolate';
  onClose: () => void;
  tableData: ThermoTableData | null | undefined;
  tempUnit: TempUnit;
  pressUnit: PressUnit;
  jumpValue: string;
  onChangeJumpValue: (v: string) => void;
  jumpProperty: string;
  onChangeJumpProperty: (p: string) => void;
  jumpSuperheatedUnit: PressUnit;
  onChangeJumpSuperheatedUnit: (u: PressUnit) => void;
  jumpOptions: { id: string; label: string }[];
  onJump: () => void;
  isProgressive: boolean;
  progressiveCols: { id: string; label: string; unit: string }[];
  onAddInterpolatedRow: (params: {
    blockIndex?: number;
    afterIndex: number;
    dominatingColId: string;
    inputValue: string;
    startEditing?: boolean;
  }) => void;
  activeSnippetRowCount: number;
  onOpenSnippet: () => void;
}

export function ActionMenuModal({
  isOpen,
  mode,
  onClose,
  tableData,
  tempUnit,
  pressUnit,
  jumpValue,
  onChangeJumpValue,
  jumpProperty,
  onChangeJumpProperty,
  jumpSuperheatedUnit,
  onChangeJumpSuperheatedUnit,
  jumpOptions,
  onJump,
  isProgressive,
  progressiveCols,
  onAddInterpolatedRow,
  activeSnippetRowCount,
  onOpenSnippet,
}: ActionMenuModalProps) {
  const isIsobar = tableData?.type === 'superheated' || tableData?.type === 'compressed';
  const blocks = isIsobar ? tableData.blocks : [];
  const defaultCol =
    tableData?.type === 'saturated' ? tableData.indexProperty : 'T';

  const [selectedBlock, setSelectedBlock] = useState<number>(0);
  const [selectedCol, setSelectedCol] = useState<string>(defaultCol);
  const [interpValue, setInterpValue] = useState<string>('');

  if (!isOpen || !tableData) return null;

  const activeCol = progressiveCols.some((c) => c.id === selectedCol)
    ? selectedCol
    : defaultCol;
  const activeBlock = isIsobar ? Math.min(selectedBlock, Math.max(0, blocks.length - 1)) : undefined;
  const rowsInBlock = isIsobar
    ? blocks[activeBlock ?? 0]?.rows ?? []
    : 'rows' in tableData
      ? tableData.rows
      : [];

  const parsedNum = Number(interpValue.trim().replace(/,/g, '').replace(/−/g, '-'));
  const hasValidNum = interpValue.trim() !== '' && Number.isFinite(parsedNum);

  const handleInsert = () => {
    if (!hasValidNum) return;
    const targetGap = findBoundingRowGap(
      tableData,
      activeCol,
      parsedNum,
      tempUnit,
      pressUnit,
      activeBlock
    );

    onAddInterpolatedRow({
      blockIndex: activeBlock,
      afterIndex: Math.max(0, targetGap),
      dominatingColId: activeCol,
      inputValue: interpValue.trim(),
      startEditing: false,
    });
    setInterpValue('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-t-2xl sm:rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden max-h-[88dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 bg-[#c13726] dark:bg-[#852115] text-white flex items-center justify-between">
          <span className="font-bold text-sm tracking-wide uppercase">
            {mode === 'mobile' ? 'Table Actions' : 'Add Interpolated Row'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-white/20 cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          {mode === 'mobile' && (
            <div className="space-y-2 pb-3 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <Search className="w-3.5 h-3.5" />
                Jump to Row / Value
              </div>
              <div className="flex flex-wrap gap-2">
                {isIsobar ? (
                  <>
                    <input
                      type="number"
                      step="any"
                      value={jumpValue}
                      onChange={(e) => onChangeJumpValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onJump();
                          onClose();
                        }
                      }}
                      placeholder="Pressure"
                      className="flex-1 min-w-[100px] px-2.5 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                    />
                    <select
                      value={jumpSuperheatedUnit}
                      onChange={(e) => onChangeJumpSuperheatedUnit(e.target.value as PressUnit)}
                      className="px-2.5 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                    >
                      <option value="MPa">MPa</option>
                      <option value="kPa">kPa</option>
                      <option value="bar">bar</option>
                    </select>
                  </>
                ) : (
                  <>
                    <input
                      type={jumpProperty === 'substance' ? 'text' : 'number'}
                      step={jumpProperty === 'substance' ? undefined : 'any'}
                      value={jumpValue}
                      onChange={(e) => onChangeJumpValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onJump();
                          onClose();
                        }
                      }}
                      placeholder={jumpProperty === 'substance' ? 'Name' : 'Value'}
                      className="flex-1 min-w-[100px] px-2.5 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                    />
                    <select
                      value={jumpProperty}
                      onChange={(e) => onChangeJumpProperty(e.target.value)}
                      className="max-w-[150px] px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                    >
                      {'rows' in tableData &&
                        tableData.rows.length > 0 &&
                        'substance' in tableData.rows[0] && (
                          <option value="substance">Name</option>
                        )}
                      {jumpOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onJump();
                    onClose();
                  }}
                  className="px-3 py-1.5 text-sm font-semibold rounded bg-[#c13726] hover:bg-[#a82e1f] text-white cursor-pointer"
                >
                  Jump
                </button>
              </div>
            </div>
          )}

          {isProgressive && rowsInBlock.length >= 2 && (
            <div className="space-y-2.5 pb-3 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                <Plus className="w-3.5 h-3.5" />
                Interpolation Solver
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Enter a known parameter and value (with as many decimals as possible) to place and solve a row between its surrounding table rows. You can also use the <strong>+</strong> icon next to any row in the table.
              </p>

              {isIsobar && (
                <div>
                  <label className="block text-xs font-semibold mb-1">Isobar Block</label>
                  <select
                    value={activeBlock ?? 0}
                    onChange={(e) => setSelectedBlock(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                  >
                    {blocks.map((b, idx) => (
                      <option key={idx} value={idx}>
                        P = {formatPressure(b.P, 'MPa', pressUnit)} {pressUnit}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold mb-1">Known Parameter</label>
                  <select
                    value={activeCol}
                    onChange={(e) => setSelectedCol(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                  >
                    {progressiveCols.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label} {c.unit ? `(${c.unit})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Known Value</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={interpValue}
                    onChange={(e) => setInterpValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && hasValidNum && handleInsert()}
                    placeholder="Enter decimals..."
                    className="w-full px-2.5 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 font-mono"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleInsert}
                disabled={!hasValidNum}
                className="w-full py-2 rounded-md text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/40 disabled:cursor-not-allowed text-white cursor-pointer transition-colors"
              >
                Insert &amp; Solve Row
              </button>
            </div>
          )}

          {mode === 'mobile' && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSnippet();
              }}
              className="w-full py-2.5 px-3 rounded-md text-sm font-semibold bg-amber-400 hover:bg-amber-300 text-gray-950 flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
            >
              <Crop className="w-4 h-4" />
              Capture Snippet
              {activeSnippetRowCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-xs font-bold bg-black/80 text-amber-300">
                  {activeSnippetRowCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
