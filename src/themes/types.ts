export interface ThemeColors {
    background: string;
    foreground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    destructive: string;
    destructiveForeground: string;
    border: string;
    input: string;
    ring: string;
}

export interface ThemeConfig {
    radius: string;
}

export interface Theme {
    name: string;
    slug: string;
    colors: ThemeColors;
    config: ThemeConfig;
}
