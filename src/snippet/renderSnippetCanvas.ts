export interface SnippetColumnDef {
  id: string;
  /** Base symbol rendered in italic serif (e.g. "T", "P", "v", "u", "h", "s") */
  symbol: string;
  /** Optional subscript rendered smaller below baseline (e.g. "f", "fg", "g", "sat", "i", "ig") */
  subscript?: string;
  /** Optional superscript rendered smaller above baseline (e.g. "°", "+") */
  superscript?: string;
  /** Whether to draw a molar overbar above the base symbol (for h_bar, u_bar, s_bar_deg) */
  overbar?: boolean;
  /** Unit string rendered next to the symbol (e.g. "K", "°C", "kJ/kg", "kJ/kg · K", "m³/kg") */
  unit: string;
  /** Human-readable label for UI chips */
  label: string;
  /** Whether this column is an index column (T or P) */
  isIndex?: boolean;
}

export interface SnippetRowGroup {
  /** Optional subheader for superheated/compressed isobar blocks, e.g. "P = 0.10 MPa (Tsat = 99.61 °C)" */
  blockTitle?: string;
  rows: {
    rowKey: string;
    cells: Record<string, string>;
  }[];
}

export interface SnippetRenderConfig {
  /** e.g. "Table A-17" -> rendered as "TABLE A–17" */
  tableName: string;
  /** e.g. "Ideal-gas properties of air" */
  tableTitle: string;
  /** Columns to render in order */
  columns: SnippetColumnDef[];
  /** One or more groups of rows (single group for saturated/ideal gas, 1+ isobar groups for superheated/compressed) */
  groups: SnippetRowGroup[];
  /** Set of "${rowKey}::${colId}" strings that should be circled/emphasized in the rendered image */
  emphasizedCells: Set<string>;
}

export interface SnippetCellHitbox {
  rowKey: string;
  colId: string;
  /** Coordinates in normalized [0..1] fractions of canvas width/height for responsive click/tap mapping */
  nx: number;
  ny: number;
  nw: number;
  nh: number;
}

export interface SnippetRenderResult {
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
  hitboxes: SnippetCellHitbox[];
}

// Hardcoded light textbook palette — strictly immune to dark mode
const PALETTE = {
  bg: '#ffffff',
  badgeBg: '#d31126',
  badgeText: '#ffffff',
  bannerBg: '#fdf2f2',
  bannerText: '#c81922',
  rule: '#d31126',
  headerText: '#111111',
  cellText: '#141414',
  satLabelText: '#b8141e',
  blockHeaderBg: '#faf0f0',
  blockHeaderText: '#a8131b',
  emphasisFill: '#fff0f0',
  emphasisStroke: '#d31126',
  emphasisText: '#9e0b14',
};

const SERIF_FONT = 'Georgia, "Times New Roman", Times, serif';
const SANS_FONT = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';

/**
 * Measures the width of a column header (italic symbol + sub/sup + space + unit)
 */
function measureHeaderCell(
  ctx: CanvasRenderingContext2D,
  col: SnippetColumnDef
): { totalWidth: number; symbolWidth: number; scriptWidth: number; spaceWidth: number; unitWidth: number } {
  ctx.font = `italic 17px ${SERIF_FONT}`;
  const symbolWidth = ctx.measureText(col.symbol).width;

  let scriptWidth = 0;
  if (col.subscript) {
    ctx.font = `italic 12px ${SERIF_FONT}`;
    scriptWidth = Math.max(scriptWidth, ctx.measureText(col.subscript).width + 1);
  }
  if (col.superscript) {
    ctx.font = `14px ${SERIF_FONT}`;
    scriptWidth = Math.max(scriptWidth, ctx.measureText(col.superscript).width + 1);
  }

  ctx.font = `400 16px ${SANS_FONT}`;
  const spaceWidth = col.unit ? 6 : 0;
  const unitWidth = col.unit ? ctx.measureText(col.unit).width : 0;

  return {
    totalWidth: symbolWidth + scriptWidth + spaceWidth + unitWidth,
    symbolWidth,
    scriptWidth,
    spaceWidth,
    unitWidth,
  };
}

/**
 * Draws a column header centered at (centerX, baselineY)
 */
