/**
 * The privacy policy and terms of use served at /privacy and /terms for every
 * brand. The mobile app shows the same text in-app
 * (runmeal-brand-mobile-app, src/content/legal.ts); change both together.
 * `{{brand}}` is the cafe's name.
 */

/** A paragraph, or a bulleted list when it is an array. */
export type LegalBlock = string | string[];

export type LegalSection = { heading: string; body: LegalBlock[] };

export type LegalDocument = { title: string; updated: string; intro: LegalBlock[]; sections: LegalSection[] };

export type LegalPage = 'privacy' | 'terms';

/** The company behind the ordering platform, as registered at Companies House (12458401). */
export const LEGAL_ENTITY = {
    name: 'PLUG DIGITAL LTD',
    number: '12458401',
    address: '60 Tottenham Court Road, Suite 2517a, Fitzrovia, London W1T 2EW, United Kingdom',
    email: 'info@plugdigital.co.uk',
} as const;

const UPDATED = '20 October 2026';
const { name: COMPANY, number: COMPANY_NUMBER, address: ADDRESS, email: EMAIL } = LEGAL_ENTITY;

const PRIVACY: LegalDocument = {
    title: 'Privacy policy',
    updated: UPDATED,
    intro: [
        `This policy explains how your personal data is used when you order from {{brand}} through this app or website. The ordering service is run by ${COMPANY} (company number ${COMPANY_NUMBER}), which is the data controller. {{brand}} receives the details it needs to prepare and hand over your order.`,
    ],
    sections: [
        {
            heading: 'Who we are',
            body: [`${COMPANY}, ${ADDRESS}. Email: ${EMAIL}.`],
        },
        {
            heading: 'What we collect',
            body: [
                [
                    'Account details: your name, email address and, if you set one, a password (stored only as a secure hash). If you sign in with Apple or Google, we receive your name, email address and an account identifier from them.',
                    'Contact and delivery details: phone number and the delivery addresses you save, including their map position.',
                    'Orders: what you order, from which branch, when, the table or collection time, your notes, prices and payment status.',
                    'Loyalty: your stamps, rewards and the code on your loyalty card, and whether you added it to Apple Wallet or Google Wallet.',
                    'Technical data: a device identifier, sign-in session records, IP address, browser or app version, and error reports.',
                ],
                'We do not see or store your full card number. Card payments are handled by our payment providers.',
            ],
        },
        {
            heading: 'Location and camera',
            body: [
                "If you allow it, your phone's location is used on your device to list the nearest branch first and to fill in a delivery address. We store a location only when you save it as part of an address. The camera is used only to scan table QR codes; images are not stored or sent to us. You can turn either permission off in your phone's settings.",
            ],
        },
        {
            heading: 'Why we use it',
            body: [
                [
                    'To create and run your account and keep you signed in (performing our contract with you).',
                    'To take, prepare, deliver and take payment for your orders, and to send you order updates (contract).',
                    'To run the loyalty scheme you join (contract).',
                    'To keep the service secure, prevent fraud and abuse, and fix problems (our legitimate interests).',
                    'To keep order and payment records as tax and accounting law requires (legal obligation).',
                    'To use your location, only with your permission (consent), which you can withdraw at any time.',
                ],
                'We do not sell your data, and we do not use it for advertising or track you across other apps and websites.',
            ],
        },
        {
            heading: 'Who we share it with',
            body: [
                [
                    '{{brand}} and its staff, to prepare and hand over your order and run its loyalty scheme.',
                    'Payment providers, to take card payments.',
                    'Apple and Google, when you sign in with them or add a loyalty card to their wallet.',
                    'Service providers that host and run the service for us: cloud hosting, email delivery, error monitoring and bot protection (Google reCAPTCHA).',
                    'Authorities, when the law requires it.',
                ],
                'Some of these providers process data outside the United Kingdom. Where they do, the transfer is protected by an adequacy decision or the UK International Data Transfer Agreement or Addendum.',
            ],
        },
        {
            heading: 'How long we keep it',
            body: [
                'We keep your account data until you delete your account. Order and payment records are kept for six years, as UK tax law requires, without your name and contact details once your account is deleted. Security logs are kept for a short time, usually no longer than 12 months.',
            ],
        },
        {
            heading: 'Your rights',
            body: [
                'Under UK data protection law you can ask for a copy of your data, ask us to correct or delete it, object to or restrict how we use it, and ask for it in a portable format. You can delete your account at any time from the Account screen. To use any other right, email us.',
                "If you are unhappy with how we handle your data, you can complain to the Information Commissioner's Office (ico.org.uk). We would like the chance to help first.",
            ],
        },
        {
            heading: 'Children',
            body: ['The service is not meant for children under 13, and we do not knowingly collect their data.'],
        },
        {
            heading: 'Changes',
            body: ['If we change this policy, we will update the date above and, for significant changes, let you know in the app or by email.'],
        },
        {
            heading: 'Contact',
            body: [`${COMPANY}, ${ADDRESS}. Email: ${EMAIL}.`],
        },
    ],
};

