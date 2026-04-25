import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Animated,
    RefreshControl,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getStats, DeletionStats, getLogs, DeletionLog } from '../utils/storage';
import { Typography, Spacing, BorderRadius } from '../theme/typography';

export default function DashboardScreen() {
    const { colors } = useTheme();
    const { t } = useLanguage();
    const [stats, setStats] = useState<DeletionStats>({
        totalScanned: 0,
        totalSelected: 0,
        totalDeleted: 0,
        totalFailed: 0,
        deletedByType: { text: 0, image: 0, video: 0, poll: 0, repost: 0 },
    });
    const [recentLogs, setRecentLogs] = useState<DeletionLog[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    // Animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(50))).current;

    useEffect(() => {
        loadData();
        animateIn();
    }, []);

    const animateIn = () => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
        }).start();

        slideAnims.forEach((anim, index) => {
            Animated.spring(anim, {
                toValue: 0,
                delay: index * 100,
                useNativeDriver: true,
                tension: 60,
                friction: 8,
            }).start();
        });
    };

    const loadData = async () => {
        const s = await getStats();
        setStats(s);
        const logs = await getLogs();
        setRecentLogs(logs.slice(0, 5));
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const statCards = [
        { label: t('dashboard_scanned'), value: stats.totalScanned, color: colors.info, bg: colors.infoLight, icon: '🔍' },
        { label: t('dashboard_selected'), value: stats.totalSelected, color: colors.warning, bg: colors.warningLight, icon: '✅' },
        { label: t('dashboard_deleted'), value: stats.totalDeleted, color: colors.accent, bg: colors.accentLight, icon: '🗑️' },
        { label: t('dashboard_failed'), value: stats.totalFailed, color: colors.danger, bg: colors.dangerLight, icon: '❌' },
    ];

    const typeData = [
        { label: t('filter_text'), value: stats.deletedByType.text, emoji: '📝' },
        { label: t('filter_image'), value: stats.deletedByType.image, emoji: '🖼️' },
        { label: t('filter_video'), value: stats.deletedByType.video, emoji: '🎬' },
        { label: t('filter_poll'), value: stats.deletedByType.poll, emoji: '📊' },
        { label: t('filter_repost'), value: stats.deletedByType.repost, emoji: '🔄' },
    ];

    const totalTypeDeleted = Object.values(stats.deletedByType).reduce((a, b) => a + b, 0);

    return (
        <Animated.View style={[styles.container, { backgroundColor: colors.background, opacity: fadeAnim }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.primary }]}>
                <Text style={styles.headerTitle}>{t('dashboard_title')}</Text>
                <Text style={styles.headerSubtitle}>{t('app_name')}</Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                }
                showsVerticalScrollIndicator={false}>

                {/* Stat Cards Grid */}
                <View style={styles.statsGrid}>
                    {statCards.map((card, index) => (
                        <Animated.View
                            key={card.label}
                            style={[
                                styles.statCard,
                                {
                                    backgroundColor: colors.card,
                                    shadowColor: colors.cardShadow,
                                    transform: [{ translateY: slideAnims[index] }],
                                },
                            ]}>
                            <View style={[styles.statIconBg, { backgroundColor: card.bg }]}>
                                <Text style={styles.statIcon}>{card.icon}</Text>
                            </View>
                            <Text style={[styles.statValue, { color: card.color }]}>
                                {card.value}
                            </Text>
                            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                                {card.label}
                            </Text>
                        </Animated.View>
                    ))}
                </View>

                {/* Deleted by Type Section */}
                <View style={[styles.section, { backgroundColor: colors.card, shadowColor: colors.cardShadow }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                        {t('dashboard_by_type')}
                    </Text>
                    {typeData.map(item => {
                        const percentage = totalTypeDeleted > 0 ? (item.value / totalTypeDeleted) * 100 : 0;
                        return (
                            <View key={item.label} style={styles.typeRow}>
                                <View style={styles.typeInfo}>
                                    <Text style={styles.typeEmoji}>{item.emoji}</Text>
                                    <Text style={[styles.typeLabel, { color: colors.text }]}>{item.label}</Text>
                                </View>
                                <View style={styles.typeBarContainer}>
                                    <View style={[styles.typeBarBg, { backgroundColor: colors.progressBg }]}>
                                        <View
                                            style={[
                                                styles.typeBarFill,
                                                {
                                                    width: `${Math.max(percentage, 2)}%`,
                                                    backgroundColor: colors.primary,
                                                },
                                            ]}
                                        />
                                    </View>
                                    <Text style={[styles.typeCount, { color: colors.textSecondary }]}>
                                        {item.value}
                                    </Text>
                                </View>
                            </View>
                        );
                    })}
                </View>

                {/* Recent Activity Removed as per request */}

                <View style={styles.bottomSpacer} />
            </ScrollView>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingTop: 60,
        paddingBottom: Spacing.lg,
        paddingHorizontal: Spacing.xl,
        borderBottomLeftRadius: BorderRadius.xl,
        borderBottomRightRadius: BorderRadius.xl,
    },
    headerTitle: {
        fontSize: Typography.sizes.xxxl,
        fontWeight: Typography.weights.bold,
        color: '#FFFFFF',
    },
    headerSubtitle: {
        fontSize: Typography.sizes.sm,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 2,
    },
    scrollContent: {
        paddingHorizontal: Spacing.base,
        paddingTop: Spacing.lg,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.md,
        marginBottom: Spacing.lg,
    },
    statCard: {
        width: '47%',
        padding: Spacing.base,
        borderRadius: BorderRadius.lg,
        alignItems: 'center',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
        elevation: 3,
    },
    statIconBg: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    statIcon: {
        fontSize: 20,
    },
    statValue: {
        fontSize: Typography.sizes.xxl,
        fontWeight: Typography.weights.extrabold,
    },
    statLabel: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.medium,
        marginTop: 2,
    },
    section: {
        padding: Spacing.base,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.base,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
        elevation: 3,
    },
    sectionTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.base,
    },
    typeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    typeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        width: 90,
    },
    typeEmoji: {
        fontSize: 16,
        marginRight: Spacing.sm,
    },
    typeLabel: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.medium,
    },
    typeBarContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    typeBarBg: {
        flex: 1,
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
    },
    typeBarFill: {
        height: '100%',
        borderRadius: 4,
    },
    typeCount: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.semibold,
        width: 30,
        textAlign: 'right',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: Spacing.xxl,
    },
    emptyIcon: {
        fontSize: 40,
        marginBottom: Spacing.md,
    },
    emptyText: {
        fontSize: Typography.sizes.md,
        textAlign: 'center',
    },
    logItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
    },
    logStatusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: Spacing.md,
    },
    logContent: {
        flex: 1,
    },
    logText: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.medium,
    },
    logMeta: {
        fontSize: Typography.sizes.xs,
        marginTop: 2,
    },
    bottomSpacer: {
        height: 100,
    },
});
