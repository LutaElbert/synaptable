'use client';

import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Check,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Strikethrough,
  Underline as UnderlineIcon,
  Unlink,
  X,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { sanitizeLinkHref } from './rich-text';
import type { RichTextDocument } from './types';

type InlineConceptEditorProps = {
  title: RichTextDocument;
  body: RichTextDocument;
  onTitleChange: (title: RichTextDocument) => void;
  onBodyChange: (body: RichTextDocument) => void;
  onCommit: () => void;
  onCancel: () => void;
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

export default function InlineConceptEditor({
  title,
  body,
  onTitleChange,
  onBodyChange,
  onCommit,
  onCancel,
}: InlineConceptEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const didFocusTitleRef = useRef(false);
  const [activeField, setActiveField] = useState<'title' | 'body'>('title');
  const [linkEditorOpen, setLinkEditorOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const bodyEditor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        blockquote: false,
        code: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
        link: { openOnClick: false, autolink: true, linkOnPaste: true },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: body,
    editorProps: {
      attributes: {
        class: 'concept-body-editor nodrag nowheel',
        'aria-label': 'Concept body',
      },
    },
    onFocus: () => setActiveField('body'),
    onUpdate: ({ editor: current }) => onBodyChange(current.getJSON() as RichTextDocument),
  }, []);

  const titleEditor = useEditor({
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
        link: { openOnClick: false, autolink: true, linkOnPaste: true },
      }),
    ],
    content: title,
    editorProps: {
      attributes: {
        class: 'concept-title-editor nodrag nowheel',
        'aria-label': 'Concept title',
      },
      handleKeyDown: (_view, event) => {
        if (event.key !== 'Enter') return false;
        event.preventDefault();
        bodyEditor?.commands.focus('start');
        return true;
      },
      handleTextInput: (view, from, to, text) => {
        const nextLength = view.state.doc.textContent.length - (to - from) + text.length;
        return nextLength > 500;
      },
      handlePaste: (view, event) => {
        const pasted = event.clipboardData?.getData('text/plain');
        if (pasted === undefined) return false;
        const singleLine = pasted.replace(/\s*\r?\n+\s*/g, ' ');
        const { from, to } = view.state.selection;
        const remaining = Math.max(0, 500 - (view.state.doc.textContent.length - (to - from)));
        view.dispatch(view.state.tr.insertText(singleLine.slice(0, remaining), from, to));
        return true;
      },
    },
    onFocus: () => setActiveField('title'),
    onUpdate: ({ editor: current }) => onTitleChange(current.getJSON() as RichTextDocument),
  }, []);

  const activeEditor = activeField === 'title' ? titleEditor : bodyEditor;

  const formatState = useEditorState({
    editor: activeEditor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive('bold') ?? false,
      italic: current?.isActive('italic') ?? false,
      underline: current?.isActive('underline') ?? false,
      strike: current?.isActive('strike') ?? false,
      bulletList: current?.isActive('bulletList') ?? false,
      orderedList: current?.isActive('orderedList') ?? false,
      taskList: current?.isActive('taskList') ?? false,
      link: current?.isActive('link') ?? false,
    }),
  });

  useLayoutEffect(() => {
    if (!titleEditor || didFocusTitleRef.current) return;
    didFocusTitleRef.current = true;
    // Tiptap initializes the title and body independently. On slower engines,
    // the title may become ready after the user has already entered the body.
    // Never let the one-time title autofocus steal an established body focus.
    if (bodyEditor?.isFocused) return;
    titleEditor.chain().focus().selectAll().run();
  }, [bodyEditor, titleEditor]);

  useEffect(() => {
    const commitOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !containerRef.current?.contains(target)) onCommit();
    };
    document.addEventListener('pointerdown', commitOnOutsidePointer, true);
    return () => document.removeEventListener('pointerdown', commitOnOutsidePointer, true);
  }, [onCommit]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      onCommit();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      event.stopPropagation();
      openLinkEditor();
    }
  };

  const keepSelection = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) event.preventDefault();
  };

  const openLinkEditor = () => {
    if (!activeEditor) return;
    setLinkValue(activeEditor.getAttributes('link').href ?? 'https://');
    setLinkEditorOpen(true);
  };

  const closeLinkEditor = () => {
    setLinkEditorOpen(false);
    window.requestAnimationFrame(() => {
      activeEditor?.commands.focus();
    });
  };

  const applyLink = () => {
    if (!activeEditor) return;
    const href = sanitizeLinkHref(linkValue);
    if (!href) return;
    activeEditor.chain().extendMarkRange('link').setLink({ href }).run();
    closeLinkEditor();
  };

  return (
    <div
      ref={containerRef}
      className="inline-concept-editor nodrag nowheel"
      onKeyDownCapture={handleKeyDown}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <div className="formatting-bar" aria-label={`Text formatting for ${activeField}`} onMouseDown={keepSelection}>
        <span className="formatting-context" aria-live="polite">{activeField === 'title' ? 'Title' : 'Body'}</span>
        <FormatButton label="Bold" toggle active={formatState?.bold} onPress={() => activeEditor?.chain().focus().toggleBold().run()}><Bold size={14} /></FormatButton>
        <FormatButton label="Italic" toggle active={formatState?.italic} onPress={() => activeEditor?.chain().focus().toggleItalic().run()}><Italic size={14} /></FormatButton>
        <FormatButton label="Underline" toggle active={formatState?.underline} onPress={() => activeEditor?.chain().focus().toggleUnderline().run()}><UnderlineIcon size={14} /></FormatButton>
        <FormatButton label="Strikethrough" toggle active={formatState?.strike} onPress={() => activeEditor?.chain().focus().toggleStrike().run()}><Strikethrough size={14} /></FormatButton>
        <span className="formatting-divider" aria-hidden="true" />
        <FormatButton label="Bulleted list" toggle disabled={activeField === 'title'} active={formatState?.bulletList} onPress={() => bodyEditor?.chain().focus().toggleBulletList().run()}><List size={14} /></FormatButton>
        <FormatButton label="Numbered list" toggle disabled={activeField === 'title'} active={formatState?.orderedList} onPress={() => bodyEditor?.chain().focus().toggleOrderedList().run()}><ListOrdered size={14} /></FormatButton>
        <FormatButton label="Checklist" toggle disabled={activeField === 'title'} active={formatState?.taskList} onPress={() => bodyEditor?.chain().focus().toggleTaskList().run()}><ListChecks size={14} /></FormatButton>
        <span className="formatting-divider" aria-hidden="true" />
        <FormatButton label="Add or edit link" toggle active={formatState?.link} onPress={openLinkEditor}><Link2 size={14} /></FormatButton>
        <FormatButton label="Remove link" disabled={!formatState?.link} onPress={() => activeEditor?.chain().focus().unsetLink().run()}><Unlink size={14} /></FormatButton>
        <FormatButton label="Finish editing" onPress={onCommit}><Check size={14} /></FormatButton>
        <FormatButton label="Cancel editing" onPress={onCancel}><X size={14} /></FormatButton>
      </div>
      {linkEditorOpen ? (
        <form className="link-editor" onSubmit={(event) => { event.preventDefault(); applyLink(); }}>
          <label htmlFor="concept-link-url">Link URL</label>
          <input
            id="concept-link-url"
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
      <EditorContent editor={titleEditor} />
      <EditorContent editor={bodyEditor} />
      <span className="editing-hint">⌘/Ctrl + Enter to finish · Esc to cancel</span>
    </div>
  );
}
