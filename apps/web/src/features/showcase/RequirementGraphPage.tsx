/** Read-only graph: find on the left, explore in the centre, understand on the right.
 * Publication, evidence and access belong to the service; key points are AI reading aids. */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  X,
  ArrowUp,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  RefreshCw,
  FileText,
  ChevronDown,
  ChevronRight,
  Eye,
  Maximize2,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { LoadingStage } from '@preview/ui/loading';
import { siteMotionTokens } from '@preview/ui';
import type {
  GraphImpact,
  GraphNode,
  GraphEdge,
  GraphEvidence,
  GraphNodeType,
  GraphRelation,
} from '../../../../../packages/platform-contracts/src/requirement-graph';
import { useNativeAuth } from '@/features/platform/platform-api';
import { GRAPH_RELATIONS } from '../../../../../packages/platform-contracts/src/requirement-graph.js';
import type { MarkdownHeading } from '@/features/docs/markdown';
import { REQUIREMENT_GRAPH_GUIDE } from '../../../../../packages/project-shared/src/requirement-graph-guide';
import { useShowcaseText } from './showcase-locale';
import { FullscreenPreview, type PreviewBounds } from './FullscreenPreview';
import { GuideBody } from './GuideBody';
import { TocSelection } from './TocSelection';
import { useTocNavigation } from './toc-navigation';
import { siteGuides } from './site-guides';
import { scopeColor, graphNodeLegend, graphRelationLegend, graphVisibility } from './graph-presentation';
import { loadGraphCatalog } from './graph-catalog';
import { graphReadingRelations, graphSourceAnchor } from './graph-reading';
import {
  graphNodeTypeLabels as typeLabels,
  RequirementGraphReading,
  type ReadingMode,
} from './RequirementGraphReading';
import { RequirementGraphFinder } from './RequirementGraphFinder';
import './requirement-graph.css';
import './graph-reading.css';
const Markdown = lazy(() =>
  import('@/features/docs/MarkdownReader').then((m) => ({ default: m.MarkdownReader })),
);
const maintenanceLabels: Record<string, string> = {
  UNREVIEWED_GRAPH: '图谱变更需要同步',
  UNMAPPED_REQUIREMENT: '部分需求尚未纳入图谱',
  UNREVIEWED_REQUIREMENT: '需求变更需要同步',
  UNREVIEWED_BINDING: '页面关联需要同步',
  UNREVIEWED_PROTOTYPE: '原型变更需要同步',
  UNMAPPED_PROTOTYPE: '部分原型尚未纳入图谱',
  STALE_NODE: '节点出处需要更新',
  STALE_EDGE: '关系出处需要更新',
  STALE_PROTOTYPE: '原型出处需要更新',
  STALE_SCOPE: '图谱范围需要重新核对',
};
const readingModes = { relations: '关系', flow: '流程' } as const;
function GraphViewSwitch({
  view,
  onChange,
  scope,
}: {
  view: ReadingMode;
  onChange: (view: ReadingMode) => void;
  scope: string;
}) {
  const text = useShowcaseText();
  const reduced = useReducedMotion();
  return (
    <div
      role="tablist"
      aria-label={text('图谱视图')}
      className="preview-shell_switch__v2Veh requirement-graph-view-switch"
      onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next =
          event.key === 'Home'
            ? 'relations'
            : event.key === 'End'
              ? 'flow'
              : view === 'relations'
                ? 'flow'
                : 'relations';
        onChange(next);
        event.currentTarget.querySelector<HTMLButtonElement>(`[data-view="${next}"]`)?.focus();
      }}
    >
      {(Object.keys(readingModes) as ReadingMode[]).map((mode) => (
        <button
          key={mode}
          type="button"
          className="preview-shell_option__gxVA2"
          role="tab"
          data-view={mode}
          aria-selected={view === mode}
          aria-controls="requirement-graph-visual"
          tabIndex={view === mode ? 0 : -1}
          onClick={() => onChange(mode)}
        >
          {view === mode && (
            <motion.span
              className="preview-shell_highlight__cOThZ"
              layoutId={`graph-view-${scope}`}
              transition={reduced ? { duration: 0 } : siteMotionTokens.spring.snappy}
            />
          )}
          <span className="requirement-graph-view-label">{text(readingModes[mode])}</span>
        </button>
      ))}
    </div>
  );
}
export default function RequirementGraphPage({
  projectId,
  title = '需求关系图谱',
  projectName,
}: {
  projectId: string;
  title?: string;
  projectName?: string;
}) {
  const text = useShowcaseText(),
    { client, session } = useNativeAuth(),
    reduced = useReducedMotion();
  useEffect(() => {
    document.title = `${text(title)} · Zelo pre`;
  }, [text, title]);
  const [params, setParams] = useSearchParams();
  const view: ReadingMode = params.get('view') === 'flow' ? 'flow' : 'relations';
  const [evidenceSelection, setEvidenceSelection] = useState<{
    id: string;
    node: string;
    mode: ReadingMode;
  }>();
  const setView = (mode: ReadingMode) => {
    if (mode === view) return;
    setEvidenceSelection(undefined);
    setDocumentSelection(undefined);
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (mode === 'relations') next.delete('view');
        else next.set('view', mode);
        return next;
      },
      { preventScrollReset: true },
    );
  };
  const [hiddenTypes, setHiddenTypes] = useState<GraphNodeType[]>([]);
  const [hiddenRelations, setHiddenRelations] = useState<GraphRelation[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [fullscreenBounds, setFullscreenBounds] = useState<PreviewBounds | null>(null);
  const [reservedHeight, setReservedHeight] = useState<number>();
  const [headings, setHeadings] = useState<MarkdownHeading[]>([]);
  const { active, scrollTo } = useTocNavigation([
    'graph-preview',
    ...headings.filter((heading) => heading.level <= 2).map((heading) => heading.id),
  ]);
  const guideUrl = useCallback(
    (file: string, anchor?: string) => {
      const target = siteGuides.find((guide) => `guides/${guide.id}.md` === file);
      if (!target) return '#';
      const params = new URLSearchParams();
      if (projectId) params.set('project', projectId);
      if (anchor) params.set('anchor', anchor);
      return `#${target.path}${params.size ? `?${params}` : ''}`;
    },
    [projectId],
  );
  const [detailSection, setDetailSection] = useState<{
    node: string;
    section: 'points' | 'sources' | 'prototypes';
  }>();
  const [impactNode, setImpactNode] = useState<string>();
  const [documentSelection, setDocumentSelection] = useState<{
    id: string;
    quote: string;
    context: string;
  }>();
  const [openQuotes, setOpenQuotes] = useState<Set<string>>(() => new Set());
  const documentTrigger = useRef<HTMLElement | null>(null);
  const evidenceTrigger = useRef<HTMLElement | null>(null);
  const workspace = useRef<HTMLDivElement>(null),
    reading = useRef<HTMLDivElement>(null),
    documentPanel = useRef<HTMLDivElement>(null),
    detail = useRef<HTMLElement>(null);
  const openFullscreen = () => {
    const element = workspace.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    setFullscreenBounds({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      borderRadius: 12,
    });
    setReservedHeight(rect.height);
    setExpanded(true);
  };
  const identity = `${session?.user?.id ?? 'anonymous'}:${session?.user?.revision ?? 0}`;
  // Content changes only with a release; focus refetch keeps it current without polling.
  const graphQuery = useQuery({
    queryKey: ['requirement-graph', projectId, identity],
    queryFn: ({ signal }) => loadGraphCatalog(client.request, projectId, signal),
    enabled: !!projectId,
    retry: false,
    staleTime: 30_000,
  });
  const graph = graphQuery.isError ? undefined : graphQuery.data;
  const nodes = useMemo(() => graph?.nodes.filter((item) => item.status === 'active') ?? [], [graph]);
  const edges = useMemo(() => graph?.edges.filter((edge) => edge.basis === 'explicit') ?? [], [graph]);
  const topicIndex = useMemo(() => new Map((graph?.topics ?? []).map((t, i) => [t.id, i])), [graph]);
  const visibility = useMemo(
    () => graphVisibility(nodes, edges, hiddenTypes, hiddenRelations),
    [nodes, edges, hiddenTypes, hiddenRelations],
  );
  const visibleNodes = useMemo(
    () => nodes.filter((item) => visibility.nodeIds.has(item.id)),
    [nodes, visibility],
  );
  const visibleEdges = useMemo(
    () => edges.filter((edge) => visibility.edgeIds.has(edge.id)),
    [edges, visibility],
  );
  const requestedNode = params.get('node');
  const node =
    requestedNode === null ? visibleNodes[0] : visibleNodes.find((item) => item.id === requestedNode);
  const selected = node?.id;
  const evidenceEdge =
    evidenceSelection?.node === selected && evidenceSelection?.mode === view
      ? visibleEdges.find((edge) => edge.id === evidenceSelection?.id)
      : undefined;
  const detailContext = JSON.stringify([projectId, selected, view, evidenceEdge?.id]);
  const activeDocument = documentSelection?.context === detailContext ? documentSelection : undefined;
  const documentId = activeDocument?.id;
  const showImpact = !!selected && impactNode === selected;
  const section = detailSection?.node === selected ? (detailSection?.section ?? 'points') : 'points';
  const closeDocument = () => {
    setDocumentSelection(undefined);
    requestAnimationFrame(() => {
      const trigger = documentTrigger.current;
      (trigger?.isConnected ? trigger : detail.current)?.focus({ preventScroll: expanded });
    });
  };
  const nodeLabel = (id: string) => text(nodes.find((n) => n.id === id)?.label ?? id);
  const impact = useQuery({
    queryKey: ['graph-impact', projectId, identity, selected, graph?.graphRevision],
    queryFn: ({ signal }) =>
      client.request(
        `/showcase/${projectId}/graph-query?${new URLSearchParams({
          operation: 'analyze_requirement_impact',
          id: selected!,
          graphRevision: graph!.graphRevision,
          maxDepth: '5',
          limit: '100',
        })}`,
        { signal },
      ) as Promise<GraphImpact>,
    enabled: !!node && showImpact && !!graph,
    retry: false,
    staleTime: 30_000,
  });
  const source = useQuery({
    queryKey: ['graph-document', projectId, identity, documentId, graph?.contentRevision],
    queryFn: ({ signal }) =>
      client.request(
        `/showcase/${projectId}/graph-document?${new URLSearchParams({
          id: documentId!,
          contentRevision: graph!.contentRevision,
        })}`,
        { signal },
      ) as Promise<{ title: string; markdown: string }>,
    enabled: !!documentId && !!graph,
    retry: false,
    staleTime: 30_000,
  });
  const select = (id: string | null, moveFocus = false) => {
    setImpactNode(undefined);
    setDetailSection(undefined);
    setOpenQuotes(new Set());
    setEvidenceSelection(undefined);
    setDocumentSelection(undefined);
    if ((id ?? '') !== requestedNode && id !== selected) {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set('node', id ?? '');
          return next;
        },
        { preventScrollReset: true },
      );
    }
    const target = nodes.find((n) => n.id === id);
    if (target) {
      setHiddenTypes((previous) => previous.filter((type) => type !== target.type));
    }
    if (moveFocus)
      requestAnimationFrame(() => {
        const target = reading.current;
        if (!target) return;
        target.focus({ preventScroll: true });
        target.scrollIntoView?.({ block: 'nearest' });
      });
  };
  const showEvidence = (edge: GraphEdge) => {
    if (!selected) return;
    evidenceTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEvidenceSelection({ id: edge.id, node: selected, mode: view });
    setDocumentSelection(undefined);
    focusDetail();
  };
  const focusDetail = () => {
    requestAnimationFrame(() => {
      const panel = detail.current;
      if (!panel) return;
      panel.scrollTo?.({ top: 0 });
      panel.focus({ preventScroll: true });
      panel.scrollIntoView?.({ block: 'nearest' });
    });
  };
  const openSource = (id: string, quote: string) => {
    documentTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDocumentSelection({ id, quote, context: detailContext });
  };
  const toggleQuote = (key: string) =>
    setOpenQuotes((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  useEffect(() => {
    detail.current?.scrollTo({ top: 0 });
  }, [detailContext]);
  useEffect(() => {
    if (documentId) documentPanel.current?.focus({ preventScroll: expanded });
  }, [documentId, expanded]);
  const warnings = [
    ...new Set((graph?.diagnostics ?? []).map((d) => maintenanceLabels[d.code] ?? '图谱资料需要同步')),
  ];
  const renderSource = (proof: GraphEvidence, key: string | number) => (
    <blockquote key={key} data-preserve-language>
      <span className="graph-source-title">
        <FileText size={13} aria-hidden="true" />
        {graph?.documents?.find((doc) => doc.id === proof.requirementId)?.title ?? text('需求说明')}
      </span>
      <p>{proof.quote}</p>
      {proof.stale && <small>{text('依据已过期，请核对现行需求')}</small>}
      <button type="button" onClick={() => openSource(proof.requirementId, proof.quote)}>
        {text('查看需求说明')}
        <ArrowUpRight size={12} aria-hidden="true" />
      </button>
    </blockquote>
  );
  const renderPoint = (target: GraphNode, index: number) => {
    const point = target.keyPoints[index],
      key = `${target.id}:${index}`,
      open = openQuotes.has(key);
    return (
      <li key={key}>
        <p>
          {text(point.text)}
          <button
            type="button"
            className="requirement-graph-quote-toggle"
            aria-expanded={open}
            onClick={() => toggleQuote(key)}
          >
            {text('原文')}
            <ChevronDown size={11} />
          </button>
        </p>
        {open &&
          point.evidence.map((ref) => {
            const proof = target.evidence[ref];
            return proof && renderSource(proof, ref);
          })}
      </li>
    );
  };
  const renderPrototypes = (targets: GraphNode[]) => {
    const prototypes = new Map(
      targets.flatMap((target) =>
        target.prototypes.map(
          (prototype) =>
            [`${prototype.clientId}/${prototype.pageKey}#${prototype.anchor}`, prototype] as const,
        ),
      ),
    );
    return (
      <section>
        <h3>{text('原型位置')}</h3>
        {prototypes.size ? (
          [...prototypes].map(([id, prototype]) => (
            <Link
              key={id}
              className="requirement-graph-prototype"
              to={`/pages/${projectId}/${prototype.clientId}/${prototype.pageKey}${prototype.anchor ? `?section=${encodeURIComponent(prototype.anchor)}` : ''}`}
            >
              <span>
                {text(prototype.target)}
                {prototype.stale && <small>{text('原型出处需要更新')}</small>}
              </span>
              <ArrowUpRight size={12} aria-hidden="true" />
            </Link>
          ))
        ) : (
          <p className="requirement-graph-muted">{text('尚未标注原型位置')}</p>
        )}
      </section>
    );
  };
  const evidenceContent = evidenceEdge && (
    <>
      <header className="requirement-graph-detail-head">
        <button
          className="graph-detail-back"
          type="button"
          onClick={() => {
            setEvidenceSelection(undefined);
            setDocumentSelection(undefined);
            requestAnimationFrame(() => {
              const trigger = evidenceTrigger.current;
              (trigger?.isConnected ? trigger : detail.current)?.focus({ preventScroll: true });
            });
          }}
        >
          <ArrowLeft size={14} aria-hidden="true" />
          {text('返回节点详情')}
        </button>
      </header>
      <h2>{text(evidenceEdge.label)}</h2>
      <div className="graph-reading-endpoints">
        <button type="button" onClick={() => select(evidenceEdge.source, true)}>
          {nodeLabel(evidenceEdge.source)}
        </button>
        {GRAPH_RELATIONS[evidenceEdge.relation].propagation === 'reverse' ? (
          <ArrowLeft size={13} aria-hidden="true" />
        ) : GRAPH_RELATIONS[evidenceEdge.relation].propagation === 'forward' ? (
          <ArrowRight size={13} aria-hidden="true" />
        ) : GRAPH_RELATIONS[evidenceEdge.relation].propagation === 'both' ? (
          <ArrowLeftRight size={13} aria-hidden="true" />
        ) : (
          <span aria-hidden="true">·</span>
        )}
        <button type="button" onClick={() => select(evidenceEdge.target, true)}>
          {nodeLabel(evidenceEdge.target)}
        </button>
      </div>
      <p className="requirement-graph-summary">{text(evidenceEdge.reason)}</p>
      <section>
        <h3>{text('需求依据')}</h3>
        {evidenceEdge.stale && !evidenceEdge.evidence.some((proof) => proof.stale) && (
          <p className="requirement-graph-footnote">{text('依据已过期，请核对现行需求')}</p>
        )}
        {evidenceEdge.evidence.map(renderSource)}
      </section>
      {renderPrototypes(
        nodes.filter((target) => target.id === evidenceEdge.source || target.id === evidenceEdge.target),
      )}
    </>
  );
  const renderDetail = (target: GraphNode) => {
    const triggers = target.keyPoints.flatMap((p, i) => (p.kind === 'trigger' ? [i] : []));
    const rules = target.keyPoints.flatMap((p, i) => (p.kind === 'rule' ? [i] : []));
    const { effects: outgoing, related } = graphReadingRelations(target.id, edges);
    const topicId = target.primaryTopic;
    return (
      <>
        <header className="requirement-graph-detail-head">
          <span>
            <i style={{ background: scopeColor(topicIndex.get(topicId) ?? 0) }} />
            {text(graph?.topics.find((t) => t.id === topicId)?.label ?? '其他需求')}
            <em>·</em>
            {text(typeLabels[target.type] ?? '')}
          </span>
          <button
            className="requirement-graph-close"
            aria-label={text('关闭详情')}
            type="button"
            onClick={() => select(null)}
          >
            <X size={15} />
          </button>
        </header>
        <h2>{text(target.label)}</h2>
        <p className="requirement-graph-summary">{text(target.summary)}</p>
        {target.requirementStatus === 'draft' && (
          <p className="requirement-graph-footnote">{text('包含规划或待确认资料，请以已确认 PRD 为准。')}</p>
        )}
        {target.topics.length > 1 && (
          <div className="requirement-graph-memberships">
            {target.topics.map((id) => (
              <span key={id}>{text(graph?.topics.find((item) => item.id === id)?.label ?? id)}</span>
            ))}
          </div>
        )}
        <div className="graph-detail-sections" role="group" aria-label={text('详情分区')}>
          {(
            [
              ['points', '要点', target.keyPoints.length],
              ['sources', '原文', target.evidence.length],
              ['prototypes', '原型', target.prototypes.length],
            ] as const
          ).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              aria-pressed={section === id}
              onClick={() => setDetailSection({ node: target.id, section: id })}
            >
              {text(label)} <small>{count}</small>
            </button>
          ))}
        </div>
        {section === 'points' && (
          <>
            {triggers.length > 0 && (
              <section>
                <h3>{text('触发条件')}</h3>
                <ul>{triggers.map((i) => renderPoint(target, i))}</ul>
              </section>
            )}
            {rules.length > 0 && (
              <section>
                <h3>{text('关键规则')}</h3>
                <ul>{rules.map((i) => renderPoint(target, i))}</ul>
              </section>
            )}
            <p className="requirement-graph-footnote">
              {text(
                target.keyPoints.length
                  ? '要点由 AI 根据 PRD 提炼，可展开原文核对。'
                  : '尚未整理触发条件或关键规则。',
              )}
            </p>
            {(outgoing.length > 0 || related.some((edge) => edge.relation === 'integrates_with')) && (
              <section>
                <button
                  type="button"
                  className="requirement-graph-impact-toggle"
                  aria-expanded={showImpact}
                  onClick={() => setImpactNode(showImpact ? undefined : target.id)}
                >
                  {text(showImpact ? '收起多级影响' : '查看多级影响')}
                  <ChevronDown size={11} />
                </button>
                {showImpact &&
                  (impact.isPending ? (
                    <LoadingStage label={text('读取影响范围…')} />
                  ) : impact.isError ? (
                    <p role="alert">{impact.error.message}</p>
                  ) : (
                    impact.data && (
                      <div className="requirement-graph-impact">
                        {impact.data.items.map((item) => (
                          <button type="button" key={item.node.id} onClick={() => select(item.node.id, true)}>
                            <span>{text(item.node.label)}</span>
                            <small>{item.path.map((p) => text(p.edge.label)).join(' → ')}</small>
                          </button>
                        ))}
                        {!impact.data.items.length && (
                          <p>{text('当前记录中未找到影响节点，仍需核对遗漏和具体修改场景。')}</p>
                        )}
                        {!impact.data.complete && <p>{text('当前需求整理或查询范围不完整，请继续核对。')}</p>}
                      </div>
                    )
                  ))}
              </section>
            )}
          </>
        )}
        {section === 'sources' && (
          <section>
            <h3>{text('需求依据')}</h3>
            {target.stale && !target.evidence.some((proof) => proof.stale) && (
              <p className="requirement-graph-footnote">{text('依据已过期，请核对现行需求')}</p>
            )}
            {target.evidence.length ? (
              target.evidence.map(renderSource)
            ) : (
              <p className="requirement-graph-muted">{text('尚未标注需求出处')}</p>
            )}
          </section>
        )}
        {section === 'prototypes' && renderPrototypes([target])}
      </>
    );
  };
  return (
    <main className="page_content__xGn__ requirement-graph-page">
      <div className="docs_docLayout__YK0uB requirement-graph-layout">
        <article className="docs_docMain__jK5Ve">
          <nav className="docs_breadcrumb__JFHCC" aria-label={text('知识图谱')}>
            <span>{text('知识图谱')}</span>
            <ChevronRight size={13} strokeWidth={1.75} aria-hidden="true" />
            <span aria-current="page">{text(projectName ?? title)}</span>
          </nav>
          <header className="docs_header__0YD_z">
            <div className="docs_headerCopy__ZDQWU">
              <div className="docs_titleRow__nNp4A">
                <h1>{text(title)}</h1>
              </div>
              <p>{text('查找功能，查看上下游关系、业务流程和需求原文。')}</p>
            </div>
          </header>
          <section id="graph-preview" className="docs_previewSection__Zbh1s" aria-label={text('图谱预览')}>
            <div className="docs_viewBar__TMird">
              <span className="requirement-graph-preview-label">
                <Eye size={14} />
                {text('预览')}
              </span>
              <div className="docs_viewTools___VpV2">
                <div className="preview-shell_tools___wPkm">
                  <GraphViewSwitch view={view} onChange={setView} scope="inline" />
                  <button
                    type="button"
                    className="preview-shell_expand__fXEJp"
                    aria-label={text('放大预览')}
                    title={text('全屏')}
                    disabled={!graph || graph.availability === 'unconfigured'}
                    onClick={openFullscreen}
                  >
                    <Maximize2 size={14} />
                  </button>
                </div>
              </div>
            </div>
            <div className="requirement-graph-preview" style={{ minHeight: reservedHeight }}>
              {!projectId ? (
                <div className="requirement-graph-empty">{text('尚未配置项目')}</div>
              ) : graphQuery.isPending ? (
                <LoadingStage label={text('读取需求关系图谱…')} />
              ) : graphQuery.isError ? (
                <div className="requirement-graph-empty" role="alert">
                  <p>{text('图谱读取失败')}</p>
                  <small>{text(graphQuery.error.message)}</small>
                  <button type="button" onClick={() => void graphQuery.refetch()}>
                    <RefreshCw size={14} />
                    {text('重试')}
                  </button>
                </div>
              ) : graph?.availability === 'unconfigured' ? (
                <div className="requirement-graph-empty" role="status">
                  <p>{text('尚未配置业务资料')}</p>
                  <small>{text('项目发布业务需求与关系图谱后，将显示在这里。')}</small>
                </div>
              ) : (
                graph && (
                  <div
                    ref={workspace}
                    className={`requirement-graph-workspace${expanded ? ' expanded' : ''}`}
                    aria-label={text('需求关系图谱')}
                  >
                    <div className="requirement-graph-frame" data-detail={node ? 'open' : undefined}>
                      <RequirementGraphFinder
                        key={projectId}
                        nodes={visibleNodes}
                        topics={graph.topics}
                        selected={selected}
                        availability={graph.availability}
                        onSelect={(id) => select(id, true)}
                      />
                      <div
                        ref={reading}
                        className="requirement-graph-visual"
                        id="requirement-graph-visual"
                        role="tabpanel"
                        aria-label={text(readingModes[view])}
                        tabIndex={0}
                      >
                        {node && (
                          <button type="button" className="graph-detail-jump" onClick={focusDetail}>
                            <FileText size={14} aria-hidden="true" />
                            {text('查看详情')}
                          </button>
                        )}
                        {nodes.length ? (
                          <RequirementGraphReading
                            key={node?.id ?? ''}
                            node={node}
                            nodes={visibleNodes}
                            edges={visibleEdges}
                            mode={view}
                            edgeId={evidenceEdge?.id}
                            onSelect={(id) => select(id, true)}
                            onEvidence={showEvidence}
                          />
                        ) : (
                          <div
                            className="requirement-graph-empty"
                            role={graph.availability === 'invalid' ? 'alert' : undefined}
                          >
                            <p>
                              {text(
                                graph.availability === 'ready'
                                  ? '尚无需求点'
                                  : graph.availability === 'invalid'
                                    ? '图谱格式需要修复'
                                    : '业务图谱尚未发布',
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                      <AnimatePresence initial={false}>
                        {(node || expanded) && (
                          <motion.aside
                            ref={detail}
                            key="detail"
                            className="requirement-graph-detail"
                            aria-label={text(evidenceEdge ? '关系依据' : '节点详情')}
                            tabIndex={-1}
                            initial={{ opacity: 0, x: reduced ? 0 : 12 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: reduced ? 0 : 8 }}
                            transition={reduced ? { duration: 0 } : siteMotionTokens.spring.snappy}
                          >
                            {evidenceEdge ? (
                              evidenceContent
                            ) : node ? (
                              renderDetail(node)
                            ) : (
                              <div className="requirement-graph-detail-empty">
                                <h2>{text('节点详情')}</h2>
                                <p>{text('选择一个需求点，查看它的关联。')}</p>
                              </div>
                            )}
                          </motion.aside>
                        )}
                      </AnimatePresence>
                    </div>
                    <details className="requirement-graph-legend">
                      <summary>
                        {text('筛选关联')}
                        <ChevronDown size={13} />
                      </summary>
                      <div role="group" aria-label={text('节点图例')}>
                        <small>{text('节点')}</small>
                        {graphNodeLegend
                          .filter((item) => nodes.some((member) => member.type === item.type))
                          .map((item) => (
                            <button
                              type="button"
                              key={item.type}
                              aria-pressed={!hiddenTypes.includes(item.type)}
                              onClick={() => {
                                if (node?.type === item.type && !hiddenTypes.includes(item.type))
                                  select(null);
                                setHiddenTypes((previous) =>
                                  previous.includes(item.type)
                                    ? previous.filter((type) => type !== item.type)
                                    : [...previous, item.type],
                                );
                              }}
                            >
                              <i style={{ background: item.color }} />
                              {text(item.label)}
                            </button>
                          ))}
                      </div>
                      <div role="group" aria-label={text('关系图例')}>
                        <small>{text('关系')}</small>
                        {graphRelationLegend
                          .filter((item) => edges.some((edge) => edge.relation === item.relation))
                          .map((item) => (
                            <button
                              type="button"
                              key={item.relation}
                              aria-pressed={!hiddenRelations.includes(item.relation)}
                              onClick={() =>
                                setHiddenRelations((previous) =>
                                  previous.includes(item.relation)
                                    ? previous.filter((relation) => relation !== item.relation)
                                    : [...previous, item.relation],
                                )
                              }
                            >
                              <i
                                className={`requirement-graph-legend-line${item.relation === 'references' || item.relation === 'similar_to' ? ' dashed' : ''}`}
                                style={{ color: item.color }}
                              />
                              {text(item.label)}
                            </button>
                          ))}
                        {(hiddenTypes.length > 0 || hiddenRelations.length > 0) && (
                          <button
                            type="button"
                            className="requirement-graph-legend-reset"
                            onClick={() => {
                              setHiddenTypes([]);
                              setHiddenRelations([]);
                            }}
                          >
                            {text('显示全部')}
                          </button>
                        )}
                      </div>
                    </details>
                    <footer className="requirement-graph-status">
                      <span>
                        {visibility.nodeIds.size} {text('个需求点')} · {visibility.edgeIds.size}{' '}
                        {text('条关联')}
                      </span>
                      {(warnings.length > 0 || !graph.complete) && (
                        <details className="requirement-graph-maintenance">
                          <summary>
                            {text('资料维护提醒')}
                            <ChevronDown size={12} />
                          </summary>
                          <p>{text('本示例仅展示已整理的需求范围。')}</p>
                          {warnings.map((v) => (
                            <p key={v}>{text(v)}</p>
                          ))}
                          {!graph.complete && <p>{text('当前需求整理或查询范围不完整，请继续核对。')}</p>}
                        </details>
                      )}
                    </footer>
                    {documentId && (
                      <div
                        ref={documentPanel}
                        tabIndex={-1}
                        className="requirement-graph-document"
                        role="region"
                        aria-label={text('需求说明')}
                      >
                        <header>
                          <h2>{source.data?.title ?? text('需求说明')}</h2>
                          <button type="button" aria-label={text('关闭文档')} onClick={closeDocument}>
                            <X size={16} />
                          </button>
                        </header>
                        {source.isPending ? (
                          <LoadingStage label={text('读取需求说明…')} />
                        ) : source.isError ? (
                          <p role="alert">{source.error.message}</p>
                        ) : (
                          source.data && (
                            <Suspense fallback={<LoadingStage label={text('加载业务需求…')} />}>
                              <Markdown
                                source={source.data.markdown}
                                loading={false}
                                layout="site"
                                activeAnchor={graphSourceAnchor(
                                  source.data.markdown,
                                  activeDocument?.quote ?? '',
                                )}
                              />
                            </Suspense>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
            <FullscreenPreview
              open={expanded}
              onOpenChange={setExpanded}
              title={text('需求关系图谱')}
              mobile={false}
              nativeRef={workspace}
              initialBounds={fullscreenBounds}
              toolbar={<GraphViewSwitch view={view} onChange={setView} scope="fullscreen" />}
              onExitComplete={() => setReservedHeight(undefined)}
              onEscapeKeyDown={(event) => {
                if (documentId) {
                  event.preventDefault();
                  closeDocument();
                }
              }}
            />
          </section>
          <div className="requirement-graph-guide-layout">
            <div className="showcase-document requirement-graph-guide" data-preserve-language>
              <GuideBody
                source={`${graph?.scope ? `## ${text('本项目的业务范围')}\n\n${graph.scope.description}\n\n` : ''}${REQUIREMENT_GRAPH_GUIDE.markdown}`}
                documentPath={REQUIREMENT_GRAPH_GUIDE.path}
                projectId={projectId}
                resolveDocumentUrl={guideUrl}
                onHeadings={setHeadings}
              />
            </div>
            <aside className="docs_tocRail__mVzSm">
              <nav className="docs_toc__4bz2v" aria-label={text('本页目录')}>
                <p className="docs_tocTitle__v_VlL">{text('本页目录')}</p>
                <TocSelection activeKey={active}>
                  <li>
                    <button
                      type="button"
                      aria-current={active === 'graph-preview' ? 'location' : undefined}
                      onClick={() => scrollTo('graph-preview')}
                    >
                      {text('预览')}
                    </button>
                  </li>
                  {headings
                    .filter((heading) => heading.level <= 2)
                    .map((heading) => (
                      <li key={heading.id} data-preserve-language>
                        <button
                          type="button"
                          aria-current={active === heading.id ? 'location' : undefined}
                          onClick={() => scrollTo(heading.id)}
                        >
                          {heading.text}
                        </button>
                      </li>
                    ))}
                </TocSelection>
                <div className="docs_tocFooter__8MA86">
                  <button
                    type="button"
                    onClick={() => window.scrollTo({ top: 0, behavior: reduced ? 'instant' : 'smooth' })}
                  >
                    {text('返回顶部')}
                    <ArrowUp size={13} />
                  </button>
                </div>
              </nav>
            </aside>
          </div>
        </article>
      </div>
    </main>
  );
}
