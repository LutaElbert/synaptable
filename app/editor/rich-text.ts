import type { RichTextDocument, RichTextMark, RichTextNode } from './types';

export const EMPTY_RICH_TEXT: RichTextDocument = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

export function emptyRichText(): RichTextDocument {
  return structuredClone(EMPTY_RICH_TEXT);
}

export function richTextFromPlainText(value: string, marks?: RichTextMark[]): RichTextDocument {
  const lines = value.split(/\r?\n/);
  return {
    type: 'doc',
    content: lines.map((line) => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line, marks: marks?.length ? structuredClone(marks) : undefined }] : undefined,
    })),
  };
}

export function conceptTitleFromPlainText(value: string): RichTextDocument {
  return richTextFromPlainText(value, [{ type: 'bold' }]);
}

export function replaceRichTextPlainText(
  document: RichTextDocument,
  value: string,
): RichTextDocument {
  const findMarks = (node: RichTextNode): RichTextMark[] | undefined => {
    if (node.type === 'text') return node.marks;
    for (const child of node.content ?? []) {
      const marks = findMarks(child);
      if (marks) return marks;
    }
    return undefined;
  };
  return richTextFromPlainText(value, findMarks(document));
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
