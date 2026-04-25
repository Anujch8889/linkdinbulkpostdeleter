import React, { useRef, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    Animated,
    TouchableOpacity,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Typography, Spacing, BorderRadius } from '../theme/typography';

interface LoginScreenProps {
    onLoginSuccess: () => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
    const { colors } = useTheme();
    const { t } = useLanguage();
    const webViewRef = useRef<WebView>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const reload = () => {
        setError(false);
        setLoading(true);
        webViewRef.current?.reload();
    };

    React.useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
        }).start();
    }, [fadeAnim]);

    const handleNavigationChange = useCallback(
        (navState: WebViewNavigation) => {
            const { url } = navState;
            console.log('WebView URL:', url); // Debug log
            // Detect successful login
            if (
                url.includes('linkedin.com/feed') ||
                url.includes('linkedin.com/in/') ||
                url.includes('linkedin.com/mynetwork')
            ) {
                onLoginSuccess();
            }
        },
        [onLoginSuccess],
    );

    return (
        <Animated.View
            style={[
                styles.container,
                { backgroundColor: colors.background, opacity: fadeAnim },
            ]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.primary }]}>
                <Text style={styles.headerIcon}>🔗</Text>
                <Text style={styles.headerTitle}>{t('login_title')}</Text>
                <Text style={styles.headerSubtitle}>{t('login_subtitle')}</Text>
            </View>

            {/* WebView */}
            <View style={[styles.webviewContainer, { borderColor: colors.border }]}>
                {loading && (
                    <View style={styles.progressBar}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={{ marginLeft: 8, color: colors.textSecondary }}>{t('loading')}...</Text>
                    </View>
                )}
                {error ? (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{t('error')}</Text>
                        <Text style={styles.errorSubText}>Check your internet connection</Text>
                        <TouchableOpacity style={styles.retryBtn} onPress={reload}>
                            <Text style={styles.retryText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <WebView
                        ref={webViewRef}
                        source={{ uri: 'https://www.linkedin.com/login' }}
                        onNavigationStateChange={handleNavigationChange}
                        onLoadStart={() => { setLoading(true); setError(false); }}
                        onLoadEnd={() => setLoading(false)}
                        onError={() => { setLoading(false); setError(true); }}
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                        sharedCookiesEnabled={true}
                        thirdPartyCookiesEnabled={true}
                        userAgent="Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
                        style={styles.webview}
                    />
                )}
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingTop: 60,
        paddingBottom: Spacing.xl,
        paddingHorizontal: Spacing.xl,
        alignItems: 'center',
        borderBottomLeftRadius: BorderRadius.xl,
        borderBottomRightRadius: BorderRadius.xl,
    },
    headerIcon: {
        fontSize: 40,
        marginBottom: Spacing.sm,
    },
    headerTitle: {
        fontSize: Typography.sizes.xxl,
        fontWeight: Typography.weights.bold,
        color: '#FFFFFF',
        marginBottom: Spacing.xs,
    },
    headerSubtitle: {
        fontSize: Typography.sizes.md,
        color: 'rgba(255,255,255,0.8)',
        textAlign: 'center',
    },
    webviewContainer: {
        flex: 1,
        margin: Spacing.base,
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
        borderWidth: 1,
    },
    webview: {
        flex: 1,
    },
    progressBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
        backgroundColor: '#f0f0f0',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#e74c3c', // Use logic for colors if needed, but hardcode for fail-safe
        marginBottom: 8,
    },
    errorSubText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 20,
    },
    retryBtn: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#0077b5',
        borderRadius: 8,
    },
    retryText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
});
