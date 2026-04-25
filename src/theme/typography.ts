import { Platform } from 'react-native';

export const Typography = {
    fontFamily: Platform.select({
        ios: 'System',
        android: 'Roboto',
    }),

    sizes: {
        xs: 10,
        sm: 12,
        md: 14,
        base: 16,
        lg: 18,
        xl: 20,
        xxl: 24,
        xxxl: 30,
        display: 36,
    },

    weights: {
        regular: '400' as const,
        medium: '500' as const,
        semibold: '600' as const,
        bold: '700' as const,
        extrabold: '800' as const,
    },

    lineHeights: {
        tight: 1.2,
        normal: 1.4,
        relaxed: 1.6,
    },
};

export const Spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    base: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    xxxl: 40,
};

export const BorderRadius = {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    full: 999,
};
