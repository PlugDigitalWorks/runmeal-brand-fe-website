"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { CheckCircle, Clock3, XCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useTable } from "@/context/TableContext";
import { orderService } from "@/services/order.service";
import { paymentService } from "@/services/payment.service";
import { tableService } from "@/services/table.service";
import {
  forgetTableCheckPayment,
  getTableCheckPaymentSnapshot,
  isTableCheckPaymentActive,
  parseTableCheckPayment,
  rememberTableCheckPayment,
  subscribeToTableCheckPayment,
} from "@/lib/table-check-payment";
import { resolveApiErrorMessage } from "@/lib/api-errors";
import { toast } from "sonner";
import { formatCurrency, resolveCurrencySymbol } from "@/lib/utils";
import type { PendingTableCheckPayment } from "@/lib/table-check-payment";
import type { CustomerTableCheck, TableOrderView } from "@/types/table";

const getServerPaymentContext = () => null;
const getClientHydrated = () => true;
const getServerHydrated = () => false;

function isTablePaymentReflected(
  pending: PendingTableCheckPayment,
  current: CustomerTableCheck,
) {
  if (current.remainingAmount >= pending.remainingAmount) return false;

  if (pending.confirmation.mode === "ITEMS") {
    const paidQuantities = new Map(
      current.orders.flatMap((order) =>
        order.items.map((item) => [item.orderItemId, item.paidQuantity] as const),
      ),
    );
    return pending.confirmation.items.every(
      (item) => (paidQuantities.get(item.orderItemId) ?? 0) >= item.paidQuantity,
    );
  }

  // A completed plan may no longer be returned as active. In that case the
  // reduced remaining balance above is the authoritative confirmation.
  const confirmation = pending.confirmation;
  if (!current.splitPlan) return true;
  if (current.splitPlan.splitPlanId !== confirmation.splitPlanId) return false;
  return current.splitPlan.parts.some(
    (part) => part.partNumber === confirmation.partNumber && part.status === "PAID",
  );
}

