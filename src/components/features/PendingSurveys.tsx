'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ClipboardCheck, Star } from 'lucide-react';

import { surveyService } from '@/services/survey.service';
import {
    isSurveyComplete,
    PendingSurvey,
    SURVEY_SCORES,
    toSurveyAnswers,
} from '@/types/survey';
import { formatCurrency, resolveCurrencySymbol } from '@/lib/utils';

interface ApiErrorLike {
    response?: { status?: number; data?: { message?: string | string[] } };
}

const getApiErrorStatus = (error: unknown) => (error as ApiErrorLike).response?.status;

const getApiErrorMessage = (error: unknown, fallback: string) => {
    const message = (error as ApiErrorLike).response?.data?.message;
    if (Array.isArray(message)) return message.join(' ') || fallback;
    return typeof message === 'string' && message.trim() ? message : fallback;
};

const PAGE_SIZE = 10;

export function PendingSurveys() {
    const { t, i18n } = useTranslation();
    const [surveys, setSurveys] = useState<PendingSurvey[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    // One score map per order, keyed by question id.
    const [scoresByOrder, setScoresByOrder] = useState<Record<string, Record<string, number>>>({});
    const [submittingOrderId, setSubmittingOrderId] = useState<string | null>(null);

    const load = useCallback(async (targetPage: number, { append }: { append: boolean }) => {
        setIsLoading(true);
        try {
            const { surveys: items, meta } = await surveyService.getPendingSurveys(targetPage, PAGE_SIZE);
            setSurveys((previous) => (append ? [...previous, ...items] : items));
            setPage(meta?.page ?? targetPage);
            setTotalPages(meta?.totalPages ?? 1);
            setHasError(false);
        } catch (error) {
            console.error('Failed to fetch pending surveys', error);
            setHasError(true);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        load(1, { append: false });
    }, [load]);

    const setScore = (orderId: string, questionId: string, score: number) => {
        setScoresByOrder((previous) => ({
            ...previous,
            [orderId]: { ...previous[orderId], [questionId]: score },
        }));
    };

    const handleSubmit = async (survey: PendingSurvey) => {
        const scores = scoresByOrder[survey.orderId] ?? {};
        if (!isSurveyComplete(survey, scores) || submittingOrderId) return;

        setSubmittingOrderId(survey.orderId);
        try {
            await surveyService.submitAnswers(survey.orderId, toSurveyAnswers(survey, scores));
            toast.success(t('survey.toast.success'));
            // The order is no longer pending; drop it instead of refetching the page.
            setSurveys((previous) => previous.filter((item) => item.orderId !== survey.orderId));
            setScoresByOrder((previous) => {
                const next = { ...previous };
                delete next[survey.orderId];
                return next;
            });
        } catch (error) {
            console.error('Failed to submit survey answers', error);
            const status = getApiErrorStatus(error);

            // Every one of these means our cached list no longer matches the server:
            // 409 already rated, 404 the order stopped being ours or eligible, 400 the
            // branch's question set moved under us. Pull a fresh page in each case.
            if (status === 409) {
                toast.error(t('survey.errors.alreadyEvaluated'));
                await load(1, { append: false });
            } else if (status === 404) {
                toast.error(t('survey.errors.orderUnavailable'));
                await load(1, { append: false });
            } else if (status === 400) {
                toast.error(getApiErrorMessage(error, t('survey.errors.questionsChanged')));
                await load(1, { append: false });
            } else {
                toast.error(getApiErrorMessage(error, t('survey.toast.failed')));
            }
        } finally {
            setSubmittingOrderId(null);
        }
    };

    if (isLoading && surveys.length === 0) {
        return (
            <div className="flex items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white p-10 text-sm text-zinc-500">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                {t('survey.loading')}
            </div>
        );
    }

    if (surveys.length === 0) {
        return (
            <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-primary">
                    <ClipboardCheck size={22} />
                </span>
                <p className="mt-4 text-sm font-medium text-zinc-800">
                    {hasError ? t('survey.loadError') : t('survey.empty')}
                </p>
                {hasError && (
                    <button
                        onClick={() => load(1, { append: false })}
                        className="mt-3 text-sm font-medium text-primary hover:underline"
                    >
                        {t('survey.retry')}
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {surveys.map((survey) => {
                const scores = scoresByOrder[survey.orderId] ?? {};
                const isComplete = isSurveyComplete(survey, scores);
                const isSubmitting = submittingOrderId === survey.orderId;

                return (
                    <div
                        key={survey.orderId}
                        className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
                    >
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 bg-zinc-50/60 p-4">
                            <div className="min-w-0">
                                <p className="break-words font-semibold text-zinc-900">
                                    {survey.branchName || t('survey.unknownBranch')}
                                </p>
                                {/* Same short id the orders tab shows, so the two screens match. */}
                                <p className="mt-0.5 text-xs font-medium text-zinc-600">
                                    {t('survey.orderNo', { id: survey.orderId.slice(-8) })}
                                </p>
                                <p className="mt-0.5 text-xs text-zinc-500">
                                    {new Date(survey.orderDate).toLocaleDateString(i18n.resolvedLanguage === 'en' ? 'en-US' : 'tr-TR', {
                                        day: '2-digit',
                                        month: 'long',
                                        year: 'numeric',
                                    })}
                                </p>
                            </div>
                            <span className="shrink-0 font-semibold text-zinc-800">
                                {formatCurrency(survey.totalPrice, resolveCurrencySymbol(survey.currency))}
                            </span>
                        </div>

                        <div className="space-y-5 p-4">
                            {survey.questions.map((question) => (
                                <fieldset key={question.id}>
                                    <legend className="text-sm font-medium text-zinc-800">
                                        {question.question}
                                    </legend>
                                    {question.description && (
                                        <p className="mt-1 text-xs text-zinc-500">{question.description}</p>
                                    )}
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {SURVEY_SCORES.map((score) => {
                                            const isSelected = scores[question.id] === score;
                                            const inputId = `survey-${survey.orderId}-${question.id}-${score}`;

                                            return (
                                                <div key={score}>
                                                    <input
                                                        type="radio"
                                                        id={inputId}
                                                        name={`survey-${survey.orderId}-${question.id}`}
                                                        value={score}
                                                        checked={isSelected}
                                                        disabled={isSubmitting}
                                                        onChange={() => setScore(survey.orderId, question.id, score)}
                                                        className="peer sr-only"
                                                    />
                                                    <label
                                                        htmlFor={inputId}
                                                        className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border text-sm font-semibold transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary/50 ${isSelected
                                                            ? 'border-primary bg-primary text-white'
                                                            : 'border-zinc-200 bg-white text-zinc-600 hover:border-primary/50'
                                                            }`}
                                                    >
                                                        {score}
                                                    </label>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </fieldset>
                            ))}

                            <button
                                onClick={() => handleSubmit(survey)}
                                disabled={!isComplete || isSubmitting}
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                        {t('survey.submitting')}
                                    </>
                                ) : (
                                    <>
                                        <Star size={18} />
                                        {t('survey.submit')}
                                    </>
                                )}
                            </button>
                            {!isComplete && (
                                <p className="text-center text-xs text-zinc-500">{t('survey.answerAllHint')}</p>
                            )}
                        </div>
                    </div>
                );
            })}

            {page < totalPages && (
                <button
                    onClick={() => load(page + 1, { append: true })}
                    disabled={isLoading}
                    className="w-full rounded-lg border border-zinc-200 bg-white py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
                >
                    {isLoading ? t('survey.loading') : t('survey.loadMore')}
                </button>
            )}
        </div>
    );
}
