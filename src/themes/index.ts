import { Theme } from "./types";
import { defaultTheme } from "./brands/default.theme";
import { brandATheme } from "./brands/brand-a.theme";
import { brandBTheme } from "./brands/brand-b.theme";

const themes: Record<string, Theme> = {
    default: defaultTheme,
    "brand-a": brandATheme,
    "brand-b": brandBTheme,
};

export const getTheme = (): Theme => {
    const themeSlug = process.env.NEXT_PUBLIC_THEME || "default";
    return themes[themeSlug] || defaultTheme;
};

export const getCdnUrl = (): string => {
    return process.env.NEXT_PUBLIC_CDN_BASE_URL || "";
};
