import type { EditorEdge, EditorNode, VectorNodeData } from './types';

const xmlEscape = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

function nodeSize(node: EditorNode) {
  const style = node.style ?? {};
  return {
    width: Number(style.width) || (node.data.kind === 'concept' ? 188 : 320),
    height: Number(style.height) || (node.data.kind === 'concept' ? 78 : 240),
  };
}

function renderNode(node: EditorNode, offsetX: number, offsetY: number) {
  const x = node.position.x - offsetX;
  const y = node.position.y - offsetY;
  const { width, height } = nodeSize(node);
  const opacity = node.data.opacity;

  if (node.data.kind === 'raster') {
    return `<g id="${xmlEscape(node.id)}" opacity="${opacity}"><image href="${xmlEscape(node.data.src)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="none" /></g>`;
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
  return `<g id="${xmlEscape(node.id)}" opacity="${opacity}">
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="15" fill="${tone.fill}" stroke="${tone.stroke}" />
    <text x="${x + 17}" y="${y + 25}" fill="#858891" font-family="system-ui, sans-serif" font-size="9" letter-spacing="1">${xmlEscape(node.data.eyebrow.toUpperCase())}</text>
    <text x="${x + 17}" y="${y + 51}" fill="${tone.accent}" font-family="system-ui, sans-serif" font-size="15" font-weight="650">${xmlEscape(node.data.label)}</text>
  </g>`;
}

function renderEdges(
  edges: EditorEdge[],
  nodes: EditorNode[],
  offsetX: number,
  offsetY: number,
) {
  return edges
    .map((edge) => {
      const source = nodes.find((node) => node.id === edge.source);
      const target = nodes.find((node) => node.id === edge.target);
      if (!source || !target || source.hidden || target.hidden) return '';
      const sourceSize = nodeSize(source);
      const targetSize = nodeSize(target);
      const x1 = source.position.x - offsetX + sourceSize.width;
      const y1 = source.position.y - offsetY + sourceSize.height / 2;
      const x2 = target.position.x - offsetX;
      const y2 = target.position.y - offsetY + targetSize.height / 2;
      return `<path d="M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}" fill="none" stroke="#a9adb7" stroke-width="1.5" marker-end="url(#arrow)" />`;
    })
    .join('');
}

export function buildSvgDocument(nodes: EditorNode[], edges: EditorEdge[]): string {
  const visibleNodes = nodes.filter((node) => !node.hidden);
  if (visibleNodes.length === 0) throw new Error('There is nothing visible to export.');

  const padding = 48;
  const minX = Math.min(...visibleNodes.map((node) => node.position.x)) - padding;
  const minY = Math.min(...visibleNodes.map((node) => node.position.y)) - padding;
  const maxX = Math.max(
    ...visibleNodes.map((node) => node.position.x + nodeSize(node).width),
  ) + padding;
  const maxY = Math.max(
    ...visibleNodes.map((node) => node.position.y + nodeSize(node).height),
  ) + padding;
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
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
  URL.revokeObjectURL(url);
}
