'use client';

import React from 'react';
import { StampCard } from '@/types/loyalty-stamp';
import { WALLET_ORANGE } from '@/components/features/StampStrip';

/**
 * Swipeable row of passes, one per campaign, with the neighbour peeking in so
 * it reads as swipeable. The cards keep the order they are given, so a
 * refresh never reshuffles them under the customer's finger; the row only
 * opens on `activeCampaignId` the first time it is shown.
 */

interface StampPassCarouselProps {
    cards: StampCard[];
    activeCampaignId: string | null;
    onActiveChange: (campaignId: string) => void;
    renderCard: (card: StampCard) => React.ReactNode;
}

/** scrollLeft that centres `slide` in `carousel`. */
const centredOffset = (carousel: HTMLElement, slide: HTMLElement) =>
    slide.offsetLeft - (carousel.clientWidth - slide.clientWidth) / 2;

export function StampPassCarousel({ cards, activeCampaignId, onActiveChange, renderCard }: StampPassCarouselProps) {
    const carouselRef = React.useRef<HTMLDivElement>(null);
    const hasOpened = React.useRef(false);

    React.useLayoutEffect(() => {
        const carousel = carouselRef.current;
        if (hasOpened.current || !carousel || !activeCampaignId) return;
        const index = cards.findIndex((card) => card.campaignId === activeCampaignId);
        const slide = carousel.children[index] as HTMLElement | undefined;
        if (slide) carousel.scrollLeft = centredOffset(carousel, slide);
        hasOpened.current = true;
    }, [cards, activeCampaignId]);

    const handleScroll = () => {
        const carousel = carouselRef.current;
        if (!carousel) return;
        const centre = carousel.scrollLeft + carousel.clientWidth / 2;
        let closest = 0;
        let closestDistance = Infinity;
        Array.from(carousel.children).forEach((child, index) => {
            const slide = child as HTMLElement;
            const distance = Math.abs(slide.offsetLeft + slide.clientWidth / 2 - centre);
            if (distance < closestDistance) {
                closest = index;
                closestDistance = distance;
            }
        });
        const campaignId = cards[closest]?.campaignId;
        if (campaignId && campaignId !== activeCampaignId) onActiveChange(campaignId);
    };

    const scrollToCard = (index: number) => {
        const carousel = carouselRef.current;
        const slide = carousel?.children[index] as HTMLElement | undefined;
        if (!carousel || !slide) return;
        carousel.scrollTo({ left: centredOffset(carousel, slide), behavior: 'smooth' });
    };

    return (
        <>
            <div
                ref={carouselRef}
                onScroll={handleScroll}
                className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-6 pb-1.5 scrollbar-hide"
            >
                {cards.map((card) => (
                    <div key={card.campaignId} className="w-[calc(100%-20px)] shrink-0 snap-center">
                        {renderCard(card)}
                    </div>
                ))}
            </div>
            <div className="flex justify-center gap-1.5 pt-2.5">
                {cards.map((card, index) => {
                    const isActive = card.campaignId === activeCampaignId;
                    return (
                        <button
                            key={card.campaignId}
                            type="button"
                            onClick={() => scrollToCard(index)}
                            aria-label={card.campaignName}
                            aria-current={isActive}
                            className={`h-1.5 rounded-full transition-all ${isActive ? 'w-[18px]' : 'w-1.5 bg-zinc-300'}`}
                            style={isActive ? { backgroundColor: WALLET_ORANGE } : undefined}
                        />
                    );
                })}
            </div>
        </>
    );
}
