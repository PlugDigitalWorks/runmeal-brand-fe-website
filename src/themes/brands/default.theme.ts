import { Theme } from "../types";

export const defaultTheme: Theme = {
    name: "Default",
    slug: "default",
    colors: {
        background: "#fffaf5",
        foreground: "#0f172a",
        primary: "#f5a623",
        primaryForeground: "#ffffff",
        secondary: "#fff1df",
        secondaryForeground: "#1f2937",
        muted: "#fffaf5",
        mutedForeground: "#4b5563",
        accent: "#fff1df",
        accentForeground: "#e28900",
        destructive: "#ef4444",
        destructiveForeground: "#ffffff",
        border: "#f2e6d7",
        input: "#f2e6d7",
        ring: "#e28900",
    },
    config: {
        radius: "0.5rem",
    },
};
