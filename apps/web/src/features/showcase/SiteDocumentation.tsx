import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUp, ArrowLeft, ArrowRight, ChevronRight, RefreshCw } from 'lucide-react';
import { LoadingStage } from '@preview/ui/loading';
import type { MarkdownHeading } from '@/features/docs/markdown';
import type { ProjectDiagramGuideId } from '../../../../../packages/platform-contracts/src/project-guides';
import { useShowcaseText } from './showcase-locale';
import { GuideBody } from './GuideBody';
import { PLATFORM_GUIDES } from '../../../../../packages/project-shared/src/platform-docs';
import { siteGuides } from './site-guides';
import { useProjectGuides } from './project-guide-query';
import { useTocNavigation } from './toc-navigation';
import { TocSelection } from './TocSelection';
import type { CatalogPage } from './showcase-catalog';
import { diagramTabTitles, isDiagramGuide, projectDiagramPath, projectGraphPath } from './catalog-sections';
import { ProjectDiagramPreview, ProjectDiagramTabs } from './ProjectDiagramPreview';

export function SiteDocumentation({
  path,
  projectId,
  pages,
  projectGuide,
}: {
  path: string;
  projectId: string;
  pages: CatalogPage[];
  projectGuide?: 'introduction' | 'changelog' | ProjectDiagramGuideId;
}) {
  const text = useShowcaseText();
  const location = useLocation();
  const navigate = useNavigate();
  const query = useProjectGuides(projectGuide ? projectId : '');
  const catalog = projectGuide ? (query.isError ? undefined : query.data) : undefined;
  const diagramPage = isDiagramGuide(projectGuide);
  const diagramGuides = catalog?.guides.filter((item) => isDiagramGuide(item.id)) ?? [];
  const requestedView = new URLSearchParams(location.search).get('view');
  const diagram = diagramPage
    ? projectGuide === 'mind-map' || requestedView === 'mind-map'
      ? 'mind-map'
      : !requestedView &&
          catalog &&
          !diagramGuides.some((item) => item.id === 'architecture') &&
          diagramGuides.some((item) => item.id === 'mind-map')
        ? 'mind-map'
        : 'architecture'
    : undefined;
  useEffect(() => {
    if (projectGuide !== 'mind-map') return;
    const params = new URLSearchParams(location.search);
    params.set('view', 'mind-map');
    navigate(`${projectDiagramPath(projectId, 'architecture')}?${params}`, { replace: true });
  }, [projectGuide, projectId, location.search, navigate]);
  const guideIndex = Math.max(
    0,
    siteGuides.findIndex((item) => item.path === path),
  );
  const navigation = projectGuide
    ? {
        id: diagram ?? projectGuide,
        title: diagram ? '平台架构' : projectGuide === 'changelog' ? '更新记录' : '项目介绍',
        path,
      }
    : siteGuides[guideIndex];
  const guides = projectGuide ? catalog?.guides : PLATFORM_GUIDES;
  const guide = guides?.find((item) => item.id === navigation.id);
  const title = navigation.title;
  useEffect(() => {
    const pageTitle = [text(title), catalog?.projectName, 'Preview'].filter(Boolean).join(' · ');
    const element = document.querySelector('head > title') ?? document.createElement('title');
    element.replaceChildren(pageTitle);
    if (!element.isConnected) document.head.append(element);
  }, [title, catalog?.projectName, text]);
  const diagramSource = diagram
    ? guide?.markdown.match(/^```mermaid\r?\n[\s\S]+?\r?\n```(?=\r?\n|$)/)?.[0]
    : undefined;
  const diagramImage =
    diagram && guide && 'previewImage' in guide && guide.previewImage && catalog?.contentRevision
      ? `/api/native/showcase/${encodeURIComponent(projectId)}/guide-preview?${new URLSearchParams({ id: diagram, contentRevision: catalog.contentRevision })}`
      : undefined;
  const restricted = catalog?.restrictedGuideIds?.some((identifier) => identifier === navigation.id);
  const diagramViews = diagramGuides.flatMap((item) =>
    isDiagramGuide(item.id) ? [{ id: item.id, label: text(diagramTabTitles[item.id]) }] : [],
  );
  const standaloneTabs = diagram && catalog && !diagramImage && !diagramSource && diagramViews.length > 0;
  const changeDiagram = (id: ProjectDiagramGuideId) => {
    if (id !== diagram) navigate(projectDiagramPath(projectId, id), { preventScrollReset: true });
  };
  const [headings, setHeadings] = useState<MarkdownHeading[]>([]);
  const updateHeadings = useCallback(
    (next: MarkdownHeading[]) =>
      setHeadings((previous) =>
        previous.length === next.length &&
        previous.every((heading, index) => heading.id === next[index].id && heading.text === next[index].text)
          ? previous
          : next,
      ),
    [],
  );
  const outline =
    diagramSource || diagramImage
      ? [{ id: 'diagram-preview', text: text('预览'), level: 2 }, ...headings]
      : headings;
  const sectionIds = outline.filter((heading) => heading.level <= 2).map((heading) => heading.id);
  const { active, scrollTo } = useTocNavigation(sectionIds, 150);
  const guidePath = useCallback(
    (pathname: string, anchor?: string) =>
      `${pathname}${anchor ? `${pathname.includes('?') ? '&' : '?'}${new URLSearchParams({ anchor })}` : ''}`,
    [],
  );
  const resolveDocumentUrl = useCallback(
    (file: string, anchor?: string) => {
      const target = guides?.find((item) => item.path === file);
      const route = siteGuides.find((item) => item.id === target?.id);
      if (projectGuide && isDiagramGuide(target?.id))
        return `#${guidePath(projectDiagramPath(projectId, target.id), anchor)}`;
      if (projectGuide && (target?.id === 'changelog' || target?.id === 'introduction'))
        return `#/docs/projects/${projectId}${target.id === 'changelog' ? '/changelog' : ''}${anchor ? `?${new URLSearchParams({ anchor })}` : ''}`;
      return route ? `#${guidePath(route.path, anchor)}` : '#';
    },
    [guides, guidePath, projectGuide, projectId],
  );
  const firstPage = pages.find((page) => page.projectId === projectId && page.allowed);
  return (
    <main className="page_content__xGn__">
      <div className="docs_docLayout__YK0uB">
        <article className="docs_docMain__jK5Ve showcase-guide">
          <nav className="docs_breadcrumb__JFHCC" aria-label={text(diagram ? '知识图谱' : '文档')}>
            {diagram ? (
              <>
                <span>{text('知识图谱')}</span>
                {catalog?.projectName && (
                  <>
                    <ChevronRight size={13} strokeWidth={1.75} aria-hidden="true" />
                    <Link to={projectGraphPath(projectId)}>{catalog.projectName}</Link>
                  </>
                )}
                <ChevronRight size={13} strokeWidth={1.75} aria-hidden="true" />
              </>
            ) : (
              <>
                <Link to={guidePath('/docs')}>{text('文档')}</Link>
                <span aria-hidden="true">›</span>
              </>
            )}
            <span aria-current="page">{text(title)}</span>
          </nav>
          <header className={diagram ? 'docs_header__0YD_z' : 'library-docs_hero__Sm4D7'}>
            <div className="docs_headerCopy__ZDQWU">
              <div className="docs_titleRow__nNp4A">
                <h1>{text(title)}</h1>
              </div>
              {guide && (
                <p data-preserve-language>
                  {(diagram && diagramGuides.find((item) => item.id === 'architecture')?.description) ||
                    guide.description}
                </p>
              )}
            </div>
          </header>
          {standaloneTabs && (
            <div className="docs_viewBar__TMird">
              <ProjectDiagramTabs views={diagramViews} activeView={diagram} onViewChange={changeDiagram} />
            </div>
          )}
          <div
            id={standaloneTabs ? 'diagram-panel' : undefined}
            role={standaloneTabs ? 'tabpanel' : undefined}
            aria-labelledby={standaloneTabs && guide ? `diagram-tab-${diagram}` : undefined}
            aria-label={standaloneTabs && !guide ? text(title) : undefined}
            tabIndex={standaloneTabs ? 0 : undefined}
          >
            {projectGuide && !projectId ? (
              <p>{text('尚未配置项目')}</p>
            ) : projectGuide && query.isPending ? (
              <LoadingStage label={text('读取项目指南…')} />
            ) : projectGuide && query.isError ? (
              <div className="showcase-error" role="alert">
                <p>{text('项目指南读取失败')}</p>
                <p>{query.error.message}</p>
                <button className="showcase-button" type="button" onClick={() => void query.refetch()}>
                  <RefreshCw size={14} />
                  {text('重试')}
                </button>
              </div>
            ) : !guide && restricted ? (
              <div className="showcase-muted" role="alert">
                <p>{text('此指南需要项目授权。')}</p>
                <p>{text('请联系管理员获取当前项目的资料访问权限。')}</p>
              </div>
            ) : !guide ? (
              <div className="showcase-muted" role="status">
                <p>{text('此项目尚未发布这篇指南。')}</p>
                {firstPage && (
                  <Link to={`/pages/${firstPage.projectId}/${firstPage.clientId}/${firstPage.pageKey}`}>
                    {text('浏览当前项目')}
                  </Link>
                )}
              </div>
            ) : (
              <>
                {diagram && (diagramImage || diagramSource) ? (
                  <ProjectDiagramPreview
                    title={`${text(title)} · ${text(diagramTabTitles[diagram])}`}
                    {...(diagramImage ? { imageUrl: diagramImage } : { source: diagramSource! })}
                    activeView={diagram}
                    views={diagramViews}
                    onViewChange={changeDiagram}
                  />
                ) : null}
                <div className="library-docs_body__P7yx7" data-preserve-language>
                  <GuideBody
                    source={
                      diagramSource ? guide.markdown.slice(diagramSource.length).trimStart() : guide.markdown
                    }
                    documentPath={guide.path}
                    projectId={projectId}
                    resolveDocumentUrl={resolveDocumentUrl}
                    onHeadings={updateHeadings}
                    activeAnchor={new URLSearchParams(location.search).get('anchor') ?? undefined}
                  />
                </div>
              </>
            )}
          </div>
          {!projectGuide && (
            <nav className="docs_pager__7frTG" aria-label={text('文档导航')}>
              {guideIndex > 0 ? (
                <Link className="docs_pagerPrev__1lFr8" to={guidePath(siteGuides[guideIndex - 1].path)}>
                  <ArrowLeft size={16} />
                  <span>
                    <small>{text('上一篇')}</small>
                    {text(siteGuides[guideIndex - 1].title)}
                  </span>
                </Link>
              ) : (
                <span aria-hidden="true" />
              )}
              {siteGuides[guideIndex + 1] && (
                <Link className="docs_pagerNext__s5UpM" to={guidePath(siteGuides[guideIndex + 1].path)}>
                  <span>
                    <small>{text('下一篇')}</small>
                    {text(siteGuides[guideIndex + 1].title)}
                  </span>
                  <ArrowRight size={16} />
                </Link>
              )}
            </nav>
          )}
        </article>
        <aside className="docs_tocRail__mVzSm">
          <nav aria-label={text('本页目录')} className="docs_toc__4bz2v">
            <p className="docs_tocTitle__v_VlL">{text('本页目录')}</p>
            <TocSelection activeKey={active}>
              {outline
                .filter((heading) => heading.level <= 2)
                .map((heading) => (
                  <li key={heading.id}>
                    <button
                      type="button"
                      data-toc-key={heading.id}
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
                onClick={() =>
                  window.scrollTo({
                    top: 0,
                    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                      ? 'instant'
                      : 'smooth',
                  })
                }
              >
                {text('返回顶部')}
                <ArrowUp size={13} />
              </button>
            </div>
          </nav>
        </aside>
      </div>
    </main>
  );
}
