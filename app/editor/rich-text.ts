import type { RichTextDocument, RichTextNode } from './types';

export const EMPTY_RICH_TEXT: RichTextDocument = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

export function emptyRichText(): RichTextDocument {
  return structuredClone(EMPTY_RICH_TEXT);
}

export function richTextFromPlainText(value: string): RichTextDocument {
  const lines = value.split(/\r?\n/);
  return {
    type: 'doc',
    content: lines.map((line) => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line }] : undefined,
    })),
  };
}

function plainTextForNode(node: RichTextNode, depth = 0): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return '\n';
  const children = node.content ?? [];
  if (node.type === 'doc' || node.type === 'listItem' || node.type === 'taskItem') {
    return children.map((child) => plainTextForNode(child, depth)).filter(Boolean).join('\n');
  }
  if (node.type === 'bulletList' || node.type === 'orderedList' || node.type === 'taskList') {
    return children
      .map((child, index) => {
        const prefix = node.type === 'orderedList'
          ? `${Number(node.attrs?.start ?? 1) + index}. `
          : node.type === 'taskList'
            ? `${child.attrs?.checked ? '[x]' : '[ ]'} `
            : '• ';
        return `${'  '.repeat(depth)}${prefix}${plainTextForNode(child, depth + 1)}`;
      })
      .join('\n');
  }
  const value = children.map((child) => plainTextForNode(child, depth)).join('');
  return value;
}

export function richTextToPlainText(document: RichTextDocument): string {
  return plainTextForNode(document).replace(/\n+$/, '');
}

export function richTextIsEmpty(document: RichTextDocument): boolean {
  return richTextToPlainText(document).trim().length === 0;
}

export function sanitizeLinkHref(value: string): string | null {
  const href = value.trim();
  if (!href) return null;
  try {
    const url = new URL(href);
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:'
      ? url.href
      : null;
  } catch {
    return null;
  }
}
