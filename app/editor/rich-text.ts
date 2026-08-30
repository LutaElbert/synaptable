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

function richTextNodeHasContent(node: RichTextNode): boolean {
  if (node.type === 'text') return Boolean(node.text?.trim());
  if (node.type === 'hardBreak') return false;
  return (node.content ?? []).some(richTextNodeHasContent);
}

function normalizeRichTextNode(node: RichTextNode): RichTextNode | null {
  const content = node.content
    ?.map(normalizeRichTextNode)
    .filter((child): child is RichTextNode => child !== null);

  if (node.type === 'bulletList' || node.type === 'orderedList' || node.type === 'taskList') {
    const items = [...(content ?? [])];
    while (items.length && !richTextNodeHasContent(items.at(-1)!)) items.pop();
    if (!items.length) return null;
    return { ...node, content: items };
  }

  return content === undefined ? { ...node } : { ...node, content };
}

/**
 * Removes list rows that have no user-visible content at the end of a list.
 * Editors need a temporary empty row while typing, so call this at document
 * boundaries such as commit, load, display, and export rather than on update.
 */
export function normalizeRichTextDocument(document: RichTextDocument): RichTextDocument {
  const normalized = normalizeRichTextNode(document);
  if (!normalized || normalized.type !== 'doc' || !normalized.content?.length) return emptyRichText();
  return normalized as RichTextDocument;
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
        const childText = plainTextForNode(child, depth + 1);
        if (!childText.trim()) return '';
        const prefix = node.type === 'orderedList'
          ? `${Number(node.attrs?.start ?? 1) + index}. `
          : node.type === 'taskList'
            ? `${child.attrs?.checked ? '[x]' : '[ ]'} `
            : '• ';
        return `${'  '.repeat(depth)}${prefix}${childText}`;
      })
      .filter(Boolean)
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
