import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n/config';

import { AddressForm } from './AddressForm';

vi.mock('@vis.gl/react-google-maps', () => ({ useMapsLibrary: () => null }));
vi.mock('./LocationPicker', () => ({ LocationPicker: () => null }));
vi.mock('./AddressSearch', () => ({ AddressSearch: () => null, toSearchResult: vi.fn() }));
vi.mock('@/lib/visitor-location', () => ({
    DEFAULT_ADDRESS_LOCATION: { lat: 51.5, lng: -0.12 },
    fetchVisitorLocation: vi.fn(() => new Promise(() => {})),
}));
vi.mock('@/services/user.service', () => ({ userService: {} }));

/** The text of every field label inside `column`, top to bottom. */
const labelsIn = (column: Element) =>
    [...column.querySelectorAll('label')].map((label) => label.textContent?.replace(/\s+/g, ' ').trim());

describe('<AddressForm /> layout', () => {
    it('puts postcode and both address lines on the left, phone and note on the right', () => {
        render(<AddressForm onCancel={vi.fn()} onSuccess={vi.fn()} />);

        const postcode = screen.getByText(i18n.t('address.postalCode'));
        const columns = postcode.closest('.grid')!.children;
        expect(columns).toHaveLength(2);

        const optional = i18n.t('address.optional');
        expect(labelsIn(columns[0])).toEqual([
            i18n.t('address.postalCode'),
            i18n.t('address.firstLine'),
            `${i18n.t('address.secondLine')} (${optional})`,
        ]);
        expect(labelsIn(columns[1])).toEqual([i18n.t('address.phone'), `${i18n.t('address.note')} (${optional})`]);
    });
});
