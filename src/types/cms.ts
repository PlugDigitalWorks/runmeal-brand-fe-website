export type ContentPageType = 'general_content' | 'contact_form';

export interface NavigationItem {
  id: string;
  title: string;
  slug: string;
  type: ContentPageType;
  externalUrl: string | null;
  parentPageId: string | null;
  sortOrder: number;
}

export interface CmsNavigation {
  header: NavigationItem[];
  footer: NavigationItem[];
}

export interface PublicContentPage {
  id: string;
  type: ContentPageType;
  title: string;
  slug: string;
  content: string;
  externalUrl: string | null;
  parentPageId: string | null;
  sortOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string[];
}

/** Route prefix for CMS pages. Frontend owned — the API only owns the slug. */
export const CMS_PAGE_PREFIX = '/pages';

/** External items link straight out; internal ones go to our own CMS route. */
export const getCmsHref = (item: Pick<NavigationItem, 'externalUrl' | 'slug'>) =>
  item.externalUrl ?? `${CMS_PAGE_PREFIX}/${encodeURIComponent(item.slug)}`;

export const isExternalNavigationItem = (item: Pick<NavigationItem, 'externalUrl'>) =>
  Boolean(item.externalUrl);

export interface NavigationNode extends NavigationItem {
  children: NavigationItem[];
}

/**
 * Turns one flat array into the one-level tree the menus render.
 *
 * The API already clears `parentPageId` when the parent is not in the same
 * array, so an item without a resolvable parent is a root item by definition —
 * never dropped, or the menu would silently lose links.
 */
export function buildNavigationTree(items: NavigationItem[]): NavigationNode[] {
  const roots: NavigationNode[] = [];
  const nodesById = new Map<string, NavigationNode>();

  for (const item of items) {
    if (!item.parentPageId) {
      const node: NavigationNode = { ...item, children: [] };
      nodesById.set(item.id, node);
      roots.push(node);
    }
  }

  for (const item of items) {
    if (!item.parentPageId) continue;

    const parent = nodesById.get(item.parentPageId);
    if (parent) {
      parent.children.push(item);
    } else {
      roots.push({ ...item, children: [] });
    }
  }

  return roots;
}
