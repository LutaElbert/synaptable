import { normalizeRichTextDocument, sanitizeLinkHref } from './rich-text';
import { TABLE_CAPTION_HEIGHT, tableDimensions } from './table-grid';
import type {
  EditorEdge,
  EditorNode,
  RichTextDocument,
  RichTextMark,
  RichTextNode,
  TableCellTone,
  TableNodeData,
  VectorNodeData,
} from './types';

const xmlEscape = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

type TextRun = { text: string; marks: RichTextMark[] };
type TextLine = { runs: TextRun[]; prefix: string; indent: number };

function inlineRuns(node: RichTextNode): TextRun[] {
  if (node.type === 'text') return [{ text: node.text ?? '', marks: node.marks ?? [] }];
  if (node.type === 'hardBreak') return [{ text: '\n', marks: [] }];
  return (node.content ?? []).flatMap(inlineRuns);
}

function blockLines(node: RichTextNode, indent = 0): TextLine[] {
  if (node.type === 'paragraph') return [{ runs: inlineRuns(node), prefix: '', indent }];
  if (node.type === 'bulletList' || node.type === 'orderedList' || node.type === 'taskList') {
    const start = Number(node.attrs?.start ?? 1);
    return (node.content ?? []).flatMap((item, index) => {
      const directParagraph = item.content?.find((child) => child.type === 'paragraph');
      const prefix = node.type === 'orderedList'
        ? `${start + index}.`
        : node.type === 'taskList'
          ? item.attrs?.checked ? '☑' : '☐'
          : '•';
      const line: TextLine = {
        runs: directParagraph ? inlineRuns(directParagraph) : [],
        prefix,
        indent,
      };
      const nested = (item.content ?? [])
        .filter((child) => child !== directParagraph)
        .flatMap((child) => blockLines(child, indent + 1));
      return [line, ...nested];
    });
  }
  return (node.content ?? []).flatMap((child) => blockLines(child, indent));
}

function splitRun(run: TextRun): TextRun[] {
  return run.text.split(/(\s+)/).filter(Boolean).map((text) => ({ text, marks: run.marks }));
}

function wrapLine(line: TextLine, maxCharacters: number): TextLine[] {
  const available = Math.max(8, maxCharacters - line.indent * 4 - (line.prefix ? line.prefix.length + 1 : 0));
  const wrapped: TextLine[] = [];
  let current: TextRun[] = [];
  let length = 0;
  const flush = () => {
    const merged = current.reduce<TextRun[]>((runs, run) => {
      const previous = runs.at(-1);
      if (previous && JSON.stringify(previous.marks) === JSON.stringify(run.marks)) {
        previous.text += run.text;
      } else {
        runs.push({ ...run });
      }
      return runs;
    }, []);
    wrapped.push({ runs: merged, prefix: wrapped.length === 0 ? line.prefix : '', indent: line.indent });
    current = [];
    length = 0;
  };
  for (const token of line.runs.flatMap(splitRun)) {
    if (token.text === '\n') {
      flush();
      continue;
    }
    if (length > 0 && length + token.text.length > available && token.text.trim()) flush();
    current.push(token);
    length += token.text.length;
  }
  if (current.length || wrapped.length === 0) flush();
  return wrapped;
}

function layoutRichText(document: RichTextDocument, width: number) {
  const maxCharacters = Math.max(12, Math.floor((width - 34) / 5.8));
  return blockLines(normalizeRichTextDocument(document)).flatMap((line) => wrapLine(line, maxCharacters));
}

function conceptContentHeight(node: EditorNode, width: number) {
  if (node.data.kind !== 'concept') return 0;
  const titleLines = layoutRichText(node.data.title, width);
  const bodyLines = layoutRichText(node.data.body, width);
  const hasBody = bodyLines.some((line) => line.runs.some((run) => run.text.trim()));
  const titleExtra = Math.max(0, titleLines.length - 1) * 18;
  return hasBody ? 70 + titleExtra + bodyLines.length * 15 + 12 : 78 + titleExtra;
}

function nodeSize(node: EditorNode) {
  if (node.data.kind === 'table') return tableDimensions(node.data);
  const style = node.style ?? {};
  const width = Number(style.width) || Number(node.measured?.width) || (node.data.kind === 'concept' ? 220 : 320);
  const preferredHeight = Number(style.height) || Number(node.measured?.height) || (node.data.kind === 'concept' ? 78 : 240);
  return {
    width,
    height: node.data.kind === 'concept' ? Math.max(preferredHeight, conceptContentHeight(node, width)) : preferredHeight,
  };
}

