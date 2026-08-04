import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { BrandProvider } from "@/context/BrandContext";
import { AuthProvider } from "@/context/AuthContext";
import { UserProvider } from "@/context/UserContext";
import { BranchProvider } from "@/context/BranchContext";
import { CartProvider } from "@/context/CartContext";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CmsNavigationProvider } from "@/context/CmsNavigationContext";
import { GoogleMapsProvider } from "@/providers/GoogleMapsProvider";
import { AuthModal } from "@/components/features/AuthModal";
import { ThemeProvider } from "@/themes/ThemeProvider";
import { I18nProvider } from "@/i18n/I18nProvider";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3002"),
  applicationName: "Runmeal",
  title: {
    default: "Runmeal | Online Food Ordering",
    template: "%s | Runmeal",
  },
  description:
    "Browse nearby restaurant branches, choose a delivery address, order from fresh menus, and complete secure Runmeal checkout.",
  keywords: [
    "Runmeal",
    "online food ordering",
    "restaurant delivery",
    "menu ordering",
  ],
  authors: [{ name: "Runmeal" }],
  creator: "Runmeal",
  publisher: "Runmeal",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Runmeal",
    title: "Runmeal | Online Food Ordering",
    description:
      "Find branches that deliver to your address, browse menus, and place secure Runmeal orders online.",
  },
  twitter: {
    card: "summary",
    title: "Runmeal | Online Food Ordering",
    description:
      "Find branches that deliver to your address, browse menus, and place secure Runmeal orders online.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <I18nProvider>
        <ThemeProvider>
          <BrandProvider>
          <AuthProvider>
            <UserProvider>
              <GoogleMapsProvider>
                <BranchProvider>
                  <CartProvider>
                    <CmsNavigationProvider>
                      <div className="flex min-h-screen flex-col">
                        <Header />
                        <main className="container mx-auto flex-1 py-8 px-4">
                          {children}
                        </main>
                        <Footer />
                      </div>
                      <Toaster position="bottom-left" />
                      <AuthModal />
                    </CmsNavigationProvider>
                  </CartProvider>
                </BranchProvider>
              </GoogleMapsProvider>
            </UserProvider>
          </AuthProvider>
          </BrandProvider>
        </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
