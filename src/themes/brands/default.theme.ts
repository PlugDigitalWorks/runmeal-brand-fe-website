import { Theme } from "../types";

export const defaultTheme: Theme = {
    name: "Default",
    slug: "default",
    colors: {
        background: "#ffffff",
        foreground: "#18181b",
        primary: "#f54900",
        primaryForeground: "#ffffff",
        secondary: "#f4f4f5",
        secondaryForeground: "#18181b",
        muted: "#f4f4f5",
        mutedForeground: "#71717a",
        accent: "#f4f4f5",
        accentForeground: "#18181b",
        destructive: "#ef4444",
        destructiveForeground: "#ffffff",
        border: "#e4e4e7",
        input: "#e4e4e7",
        ring: "#f54900",
    },
    config: {
        radius: "0.5rem",
    },
};
