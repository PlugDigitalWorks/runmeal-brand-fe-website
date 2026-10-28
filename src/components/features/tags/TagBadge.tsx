'use client';

import { useTranslation } from 'react-i18next';

import { useBrand } from '@/context/BrandContext';
import { cn } from '@/lib/utils';
import { tagName, type Tag } from '@/types/tag';
import { TagIcon } from './tag-icons';

/** The tag's name in the brand's language, or the interface language before the brand resolves. */
export function useTagName() {
  const { brand } = useBrand();
  const { i18n } = useTranslation();
  const language = brand?.language ?? i18n?.resolvedLanguage ?? i18n?.language;
  return (tag: Pick<Tag, 'name'>) => tagName(tag, language);
}

/** A small read-only tag label with its icon, if the icon key is known. */
export function TagBadge({ tag, className }: { tag: Tag; className?: string }) {
  const nameOf = useTagName();

  return (
    <span
      data-testid="tag-badge"
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary whitespace-nowrap',
        className,
      )}
    >
      <TagIcon icon={tag.icon} className="h-3 w-3 shrink-0" />
      {nameOf(tag)}
    </span>
  );
}

export function TagBadgeList({ tags, className }: { tags: Tag[] | undefined; className?: string }) {
  if (!tags?.length) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {tags.map((tag) => (
        <TagBadge key={tag.id} tag={tag} />
      ))}
    </div>
  );
}
