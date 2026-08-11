import { Suspense } from "react";

import PaymentCallbackClient from "./PaymentCallbackClient";

function PaymentCallbackFallback() {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="text-center text-zinc-600">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-primary" />
      </div>
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={<PaymentCallbackFallback />}>
      <PaymentCallbackClient />
    </Suspense>
  );
}
