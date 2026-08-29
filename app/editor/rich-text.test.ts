import { describe, expect, it } from 'vitest';
import { richTextFromPlainText, richTextIsEmpty, richTextToPlainText, sanitizeLinkHref } from './rich-text';
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

  it('allows safe links and rejects executable or data URLs', () => {
    expect(sanitizeLinkHref('https://example.com/path')).toBe('https://example.com/path');
    expect(sanitizeLinkHref('mailto:hello@example.com')).toBe('mailto:hello@example.com');
    expect(sanitizeLinkHref('javascript:alert(1)')).toBeNull();
    expect(sanitizeLinkHref('data:text/html,unsafe')).toBeNull();
  });
});
