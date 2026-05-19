"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Theme } from "./types";
import { getTheme, getCdnUrl } from "./index";

interface ThemeContextType {
    theme: Theme;
    cdnBaseUrl: string;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    // Initialize with default theme to avoid hydration mismatch
    // We'll update to the correct theme in useEffect if needed, 
    // but since getTheme relies on env vars which are available at build/runtime,
    // we can usually initialize directly.
    const [theme] = useState<Theme>(getTheme());
    const cdnBaseUrl = getCdnUrl();

    useEffect(() => {
        const root = document.documentElement;

        // Set CSS variables
        Object.entries(theme.colors).forEach(([key, value]) => {
            // Convert camelCase to kebab-case for CSS variables
            // e.g. primaryForeground -> --primary-foreground
            const cssVar = `--${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
            root.style.setProperty(cssVar, value);
        });

        // Set config variables
        root.style.setProperty("--radius", theme.config.radius);

    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, cdnBaseUrl }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
};
