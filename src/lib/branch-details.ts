import type { Branch, BrandBranch } from '@/types/branch';

/**
 * The handful of branch facts both context panels above the menu render —
 * the address/branch picker on the storefront and the table panel in a QR
 * journey. Pure derivation, so it can be memoized by either caller.
 */
export interface ResolvedBranchDetails {
    /** Today's opening window, or null when the branch is closed today. */
    workingHours: string | null;
    /** An open day without a configured time slot means the branch is open all day. */
    isOpen24Hours: boolean;
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
    if (orderTypeSettings?.scheduledPickup?.isActive) orderTypeKeys.push('scheduledPickup');
    if (orderTypeSettings?.tableOrder?.isActive) orderTypeKeys.push('tableOrder');

    return {
        workingHours: slot ? `${slot.openTime} - ${slot.closeTime}` : null,
        isOpen24Hours: todayHours?.isOpen === true && !slot,
        paymentMethodKeys,
        orderTypeKeys,
        phoneNumber: branch.phoneNumber || null,
    };
}

/** True when this branch still lets a QR customer switch to pickup. */
export function isPickupAvailable(branch: Branch | null | undefined): boolean {
    return branch?.order_type_settings?.pickup?.isActive === true;
}

/** `canDeliver` from the all-branches list; null when unknown (no location, or a record from elsewhere). */
export function branchCanDeliver(branch: Branch | BrandBranch | null | undefined): boolean | null {
    return branch && 'canDeliver' in branch ? branch.canDeliver : null;
}

/** Pickup (now or scheduled) — what still works when the branch doesn't deliver to the customer. */
export function hasPickupOrderType(branch: Branch | BrandBranch | null | undefined): boolean {
    const settings = branch?.order_type_settings;
    return settings?.pickup?.isActive === true || settings?.scheduledPickup?.isActive === true;
}

/** Delivery (now or scheduled) — the order types `canDeliver` is about. */
export function hasDeliveryOrderType(branch: Branch | BrandBranch | null | undefined): boolean {
    const settings = branch?.order_type_settings;
    return settings?.delivery?.isActive === true || settings?.scheduledDelivery?.isActive === true;
}

/**
 * Any order type the storefront can place. Table ordering doesn't count: it
 * only starts from a scanned QR code.
 */
export function hasStorefrontOrderType(branch: Branch | BrandBranch | null | undefined): boolean {
    return hasDeliveryOrderType(branch) || hasPickupOrderType(branch);
}

/**
 * The branch delivers, just not to the customer's address. `canDeliver` is
 * purely geographic, so a branch with delivery switched off would otherwise
 * read as "no delivery to your address" too.
 */
export function isOutsideDeliveryArea(branch: Branch | BrandBranch | null | undefined): boolean {
    return branchCanDeliver(branch) === false && hasDeliveryOrderType(branch);
}

/**
 * A branch that doesn't deliver to the customer can still be picked for pickup.
 * One with no storefront order type at all stays pickable: its menu can still
 * be browsed.
 */
export function isBranchSelectable(branch: Branch | BrandBranch): boolean {
    return !isOutsideDeliveryArea(branch) || hasPickupOrderType(branch);
}
