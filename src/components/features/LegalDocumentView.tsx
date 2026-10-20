'use client';

import { useBrand } from '@/context/BrandContext';
import { legalDocument, LegalBlock, LegalPage } from '@/lib/legal-content';

function Block({ block }: { block: LegalBlock }) {
    if (!Array.isArray(block)) {
        return <p className="text-sm leading-relaxed text-zinc-600">{block}</p>;
    }
    return (
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-zinc-600">
            {block.map((item) => (
                <li key={item}>{item}</li>
            ))}
        </ul>
    );
}

/**
 * The privacy policy or terms of use with the brand's name filled in. The text
 * is English for every visitor: it is written for UK law, and a translation
 * would not be the binding version.
 */
export function LegalDocumentView({ page }: { page: LegalPage }) {
    const { brand } = useBrand();
    // English only, like the text around it, so a Turkish visitor never sees a half-translated page.
    const doc = legalDocument(page, brand?.name ?? 'this cafe');

    return (
        <>
            <title>{brand ? `${doc.title} | ${brand.name}` : doc.title}</title>
            <article className="mx-auto max-w-3xl py-4">
                <h1 className="text-3xl font-bold text-zinc-900">{doc.title}</h1>
                <p className="mt-2 text-xs text-zinc-400">Last updated {doc.updated}</p>
                <div className="mt-6 space-y-3">
                    {doc.intro.map((block, i) => (
                        <Block key={i} block={block} />
                    ))}
                </div>
                {doc.sections.map((section) => (
                    <section key={section.heading} className="mt-8 space-y-3">
                        <h2 className="text-lg font-bold text-zinc-900">{section.heading}</h2>
                        {section.body.map((block, i) => (
                            <Block key={i} block={block} />
                        ))}
                    </section>
                ))}
            </article>
        </>
    );
}
