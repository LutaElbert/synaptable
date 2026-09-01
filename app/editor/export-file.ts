import { tableDimensions, type TableCellAddress } from './table-grid';
import type { EditorEdge, EditorNode, TableNodeData } from './types';

export type ExportScope = 'canvas' | 'selection' | 'table-cells';
export type ExportFormat = 'png' | 'svg' | 'pdf' | 'csv';
export type ExportBackground = 'transparent' | 'white';
export type PdfPageSize = 'fit' | 'a4' | 'letter';
export type PdfOrientation = 'auto' | 'portrait' | 'landscape';

export type ExportContent = {
  nodes: EditorNode[];
  edges: EditorEdge[];
  table: TableNodeData | null;
};

export type RasterDimensions = {
  width: number;
  height: number;
  scale: number;
  reduced: boolean;
};

export type PdfLayout = {
  pageWidth: number;
  pageHeight: number;
  imageX: number;
  imageY: number;
  imageWidth: number;
  imageHeight: number;
};

const MAX_RASTER_DIMENSION = 16_384;
const MAX_RASTER_PIXELS = 64_000_000;
const PDF_POINTS_PER_CSS_PIXEL = 0.75;

function selectedTableSlice(data: TableNodeData, addresses: TableCellAddress[]): TableNodeData {
  const rows = new Set(addresses.map((address) => address.rowId));
  const columns = new Set(addresses.map((address) => address.columnId));
  const rowIndexes = data.rows.flatMap((row, index) => rows.has(row.id) ? [index] : []);
  const columnIndexes = data.columns.flatMap((column, index) => columns.has(column.id) ? [index] : []);
  if (!rowIndexes.length || !columnIndexes.length) throw new Error('Select at least one table cell to export.');
  const firstRow = Math.min(...rowIndexes);
  const lastRow = Math.max(...rowIndexes);
  const firstColumn = Math.min(...columnIndexes);
  const lastColumn = Math.max(...columnIndexes);
  return {
    ...data,
    name: `${data.name} selection`,
    columns: data.columns.slice(firstColumn, lastColumn + 1).map((column) => ({ ...column })),
    rows: data.rows.slice(firstRow, lastRow + 1).map((row) => ({
      ...row,
      cells: row.cells.slice(firstColumn, lastColumn + 1).map((cell) => ({ ...cell })),
    })),
    headerRow: data.headerRow && firstRow === 0,
    headerColumn: data.headerColumn && firstColumn === 0,
  };
}

export function resolveExportContent(
  nodes: EditorNode[],
  edges: EditorEdge[],
  scope: ExportScope,
  tableSelection?: { nodeId: string; addresses: TableCellAddress[] } | null,
): ExportContent {
  const visibleNodes = nodes.filter((node) => !node.hidden);
  if (scope === 'table-cells') {
    const source = visibleNodes.find((node) => node.id === tableSelection?.nodeId && node.data.kind === 'table');
    if (!source || source.data.kind !== 'table') throw new Error('Select table cells before exporting this scope.');
    const table = selectedTableSlice(source.data, tableSelection?.addresses ?? []);
    const dimensions = tableDimensions(table);
    const node: EditorNode = {
      ...source,
      position: { x: 0, y: 0 },
      selected: false,
      data: table,
      style: { ...source.style, width: dimensions.width, height: dimensions.height },
    };
    return { nodes: [node], edges: [], table };
  }

  const scopedNodes = scope === 'selection'
    ? visibleNodes.filter((node) => node.selected)
    : visibleNodes;
  if (!scopedNodes.length) {
    throw new Error(scope === 'selection' ? 'Select at least one layer to export.' : 'There is nothing visible to export.');
  }
  const ids = new Set(scopedNodes.map((node) => node.id));
  const scopedEdges = edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target));
  const table = scopedNodes.length === 1 && scopedNodes[0].data.kind === 'table'
    ? scopedNodes[0].data
    : null;
  return { nodes: scopedNodes, edges: scopedEdges, table };
}