const TABLE_CELL_FILLS: Record<TableCellTone, string> = {
  none: '#ffffff',
  gray: '#f0f1f4',
  indigo: '#efedff',
  mint: '#e8f7ef',
  amber: '#fff4d8',
  rose: '#ffecef',
};

function wrapTableCellText(text: string, width: number, height: number) {
  const maxCharacters = Math.max(4, Math.floor((width - 18) / 6.4));
  const maxLines = Math.max(1, Math.floor((height - 12) / 14));
  const lines: string[] = [];
  for (const sourceLine of text.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n')) {
    const words = sourceLine.split(/(\s+)/).filter(Boolean);
    let current = '';
    for (const word of words) {
      if (current && current.length + word.length > maxCharacters && word.trim()) {
        lines.push(current.trimEnd());
        current = '';
      }
      current += word;
    }
    lines.push(current.trimEnd());
  }
  const visible = lines.slice(0, maxLines);
  if (lines.length > maxLines && visible.length) {
    const last = visible.length - 1;
    visible[last] = `${visible[last].slice(0, Math.max(1, maxCharacters - 1)).trimEnd()}…`;
  }
  return visible.length ? visible : [''];
}

function renderTableNode(data: TableNodeData, id: string, x: number, y: number) {
  const { width, height } = tableDimensions(data);
  const caption = `<rect x="${x}" y="${y}" width="${width}" height="${TABLE_CAPTION_HEIGHT}" rx="12" fill="#18191d" />
    <text x="${x + 14}" y="${y + 24}" fill="#ffffff" font-family="system-ui, sans-serif" font-size="12" font-weight="700">${xmlEscape(data.name)}</text>`;
  let rowY = y + TABLE_CAPTION_HEIGHT;
  const rows: string[] = [];
  data.rows.forEach((row, rowIndex) => {
    let columnX = x;
    row.cells.forEach((cell, columnIndex) => {
      const column = data.columns[columnIndex];
      const header = (data.headerRow && rowIndex === 0) || (data.headerColumn && columnIndex === 0);
      const fill = header && cell.tone === 'none' ? '#f0f1f4' : TABLE_CELL_FILLS[cell.tone];
      const anchor = cell.horizontalAlign === 'center' ? 'middle' : cell.horizontalAlign === 'right' ? 'end' : 'start';
      const textX = cell.horizontalAlign === 'center'
        ? columnX + column.width / 2
        : cell.horizontalAlign === 'right'
          ? columnX + column.width - 9
          : columnX + 9;
      const lines = wrapTableCellText(cell.text, column.width, row.height);
      const lineHeight = 14;
      const firstLineY = rowY + (row.height - lines.length * lineHeight) / 2 + 11;
      const text = lines.map((line, lineIndex) => (
        `<tspan x="${textX}" y="${firstLineY + lineIndex * lineHeight}">${xmlEscape(line)}</tspan>`
      )).join('');
      rows.push(`<rect x="${columnX}" y="${rowY}" width="${column.width}" height="${row.height}" fill="${fill}" stroke="#d6d9e0" />
    <text text-anchor="${anchor}" fill="#26272b" font-family="system-ui, sans-serif" font-size="11"${header ? ' font-weight="700"' : ''}>${text}</text>`);
      columnX += column.width;
    });
    rowY += row.height;
  });
  return `<g id="${xmlEscape(id)}" opacity="${data.opacity}">${caption}
    ${rows.join('\n    ')}
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="12" fill="none" stroke="#b7bbc4" /></g>`;
}

function markAttributes(marks: RichTextMark[]) {
  const attributes: string[] = [];
  if (marks.some((mark) => mark.type === 'bold')) attributes.push('font-weight="700"');
  if (marks.some((mark) => mark.type === 'italic')) attributes.push('font-style="italic"');
  const decoration = [
    marks.some((mark) => mark.type === 'underline') ? 'underline' : '',
    marks.some((mark) => mark.type === 'strike') ? 'line-through' : '',
  ].filter(Boolean).join(' ');
  if (decoration) attributes.push(`text-decoration="${decoration}"`);
  return attributes.join(' ');
}

