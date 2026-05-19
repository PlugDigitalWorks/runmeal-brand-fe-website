import { BranchSelector } from "@/components/features/BranchSelector";
import { ProductList } from "@/components/features/ProductList";
import { CartSidebar } from "@/components/features/CartSidebar";
import { MobileCartFab } from "@/components/features/MobileCartFab";

export default function Home() {
    return (
        <div className="flex flex-col lg:flex-row gap-6">
            {/* Main Content */}
            <div className="flex-1 min-w-0">
                <BranchSelector />
                <ProductList />
            </div>

            {/* Sidebar */}
            <aside>
                <CartSidebar />
            </aside>
            <MobileCartFab />
        </div>
    );
}
