'use client';

import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { NodeToolbar, Position } from '@xyflow/react';
import {
  Bold,
  Check,
  Italic,
  Link2,
  Strikethrough,
  Underline as UnderlineIcon,
  Unlink,
  X,
} from 'lucide-react';
import { useEffect, useState, type MouseEvent } from 'react';
import { richTextFromPlainText, sanitizeLinkHref } from './rich-text';
import {
  TABLE_MAX_CELL_TEXT,
  clipboardGrid,
  type ClipboardGrid,
} from './table-grid';
import type { RichTextDocument } from './types';

type InlineTableCellEditorProps = {
  ariaLabel: string;
  content: RichTextDocument;
  onChange: (content: RichTextDocument) => void;
  onCommit: () => void;
  onCancel: () => void;
  onNavigate: (direction: 'next' | 'previous') => void;
  onPasteGrid: (grid: ClipboardGrid) => void;
  selectAllOnFocus?: boolean;
};

type FormatButtonProps = {
  label: string;
  active?: boolean;
  toggle?: boolean;
  disabled?: boolean;
  onPress: () => void;
  children: React.ReactNode;
};

function FormatButton({ label, active = false, toggle = false, disabled = false, onPress, children }: FormatButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={toggle ? active : undefined}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPress}
    >
      {children}
    </button>
  );
}

