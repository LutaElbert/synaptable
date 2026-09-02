import Editor from './editor/Editor';
import ErrorBoundary from './editor/ErrorBoundary';
import { isWebMcpFeatureEnabled } from './editor/webmcp/webmcp-feature';

export default function Home() {
  const webMcpEnabled = isWebMcpFeatureEnabled(process.env.SYNAPTABLE_WEBMCP_ENABLED);

  return (
    <ErrorBoundary>
      <Editor webMcpEnabled={webMcpEnabled} />
    </ErrorBoundary>
  );
}
