'use client';

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import { Send, X } from 'lucide-react';

import { contactService } from '@/services/contact.service';
import { CONTACT_MESSAGE_MAX_LENGTH } from '@/types/contact';

interface ApiErrorLike {
    response?: { data?: { message?: string | string[] } };
}

const getApiErrorMessage = (error: unknown, fallback: string) => {
    const message = (error as ApiErrorLike).response?.data?.message;
    if (Array.isArray(message)) return message.join(' ') || fallback;
    return typeof message === 'string' && message.trim() ? message : fallback;
};

// Same shape the address form validates against, so a phone accepted there is
// accepted here. An empty string is valid: the backend then falls back to the
// user's active address phone.
const PHONE_E164 = /^\+[1-9]\d{7,14}$/;

const createContactSchema = (t: TFunction) =>
    z.object({
        phoneE164: z
            .string()
            .trim()
            .refine((value) => value === '' || PHONE_E164.test(value), t('contact.validation.phoneFormat')),
        message: z
            .string()
            .trim()
            .min(1, t('contact.validation.messageRequired'))
            .max(CONTACT_MESSAGE_MAX_LENGTH, t('contact.validation.messageMax')),
    });

type ContactFormValues = z.infer<ReturnType<typeof createContactSchema>>;

interface ContactFormProps {
    branchId: string;
    branchName: string;
    brandId?: string;
    /** Set by the modal host; adds the close control to the card header. */
    onClose?: () => void;
}

export function ContactForm({ branchId, branchName, brandId, onClose }: ContactFormProps) {
    const { t } = useTranslation();
    const {
        register,
        handleSubmit,
        reset,
        control,
        formState: { errors, isSubmitting },
    } = useForm<ContactFormValues>({
        resolver: zodResolver(createContactSchema(t)),
        defaultValues: { phoneE164: '', message: '' },
    });

    // useWatch keeps the counter reactive without the non-memoizable watch().
    const messageLength = (useWatch({ control, name: 'message' }) ?? '').length;

    const onSubmit = handleSubmit(async (values) => {
        try {
            await contactService.createContactRequest(
                branchId,
                {
                    message: values.message,
                    // Sending an empty phone would fail validation; leaving the key
                    // out is what triggers the backend's address-phone fallback.
                    ...(values.phoneE164 ? { phoneE164: values.phoneE164 } : {}),
                },
                brandId
            );
            toast.success(t('contact.toast.success'));
            reset({ phoneE164: '', message: '' });
        } catch (error) {
            console.error('Contact request failed', error);
            toast.error(getApiErrorMessage(error, t('contact.toast.failed')));
        }
    });

    return (
        <div className="bg-white rounded-lg shadow-sm border border-zinc-100 overflow-hidden">
            <div className="bg-primary p-4 flex items-center gap-3 text-white">
                <Send size={20} className="shrink-0" />
                <h2 className="font-bold text-lg flex-1">{t('contact.title')}</h2>
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={t('contact.close')}
                        className="shrink-0 rounded-full p-1 transition-colors hover:bg-white/20"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>

            <form onSubmit={onSubmit} className="p-5 space-y-5" noValidate>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        {t('contact.branchLabel')}
                    </p>
                    <p className="mt-1 break-words font-semibold text-zinc-800">{branchName}</p>
                </div>

                <div>
                    <label htmlFor="contact-phone" className="block text-sm font-medium text-zinc-700 mb-1">
                        {t('contact.phoneLabel')}{' '}
                        <span className="font-normal text-zinc-400">{t('contact.optional')}</span>
                    </label>
                    <input
                        id="contact-phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="+905551234567"
                        aria-invalid={Boolean(errors.phoneE164)}
                        aria-describedby={errors.phoneE164 ? 'contact-phone-error' : 'contact-phone-hint'}
                        className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-zinc-900 placeholder:text-zinc-400"
                        {...register('phoneE164')}
                    />
                    {errors.phoneE164 ? (
                        <p id="contact-phone-error" role="alert" className="mt-1 text-xs text-red-600">
                            {errors.phoneE164.message}
                        </p>
                    ) : (
                        <p id="contact-phone-hint" className="mt-1 text-xs text-zinc-500">
                            {t('contact.phoneHint')}
                        </p>
                    )}
                </div>

                <div>
                    <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                        <label htmlFor="contact-message" className="block text-sm font-medium text-zinc-700">
                            {t('contact.messageLabel')}
                        </label>
                        <span className="text-xs tabular-nums text-zinc-400">
                            {messageLength} / {CONTACT_MESSAGE_MAX_LENGTH}
                        </span>
                    </div>
                    <textarea
                        id="contact-message"
                        rows={6}
                        maxLength={CONTACT_MESSAGE_MAX_LENGTH}
                        placeholder={t('contact.messagePlaceholder')}
                        aria-invalid={Boolean(errors.message)}
                        aria-describedby={errors.message ? 'contact-message-error' : undefined}
                        className="w-full resize-none px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-zinc-900 placeholder:text-zinc-400"
                        {...register('message')}
                    />
                    {errors.message && (
                        <p id="contact-message-error" role="alert" className="mt-1 text-xs text-red-600">
                            {errors.message.message}
                        </p>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-primary text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            {t('contact.submitting')}
                        </>
                    ) : (
                        <>
                            <Send size={18} />
                            {t('contact.submit')}
                        </>
                    )}
                </button>
            </form>
        </div>
    );
}
