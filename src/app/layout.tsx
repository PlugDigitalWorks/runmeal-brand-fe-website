import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import { UserProvider } from "@/context/UserContext";
import { BranchProvider } from "@/context/BranchContext";
import { CartProvider } from "@/context/CartContext";
import { Header } from "@/components/layout/Header";
import { GoogleMapsProvider } from "@/providers/GoogleMapsProvider";
import { AuthModal } from "@/components/features/AuthModal";
import { ThemeProvider } from "@/themes/ThemeProvider";

export const metadata: Metadata = {
  title: "Food Delivery",
  description: "Food Delivery Application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <ThemeProvider>
          <AuthProvider>
            <UserProvider>
              <GoogleMapsProvider>
                <BranchProvider>
                  <CartProvider>
                    <Header />
                    <main className="container mx-auto py-8 px-4">
                      {children}
                    </main>
                    <Toaster position="bottom-left" />
                    <AuthModal />
                  </CartProvider>
                </BranchProvider>
              </GoogleMapsProvider>
            </UserProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