const TERMS: LegalDocument = {
    title: 'Terms of use',
    updated: UPDATED,
    intro: [
        `These terms apply when you use this app or website to order from {{brand}}. The ordering service is provided by ${COMPANY} (company number ${COMPANY_NUMBER}) on behalf of {{brand}}. By using the service you agree to these terms.`,
    ],
    sections: [
        {
            heading: 'Your account',
            body: [
                'You need an account to order. Keep your sign-in details to yourself; you are responsible for orders placed from your account. You can delete your account at any time from the Account screen.',
            ],
        },
        {
            heading: 'Orders',
            body: [
                'When you place an order, you make an offer to buy from {{brand}}. The order is accepted when the branch confirms it. Menus, prices, opening hours and availability are set by {{brand}} and can change; the price shown at checkout is the price you pay.',
                'If the branch cannot fulfil your order, it may cancel it, and any payment taken for it will be refunded.',
            ],
        },
        {
            heading: 'Allergies and dietary needs',
            body: [
                'Product descriptions may not list every ingredient or allergen. If you have an allergy or dietary need, speak to the branch staff before you order.',
            ],
        },
        {
            heading: 'Payment',
            body: [
                'Card payments are taken securely by our payment providers when you order. Where the branch offers it, you can pay at the table or on collection instead.',
            ],
        },
        {
            heading: 'Cancellations, refunds and complaints',
            body: [
                'Food and drink made to order cannot be returned once it is being prepared. If something is wrong with your order, tell the branch straight away. Refunds are decided by {{brand}}. This does not affect your statutory rights.',
            ],
        },
        {
            heading: 'Loyalty',
            body: [
                '{{brand}} sets the rules of its loyalty scheme, including how stamps are earned and when rewards expire, and may change or end the scheme. Stamps and rewards have no cash value, cannot be transferred, and are lost if you delete your account.',
            ],
        },
        {
            heading: 'Fair use',
            body: [
                'Do not misuse the service: no fraudulent orders, no attempts to break into or disrupt it, and no automated access. We may suspend accounts that do.',
            ],
        },
        {
            heading: 'Liability',
            body: [
                'We work to keep the service available and accurate, but cannot promise it will always be uninterrupted or error-free. Nothing in these terms limits liability that cannot be limited by law, including for death or personal injury caused by negligence.',
            ],
        },
        {
            heading: 'Changes and law',
            body: [
                'We may update these terms; the date above shows the latest version. These terms are governed by the law of England and Wales, and its courts have jurisdiction. If you live elsewhere in the UK, you can also bring a claim in your local courts.',
            ],
        },
        {
            heading: 'Contact',
            body: [
                `${COMPANY}, ${ADDRESS}. Email: ${EMAIL}. Your personal data is handled as set out in our privacy policy.`,
            ],
        },
    ],
};

const fill = (text: string, brand: string) => text.replaceAll('{{brand}}', brand);
const fillBlock = (block: LegalBlock, brand: string): LegalBlock =>
    Array.isArray(block) ? block.map((item) => fill(item, brand)) : fill(block, brand);

/** The document with the cafe's name filled in. */
export function legalDocument(page: LegalPage, brand: string): LegalDocument {
    const doc = page === 'privacy' ? PRIVACY : TERMS;
    return {
        ...doc,
        intro: doc.intro.map((block) => fillBlock(block, brand)),
        sections: doc.sections.map((section) => ({ ...section, body: section.body.map((block) => fillBlock(block, brand)) })),
    };
}