function renderRun(run: TextRun) {
  const attributes = markAttributes(run.marks);
  const span = `<tspan${attributes ? ` ${attributes}` : ''}>${xmlEscape(run.text)}</tspan>`;
  const link = run.marks.find((mark) => mark.type === 'link');
  const href = sanitizeLinkHref(link?.attrs?.href ?? '');
  return href ? `<a href="${xmlEscape(href)}" target="_blank">${span}</a>` : span;
}

function conceptTextPosition(node: EditorNode, x: number, width: number) {
  if (node.data.kind !== 'concept') return { x: x + 17, anchor: 'start' };
  if (node.data.horizontalAlign === 'center') return { x: x + width / 2, anchor: 'middle' };
  if (node.data.horizontalAlign === 'right') return { x: x + width - 17, anchor: 'end' };
  return { x: x + 17, anchor: 'start' };
}

function conceptVerticalOffset(node: EditorNode, width: number, height: number) {
  if (node.data.kind !== 'concept') return 0;
  const remaining = Math.max(0, height - conceptContentHeight(node, width));
  if (node.data.verticalAlign === 'middle') return remaining / 2;
  if (node.data.verticalAlign === 'bottom') return remaining;
  return 0;
}

function renderConceptText(node: EditorNode, x: number, y: number, width: number, height: number, accent: string) {
  if (node.data.kind !== 'concept') return '';
  const titleLines = layoutRichText(node.data.title, width);
  const bodyLines = layoutRichText(node.data.body, width);
  const hasBody = bodyLines.some((line) => line.runs.some((run) => run.text.trim()));
  const verticalOffset = conceptVerticalOffset(node, width, height);
  const textPosition = conceptTextPosition(node, x, width);
  const title = titleLines.map((line, index) => (
    `<text x="${textPosition.x}" y="${y + verticalOffset + 51 + index * 18}" text-anchor="${textPosition.anchor}" fill="${accent}" font-family="system-ui, sans-serif" font-size="15">${line.runs.map(renderRun).join('')}</text>`
  )).join('\n    ');
  if (!hasBody) return title;
  const bodyOffset = Math.max(0, titleLines.length - 1) * 18;
  const body = bodyLines.map((line, index) => {
    const structuralLine = Boolean(line.prefix || line.indent);
    const lineX = structuralLine ? x + 17 + line.indent * 13 : textPosition.x;
    const anchor = structuralLine ? 'start' : textPosition.anchor;
    const prefix = line.prefix ? `<tspan font-weight="650">${xmlEscape(`${line.prefix} `)}</tspan>` : '';
    return `<text x="${lineX}" y="${y + verticalOffset + 72 + bodyOffset + index * 15}" text-anchor="${anchor}" fill="#4f535c" font-family="system-ui, sans-serif" font-size="10">${prefix}${line.runs.map(renderRun).join('')}</text>`;
  }).join('\n    ');
  return `${title}\n    ${body}`;
}

function renderNode(node: EditorNode, offsetX: number, offsetY: number) {
  const x = node.position.x - offsetX;
  const y = node.position.y - offsetY;
  const { width, height } = nodeSize(node);
  const opacity = node.data.opacity;

  if (node.data.kind === 'raster') {
    return `<g id="${xmlEscape(node.id)}" opacity="${opacity}"><image href="${xmlEscape(node.data.src)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="none" /></g>`;
  }

  if (node.data.kind === 'table') {
    return renderTableNode(node.data, node.id, x, y);
  }

  if (node.data.kind === 'vector') {
    const data = node.data as VectorNodeData;
    const [minX, minY, viewWidth, viewHeight] = data.viewBox;
    const sx = width / viewWidth;
    const sy = height / viewHeight;
    const paths = data.paths
      .filter((path) => path.visible)
      .map(
        (path) =>
          `<path id="${xmlEscape(path.id)}" d="${xmlEscape(path.d)}" fill="${xmlEscape(path.fill)}" stroke="${xmlEscape(path.stroke)}" stroke-width="${path.strokeWidth}" opacity="${path.opacity}" />`,
      )
      .join('');
    return `<g id="${xmlEscape(node.id)}" opacity="${opacity}" transform="translate(${x} ${y}) scale(${sx} ${sy}) translate(${-minX} ${-minY})">${paths}</g>`;
  }

  const tone = {
    ink: { fill: '#ffffff', stroke: '#d6d9e0', accent: '#18191d' },
    indigo: { fill: '#f5f4ff', stroke: '#817aff', accent: '#635bff' },
    mint: { fill: '#f0faf5', stroke: '#86cdae', accent: '#238661' },
  }[node.data.tone];
  const textPosition = conceptTextPosition(node, x, width);
  const verticalOffset = conceptVerticalOffset(node, width, height);
  return `<g id="${xmlEscape(node.id)}" opacity="${opacity}">
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="15" fill="${tone.fill}" stroke="${tone.stroke}" />
    <text x="${textPosition.x}" y="${y + verticalOffset + 25}" text-anchor="${textPosition.anchor}" fill="#858891" font-family="system-ui, sans-serif" font-size="9" letter-spacing="1">${xmlEscape(node.data.eyebrow.toUpperCase())}</text>
    ${renderConceptText(node, x, y, width, height, tone.accent)}
  </g>`;
}