export default function PaymentCallbackClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useTranslation();
  const { isGuest } = useAuth();
  const { journey } = useTable();
  const { resetCartState } = useCart();
  const [order, setOrder] = useState<TableOrderView | null>(null);
  const paymentContextSnapshot = useSyncExternalStore(
    subscribeToTableCheckPayment,
    getTableCheckPaymentSnapshot,
    getServerPaymentContext,
  );
  const hasReadPaymentContext = useSyncExternalStore(
    subscribeToTableCheckPayment,
    getClientHydrated,
    getServerHydrated,
  );
  const pendingTablePayment = useMemo(
    () => parseTableCheckPayment(paymentContextSnapshot),
    [paymentContextSnapshot],
  );
  const [refreshedCheck, setRefreshedCheck] = useState<CustomerTableCheck | null>(null);
  const [tablePaymentVerification, setTablePaymentVerification] = useState<"confirmed" | "pending" | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCheckoutForm, setRetryCheckoutForm] = useState<string | null>(null);

  const paymentStatus = searchParams.get("status");
  const paymentId = searchParams.get("paymentId");
  const orderId = searchParams.get("orderId");
  const isTableCheckPayment = !!(
    pendingTablePayment &&
    journey &&
    pendingTablePayment.qrToken === journey.qrToken &&
    (!paymentId || paymentId === pendingTablePayment.paymentId)
  );

  // Nothing to hold in state: what we render is a pure function of the status
  // the backend redirected us with.
  const status = !hasReadPaymentContext
    ? "loading"
    : paymentStatus === "success"
      ? "success"
      : paymentStatus === "failure"
        ? "failure"
        : "loading";

  // The journey survives the provider round trip in sessionStorage, so a table
  // customer lands back on their own menu instead of the storefront.
  const tableMenuHref = journey ? `/order?qr=${encodeURIComponent(journey.qrToken)}` : null;

  // Retiring the cart is a side effect on shared state, not something we
  // render from — and it only happens on success. A failure/cancel URL
  // deliberately keeps the cart so the customer can retry.
  useEffect(() => {
    if (status !== "success" || isTableCheckPayment) return;
    // The backend callback/webhook is what actually marks the payment done;
    // reaching this URL only tells us the cart is no longer ours to reuse.
    resetCartState();
  }, [status, isTableCheckPayment, resetCartState]);

  // Existing-item payments do not consume the cart or create an order. Read
  // the shared check back before presenting the result, so paid quantities and
  // totals always come from the backend callback/webhook state.
  useEffect(() => {
    if (!isTableCheckPayment || status === "loading" || !pendingTablePayment) return;

    // Failure keeps the request marker. Retrying the exact request lets the
    // backend return the provider URL of its matching in-flight payment.
    if (status === "failure") return;

    let cancelled = false;
    (async () => {
      let latest: CustomerTableCheck | null = null;
      for (let attempt = 0; attempt < 4 && !cancelled; attempt += 1) {
        try {
          latest = await tableService.getCurrentCheck(pendingTablePayment.qrToken);
          if (isTablePaymentReflected(pendingTablePayment, latest)) {
            setRefreshedCheck(latest);
            setTablePaymentVerification("confirmed");
            forgetTableCheckPayment();
            return;
          }
        } catch (error) {
          console.error("Failed to refresh the table bill after payment", error);
        }

        if (attempt < 3) {
          await new Promise((resolve) => window.setTimeout(resolve, 1500));
        }
      }

      if (!cancelled) {
        setRefreshedCheck(latest);
        setTablePaymentVerification("pending");
        forgetTableCheckPayment();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isTableCheckPayment, status, pendingTablePayment]);

  // The success URL alone proves nothing — the backend callback/webhook is
  // what marks a payment done. Reading the order back is the only way to show
  // an authoritative result, and it needs the branch/brand context a table
  // journey carries.
  useEffect(() => {
    if (status !== "success" || isTableCheckPayment || !orderId || !journey) return;

    let cancelled = false;
    orderService
      .getOrderById(orderId, journey.branchId, journey.brandId)
      .then((fetched) => {
        if (!cancelled && fetched) setOrder(fetched as unknown as TableOrderView);
      })
      .catch((error) => {
        // Falls back to the plain confirmation below; the payment itself is
        // unaffected by our inability to read it back.
        console.error("Failed to load the order behind this payment", error);
      });

    return () => {
      cancelled = true;
    };
  }, [status, isTableCheckPayment, orderId, journey]);

  const handleContinue = () => {
    if (status !== "success") {
      router.push(tableMenuHref ?? "/");
      return;
    }

    if (tableMenuHref) {
      router.push(tableMenuHref);
      return;
    }

    // A guest has no order history page to send them to.
    router.push(isGuest ? "/" : "/profile?tab=orders");
  };

  const handleRetry = async () => {
    if (isTableCheckPayment && pendingTablePayment) {
      if (!isTableCheckPaymentActive(pendingTablePayment)) {
        forgetTableCheckPayment();
        router.push(tableMenuHref ?? "/");
        return;
      }

      setIsRetrying(true);
      try {
        if (pendingTablePayment.paymentUrl) {
          window.location.assign(pendingTablePayment.paymentUrl);
          return;
        }
        if (pendingTablePayment.checkoutFormContent) {
          setRetryCheckoutForm(pendingTablePayment.checkoutFormContent);
          return;
        }

        const existingPayment = await paymentService.getPaymentById(
          pendingTablePayment.paymentId,
        );
        const providerResponse = existingPayment.providerResponse;
        const payment = {
          paymentId: existingPayment.id,
          tableCheckId: pendingTablePayment.tableCheckId,
          expiresAt: pendingTablePayment.expiresAt,
          paymentUrl: providerResponse?.paymentPageUrl ?? providerResponse?.paymentUrl,
          checkoutFormContent: providerResponse?.checkoutFormContent,
        };
        rememberTableCheckPayment(
          pendingTablePayment.qrToken,
          payment,
          pendingTablePayment.confirmation,
          pendingTablePayment.remainingAmount,
          pendingTablePayment.request,
        );

        if (payment.paymentUrl) {
          window.location.assign(payment.paymentUrl);
        } else if (payment.checkoutFormContent) {
          setRetryCheckoutForm(payment.checkoutFormContent);
        } else {
          toast.error(t("table.check.errors.paymentMissing"));
        }
      } catch (error) {
        toast.error(resolveApiErrorMessage(error, t("table.check.errors.generic")));
      } finally {
        setIsRetrying(false);
      }
      return;
    }

    router.push(tableMenuHref ? "/order/checkout" : "/checkout");
  };

  if (retryCheckoutForm) {
    return (
      <div className="min-h-screen bg-zinc-50 py-8">
        <div className="container mx-auto max-w-2xl px-4">
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-bold text-zinc-800">
              {t("table.check.completePayment")}
            </h2>
            <div dangerouslySetInnerHTML={{ __html: retryCheckoutForm }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        {(status === "loading" || (status === "success" && isTableCheckPayment && !tablePaymentVerification)) && (
          <>
            <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Loader2 size={32} className="text-primary animate-spin" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-800 mb-2">
              {t("payment.processingTitle")}
            </h1>
            <p className="text-zinc-600 mb-6">{t("payment.processingBody")}</p>
          </>
        )}

        {status === "success" && (!isTableCheckPayment || tablePaymentVerification === "confirmed") && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-800 mb-2">
              {isTableCheckPayment ? t("table.check.paymentSuccessTitle") : t("payment.successTitle")}
            </h1>
            {/* Fulfillment is not carried through the provider round trip, and
                a pickup order can also start from the table page — so the copy
                stays neutral instead of promising table service. */}
            <p className="text-zinc-600 mb-2">
              {isTableCheckPayment
                ? t("table.check.paymentSuccessBody")
                : tableMenuHref
                  ? t("payment.successTableBody")
                  : t("payment.successBody")}
            </p>
            {isTableCheckPayment && refreshedCheck ? (
              <dl className="mb-6 mt-4 space-y-2 rounded-lg border border-zinc-100 bg-zinc-50 p-4 text-left text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">{t("table.check.paid")}</dt>
                  <dd className="font-semibold text-zinc-800">{formatCurrency(refreshedCheck.paidAmount)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">{t("table.check.remaining")}</dt>
                  <dd className="font-bold text-zinc-800">{formatCurrency(refreshedCheck.remainingAmount)}</dd>
                </div>
              </dl>
            ) : order ? (
              <dl className="mb-6 mt-4 space-y-2 rounded-lg border border-zinc-100 bg-zinc-50 p-4 text-left text-sm">
                {order.tableLabel && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">{t("payment.table")}</dt>
                    <dd className="font-medium text-zinc-800">{order.tableLabel}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">{t("table.success.total")}</dt>
                  <dd className="font-bold text-zinc-800">
                    {formatCurrency(
                      order.totalPrice,
                      order.currencySymbol ?? resolveCurrencySymbol(order.currency),
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">{t("payment.orderId")}</dt>
                  <dd className="font-mono text-xs text-zinc-600">{order.id}</dd>
                </div>
              </dl>
            ) : (
              !isTableCheckPayment && orderId && (
                <p className="text-sm text-zinc-500 mb-6">
                  {t("payment.orderId")}: {orderId}
                </p>
              )
            )}
            <button
              onClick={handleContinue}
              className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:opacity-90 transition-opacity"
            >
              {tableMenuHref
                ? isTableCheckPayment
                  ? t("table.check.viewBill")
                  : t("table.success.orderMore")
                : orderId
                  ? t("payment.viewOrder")
                  : t("payment.continueShopping")}
            </button>
          </>
        )}

        {status === "success" && isTableCheckPayment && tablePaymentVerification === "pending" && (
          <>
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Clock3 size={32} className="text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-800 mb-2">
              {t("table.check.paymentPendingTitle")}
            </h1>
            <p className="text-zinc-600 mb-6">{t("table.check.paymentPendingBody")}</p>
            {refreshedCheck && (
              <p className="mb-6 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600">
                {t("table.check.remainingSummary", { amount: formatCurrency(refreshedCheck.remainingAmount) })}
              </p>
            )}
            <button
              onClick={handleContinue}
              className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:opacity-90 transition-opacity"
            >
              {t("table.check.viewBill")}
            </button>
          </>
        )}

        {status === "failure" && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle size={32} className="text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-800 mb-2">
              {t("payment.failureTitle")}
            </h1>
            <p className="text-zinc-600 mb-6">{t("payment.failureBody")}</p>
            <div className="space-y-3">
              <button
                onClick={() => void handleRetry()}
                disabled={isRetrying}
                className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isRetrying
                  ? t("table.check.startingPayment")
                  : isTableCheckPayment
                    ? t("table.check.resumePayment")
                    : t("payment.tryAgain")}
              </button>
              <button
                onClick={() => router.push(tableMenuHref ?? "/")}
                className="w-full border border-zinc-200 text-zinc-700 font-medium py-3 rounded-lg hover:bg-zinc-50 transition-colors"
              >
                {tableMenuHref ? t("table.checkout.backToMenu") : t("payment.backHome")}
              </button>
            </div>
          </>
        )}

        {paymentId && (
          <p className="text-xs text-zinc-400 mt-6">
            {t("payment.paymentId")}: {paymentId}
          </p>
        )}
      </div>
    </div>
  );
}
