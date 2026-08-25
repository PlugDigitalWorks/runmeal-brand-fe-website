import { Order, OrderItem } from '@/services/order.service';

/** Numbers arrive as strings on raw order rows and as numbers on the formatted view. */
export function toNumber(value: number | string | null | undefined): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
        const parsed = Number(value.replace(',', '.'));
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

export function formatOrderDateTime(value: string | null | undefined, locale: string): string {
    if (!value) return '-';
    return new Date(value).toLocaleString(locale, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/** Orders have no human-facing number yet, so the tail of the id stands in for one. */
export function getOrderDisplayId(order: Pick<Order, 'id'>): string {
    return order.id.slice(-8);
}

export function getOrderItemQty(item: OrderItem): number {
    return item.quantity ?? item.qty ?? 1;
}

export function getOrderItemUnitPrice(item: OrderItem): number {
    const unitPrice = toNumber(item.unitPrice);
    if (unitPrice > 0) return unitPrice;

    const price = toNumber(item.price);
    if (price > 0) return price;

    const qty = getOrderItemQty(item);
    const lineTotal = toNumber(item.lineTotal) || toNumber(item.totalPrice);
    return qty > 0 ? lineTotal / qty : 0;
}

/** The line before any promotion; `DiscountedLinePrice` renders the discount itself. */
export function getOrderItemLineTotal(item: OrderItem): number {
    const lineTotal = toNumber(item.lineTotal);
    if (lineTotal > 0) return lineTotal;

    const totalPrice = toNumber(item.totalPrice);
    if (totalPrice > 0) return totalPrice;

    return getOrderItemUnitPrice(item) * getOrderItemQty(item);
}

/** What the line actually costs, once a product reward has been taken off it. */
export function getOrderItemPayableTotal(item: OrderItem): number {
    const finalLineTotal = item.finalLineTotal;
    if (finalLineTotal != null) return toNumber(finalLineTotal);
    return getOrderItemLineTotal(item);
}

/** `"Sos: Ketçap, Mayonez"` — one line per option group that has a selection. */
export function getOrderItemOptionLines(item: OrderItem): string[] {
    return (item.options ?? [])
        .map((group) => {
            const selected = (group.selections ?? [])
                .map((selection) => selection.optionName)
                .filter(Boolean)
                .join(', ');
            if (!selected) return null;
            return `${group.groupName}: ${selected}`;
        })
        .filter((line): line is string => Boolean(line));
}

/**
 * The order carries no subtotal column, so the items are the source of truth;
 * `totalPrice` only stands in when an order somehow came back without items.
 */
export function getOrderSubtotal(order: Pick<Order, 'totalPrice'>, items: OrderItem[] = []): number {
    const itemSubtotal = items.reduce((sum, item) => sum + getOrderItemLineTotal(item), 0);
    if (itemSubtotal > 0) return itemSubtotal;
    return toNumber(order.totalPrice);
}
