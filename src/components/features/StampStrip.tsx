import React from 'react';

/**
 * The stamp grid band of the loyalty pass. A port of the backend's Apple
 * Wallet strip (runmeal-api `stamp-strip.ts`) so the card on this screen and
 * the one in Wallet look the same: same canvas, same stamp art, same layout
 * rules. The last slot is always the reward, faded until the card is full.
 */

export const WALLET_ORANGE = '#F6921E';

export type StampStripState = 'collecting' | 'ready' | 'paused';

const WIDTH = 1125;
const HEIGHT = 369;
// Above this many stamps the icons get too small; draw a progress bar.
const MAX_GRID_STAMPS = 30;
const MARGIN = 36;
const GAP = 24;
const MAX_STAMP = 140;

type StampKind = 'filled' | 'empty' | 'reward';

// Each stamp is drawn in a 112×112 box, as in the backend source.
function StampArt({ kind, ids }: { kind: StampKind; ids: Record<string, string> }) {
    if (kind === 'filled') {
        return (
            <>
                <circle cx="56" cy="56" r="50" fill="#FFFFFF" fillOpacity="0.22" filter={`url(#${ids.shadow})`} />
                <circle cx="56" cy="56" r="48" fill="#FFFFFF" fillOpacity="0.95" />
                <circle cx="56" cy="56" r="43" fill="none" stroke={WALLET_ORANGE} strokeWidth="2.5" strokeDasharray="3 3" />
                <path
                    d="M36 57 L50 71 L77 42"
                    fill="none"
                    stroke={WALLET_ORANGE}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </>
        );
    }
    if (kind === 'empty') {
        return (
            <>
                <circle cx="56" cy="56" r="48" fill="#FFFFFF" fillOpacity="0.08" />
                <circle
                    cx="56"
                    cy="56"
                    r="47"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="3"
                    strokeDasharray="6 5"
                    strokeOpacity="0.45"
                />
                <circle cx="56" cy="56" r="16" fill="#FFFFFF" fillOpacity="0.12" />
                <circle cx="56" cy="56" r="6" fill="#FFFFFF" fillOpacity="0.35" />
            </>
        );
    }
    return (
        <>
            <circle cx="56" cy="56" r="50" fill="#FFFFFF" fillOpacity="0.28" filter={`url(#${ids.shadow})`} />
            <circle cx="56" cy="56" r="47" fill="#FFFFFF" fillOpacity="0.96" />
            <circle cx="56" cy="56" r="43" fill={`url(#${ids.gold})`} />
            <g transform="translate(30, 30) scale(0.46)">
                <path d="M56 12 L68 38 L96 42 L75 62 L80 90 L56 76 L32 90 L37 62 L16 42 L44 38 Z" fill="#FFFFFF" />
                <circle cx="56" cy="54" r="12" fill="#EAB308" />
                <path
                    d="M52 50 L56 58 L63 47"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </g>
        </>
    );
}

function Stamp({
    kind,
    x,
    y,
    size,
    opacity = 1,
    ids,
}: {
    kind: StampKind;
    x: number;
    y: number;
    size: number;
    opacity?: number;
    ids: Record<string, string>;
}) {
    return (
        <svg x={x} y={y} width={size} height={size} viewBox="0 0 112 112" opacity={opacity}>
            <StampArt kind={kind} ids={ids} />
        </svg>
    );
}

function Grid({ count, threshold, state, ids }: StripProps & { ids: Record<string, string> }) {
    const rows = threshold <= 6 ? 1 : threshold <= 20 ? 2 : 3;
    const cols = Math.ceil(threshold / rows);
    const size = Math.min(
        MAX_STAMP,
        Math.floor((WIDTH - 2 * MARGIN - (cols - 1) * GAP) / cols),
        Math.floor((HEIGHT - 2 * MARGIN - (rows - 1) * GAP) / rows),
    );
    const left = (WIDTH - (cols * size + (cols - 1) * GAP)) / 2;
    const top = (HEIGHT - (rows * size + (rows - 1) * GAP)) / 2;

    return (
        <>
            {Array.from({ length: threshold }, (_, i) => {
                const x = left + (i % cols) * (size + GAP);
                const y = top + Math.floor(i / cols) * (size + GAP);
                if (i === threshold - 1) {
                    return (
                        <Stamp key={i} kind="reward" x={x} y={y} size={size} opacity={state === 'ready' ? 1 : 0.45} ids={ids} />
                    );
                }
                const filled = state === 'ready' || i < count;
                return <Stamp key={i} kind={filled ? 'filled' : 'empty'} x={x} y={y} size={size} ids={ids} />;
            })}
        </>
    );
}

