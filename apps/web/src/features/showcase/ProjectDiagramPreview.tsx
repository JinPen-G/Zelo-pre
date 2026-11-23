import { useRef, useState } from 'react';
import { Eye, Maximize2 } from 'lucide-react';
import { MarkdownReader } from '@/features/docs/MarkdownReader';
import { FullscreenPreview, type PreviewBounds } from './FullscreenPreview';
import { useShowcaseText } from './showcase-locale';
import './project-diagram-preview.css';

export function ProjectDiagramPreview({
  title,
  ...preview
}: { title: string } & ({ source: string } | { imageUrl: string })) {
  const text = useShowcaseText();
  const diagram = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [bounds, setBounds] = useState<PreviewBounds | null>(null);

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
        <span className="requirement-graph-preview-label">
          <Eye size={14} aria-hidden="true" />
          {text('预览')}
        </span>
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
          className="project-diagram-preview"
          role="region"
          aria-label={title}
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
        onExitComplete={() => setBounds(null)}
      />
    </section>
  );
}
