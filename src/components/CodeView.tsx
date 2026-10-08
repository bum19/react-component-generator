import { useState, useEffect, useRef } from 'react';

interface CodeViewProps {
  code: string;
  isStreaming?: boolean;
}

export function CodeView({ code, isStreaming = false }: CodeViewProps) {
  const [copied, setCopied] = useState(false);
  const codeBlock = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (isStreaming && codeBlock.current) codeBlock.current.scrollTop = codeBlock.current.scrollHeight;
  }, [code, isStreaming]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-panel">
      <div className="panel-header">
        <h3>코드</h3>
        <button className="btn-copy" onClick={handleCopy} disabled={isStreaming}>
          {copied ? '복사됨!' : '복사'}
        </button>
      </div>
      <pre ref={codeBlock} className={`code-block${isStreaming ? ' code-block--streaming' : ''}`}>
        <code>{code || (isStreaming ? '첫 코드를 기다리고 있습니다...' : '')}</code>
      </pre>
    </div>
  );
}
