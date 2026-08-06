import type { Branch } from '@/types/branch';

/**
 * The handful of branch facts both context panels above the menu render —
 * the address/branch picker on the storefront and the table panel in a QR
 * journey. Pure derivation, so it can be memoized by either caller.
 */
export interface ResolvedBranchDetails {
    /** Today's opening window, or null when the branch is closed today. */
    workingHours: string | null;
    minimumDeliveryAmount: number;
    paymentMethodKeys: string[];
    orderTypeKeys: string[];
    phoneNumber: string | null;
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export const getDayName = (date = new Date()) => DAY_NAMES[date.getDay()];

export function resolveBranchDetails(branch: Branch | null | undefined): ResolvedBranchDetails | null {
    if (!branch) return null;

    const todayHours = branch.business_hour?.[getDayName()];
    const slot = todayHours?.isOpen ? todayHours.timeSlots?.[0] : undefined;

    const paymentSettings = branch.payment_settings;
    const paymentMethodKeys: string[] = [];
    if (paymentSettings?.onlineMethods?.card?.isActive) paymentMethodKeys.push('onlineCard');
    if (paymentSettings?.offlineMethods?.cash?.isActive) paymentMethodKeys.push('cash');
    if (paymentSettings?.offlineMethods?.cardOnDelivery?.isActive) paymentMethodKeys.push('cardOnDelivery');

    const orderTypeSettings = branch.order_type_settings;
    const orderTypeKeys: string[] = [];
    if (orderTypeSettings?.delivery?.isActive) orderTypeKeys.push('delivery');
    if (orderTypeSettings?.pickup?.isActive) orderTypeKeys.push('pickup');
    if (orderTypeSettings?.scheduledDelivery?.isActive) orderTypeKeys.push('scheduledDelivery');
    if (orderTypeSettings?.tableOrder?.isActive) orderTypeKeys.push('tableOrder');

    return {
        workingHours: slot ? `${slot.openTime} - ${slot.closeTime}` : null,
        minimumDeliveryAmount: branch.minBasketPrice || 0,
        paymentMethodKeys,
        orderTypeKeys,
        phoneNumber: branch.phoneNumber || null,
    };
}

/** True when this branch still lets a QR customer switch to pickup. */
export function isPickupAvailable(branch: Branch | null | undefined): boolean {
    return branch?.order_type_settings?.pickup?.isActive === true;
}