function drawHeaderCell(
  ctx: CanvasRenderingContext2D,
  col: SnippetColumnDef,
  centerX: number,
  baselineY: number
) {
  const m = measureHeaderCell(ctx, col);
  let curX = centerX - m.totalWidth / 2;

  ctx.fillStyle = PALETTE.headerText;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // 1. Base symbol in italic serif
  ctx.font = `italic 17px ${SERIF_FONT}`;
  ctx.fillText(col.symbol, curX, baselineY);

  // Optional molar overbar above the symbol
  if (col.overbar) {
    const barWidth = Math.max(8, m.symbolWidth - 1);
    const barX = curX + 1;
    const barY = baselineY - 14.5;
    ctx.fillRect(barX, barY, barWidth, 1.3);
  }

  curX += m.symbolWidth;

  // 2. Subscript / Superscript
  if (col.subscript) {
    ctx.font = `italic 11.5px ${SERIF_FONT}`;
    ctx.fillText(col.subscript, curX + 0.5, baselineY + 4);
  }
  if (col.superscript) {
    ctx.font = `400 13.5px ${SERIF_FONT}`;
    ctx.fillText(col.superscript, curX + 0.5, baselineY - 5.5);
  }
  curX += m.scriptWidth + m.spaceWidth;

  // 3. Unit
  if (col.unit) {
    ctx.font = `400 15.5px ${SANS_FONT}`;
    ctx.fillText(col.unit, curX, baselineY);
  }
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export async function renderSnippetCanvas(
  config: SnippetRenderConfig
): Promise<SnippetRenderResult> {
  const scale = 3; // Crisp 3x Retina output
  const measureCanvas = document.createElement('canvas');
  const mCtx = measureCanvas.getContext('2d')!;

  // Format table badge text with textbook en-dash: "TABLE A–17"
  const formattedBadge = config.tableName.toUpperCase().replace('-', '–');
  const formattedTitle = config.tableTitle;

  // Measure banner requirements
  mCtx.font = `700 16.5px ${SANS_FONT}`;
  const badgeTextW = mCtx.measureText(formattedBadge).width;
  const badgeBoxW = Math.ceil(badgeTextW + 24);

  mCtx.font = `400 17.5px ${SERIF_FONT}`;
  const titleTextW = mCtx.measureText(formattedTitle).width;
  const minBannerWidth = badgeBoxW + 18 + Math.ceil(titleTextW) + 24;

  // Measure each column width
  const colCellPaddingX = 20;
  const colWidths = config.columns.map((col) => {
    const headerM = measureHeaderCell(mCtx, col);
    let maxW = headerM.totalWidth;

    mCtx.font = `400 16px ${SANS_FONT}`;
    for (const group of config.groups) {
      for (const row of group.rows) {
        const val = row.cells[col.id] ?? '-';
        const w = mCtx.measureText(val).width;
        if (w > maxW) maxW = w;
      }
    }
    return Math.ceil(maxW + colCellPaddingX * 2);
  });

  // Check if any block subheaders exist and need width
  let maxBlockHeaderW = 0;
  mCtx.font = `600 13.5px ${SANS_FONT}`;
  for (const group of config.groups) {
    if (group.blockTitle) {
      const bw = mCtx.measureText(group.blockTitle).width + 24;
      if (bw > maxBlockHeaderW) maxBlockHeaderW = bw;
    }
  }

  const rawColsWidth = colWidths.reduce((a, b) => a + b, 0);
  const contentWidth = Math.max(rawColsWidth, minBannerWidth, maxBlockHeaderW, 340);

  // Distribute any extra width evenly across columns so columns span full table width cleanly
  if (contentWidth > rawColsWidth && colWidths.length > 0) {
    const extraPerCol = (contentWidth - rawColsWidth) / colWidths.length;
    for (let i = 0; i < colWidths.length; i++) {
      colWidths[i] += extraPerCol;
    }
  }

  // Vertical layout metrics (in 1x logical pixels)
  const outerPadX = 24;
  const outerPadTop = 20;
  const outerPadBottom = 18;
  const bannerH = 38;
  const gapBannerToRule = 5;
  const headerRowH = 36;
  const blockSubheaderH = 28;
  const dataRowH = 31;
  const afterHeaderPad = 5;
  const afterGroupPad = 6;

  const totalRows = config.groups.reduce((acc, g) => acc + g.rows.length, 0);
  const totalBlockHeaders = config.groups.filter((g) => Boolean(g.blockTitle)).length;
  const multiGroupGaps = Math.max(0, config.groups.length - 1) * afterGroupPad;

  const logicalWidth = Math.ceil(contentWidth + outerPadX * 2);
  const logicalHeight = Math.ceil(
    outerPadTop +
      bannerH +
      gapBannerToRule +
      headerRowH +
      afterHeaderPad +
      totalBlockHeaders * blockSubheaderH +
      totalRows * dataRowH +
      multiGroupGaps +
      outerPadBottom
  );

  const canvas = document.createElement('canvas');
  canvas.width = logicalWidth * scale;
  canvas.height = logicalHeight * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  // 1. Pure white background (never dark mode)
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, logicalWidth, logicalHeight);

  let curY = outerPadTop;
  const leftX = outerPadX;
  const rightX = outerPadX + contentWidth;

  // 2. Top Textbook Banner: Red Badge + Rose Title Box
  ctx.fillStyle = PALETTE.badgeBg;
  ctx.fillRect(leftX, curY, badgeBoxW, bannerH);

  ctx.fillStyle = PALETTE.bannerBg;
  ctx.fillRect(leftX + badgeBoxW, curY, contentWidth - badgeBoxW, bannerH);

  // Badge Text ("TABLE A–17")
  ctx.fillStyle = PALETTE.badgeText;
  ctx.font = `700 16.5px ${SANS_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(formattedBadge, leftX + badgeBoxW / 2, curY + bannerH / 2 + 0.5);

  // Title Text ("Ideal-gas properties of air")
  ctx.fillStyle = PALETTE.bannerText;
  ctx.font = `400 17.5px ${SERIF_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(formattedTitle, leftX + badgeBoxW + 14, curY + bannerH / 2 + 0.5);

  curY += bannerH + gapBannerToRule;

  // 3. Top Red Rule above Column Headers
  ctx.strokeStyle = PALETTE.rule;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(leftX, curY);
  ctx.lineTo(rightX, curY);
  ctx.stroke();

  // 4. Column Headers
  const headerBaselineY = curY + headerRowH * 0.66;
  let colX = leftX;
  for (let i = 0; i < config.columns.length; i++) {
    const col = config.columns[i];
    const colW = colWidths[i];
    drawHeaderCell(ctx, col, colX + colW / 2, headerBaselineY);
    colX += colW;
  }

  curY += headerRowH;

  // 5. Bottom Red Rule below Column Headers
  ctx.strokeStyle = PALETTE.rule;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(leftX, curY);
  ctx.lineTo(rightX, curY);
  ctx.stroke();

  curY += afterHeaderPad;

  // 6. Data Rows & Optional Isobar Block Subheaders
  const hitboxes: SnippetCellHitbox[] = [];

  for (let gIdx = 0; gIdx < config.groups.length; gIdx++) {
    const group = config.groups[gIdx];

    if (group.blockTitle) {
      // Subtle isobar subheader band
      ctx.fillStyle = PALETTE.blockHeaderBg;
      ctx.fillRect(leftX, curY + 1, contentWidth, blockSubheaderH - 2);

      ctx.fillStyle = PALETTE.blockHeaderText;
      ctx.font = `600 13px ${SANS_FONT}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(group.blockTitle, leftX + 10, curY + blockSubheaderH / 2 + 0.5);

      curY += blockSubheaderH;
    }

    for (const row of group.rows) {
      let cellX = leftX;
      const rowCenterY = curY + dataRowH / 2;

      for (let cIdx = 0; cIdx < config.columns.length; cIdx++) {
        const col = config.columns[cIdx];
        const colW = colWidths[cIdx];
        const val = row.cells[col.id] ?? '-';
        const cellKey = `${row.rowKey}::${col.id}`;
        const isEmphasized = config.emphasizedCells.has(cellKey);

        const cellCenterX = cellX + colW / 2;

        // Record normalized hitbox so user can click/tap cells directly on the preview image
        hitboxes.push({
          rowKey: row.rowKey,
          colId: col.id,
          nx: cellX / logicalWidth,
          ny: curY / logicalHeight,
          nw: colW / logicalWidth,
          nh: dataRowH / logicalHeight,
        });

        ctx.font = isEmphasized ? `700 15.5px ${SANS_FONT}` : `400 15.5px ${SANS_FONT}`;
        const textW = ctx.measureText(val).width;

        if (isEmphasized) {
          const pillW = Math.min(colW - 6, Math.max(textW + 18, 44));
          const pillH = 23;
          const pillX = cellCenterX - pillW / 2;
          const pillY = rowCenterY - pillH / 2;

          ctx.fillStyle = PALETTE.emphasisFill;
          drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 11.5);
          ctx.fill();

          ctx.strokeStyle = PALETTE.emphasisStroke;
          ctx.lineWidth = 1.65;
          drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 11.5);
          ctx.stroke();
        }

        const isSatLabel = val === 'Sat.';
        ctx.fillStyle = isEmphasized
          ? PALETTE.emphasisText
          : isSatLabel
          ? PALETTE.satLabelText
          : PALETTE.cellText;

        if (isSatLabel && !isEmphasized) {
          ctx.font = `600 15px ${SANS_FONT}`;
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(val, cellCenterX, rowCenterY + 0.5);

        cellX += colW;
      }

      curY += dataRowH;
    }

    if (gIdx < config.groups.length - 1) {
      curY += afterGroupPad;
    }
  }

  const dataUrl = canvas.toDataURL('image/png');
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Failed to generate PNG blob'));
    }, 'image/png');
  });

  return {
    dataUrl,
    blob,
    width: logicalWidth,
    height: logicalHeight,
    hitboxes,
  };
}
