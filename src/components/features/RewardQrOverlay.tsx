'use client';

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Sun, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Full-screen QR for the cashier to scan. On phones this is the whole screen:
 * the code has to stay large and high-contrast, so the panel is always white
 * regardless of the surrounding brand colours.
 *
 * The payload is the customer's fixed member id, so this overlay is opened from
 * anywhere in the wallet with the same value.
 */

interface RewardQrOverlayProps {
    payload: string;
    title: string;
    subtitle?: string | null;
    onClose: () => void;
}

export function RewardQrOverlay({ payload, title, subtitle, onClose }: RewardQrOverlayProps) {
    const { t } = useTranslation();

    React.useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        // The QR is the only thing that matters while this is open.
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [onClose]);

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="fixed inset-0 z-[100] flex flex-col bg-zinc-950/95 backdrop-blur-sm animate-in fade-in duration-200"
        >
            <div className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{title}</p>
                    {subtitle && <p className="truncate font-mono text-xs text-zinc-400">{subtitle}</p>}
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label={t('common.close')}
                    className="shrink-0 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/20"
                >
                    <X size={20} />
                </button>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-8">
                <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-300 sm:p-8">
                    <div className="flex aspect-square w-full items-center justify-center">
                        <QRCodeSVG
                            value={payload}
                            level="M"
                            marginSize={0}
                            className="h-full w-full"
                            aria-label={title}
                        />
                    </div>
                    <p className="mt-6 text-center text-sm font-medium text-zinc-700">
                        {t('rewards.qrScanAtCounter')}
                    </p>
                </div>

                <p className="flex items-center gap-2 text-xs text-zinc-400">
                    <Sun size={14} className="shrink-0" />
                    {t('rewards.qrBrightnessHint')}
                </p>
            </div>

            <div className="px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                <button
                    type="button"
                    onClick={onClose}
                    className="w-full rounded-full bg-white/10 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20"
                >
                    {t('common.close')}
                </button>
            </div>
        </div>
    );
}
