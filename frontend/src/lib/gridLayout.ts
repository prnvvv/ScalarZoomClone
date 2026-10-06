/**
 * Pure tile-grid fitting for the meeting stage.
 *
 * Given the stage size and the number of tiles, pick a column/row count that
 * fills the viewport without overflowing it, prefers a 16:9-ish cell, wastes
 * as few grid slots as possible, and paginates only when the tiles would be
 * unreadably small. No pixel positions — everything scales with the viewport.
 */

export interface GridFit {
  columns: number;
  rows: number;
  /** Tiles rendered on the current page. */
  pageSize: number;
  /** 1 unless the tiles had to be paginated. */
  pageCount: number;
}

export interface FitOptions {
  gap?: number;
  /** Below this a cell is unreadable, so we page instead of shrinking. */
  minCellWidth?: number;
  minCellHeight?: number;
  /** Widest grid we ever build, even if space allows more. */
  maxColumns?: number;
}

const DEFAULTS = {
  gap: 12,
  minCellWidth: 150,
  minCellHeight: 96,
  maxColumns: 8,
};

const TARGET_ASPECT = 16 / 9;

function columnsForCount(count: number): number {
  return Math.max(1, Math.ceil(Math.sqrt(count)));
}

/**
 * Choose a grid for `count` tiles inside `width` x `height`.
 *
 * Unknown/zero sizes (first paint) fall back to a count-based estimate so the
 * stage is never blank while the ResizeObserver warms up.
 */
export function fitGrid(
  count: number,
  width: number,
  height: number,
  options: FitOptions = {}
): GridFit {
  const gap = options.gap ?? DEFAULTS.gap;
  const minW = options.minCellWidth ?? DEFAULTS.minCellWidth;
  const minH = options.minCellHeight ?? DEFAULTS.minCellHeight;
  const maxColumns = options.maxColumns ?? DEFAULTS.maxColumns;

  const total = Math.max(1, Math.floor(count));

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    const columns = Math.min(maxColumns, columnsForCount(total));
    const rows = Math.ceil(total / columns);
    return { columns, rows, pageSize: total, pageCount: 1 };
  }

  // Hard caps: the most columns/rows that still honour the minimum cell size.
  const capColumns = Math.max(1, Math.floor((width + gap) / (minW + gap)));
  const capRows = Math.max(1, Math.floor((height + gap) / (minH + gap)));
  const preferred = columnsForCount(total);
  const searchCeiling = Math.min(maxColumns, capColumns, total);

  let best: { columns: number; rows: number; score: number } | null = null;

  for (let columns = 1; columns <= searchCeiling; columns += 1) {
    const rows = Math.ceil(total / columns);
    if (rows > capRows) continue;

    const cellWidth = (width - gap * (columns - 1)) / columns;
    const cellHeight = (height - gap * (rows - 1)) / rows;
    if (cellWidth <= 0 || cellHeight <= 0) continue;

    const aspectError = Math.abs(
      Math.log(cellWidth / cellHeight / TARGET_ASPECT)
    );
    const waste = columns * rows - total;
    const score =
      aspectError + waste * 0.08 + Math.abs(columns - preferred) * 0.05;

    if (!best || score < best.score) best = { columns, rows, score };
  }

  if (best) {
    return {
      columns: best.columns,
      rows: best.rows,
      pageSize: total,
      pageCount: 1,
    };
  }

  // Not every tile fits legibly: page them.
  const columns = Math.max(1, Math.min(maxColumns, capColumns, preferred));
  const rows = Math.max(1, Math.min(capRows, Math.ceil(total / columns)));
  const pageSize = Math.max(1, columns * rows);
  return {
    columns,
    rows,
    pageSize,
    pageCount: Math.ceil(total / pageSize),
  };
}

/**
 * 1-based column where the first tile of a partial last row starts, so a
 * single leftover tile sits centred instead of pinned to the left edge.
 * A full last row always starts at 1.
 */
export function lastRowStart(count: number, columns: number): number {
  if (columns <= 1 || count <= 0) return 1;
  const remainder = count % columns;
  if (remainder === 0) return 1;
  return Math.ceil((columns - remainder) / 2) + 1;
}

/** Slices the ordered tile list into the visible page. */
export function pageSlice<T>(
  items: T[],
  page: number,
  fit: GridFit
): { visible: T[]; start: number } {
  if (fit.pageCount <= 1) return { visible: items, start: 0 };
  const start = Math.min(page, fit.pageCount - 1) * fit.pageSize;
  // A clamped page that points past the data means the fit over-estimated
  // the page count (fewer items than expected); show everything instead.
  if (start >= items.length) return { visible: items, start: 0 };
  return { visible: items.slice(start, start + fit.pageSize), start };
}
