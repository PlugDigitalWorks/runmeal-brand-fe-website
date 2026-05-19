"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function PaymentCallbackClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "failure">(
    "loading",
  );

  const paymentStatus = searchParams.get("status");
  const paymentId = searchParams.get("paymentId");
  const orderId = searchParams.get("orderId");

  useEffect(() => {
    if (paymentStatus === "success") {
      setStatus("success");
    } else if (paymentStatus === "failure") {
      setStatus("failure");
    } else {
      setStatus("loading");
    }
  }, [paymentStatus]);

  const handleContinue = () => {
    if (status === "success") {
      router.push(`/profile?tab=orders`);
    } else {
      router.push("/");
    }
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
              Processing Payment
            </h1>
            <p className="text-zinc-600 mb-6">
              Please wait while we confirm your payment...
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-800 mb-2">
              Payment Successful!
            </h1>
            <p className="text-zinc-600 mb-2">
              Your order has been placed successfully.
            </p>
            {orderId && (
              <p className="text-sm text-zinc-500 mb-6">Order ID: {orderId}</p>
            )}
            <button
              onClick={handleContinue}
              className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:opacity-90 transition-opacity"
            >
              {orderId ? "View Order" : "Continue Shopping"}
            </button>
          </>
        )}

        {status === "failure" && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle size={32} className="text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-800 mb-2">
              Payment Failed
            </h1>
            <p className="text-zinc-600 mb-6">
              Unfortunately, your payment could not be processed. Please try
              again.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => router.push("/checkout")}
                className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:opacity-90 transition-opacity"
              >
                Try Again
              </button>
              <button
                onClick={() => router.push("/")}
                className="w-full border border-zinc-200 text-zinc-700 font-medium py-3 rounded-lg hover:bg-zinc-50 transition-colors"
              >
                Back to Home
              </button>
            </div>
          </>
        )}

        {paymentId && (
          <p className="text-xs text-zinc-400 mt-6">Payment ID: {paymentId}</p>
        )}
      </div>
    </div>
  );
}
