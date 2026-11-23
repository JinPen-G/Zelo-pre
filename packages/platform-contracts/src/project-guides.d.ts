export const PROJECT_GUIDE_IDS: readonly ProjectGuideId[];
export const PROJECT_DIAGRAM_GUIDES: readonly ProjectDiagramGuideId[];
export type ProjectDiagramGuideId = 'architecture' | 'mind-map';
export type ProjectGuideId =
  'introduction' | 'usage' | 'theming' | 'motion' | 'ai' | 'changelog' | ProjectDiagramGuideId;
export interface ProjectGuide {
  id: ProjectGuideId;
  title: string;
  description: string;
  path: string;
  markdown: string;
  previewImage?: true;
}
export interface ProjectGuideCatalog {
  projectId: string;
  projectName: string;
  availability: 'ready' | 'unconfigured';
  contentRevision: string | null;
  guides: ProjectGuide[];
  restrictedGuideIds: ProjectGuideId[];
}