function escapeCsvCell(value: string) {
  const normalized = value.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
  return /[",\n]/.test(normalized) ? `"${normalized.replaceAll('"', '""')}"` : normalized;
}

export function tableToCsv(data: TableNodeData) {
  return `\uFEFF${data.rows.map((row) => row.cells.map((cell) => escapeCsvCell(cell.text)).join(',')).join('\r\n')}`;
}

export function clampRasterDimensions(width: number, height: number, requestedScale: number): RasterDimensions {
  if (!(width > 0) || !(height > 0)) throw new Error('The export dimensions are invalid.');
  const scale = Math.max(0.25, Math.min(4, requestedScale));
  const dimensionScale = Math.min(1, MAX_RASTER_DIMENSION / (Math.max(width, height) * scale));
  const pixelScale = Math.min(1, Math.sqrt(MAX_RASTER_PIXELS / (width * height * scale * scale)));
  const safeScale = scale * Math.min(dimensionScale, pixelScale);
  return {
    width: Math.max(1, Math.floor(width * safeScale)),
    height: Math.max(1, Math.floor(height * safeScale)),
    scale: safeScale,
    reduced: safeScale < scale - 0.001,
  };
}

function loadSvgImage(svg: string) {
  return new Promise<{ image: HTMLImageElement; url: string }>((resolve, reject) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => resolve({ image, url });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('The browser could not render this export.'));
    };
    image.src = url;
  });
}

export async function svgToPngBlob(svg: string, width: number, height: number, scale = 2) {
  const dimensions = clampRasterDimensions(width, height, scale);
  const loaded = await loadSvgImage(svg);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas rendering is unavailable in this browser.');
    context.drawImage(loaded.image, 0, 0, dimensions.width, dimensions.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error('PNG encoding failed.')), 'image/png');
    });
    return { blob, dimensions };
  } finally {
    URL.revokeObjectURL(loaded.url);
  }
}

function pageDimensions(pageSize: PdfPageSize, orientation: PdfOrientation, sourceWidth: number, sourceHeight: number) {
  let width: number;
  let height: number;
  if (pageSize === 'a4') [width, height] = [595.28, 841.89];
  else if (pageSize === 'letter') [width, height] = [612, 792];
  else {
    const longestSideScale = Math.min(1, 1_440 / Math.max(sourceWidth, sourceHeight));
    width = Math.max(72, sourceWidth * PDF_POINTS_PER_CSS_PIXEL * longestSideScale);
    height = Math.max(72, sourceHeight * PDF_POINTS_PER_CSS_PIXEL * longestSideScale);
  }
  const resolved = orientation === 'auto'
    ? (sourceWidth > sourceHeight ? 'landscape' : 'portrait')
    : orientation;
  if ((resolved === 'landscape' && width < height) || (resolved === 'portrait' && width > height)) {
    [width, height] = [height, width];
  }
  return { width, height };
}

export function calculatePdfLayout(
  sourceWidth: number,
  sourceHeight: number,
  pageSize: PdfPageSize,
  orientation: PdfOrientation,
  margin: number,
): PdfLayout {
  const page = pageDimensions(pageSize, orientation, sourceWidth, sourceHeight);
  const safeMargin = Math.max(0, Math.min(Math.min(page.width, page.height) / 3, margin));
  const availableWidth = page.width - safeMargin * 2;
  const availableHeight = page.height - safeMargin * 2;
  const scale = Math.min(availableWidth / sourceWidth, availableHeight / sourceHeight);
  const imageWidth = sourceWidth * scale;
  const imageHeight = sourceHeight * scale;
  return {
    pageWidth: page.width,
    pageHeight: page.height,
    imageX: (page.width - imageWidth) / 2,
    imageY: (page.height - imageHeight) / 2,
    imageWidth,
    imageHeight,
  };
}

export async function pngToPdfBlob(
  png: Blob,
  sourceWidth: number,
  sourceHeight: number,
  options: { pageSize: PdfPageSize; orientation: PdfOrientation; margin: number },
) {
  const { PDFDocument } = await import('pdf-lib');
  const document = await PDFDocument.create();
  document.setTitle('SynapTable canvas export');
  document.setCreator('SynapTable');
  const image = await document.embedPng(await png.arrayBuffer());
  const layout = calculatePdfLayout(sourceWidth, sourceHeight, options.pageSize, options.orientation, options.margin);
  const page = document.addPage([layout.pageWidth, layout.pageHeight]);
  page.drawImage(image, {
    x: layout.imageX,
    y: layout.imageY,
    width: layout.imageWidth,
    height: layout.imageHeight,
  });
  const bytes = await document.save();
  return new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' });
}

export function downloadBlob(blob: Blob, fileName: string, extension: ExportFormat) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.toLowerCase().endsWith(`.${extension}`) ? fileName : `${fileName}.${extension}`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