function Bar({ count, threshold, state, ids }: StripProps & { ids: Record<string, string> }) {
    const reward = MAX_STAMP;
    const trackWidth = WIDTH - 2 * MARGIN - reward - GAP;
    const ratio = state === 'ready' ? 1 : Math.min(1, count / threshold);
    const y = (HEIGHT - 36) / 2;
    return (
        <>
            <rect x={MARGIN} y={y} width={trackWidth} height="36" rx="18" fill="#FFFFFF" fillOpacity="0.25" />
            <rect
                x={MARGIN}
                y={y}
                width={Math.max(36, trackWidth * ratio)}
                height="36"
                rx="18"
                fill="#FFFFFF"
                fillOpacity="0.95"
            />
            <Stamp
                kind="reward"
                x={WIDTH - MARGIN - reward}
                y={(HEIGHT - reward) / 2}
                size={reward}
                opacity={state === 'ready' ? 1 : 0.45}
                ids={ids}
            />
        </>
    );
}

interface StripProps {
    count: number;
    threshold: number;
    state: StampStripState;
}

export function StampStrip({ count, threshold, state }: StripProps) {
    // Gradient and filter ids are document-global; several passes sit side by
    // side in the carousel, so each strip needs its own.
    const uid = React.useId().replace(/:/g, '');
    const ids = {
        bg: `${uid}-bg`,
        orb: `${uid}-orb`,
        dots: `${uid}-dots`,
        gold: `${uid}-gold`,
        shadow: `${uid}-shadow`,
        mute: `${uid}-mute`,
    };
    const safeThreshold = Math.max(1, threshold);

    return (
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block aspect-[375/123] w-full" aria-hidden>
            <defs>
                <linearGradient id={ids.bg} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.14" />
                    <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="#000000" stopOpacity="0.12" />
                </linearGradient>
                <radialGradient id={ids.orb} cx="85%" cy="30%" r="60%">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                </radialGradient>
                <pattern id={ids.dots} width="30" height="30" patternUnits="userSpaceOnUse">
                    <circle cx="15" cy="15" r="1.5" fill="#FFFFFF" fillOpacity="0.06" />
                </pattern>
                <radialGradient id={ids.gold} cx="40%" cy="35%" r="65%">
                    <stop offset="0%" stopColor="#FEF08A" />
                    <stop offset="60%" stopColor="#EAB308" />
                    <stop offset="100%" stopColor="#CA8A04" />
                </radialGradient>
                <filter id={ids.shadow} x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.2" />
                </filter>
                <filter id={ids.mute}>
                    <feColorMatrix type="saturate" values="0" />
                </filter>
            </defs>
            <rect width={WIDTH} height={HEIGHT} fill={WALLET_ORANGE} />
            <rect width={WIDTH} height={HEIGHT} fill={`url(#${ids.bg})`} />
            <rect width={WIDTH} height={HEIGHT} fill={`url(#${ids.orb})`} />
            <rect width={WIDTH} height={HEIGHT} fill={`url(#${ids.dots})`} />
            <g {...(state === 'paused' ? { filter: `url(#${ids.mute})`, opacity: 0.6 } : {})}>
                {safeThreshold <= MAX_GRID_STAMPS ? (
                    <Grid count={count} threshold={safeThreshold} state={state} ids={ids} />
                ) : (
                    <Bar count={count} threshold={safeThreshold} state={state} ids={ids} />
                )}
            </g>
        </svg>
    );
}
