"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useTable } from "@/context/TableContext";

export default function PaymentCallbackClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useTranslation();
  const { isGuest } = useAuth();
  const { journey } = useTable();
  const { resetCartState } = useCart();
  const [status, setStatus] = useState<"loading" | "success" | "failure">(
    "loading",
  );

  const paymentStatus = searchParams.get("status");
  const paymentId = searchParams.get("paymentId");
  const orderId = searchParams.get("orderId");

  // The journey survives the provider round trip in sessionStorage, so a table
  // customer lands back on their own menu instead of the storefront.
  const tableMenuHref = journey ? `/order?qr=${encodeURIComponent(journey.qrToken)}` : null;

  useEffect(() => {
    if (paymentStatus === "success") {
      setStatus("success");
      // The backend callback/webhook is what actually marks the payment done;
      // reaching this URL only tells us the cart is no longer ours to reuse.
      resetCartState();
    } else if (paymentStatus === "failure") {
      // Deliberately keeps the cart: the customer must be able to retry.
      setStatus("failure");
    } else {
      setStatus("loading");
    }
  }, [paymentStatus, resetCartState]);

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

  const handleRetry = () => {
    router.push(tableMenuHref ? "/order/checkout" : "/checkout");
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        {status === "loading" && (
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

        {status === "success" && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-800 mb-2">
              {t("payment.successTitle")}
            </h1>
            {/* Fulfillment is not carried through the provider round trip, and
                a pickup order can also start from the table page — so the copy
                stays neutral instead of promising table service. */}
            <p className="text-zinc-600 mb-2">
              {tableMenuHref ? t("payment.successTableBody") : t("payment.successBody")}
            </p>
            {orderId && (
              <p className="text-sm text-zinc-500 mb-6">
                {t("payment.orderId")}: {orderId}
              </p>
            )}
            <button
              onClick={handleContinue}
              className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:opacity-90 transition-opacity"
            >
              {tableMenuHref
                ? t("table.success.orderMore")
                : orderId
                  ? t("payment.viewOrder")
                  : t("payment.continueShopping")}
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
                onClick={handleRetry}
                className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:opacity-90 transition-opacity"
              >
                {t("payment.tryAgain")}
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
