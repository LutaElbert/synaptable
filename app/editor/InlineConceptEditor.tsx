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
import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { sanitizeLinkHref } from './rich-text';
import type { RichTextDocument } from './types';

type InlineConceptEditorProps = {
  title: string;
  body: RichTextDocument;
  onTitleChange: (title: string) => void;
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
  const titleRef = useRef<HTMLInputElement>(null);
  const [linkEditorOpen, setLinkEditorOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const editor = useEditor({
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
    onUpdate: ({ editor: current }) => onBodyChange(current.getJSON() as RichTextDocument),
  }, []);

  const formatState = useEditorState({
    editor,
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

  useEffect(() => {
    titleRef.current?.focus();
    titleRef.current?.select();
  }, []);

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    window.setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) onCommit();
    }, 0);
  };

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
    if (!editor) return;
    setLinkValue(editor.getAttributes('link').href ?? 'https://');
    setLinkEditorOpen(true);
  };

  const applyLink = () => {
    if (!editor) return;
    const href = sanitizeLinkHref(linkValue);
    if (!href) return;
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    setLinkEditorOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className="inline-concept-editor nodrag nowheel"
      onBlurCapture={handleBlur}
      onKeyDownCapture={handleKeyDown}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <div className="formatting-bar" aria-label="Text formatting" onMouseDown={keepSelection}>
        <FormatButton label="Bold" toggle active={formatState?.bold} onPress={() => editor?.chain().focus().toggleBold().run()}><Bold size={14} /></FormatButton>
        <FormatButton label="Italic" toggle active={formatState?.italic} onPress={() => editor?.chain().focus().toggleItalic().run()}><Italic size={14} /></FormatButton>
        <FormatButton label="Underline" toggle active={formatState?.underline} onPress={() => editor?.chain().focus().toggleUnderline().run()}><UnderlineIcon size={14} /></FormatButton>
        <FormatButton label="Strikethrough" toggle active={formatState?.strike} onPress={() => editor?.chain().focus().toggleStrike().run()}><Strikethrough size={14} /></FormatButton>
        <span className="formatting-divider" aria-hidden="true" />
        <FormatButton label="Bulleted list" toggle active={formatState?.bulletList} onPress={() => editor?.chain().focus().toggleBulletList().run()}><List size={14} /></FormatButton>
        <FormatButton label="Numbered list" toggle active={formatState?.orderedList} onPress={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered size={14} /></FormatButton>
        <FormatButton label="Checklist" toggle active={formatState?.taskList} onPress={() => editor?.chain().focus().toggleTaskList().run()}><ListChecks size={14} /></FormatButton>
        <span className="formatting-divider" aria-hidden="true" />
        <FormatButton label="Add or edit link" toggle active={formatState?.link} onPress={openLinkEditor}><Link2 size={14} /></FormatButton>
        <FormatButton label="Remove link" disabled={!formatState?.link} onPress={() => editor?.chain().focus().unsetLink().run()}><Unlink size={14} /></FormatButton>
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
          <button type="button" onClick={() => setLinkEditorOpen(false)}>Cancel</button>
        </form>
      ) : null}
      <input
        ref={titleRef}
        className="concept-title-editor"
        aria-label="Concept title"
        value={title}
        maxLength={500}
        onChange={(event) => onTitleChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            editor?.commands.focus('start');
          }
        }}
      />
      <EditorContent editor={editor} />
      <span className="editing-hint">⌘/Ctrl + Enter to finish · Esc to cancel</span>
    </div>
  );
}
