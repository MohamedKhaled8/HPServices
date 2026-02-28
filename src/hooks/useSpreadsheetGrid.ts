import { useCallback, useRef, useState } from 'react';

export interface GridSelection {
  tableId: string;
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface SpreadsheetGridState {
  /** Which table has focus (for keyboard) */
  activeTableId: string | null;
  /** Current selection range (inclusive). -1 means no selection. */
  selection: GridSelection | null;
  /** Cell being edited { tableId, row, col } */
  editingCell: { tableId: string; row: number; col: number } | null;
  /** Clipboard: 2D array of strings (tab/newline from Excel-style paste) */
  clipboard: string[][];
  /** Cut mode: after paste, clear source cells if true */
  clipboardCut: boolean;
  /** Column widths per table: tableId -> colIndex -> width in px */
  columnWidths: Record<string, Record<number, number>>;
  /** Hidden column indices per table */
  hiddenColumns: Record<string, Set<number>>;
  /** Sort state per table */
  sortState: Record<string, { colIndex: number; dir: 'asc' | 'desc' } | null>;
}

const defaultSelection: GridSelection = {
  tableId: '',
  startRow: -1,
  startCol: -1,
  endRow: -1,
  endCol: -1
};

function normalizeRange(sel: GridSelection): GridSelection {
  return {
    ...sel,
    startRow: Math.min(sel.startRow, sel.endRow),
    endRow: Math.max(sel.startRow, sel.endRow),
    startCol: Math.min(sel.startCol, sel.endCol),
    endCol: Math.max(sel.startCol, sel.endCol)
  };
}

export function useSpreadsheetGrid() {
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [selection, setSelection] = useState<GridSelection | null>(null);
  const [editingCell, setEditingCell] = useState<{ tableId: string; row: number; col: number } | null>(null);
  const [clipboard, setClipboard] = useState<string[][]>([]);
  const [clipboardCut, setClipboardCut] = useState(false);
  const [columnWidths, setColumnWidths] = useState<Record<string, Record<number, number>>>({});
  const [hiddenColumns, setHiddenColumns] = useState<Record<string, Set<number>>>({});
  const [sortState, setSortState] = useState<Record<string, { colIndex: number; dir: 'asc' | 'desc' } | null>>({});
  const isSelectingRef = useRef(false);

  const setSelectionRange = useCallback((tableId: string, startRow: number, startCol: number, endRow: number, endCol: number) => {
    setActiveTableId(tableId);
    setSelection(normalizeRange({ tableId, startRow, startCol, endRow, endCol }));
  }, []);

  const selectCell = useCallback((tableId: string, row: number, col: number) => {
    setActiveTableId(tableId);
    setSelection(normalizeRange({ tableId, startRow: row, startCol: col, endRow: row, endCol: col }));
    setEditingCell(null);
  }, []);

  const selectRange = useCallback((tableId: string, startRow: number, startCol: number, endRow: number, endCol: number) => {
    setActiveTableId(tableId);
    setSelection(normalizeRange({ tableId, startRow, startCol, endRow, endCol }));
  }, []);

  const selectRow = useCallback((tableId: string, row: number, colCount: number) => {
    setActiveTableId(tableId);
    setSelection(normalizeRange({ tableId, startRow: row, startCol: 0, endRow: row, endCol: Math.max(0, colCount - 1) }));
  }, []);

  const selectColumn = useCallback((tableId: string, col: number, rowCount: number) => {
    setActiveTableId(tableId);
    setSelection(normalizeRange({ tableId, startRow: 0, startCol: col, endRow: Math.max(0, rowCount - 1), endCol: col }));
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(null);
    setEditingCell(null);
  }, []);

  const isCellSelected = useCallback((tableId: string, row: number, col: number) => {
    if (!selection || selection.tableId !== tableId) return false;
    const n = normalizeRange(selection);
    return row >= n.startRow && row <= n.endRow && col >= n.startCol && col <= n.endCol;
  }, [selection]);

  const isCellEditing = useCallback((tableId: string, row: number, col: number) => {
    return editingCell?.tableId === tableId && editingCell.row === row && editingCell.col === col;
  }, [editingCell]);

  const startEditing = useCallback((tableId: string, row: number, col: number) => {
    setActiveTableId(tableId);
    setEditingCell({ tableId, row, col });
    setSelection(normalizeRange({ tableId, startRow: row, startCol: col, endRow: row, endCol: col }));
  }, []);

  const stopEditing = useCallback(() => {
    setEditingCell(null);
  }, []);

  const copyToClipboard = useCallback((values: string[][], isCut: boolean) => {
    setClipboard(values);
    setClipboardCut(isCut);
  }, []);

  const getClipboard = useCallback(() => ({ values: clipboard, isCut: clipboardCut }), [clipboard, clipboardCut]);

  const clearClipboardAfterPaste = useCallback(() => {
    if (clipboardCut) {
      setClipboard([]);
      setClipboardCut(false);
    }
  }, [clipboardCut]);

  const setColumnWidth = useCallback((tableId: string, colIndex: number, widthPx: number) => {
    setColumnWidths(prev => ({
      ...prev,
      [tableId]: { ...(prev[tableId] || {}), [colIndex]: widthPx }
    }));
  }, []);

  const getColumnWidth = useCallback((tableId: string, colIndex: number): number | undefined => {
    return columnWidths[tableId]?.[colIndex];
  }, [columnWidths]);

  const hideColumn = useCallback((tableId: string, colIndex: number) => {
    setHiddenColumns(prev => ({
      ...prev,
      [tableId]: new Set(prev[tableId] || []).add(colIndex)
    }));
  }, []);

  const isColumnHidden = useCallback((tableId: string, colIndex: number) => {
    return (hiddenColumns[tableId] || new Set()).has(colIndex);
  }, [hiddenColumns]);

  const setSort = useCallback((tableId: string, colIndex: number, dir: 'asc' | 'desc') => {
    setSortState(prev => ({ ...prev, [tableId]: { colIndex, dir } }));
  }, []);

  const getSort = useCallback((tableId: string) => sortState[tableId] ?? null, [sortState]);

  return {
    activeTableId,
    setActiveTableId,
    selection,
    setSelectionRange,
    selectCell,
    selectRange,
    selectRow,
    selectColumn,
    clearSelection,
    isCellSelected,
    editingCell,
    isCellEditing,
    startEditing,
    stopEditing,
    copyToClipboard,
    getClipboard,
    clearClipboardAfterPaste,
    columnWidths,
    setColumnWidth,
    getColumnWidth,
    hiddenColumns,
    hideColumn,
    isColumnHidden,
    setSort,
    getSort,
    isSelectingRef
  };
}

export type SpreadsheetGridAPI = ReturnType<typeof useSpreadsheetGrid>;
