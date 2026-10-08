import { useState } from 'react';
import type { GeneratedComponent } from '../types';
import { LivePreview } from './LivePreview';
import { CodeView } from './CodeView';

interface ComponentCardProps {
  component: GeneratedComponent;
  onRemove: (id: string) => void;
  onRegenerate: (prompt: string) => void;
  isLoading: boolean;
  isGenerating?: boolean;
}

type Tab = 'preview' | 'code';

export function ComponentCard({ component, onRemove, onRegenerate, isLoading, isGenerating = false }: ComponentCardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('preview');
  const displayedTab = isGenerating ? 'code' : activeTab;
  const [previewKey, setPreviewKey] = useState(0);
  const createdAt = component.createdAt.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="component-card">
      <div className="card-header">
        <div className="card-title-group">
          <span>{createdAt}</span>
          <p className="card-prompt">{component.prompt}</p>
        </div>
        <div className="card-actions">
          <button
            className="btn-refresh"
            onClick={() => setPreviewKey((k) => k + 1)}
            title="미리보기 새로고침"
            aria-label="미리보기 새로고침"
            disabled={isGenerating}
          >
            ↻
          </button>
          <button
            className="btn-regenerate"
            onClick={() => onRegenerate(component.prompt)}
            disabled={isLoading}
          >
            {isLoading ? '생성 중...' : '재생성'}
          </button>
          <button
            className="btn-remove"
            onClick={() => onRemove(component.id)}
            disabled={isGenerating}
          >
            삭제
          </button>
        </div>
      </div>
      {isGenerating && <p className="generation-status" role="status">코드를 생성하고 있습니다. 완료되면 미리보기로 전환합니다.</p>}
      <div className="card-tabs" role="tablist" aria-label="컴포넌트 보기">
        <button
          role="tab"
          aria-selected={displayedTab === 'preview'}
          disabled={isGenerating}
          className={`tab ${displayedTab === 'preview' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('preview')}
        >
          미리보기
        </button>
        <button
          role="tab"
          aria-selected={displayedTab === 'code'}
          className={`tab ${displayedTab === 'code' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('code')}
        >
          코드
        </button>
      </div>
      <div className="card-content">
        {displayedTab === 'preview' ? (
          <LivePreview key={previewKey} code={component.code} />
        ) : (
          <CodeView code={component.code} isStreaming={isGenerating} />
        )}
      </div>
    </div>
  );
}
