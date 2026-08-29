import Editor from './editor/Editor';
import ErrorBoundary from './editor/ErrorBoundary';

export default function Home() {
  return (
    <ErrorBoundary>
      <Editor />
    </ErrorBoundary>
  );
}
