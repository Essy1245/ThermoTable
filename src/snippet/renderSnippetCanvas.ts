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
  columnDivider: '#e5e7eb',
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
  ctx.font = `italic 16.5px ${SERIF_FONT}`;
  const symbolWidth = ctx.measureText(col.symbol).width;

  let scriptWidth = 0;
  if (col.subscript) {
    ctx.font = `italic 11.5px ${SERIF_FONT}`;
    scriptWidth = Math.max(scriptWidth, ctx.measureText(col.subscript).width + 1);
  }
  if (col.superscript) {
    ctx.font = `13.5px ${SERIF_FONT}`;
    scriptWidth = Math.max(scriptWidth, ctx.measureText(col.superscript).width + 1);
  }

  ctx.font = `400 15.5px ${SANS_FONT}`;
  const spaceWidth = col.unit ? 5 : 0;
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
  ctx.font = `italic 16.5px ${SERIF_FONT}`;
  ctx.fillText(col.symbol, curX, baselineY);

  // Optional molar overbar above the symbol
  if (col.overbar) {
    const barWidth = Math.max(8, m.symbolWidth - 1);
    const barX = curX + 1;
    const barY = baselineY - 14;
    ctx.fillRect(barX, barY, barWidth, 1.3);
  }

  curX += m.symbolWidth;

  // 2. Subscript / Superscript
  if (col.subscript) {
    ctx.font = `italic 11px ${SERIF_FONT}`;
    ctx.fillText(col.subscript, curX + 0.5, baselineY + 3.5);
  }
  if (col.superscript) {
    ctx.font = `400 13px ${SERIF_FONT}`;
    ctx.fillText(col.superscript, curX + 0.5, baselineY - 5);
  }
  curX += m.scriptWidth + m.spaceWidth;

  // 3. Unit
  if (col.unit) {
    ctx.font = `400 15px ${SANS_FONT}`;
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

interface DisplayGroup {
  blockTitle?: string;
  rows: {
    rowKey: string;
    cells: Record<string, string>;
  }[];
}

export async function renderSnippetCanvas(
  config: SnippetRenderConfig
): Promise<SnippetRenderResult> {
  if (config.columns.length === 0 || config.groups.length === 0) {
    throw new Error('No columns or groups to render');
  }

  const scale = 3; // Crisp 3x Retina output
  const measureCanvas = document.createElement('canvas');
  const mCtx = measureCanvas.getContext('2d')!;

  // Format table badge text with textbook en-dash: "TABLE A–17"
  const formattedBadge = config.tableName.toUpperCase().replace('-', '–');
  const formattedTitle = config.tableTitle;

  // Measure banner requirements
  mCtx.font = `700 16px ${SANS_FONT}`;
  const badgeTextW = mCtx.measureText(formattedBadge).width;
  const badgeBoxW = Math.ceil(badgeTextW + 20);

  mCtx.font = `400 17px ${SERIF_FONT}`;
  const titleTextW = mCtx.measureText(formattedTitle).width;
  const minBannerWidth = badgeBoxW + 14 + Math.ceil(titleTextW) + 16;

  // Measure individual columns width needed
  const colCellPaddingX = 14;
  const rawColWidths = config.columns.map((col) => {
    const headerM = measureHeaderCell(mCtx, col);
    let maxW = headerM.totalWidth;

    mCtx.font = `400 15.5px ${SANS_FONT}`;
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
  mCtx.font = `600 13px ${SANS_FONT}`;
  for (const group of config.groups) {
    if (group.blockTitle) {
      const bw = mCtx.measureText(group.blockTitle).width + 20;
      if (bw > maxBlockHeaderW) maxBlockHeaderW = bw;
    }
  }

  const baseColWidthSum = rawColWidths.reduce((a, b) => a + b, 0);
  const minBlockWidth = Math.max(baseColWidthSum, maxBlockHeaderW, 260);

  // Prepare display blocks
  // If multiple groups exist (e.g. multiple isobars): use them as distinct blocks
  // If single group exists but has many rows (>= 16): chunk rows so it can also grow square
  let displayBlocks: DisplayGroup[] = [];
  if (config.groups.length > 1) {
    displayBlocks = config.groups.filter((g) => g.rows.length > 0);
  } else if (config.groups.length === 1) {
    const single = config.groups[0];
    if (single.rows.length >= 16 && !single.blockTitle) {
      // Chunk into two halves
      const half = Math.ceil(single.rows.length / 2);
      displayBlocks = [
        { rows: single.rows.slice(0, half) },
        { rows: single.rows.slice(half) },
      ];
    } else {
      displayBlocks = [single];
    }
  }

  if (displayBlocks.length === 0) {
    throw new Error('No non-empty groups to render');
  }

  // Vertical layout metrics (0 outer padding for tight snippet crop)
  const bannerH = 36;
  const gapBannerToContent = 4;
  const headerRowH = 34;
  const blockSubheaderH = 26;
  const dataRowH = 30;
  const afterHeaderPad = 4;
  const afterGroupPad = 8;
  const columnGapX = 18; // Gap between side-by-side columns
  const outerPadBottom = 2; // Tiny safety margin for descenders at bottom

  // Estimate block heights
  const blockHeights = displayBlocks.map((b) => {
    const subH = b.blockTitle ? blockSubheaderH : 0;
    return subH + headerRowH + afterHeaderPad + b.rows.length * dataRowH;
  });

  // Calculate the optimal number of columns C (1..4) to grow as square as possible (aspect ratio ≈ 1.0)
  const maxCandidateColumns = Math.min(displayBlocks.length, 4);
  let bestColumns = 1;
  let bestScore = Infinity; // score = |ln(width / height)| (0 means perfect 1:1 square)
  let bestPartition: DisplayGroup[][] = [displayBlocks];

  for (let c = 1; c <= maxCandidateColumns; c++) {
    // Partition displayBlocks into c contiguous columns to balance column heights
    const partition: DisplayGroup[][] = Array.from({ length: c }, () => []);
    const partitionHeights: number[] = Array.from({ length: c }, () => 0);

    // Distribute blocks into c columns
    if (c === 1) {
      partition[0] = [...displayBlocks];
      partitionHeights[0] =
        blockHeights.reduce((acc, h) => acc + h, 0) +
        Math.max(0, displayBlocks.length - 1) * afterGroupPad;
    } else {
      // Contiguous partition balancing heights
      const totalH = blockHeights.reduce((a, b) => a + b, 0);
      const targetPerCol = totalH / c;
      let curCol = 0;
      let curColH = 0;

      for (let i = 0; i < displayBlocks.length; i++) {
        const remainingBlocks = displayBlocks.length - i;
        const remainingCols = c - curCol;

        // Force advance if we need to ensure each remaining column gets at least one block
        if (remainingBlocks <= remainingCols && curCol < c - 1 && partition[curCol].length > 0) {
          curCol++;
          curColH = 0;
        } else if (
          curCol < c - 1 &&
          curColH + blockHeights[i] > targetPerCol &&
          partition[curCol].length > 0
        ) {
          curCol++;
          curColH = 0;
        }

        partition[curCol].push(displayBlocks[i]);
        curColH += blockHeights[i] + afterGroupPad;
        partitionHeights[curCol] = curColH;
      }
    }

    const maxTrackH = Math.max(...partitionHeights);
    const estTotalH = bannerH + gapBannerToContent + maxTrackH + outerPadBottom;
    const estColsW = c * minBlockWidth + (c - 1) * columnGapX;
    const estTotalW = Math.max(estColsW, minBannerWidth);

    const ratio = estTotalW / estTotalH;
    const score = Math.abs(Math.log(ratio));

    if (score < bestScore) {
      bestScore = score;
      bestColumns = c;
      bestPartition = partition;
    }
  }

  // With bestColumns chosen, compute exact column widths and track widths
  const numTracks = bestColumns;
  const rawTotalTracksW = numTracks * minBlockWidth + (numTracks - 1) * columnGapX;
  const logicalWidth = Math.ceil(Math.max(rawTotalTracksW, minBannerWidth));

  // Determine actual width of each column track (distribute extra banner space evenly)
  const trackWidth = (logicalWidth - (numTracks - 1) * columnGapX) / numTracks;

  // Determine column widths within a track
  const trackColWidths = rawColWidths.map((w) => w);
  const trackColsSum = trackColWidths.reduce((a, b) => a + b, 0);
  if (trackWidth > trackColsSum && trackColWidths.length > 0) {
    const extraPerCol = (trackWidth - trackColsSum) / trackColWidths.length;
    for (let i = 0; i < trackColWidths.length; i++) {
      trackColWidths[i] += extraPerCol;
    }
  }

  // Calculate actual logical height with exact spacing
  const trackHeights: number[] = [];
  for (let tIdx = 0; tIdx < numTracks; tIdx++) {
    const blocksInTrack = bestPartition[tIdx];
    let h = 0;
    for (let bIdx = 0; bIdx < blocksInTrack.length; bIdx++) {
      const b = blocksInTrack[bIdx];
      h += (b.blockTitle ? blockSubheaderH : 0) + headerRowH + afterHeaderPad + b.rows.length * dataRowH;
      if (bIdx < blocksInTrack.length - 1) {
        h += afterGroupPad;
      }
    }
    trackHeights.push(h);
  }

  const maxContentH = Math.max(...trackHeights);
  const logicalHeight = Math.ceil(bannerH + gapBannerToContent + maxContentH + outerPadBottom);

  // Setup Canvas
  const canvas = document.createElement('canvas');
  canvas.width = logicalWidth * scale;
  canvas.height = logicalHeight * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  // 1. Pure white background (flush, zero outer padding, strictly immune to dark mode)
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, logicalWidth, logicalHeight);

  // 2. Top Textbook Banner: Red Badge + Soft Rose Title Box
  ctx.fillStyle = PALETTE.badgeBg;
  ctx.fillRect(0, 0, badgeBoxW, bannerH);

  ctx.fillStyle = PALETTE.bannerBg;
  ctx.fillRect(badgeBoxW, 0, logicalWidth - badgeBoxW, bannerH);

  // Badge Text ("TABLE A–17")
  ctx.fillStyle = PALETTE.badgeText;
  ctx.font = `700 16px ${SANS_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(formattedBadge, badgeBoxW / 2, bannerH / 2 + 0.5);

  // Title Text ("Ideal-gas properties of air")
  ctx.fillStyle = PALETTE.bannerText;
  ctx.font = `400 17px ${SERIF_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(formattedTitle, badgeBoxW + 12, bannerH / 2 + 0.5);

  // Thin red line separating banner from content
  ctx.strokeStyle = PALETTE.rule;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(0, bannerH);
  ctx.lineTo(logicalWidth, bannerH);
  ctx.stroke();

  const contentStartY = bannerH + gapBannerToContent;
  const hitboxes: SnippetCellHitbox[] = [];

  // 3. Render Column Tracks side-by-side
  for (let tIdx = 0; tIdx < numTracks; tIdx++) {
    const trackLeftX = tIdx * (trackWidth + columnGapX);
    const trackRightX = trackLeftX + trackWidth;
    let trackCurY = contentStartY;

    // Draw vertical divider line between adjacent column tracks
    if (tIdx > 0) {
      const sepX = trackLeftX - columnGapX / 2;
      ctx.strokeStyle = PALETTE.columnDivider;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sepX, contentStartY);
      ctx.lineTo(sepX, logicalHeight);
      ctx.stroke();
    }

    const blocksInTrack = bestPartition[tIdx];

    for (let bIdx = 0; bIdx < blocksInTrack.length; bIdx++) {
      const block = blocksInTrack[bIdx];

      // Draw Isobar Subheader if present
      if (block.blockTitle) {
        ctx.fillStyle = PALETTE.blockHeaderBg;
        ctx.fillRect(trackLeftX, trackCurY, trackWidth, blockSubheaderH - 2);

        ctx.fillStyle = PALETTE.blockHeaderText;
        ctx.font = `600 13px ${SANS_FONT}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(block.blockTitle, trackLeftX + 8, trackCurY + blockSubheaderH / 2);

        trackCurY += blockSubheaderH - 2;

        // Thin red line below block header
        ctx.strokeStyle = PALETTE.rule;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(trackLeftX, trackCurY);
        ctx.lineTo(trackRightX, trackCurY);
        ctx.stroke();

        trackCurY += 2;
      }

      // Top Red Rule above Column Headers
      ctx.strokeStyle = PALETTE.rule;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(trackLeftX, trackCurY);
      ctx.lineTo(trackRightX, trackCurY);
      ctx.stroke();

      // Column Headers for this block
      const headerBaselineY = trackCurY + headerRowH * 0.66;
      let curColX = trackLeftX;
      for (let cIdx = 0; cIdx < config.columns.length; cIdx++) {
        const col = config.columns[cIdx];
        const colW = trackColWidths[cIdx];
        drawHeaderCell(ctx, col, curColX + colW / 2, headerBaselineY);
        curColX += colW;
      }

      trackCurY += headerRowH;

      // Bottom Red Rule below Column Headers
      ctx.strokeStyle = PALETTE.rule;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(trackLeftX, trackCurY);
      ctx.lineTo(trackRightX, trackCurY);
      ctx.stroke();

      trackCurY += afterHeaderPad;

      // Data Rows
      for (const row of block.rows) {
        let cellX = trackLeftX;
        const rowCenterY = trackCurY + dataRowH / 2;

        for (let cIdx = 0; cIdx < config.columns.length; cIdx++) {
          const col = config.columns[cIdx];
          const colW = trackColWidths[cIdx];
          const val = row.cells[col.id] ?? '-';
          const cellKey = `${row.rowKey}::${col.id}`;
          const isEmphasized = config.emphasizedCells.has(cellKey);
          const cellCenterX = cellX + colW / 2;

          // Record normalized hitbox for responsive click/tap mapping
          hitboxes.push({
            rowKey: row.rowKey,
            colId: col.id,
            nx: cellX / logicalWidth,
            ny: trackCurY / logicalHeight,
            nw: colW / logicalWidth,
            nh: dataRowH / logicalHeight,
          });

          ctx.font = isEmphasized ? `700 15px ${SANS_FONT}` : `400 15px ${SANS_FONT}`;
          const textW = ctx.measureText(val).width;

          if (isEmphasized) {
            const pillW = Math.min(colW - 6, Math.max(textW + 16, 40));
            const pillH = 22;
            const pillX = cellCenterX - pillW / 2;
            const pillY = rowCenterY - pillH / 2;

            ctx.fillStyle = PALETTE.emphasisFill;
            drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 11);
            ctx.fill();

            ctx.strokeStyle = PALETTE.emphasisStroke;
            ctx.lineWidth = 1.6;
            drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 11);
            ctx.stroke();
          }

          const isSatLabel = val === 'Sat.';
          ctx.fillStyle = isEmphasized
            ? PALETTE.emphasisText
            : isSatLabel
            ? PALETTE.satLabelText
            : PALETTE.cellText;

          if (isSatLabel && !isEmphasized) {
            ctx.font = `600 14.5px ${SANS_FONT}`;
          }

          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(val, cellCenterX, rowCenterY + 0.5);

          cellX += colW;
        }

        trackCurY += dataRowH;
      }

      if (bIdx < blocksInTrack.length - 1) {
        trackCurY += afterGroupPad;
      }
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
