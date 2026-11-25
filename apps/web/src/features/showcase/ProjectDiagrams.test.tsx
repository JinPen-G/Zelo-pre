import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { SiteDocumentation } from './SiteDocumentation';

const state = vi.hoisted(() => ({ guides: [] as object[], restricted: [] as string[] }));
vi.mock('./project-guide-query', () => ({
  useProjectGuides: () => ({
    data: {
      projectName: 'Rental',
      contentRevision: 'revision',
      guides: state.guides,
      restrictedGuideIds: state.restricted,
    },
  }),
}));
vi.mock('./showcase-locale', () => ({ useShowcaseText: () => (value: string) => value }));
vi.mock('./FullscreenPreview', () => ({ FullscreenPreview: () => null }));
vi.mock('@/features/docs/MarkdownReader', () => ({
  MarkdownReader: ({ source }: { source: string }) => <div>{source}</div>,
}));
vi.mock('./GuideBody', () => ({ GuideBody: ({ source }: { source: string }) => <div>{source}</div> }));

function DocumentRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => navigate(-1)}>Back</button>
      <button onClick={() => navigate(1)}>Forward</button>
      <output>
        {location.pathname}
        {location.search}
      </output>
      <SiteDocumentation
        path={location.pathname}
        projectId="rental"
        pages={[]}
        projectGuide={location.pathname.endsWith('/mind-map') ? 'mind-map' : 'architecture'}
      />
    </>
  );
}
function mount(path = '/docs/projects/rental/architecture') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <DocumentRoute />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  state.restricted = [];
  state.guides = [
    {
      id: 'architecture',
      title: 'Architecture',
      description: 'System boundaries',
      path: 'guides/architecture.md',
      previewImage: true,
      markdown: 'Architecture explanation',
    },
    {
      id: 'mind-map',
      title: 'Mind map',
      description: 'Hierarchy',
      path: 'guides/mind-map.md',
      markdown: '```mermaid\nflowchart LR\nroot-->child\n```\n\nMind map explanation',
    },
  ];
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('switches preview and explanation in one page and persists the selection in its URL', () => {
  mount();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('平台架构');
  expect(screen.getByRole('tab', { name: '架构图' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('img')).toHaveAttribute('src', expect.stringContaining('id=architecture'));
  fireEvent.click(screen.getByRole('tab', { name: '脑图' }));
  expect(screen.getByRole('status')).toHaveTextContent('/architecture?view=mind-map');
  expect(screen.getByRole('tabpanel', { name: '脑图' })).toBeInTheDocument();
  expect(screen.getByText('Mind map explanation')).toBeInTheDocument();
  expect(screen.queryByText('Architecture explanation')).not.toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole('tab', { name: '脑图' }), { key: 'Home' });
  expect(screen.getByRole('tab', { name: '架构图' })).toHaveFocus();
  expect(screen.getByText('Architecture explanation')).toBeInTheDocument();
});
it('preserves old mind-map links and their section anchors', () => {
  mount('/docs/projects/rental/mind-map?anchor=business');
  expect(screen.getByRole('status')).toHaveTextContent('/architecture?anchor=business&view=mind-map');
  expect(screen.getByRole('tab', { name: '脑图' })).toHaveAttribute('aria-selected', 'true');
});
it('keeps browser history useful after clicking the selected tab again', () => {
  mount();
  fireEvent.click(screen.getByRole('tab', { name: '脑图' }));
  fireEvent.click(screen.getByRole('tab', { name: '脑图' }));
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByRole('tabpanel', { name: '架构图' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Forward' }));
  expect(screen.getByRole('tabpanel', { name: '脑图' })).toBeInTheDocument();
});
it('keeps the other view reachable when the current guide only contains text', () => {
  state.guides[0] = { ...state.guides[0], previewImage: false };
  mount();
  expect(screen.getByText('Architecture explanation')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '放大预览' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: '脑图' }));
  expect(screen.getByRole('tabpanel', { name: '脑图' })).toBeInTheDocument();
  expect(screen.getByText('Mind map explanation')).toBeInTheDocument();
});
it('only offers accessible guides and does not substitute a restricted requested view', () => {
  state.guides = state.guides.slice(0, 1);
  state.restricted = ['mind-map'];
  const view = mount();
  expect(screen.queryByRole('tab', { name: '脑图' })).not.toBeInTheDocument();
  view.unmount();
  mount('/docs/projects/rental/architecture?view=mind-map');
  expect(screen.getByRole('alert')).toHaveTextContent('此指南需要项目授权');
  expect(screen.queryByText('Architecture explanation')).not.toBeInTheDocument();
  expect(screen.getByRole('tab', { name: '架构图' })).toHaveAttribute('tabindex', '0');
  fireEvent.click(screen.getByRole('tab', { name: '架构图' }));
  expect(screen.getByText('Architecture explanation')).toBeInTheDocument();
});
it('opens an available mind map when the project publishes no architecture view', () => {
  state.guides = state.guides.slice(1);
  mount();
  expect(screen.getByRole('tabpanel', { name: '脑图' })).toBeInTheDocument();
});
