import { Suspense } from "react";

import PaymentCallbackClient from "./PaymentCallbackClient";

function PaymentCallbackFallback() {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="text-center text-zinc-600">
        Loading payment status...
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
