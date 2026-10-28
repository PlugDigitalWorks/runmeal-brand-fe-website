export type TagKind = 'restaurant' | 'product';

/** Restaurant tags sit in a group; product tags have none. */
export type TagGroup = 'cuisine' | 'feature';

/** One entry of the global tag list. */
export interface Tag {
  id: string;
  kind: TagKind;
  group: TagGroup | null;
  slug: string;
  name: { tr: string; en: string };
  /** An icon key such as `leaf`; unknown keys render without an icon. */
  icon: string | null;
  sortOrder: number;
}

/** A tag on a menu product: its own (`product`) or inherited from its category. */
export interface ProductTag extends Tag {
  source: 'product' | 'category';
}

/** A tag's name in the given language, falling back to the other one. */
export function tagName(tag: Pick<Tag, 'name'>, language: string | undefined): string {
  const { tr, en } = tag.name ?? { tr: '', en: '' };
  return language?.startsWith('en') ? en || tr : tr || en;
}