export default function InlineTableCellEditor({
  ariaLabel,
  content,
  onChange,
  onCommit,
  onCancel,
  onNavigate,
  onPasteGrid,
  selectAllOnFocus = false,
}: InlineTableCellEditorProps) {
  const [linkEditorOpen, setLinkEditorOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        blockquote: false,
        bulletList: false,
        code: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
        listItem: false,
        orderedList: false,
        link: {
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
          isAllowedUri: (url) => Boolean(sanitizeLinkHref(url)),
        },
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class: 'table-cell-editor nodrag nowheel',
        role: 'textbox',
        'aria-label': ariaLabel,
        'aria-multiline': 'true',
        dir: 'auto',
        maxlength: String(TABLE_MAX_CELL_TEXT),
      },
      handleKeyDown: (_view, event) => {
        event.stopPropagation();
        if (event.key === 'Escape') {
          event.preventDefault();
          onCancel();
          return true;
        }
        if (event.key === 'Tab') {
          event.preventDefault();
          onCommit();
          onNavigate(event.shiftKey ? 'previous' : 'next');
          return true;
        }
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          onCommit();
          return true;
        }
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
          event.preventDefault();
          setLinkValue(editor?.getAttributes('link').href ?? 'https://');
          setLinkEditorOpen(true);
          return true;
        }
        return false;
      },
      handleTextInput: (view, from, to, text) => (
        view.state.doc.textContent.length - (to - from) + text.length > TABLE_MAX_CELL_TEXT
      ),
      handlePaste: (view, event) => {
        const html = event.clipboardData?.getData('text/html') ?? '';
        const text = event.clipboardData?.getData('text/plain') ?? '';
        const grid = clipboardGrid(html, text);
        if (grid.length > 1 || grid.some((row) => row.length > 1)) {
          event.preventDefault();
          onPasteGrid(grid);
          return true;
        }
        const { from, to } = view.state.selection;
        const remaining = Math.max(0, TABLE_MAX_CELL_TEXT - (view.state.doc.textContent.length - (to - from)));
        if (text.length <= remaining) return false;
        event.preventDefault();
        view.dispatch(view.state.tr.insertText(text.slice(0, remaining), from, to));
        return true;
      },
    },
    onCreate: ({ editor: current }) => {
      const chain = current.chain().focus('end');
      if (selectAllOnFocus) chain.selectAll();
      chain.run();
    },
    onUpdate: ({ editor: current }) => {
      const plainText = current.getText({ blockSeparator: '\n' });
      if (plainText.length > TABLE_MAX_CELL_TEXT) {
        current.commands.setContent(richTextFromPlainText(plainText.slice(0, TABLE_MAX_CELL_TEXT)));
        return;
      }
      onChange(current.getJSON() as RichTextDocument);
    },
  }, [selectAllOnFocus]);

  const formatState = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive('bold') ?? false,
      italic: current?.isActive('italic') ?? false,
      underline: current?.isActive('underline') ?? false,
      strike: current?.isActive('strike') ?? false,
      link: current?.isActive('link') ?? false,
    }),
  });

  useEffect(() => {
    const commitOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(
        '.table-cell-editor, .table-formatting-shell, .table-link-editor, [role="toolbar"][aria-label="Cell text formatting"]',
      )) return;
      onCommit();
    };
    document.addEventListener('pointerdown', commitOnOutsidePointer, true);
    return () => document.removeEventListener('pointerdown', commitOnOutsidePointer, true);
  }, [onCommit]);

  const keepSelection = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) event.preventDefault();
  };

  const openLinkEditor = () => {
    if (!editor) return;
    setLinkValue(editor.getAttributes('link').href ?? 'https://');
    setLinkEditorOpen(true);
  };

  const closeLinkEditor = () => {
    setLinkEditorOpen(false);
    window.requestAnimationFrame(() => editor?.commands.focus());
  };

  const applyLink = () => {
    const href = sanitizeLinkHref(linkValue);
    if (!editor || !href) return;
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    closeLinkEditor();
  };

  return (
    <>
      <NodeToolbar isVisible position={Position.Top} offset={10} className="nodrag nowheel">
        <div
          className="table-formatting-shell nodrag nowheel"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          {linkEditorOpen ? (
            <form
              className="table-link-editor"
              onSubmit={(event) => { event.preventDefault(); applyLink(); }}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key !== 'Escape') return;
                event.preventDefault();
                closeLinkEditor();
              }}
              onCopy={(event) => event.stopPropagation()}
              onCut={(event) => event.stopPropagation()}
              onPaste={(event) => event.stopPropagation()}
            >
              <label htmlFor="table-cell-link-url">Link URL</label>
              <input
                id="table-cell-link-url"
                type="url"
                value={linkValue}
                autoFocus
                placeholder="https://example.com"
                onChange={(event) => setLinkValue(event.target.value)}
              />
              <button type="submit" disabled={!sanitizeLinkHref(linkValue)}>Apply</button>
              <button type="button" onClick={closeLinkEditor}>Cancel</button>
            </form>
          ) : null}
          <div className="table-formatting-bar" role="toolbar" aria-label="Cell text formatting" onMouseDown={keepSelection}>
            <FormatButton label="Bold" toggle active={formatState?.bold} onPress={() => editor?.chain().focus().toggleBold().run()}><Bold size={17} aria-hidden="true" /></FormatButton>
            <FormatButton label="Italic" toggle active={formatState?.italic} onPress={() => editor?.chain().focus().toggleItalic().run()}><Italic size={17} aria-hidden="true" /></FormatButton>
            <FormatButton label="Underline" toggle active={formatState?.underline} onPress={() => editor?.chain().focus().toggleUnderline().run()}><UnderlineIcon size={17} aria-hidden="true" /></FormatButton>
            <FormatButton label="Strikethrough" toggle active={formatState?.strike} onPress={() => editor?.chain().focus().toggleStrike().run()}><Strikethrough size={17} aria-hidden="true" /></FormatButton>
            <span className="formatting-divider" aria-hidden="true" />
            <FormatButton label="Add or edit link" toggle active={formatState?.link} onPress={openLinkEditor}><Link2 size={17} aria-hidden="true" /></FormatButton>
            <FormatButton label="Remove link" disabled={!formatState?.link} onPress={() => editor?.chain().focus().unsetLink().run()}><Unlink size={17} aria-hidden="true" /></FormatButton>
            <span className="formatting-divider" aria-hidden="true" />
            <FormatButton label="Finish editing" onPress={onCommit}><Check size={17} aria-hidden="true" /></FormatButton>
            <FormatButton label="Cancel editing" onPress={onCancel}><X size={17} aria-hidden="true" /></FormatButton>
          </div>
        </div>
      </NodeToolbar>
      <EditorContent editor={editor} className="table-cell-editor-container" />
    </>
  );
}
