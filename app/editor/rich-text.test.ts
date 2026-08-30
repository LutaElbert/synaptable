import { describe, expect, it } from 'vitest';
import {
  conceptTitleFromPlainText,
  normalizeRichTextDocument,
  replaceRichTextPlainText,
  richTextFromPlainText,
  richTextIsEmpty,
  richTextToPlainText,
  sanitizeLinkHref,
} from './rich-text';
import type { RichTextDocument } from './types';

describe('rich text utilities', () => {
  it('converts plain multiline text without losing line boundaries', () => {
    const document = richTextFromPlainText('First line\nSecond line');
    expect(richTextToPlainText(document)).toBe('First line\nSecond line');
    expect(richTextIsEmpty(document)).toBe(false);
  });

  it('creates readable text for lists and checklists', () => {
    const document: RichTextDocument = {
      type: 'doc',
      content: [
        { type: 'bulletList', content: [{
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Idea' }] }],
        }] },
        { type: 'taskList', content: [{
          type: 'taskItem',
          attrs: { checked: true },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Done' }] }],
        }] },
      ],
    };
    expect(richTextToPlainText(document)).toContain('• Idea');
    expect(richTextToPlainText(document)).toContain('[x] Done');
  });

  it('removes trailing empty list rows without changing meaningful or nested content', () => {
    const document: RichTextDocument = {
      type: 'doc',
      content: [{
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { checked: true },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Keep me' }] }],
          },
          {
            type: 'taskItem',
            attrs: { checked: false },
            content: [
              { type: 'paragraph' },
              {
                type: 'bulletList',
                content: [{
                  type: 'listItem',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nested detail' }] }],
                }],
              },
            ],
          },
          {
            type: 'taskItem',
            attrs: { checked: false },
            content: [{ type: 'paragraph' }],
          },
          {
            type: 'taskItem',
            attrs: { checked: false },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: '   ' }] }],
          },
        ],
      }],
    };

    const normalized = normalizeRichTextDocument(document);
    expect(normalized.content?.[0].content).toHaveLength(2);
    expect(richTextToPlainText(normalized)).toContain('Nested detail');
    expect(document.content?.[0].content).toHaveLength(4);
  });

  it('turns a document containing only empty list rows into an empty paragraph', () => {
    const document: RichTextDocument = {
      type: 'doc',
      content: [{
        type: 'taskList',
        content: [{
          type: 'taskItem',
          attrs: { checked: false },
          content: [{ type: 'paragraph' }],
        }],
      }],
    };

    expect(normalizeRichTextDocument(document)).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph' }],
    });
    expect(richTextIsEmpty(document)).toBe(true);
  });

  it('creates bold concept titles and preserves their leading marks during plain replacement', () => {
    const title = conceptTitleFromPlainText('Original');
    const replaced = replaceRichTextPlainText(title, 'Replacement');
    expect(richTextToPlainText(replaced)).toBe('Replacement');
    expect(replaced.content?.[0].content?.[0].marks).toEqual([{ type: 'bold' }]);
  });

  it('allows safe links and rejects executable or data URLs', () => {
    expect(sanitizeLinkHref('https://example.com/path')).toBe('https://example.com/path');
    expect(sanitizeLinkHref('mailto:hello@example.com')).toBe('mailto:hello@example.com');
    expect(sanitizeLinkHref('javascript:alert(1)')).toBeNull();
    expect(sanitizeLinkHref('data:text/html,unsafe')).toBeNull();
  });
});
