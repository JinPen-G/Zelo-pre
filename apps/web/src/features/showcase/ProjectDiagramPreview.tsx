import { useRef, useState } from 'react';
import { Eye, Maximize2, ZoomIn, Scan } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { siteMotionTokens } from '@preview/ui';
import type { ProjectDiagramGuideId } from '../../../../../packages/platform-contracts/src/project-guides';
import { MarkdownReader } from '@/features/docs/MarkdownReader';
import { FullscreenPreview, type PreviewBounds } from './FullscreenPreview';
import { useShowcaseText } from './showcase-locale';
import './project-diagram-preview.css';

type DiagramViews = {
  views: { id: ProjectDiagramGuideId; label: string }[];
  activeView?: ProjectDiagramGuideId;
  onViewChange?: (id: ProjectDiagramGuideId) => void;
};

/** Keep view navigation available even when the selected guide has no preview. */
export function ProjectDiagramTabs({ views, activeView, onViewChange }: DiagramViews) {
  const text = useShowcaseText();
  const reduced = useReducedMotion();
  return (
    <div
      className="docs_viewTabs__swfjS"
      role="tablist"
      aria-label={text('架构视图')}
      onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
        const current = buttons.indexOf(event.target as HTMLButtonElement);
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? buttons.length - 1
              : (current + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.click();
        buttons[next]?.focus();
      }}
    >
      {views.map((view, index) => (
        <button
          key={view.id}
          id={`diagram-tab-${view.id}`}
          type="button"
          role="tab"
          aria-selected={view.id === activeView}
          aria-controls="diagram-panel"
          tabIndex={
            view.id === activeView || (index === 0 && !views.some((item) => item.id === activeView)) ? 0 : -1
          }
          onClick={() => {
            if (view.id !== activeView) onViewChange?.(view.id);
          }}
        >
          <span>{view.label}</span>
          {view.id === activeView && (
            <motion.i
              layoutId="project-diagram-tab"
              className="docs_viewIndicator__NIPRK"
              transition={reduced ? { duration: 0 } : siteMotionTokens.spring.snappy}
            />
          )}
        </button>
      ))}
    </div>
  );
}

export function ProjectDiagramPreview({
  title,
  views,
  activeView,
  onViewChange,
  ...preview
}: {
  title: string;
} & Partial<DiagramViews> &
  ({ source: string } | { imageUrl: string })) {
  const text = useShowcaseText();
  const diagram = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [bounds, setBounds] = useState<PreviewBounds | null>(null);
  const [zoomed, setZoomed] = useState(false);

  function openFullscreen() {
    const element = diagram.current;
    if (!element) return;
    const { top, left, width, height } = element.getBoundingClientRect();
    setBounds({
      top,
      left,
      width,
      height,
      borderRadius: Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0,
    });
    setExpanded(true);
  }

  return (
    <section id="diagram-preview" className="docs_previewSection__Zbh1s" aria-label={text('预览')}>
      <div className="docs_viewBar__TMird">
        {views?.length ? (
          <ProjectDiagramTabs views={views} activeView={activeView} onViewChange={onViewChange} />
        ) : (
          <span className="requirement-graph-preview-label">
            <Eye size={14} aria-hidden="true" />
            {text('预览')}
          </span>
        )}
        <div className="docs_viewTools___VpV2">
          <div className="preview-shell_tools___wPkm">
            <button
              className="preview-shell_expand__fXEJp"
              type="button"
              aria-label={text('放大预览')}
              title={text('全屏')}
              onClick={openFullscreen}
            >
              <Maximize2 size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      <div style={{ minHeight: bounds?.height }}>
        <div
          ref={diagram}
          id="diagram-panel"
          className="project-diagram-preview"
          data-zoomed={zoomed || undefined}
          role={activeView ? 'tabpanel' : 'region'}
          aria-label={activeView ? undefined : title}
          aria-labelledby={activeView ? `diagram-tab-${activeView}` : undefined}
          tabIndex={0}
          data-preserve-language
        >
          {'imageUrl' in preview ? (
            <div className="project-diagram-image">
              <img src={preview.imageUrl} alt={title} />
            </div>
          ) : (
            <MarkdownReader source={preview.source} loading={false} layout="site" />
          )}
        </div>
      </div>
      <FullscreenPreview
        open={expanded}
        onOpenChange={setExpanded}
        title={title}
        mobile={false}
        nativeRef={diagram}
        initialBounds={bounds}
        toolbar={
          'imageUrl' in preview ? (
            <button
              type="button"
              className="preview-shell_expand__fXEJp"
              aria-label={text(zoomed ? '适应窗口' : '放大图面')}
              title={text(zoomed ? '适应窗口' : '放大图面')}
              onClick={() => setZoomed(!zoomed)}
            >
              {zoomed ? <Scan size={16} aria-hidden="true" /> : <ZoomIn size={16} aria-hidden="true" />}
            </button>
          ) : undefined
        }
        onExitComplete={() => {
          setBounds(null);
          setZoomed(false);
        }}
      />
    </section>
  );
}