function renderEdges(edges: EditorEdge[], nodes: EditorNode[], offsetX: number, offsetY: number) {
  return edges
    .map((edge) => {
      const source = nodes.find((node) => node.id === edge.source);
      const target = nodes.find((node) => node.id === edge.target);
      if (!source || !target || source.hidden || target.hidden) return '';
      const sourceSize = nodeSize(source);
      const targetSize = nodeSize(target);
      const vertical = edge.sourceHandle === 'bottom' && edge.targetHandle === 'top';
      const x1 = source.position.x - offsetX + (vertical ? sourceSize.width / 2 : sourceSize.width);
      const y1 = source.position.y - offsetY + (vertical ? sourceSize.height : sourceSize.height / 2);
      const x2 = target.position.x - offsetX + (vertical ? targetSize.width / 2 : 0);
      const y2 = target.position.y - offsetY + (vertical ? 0 : targetSize.height / 2);
      const middleX = (x1 + x2) / 2;
      const middleY = (y1 + y2) / 2;
      const kind = edge.data?.kind ?? 'default';
      const stroke = kind === 'emphasis' ? '#635bff' : '#a9adb7';
      const strokeWidth = kind === 'emphasis' ? 2.5 : 1.5;
      const dash = kind === 'dashed' ? ' stroke-dasharray="6 5"' : '';
      const label = edge.data?.label?.trim()
        ? `<text x="${middleX}" y="${middleY - 7}" text-anchor="middle" fill="#656973" font-family="system-ui, sans-serif" font-size="9"><tspan stroke="white" stroke-width="4" paint-order="stroke">${xmlEscape(edge.data.label)}</tspan></text>`
        : '';
      const path = vertical
        ? `M ${x1} ${y1} C ${x1} ${middleY}, ${x2} ${middleY}, ${x2} ${y2}`
        : `M ${x1} ${y1} C ${middleX} ${y1}, ${middleX} ${y2}, ${x2} ${y2}`;
      return `<g><path d="${path}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"${dash} marker-end="url(#arrow)" />${label}</g>`;
    })
    .join('');
}

export function buildSvgDocument(nodes: EditorNode[], edges: EditorEdge[]): string {
  const visibleNodes = nodes.filter((node) => !node.hidden);
  if (visibleNodes.length === 0) throw new Error('There is nothing visible to export.');

  const padding = 48;
  const minX = Math.min(...visibleNodes.map((node) => node.position.x)) - padding;
  const minY = Math.min(...visibleNodes.map((node) => node.position.y)) - padding;
  const maxX = Math.max(...visibleNodes.map((node) => node.position.x + nodeSize(node).width)) + padding;
  const maxY = Math.max(...visibleNodes.map((node) => node.position.y + nodeSize(node).height)) + padding;
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">SynapTable editable diagram</title>
  <desc id="desc">An editable SVG exported from SynapTable.</desc>
  <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#a9adb7" /></marker></defs>
  ${renderEdges(edges, visibleNodes, minX, minY)}
  ${visibleNodes.map((node) => renderNode(node, minX, minY)).join('\n  ')}
</svg>`;
}

export function downloadSvg(svg: string, fileName: string) {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.svg') ? fileName : `${fileName}.svg`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
