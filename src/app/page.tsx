import { Suspense } from "react";

import { BranchSelector } from "@/components/features/BranchSelector";
import { ProductList } from "@/components/features/ProductList";
import { CartSidebar } from "@/components/features/CartSidebar";
import { MobileCartFab } from "@/components/features/MobileCartFab";

function MenuFallback() {
    return (
        <div className="flex min-h-[500px] items-center justify-center rounded-lg border border-zinc-100 bg-white shadow-sm">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-primary" />
        </div>
    );
}

export default function Home() {
    return (
        <div className="flex flex-col lg:flex-row gap-6">
            {/* Main Content */}
            <div className="flex-1 min-w-0">
                <BranchSelector />
                {/* The menu reads `?category=`/`?product=` reward deep links. */}
                <Suspense fallback={<MenuFallback />}>
                    <ProductList />
                </Suspense>
            </div>

            {/* Sidebar */}
            <aside>
                <CartSidebar />
            </aside>
            <MobileCartFab />
        </div>
    );
}
