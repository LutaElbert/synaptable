import { Fragment, type ReactNode } from 'react';
import { sanitizeLinkHref } from './rich-text';
import type { RichTextDocument, RichTextMark, RichTextNode } from './types';

function applyMarks(content: ReactNode, marks: RichTextMark[] | undefined, key: string): ReactNode {
  return (marks ?? []).reduce<ReactNode>((current, mark, index) => {
    const markKey = `${key}-mark-${index}`;
    if (mark.type === 'bold') return <strong key={markKey}>{current}</strong>;
    if (mark.type === 'italic') return <em key={markKey}>{current}</em>;
    if (mark.type === 'underline') return <u key={markKey}>{current}</u>;
    if (mark.type === 'strike') return <s key={markKey}>{current}</s>;
    if (mark.type === 'link') {
      const href = sanitizeLinkHref(mark.attrs?.href ?? '');
      return href ? <a key={markKey} href={href} target="_blank" rel="noopener noreferrer">{current}</a> : current;
    }
    return current;
  }, content);
}

function renderNode(node: RichTextNode, key: string): ReactNode {
  if (node.type === 'text') return applyMarks(node.text ?? '', node.marks, key);
  if (node.type === 'hardBreak') return <br key={key} />;
  const children = (node.content ?? []).map((child, index) => renderNode(child, `${key}-${index}`));
  if (node.type === 'paragraph') return <p key={key}>{children.length ? children : <br />}</p>;
  if (node.type === 'bulletList') return <ul key={key}>{children}</ul>;
  if (node.type === 'orderedList') return <ol key={key} start={node.attrs?.start}>{children}</ol>;
  if (node.type === 'listItem') return <li key={key}>{children}</li>;
  if (node.type === 'taskList') return <ul key={key} className="concept-task-list">{children}</ul>;
  if (node.type === 'taskItem') {
    return (
      <li key={key} className="concept-task-item">
        <span className="concept-checkbox" aria-hidden="true">{node.attrs?.checked ? '✓' : ''}</span>
        <div>{children}</div>
      </li>
    );
  }
  return <Fragment key={key}>{children}</Fragment>;
}

export function RichTextView({
  document,
  className = 'concept-rich-text',
}: {
  document: RichTextDocument;
  className?: string;
}) {
  return <div className={className}>{renderNode(document, 'doc')}</div>;
}
