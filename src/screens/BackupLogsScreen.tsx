import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Animated, Alert, Share, Platform,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getLogs, clearLogs, DeletionLog, getScannedPosts, PostData } from '../utils/storage';
import { Typography, Spacing, BorderRadius } from '../theme/typography';

export default function BackupLogsScreen() {
    const { colors } = useTheme();
    const { t } = useLanguage();
    const [logs, setLogs] = useState<DeletionLog[]>([]);
    const [scannedPosts, setScannedPosts] = useState<PostData[]>([]);
    const [activeTab, setActiveTab] = useState<'backup' | 'logs'>('backup');
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
        loadData();
    }, []);

    const loadData = async () => {
        setLogs(await getLogs());
        setScannedPosts(await getScannedPosts());
    };

    const exportData = async (format: 'csv' | 'json') => {
        try {
            const data = scannedPosts.length > 0 ? scannedPosts : logs;
            let content = '';
            let title = '';

            if (format === 'csv') {
                title = 'linkedin_backup.csv';
                if (scannedPosts.length > 0) {
                    content = 'ID,Text,Type,Date,Likes,Comments,Visibility\n' +
                        scannedPosts.map(p => `"${p.id}","${p.text.replace(/"/g, '""')}","${p.type}","${p.date}",${p.likes},${p.comments},"${p.visibility}"`).join('\n');
                } else {
                    content = 'ID,PostID,Text,Type,Status,Timestamp\n' +
                        logs.map(l => `"${l.id}","${l.postId}","${l.postText.replace(/"/g, '""')}","${l.postType}","${l.status}","${l.timestamp}"`).join('\n');
                }
            } else {
                title = 'linkedin_backup.json';
                content = JSON.stringify(scannedPosts.length > 0 ? scannedPosts : logs, null, 2);
            }

            await Share.share({ message: content, title });
            Alert.alert(t('success'), t('backup_success'));
        } catch (e) {
            Alert.alert(t('error'), String(e));
        }
    };

    const handleClearLogs = () => {
        Alert.alert(t('warning'), t('backup_clear_confirm'), [
            { text: t('cancel'), style: 'cancel' },
            { text: t('clear'), style: 'destructive', onPress: async () => { await clearLogs(); setLogs([]); } },
        ]);
    };

    return (
        <Animated.View style={[st.container, { backgroundColor: colors.background, opacity: fadeAnim }]}>
            <View style={[st.header, { backgroundColor: colors.secondary }]}>
                <Text style={st.headerTitle}>{t('backup_title')}</Text>
            </View>

            {/* Tab Switcher */}
            <View style={[st.tabRow, { backgroundColor: colors.card }]}>
                <TouchableOpacity style={[st.tab, activeTab === 'backup' && { backgroundColor: colors.primary }]} onPress={() => setActiveTab('backup')}>
                    <Text style={[st.tabTxt, { color: activeTab === 'backup' ? '#FFF' : colors.textSecondary }]}>💾 {t('backup_export')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.tab, activeTab === 'logs' && { backgroundColor: colors.primary }]} onPress={() => setActiveTab('logs')}>
                    <Text style={[st.tabTxt, { color: activeTab === 'logs' ? '#FFF' : colors.textSecondary }]}>📋 {t('backup_logs')}</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
                {activeTab === 'backup' ? (
                    <View>
                        <View style={[st.section, { backgroundColor: colors.card }]}>
                            <Text style={[st.secTitle, { color: colors.text }]}>📤 {t('backup_export')}</Text>
                            <Text style={[st.secDesc, { color: colors.textSecondary }]}>
                                {scannedPosts.length > 0 ? `${scannedPosts.length} scanned posts available for backup` : logs.length > 0 ? `${logs.length} log entries available for backup` : 'No data available to export'}
                            </Text>

                            <TouchableOpacity style={[st.exportBtn, { backgroundColor: colors.accentLight }]} onPress={() => exportData('csv')} activeOpacity={0.7}>
                                <Text style={st.exportIcon}>📊</Text>
                                <View style={{ flex: 1 }}>
                                    <Text style={[st.exportTitle, { color: colors.accent }]}>{t('backup_csv')}</Text>
                                    <Text style={[st.exportDesc, { color: colors.textTertiary }]}>Spreadsheet format</Text>
                                </View>
                                <Text style={{ color: colors.textTertiary }}>→</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={[st.exportBtn, { backgroundColor: colors.infoLight }]} onPress={() => exportData('json')} activeOpacity={0.7}>
                                <Text style={st.exportIcon}>{'{}'}</Text>
                                <View style={{ flex: 1 }}>
                                    <Text style={[st.exportTitle, { color: colors.info }]}>{t('backup_json')}</Text>
                                    <Text style={[st.exportDesc, { color: colors.textTertiary }]}>Developer format</Text>
                                </View>
                                <Text style={{ color: colors.textTertiary }}>→</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <View>
                        <View style={[st.section, { backgroundColor: colors.card }]}>
                            <View style={st.logsHeader}>
                                <Text style={[st.secTitle, { color: colors.text }]}>📋 {t('backup_logs')} ({logs.length})</Text>
                                {logs.length > 0 && (
                                    <TouchableOpacity onPress={handleClearLogs} style={[st.clearBtn, { backgroundColor: colors.dangerLight }]}>
                                        <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '600' }}>{t('backup_clear_logs')}</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {logs.length === 0 ? (
                                <View style={st.empty}>
                                    <Text style={{ fontSize: 40 }}>📭</Text>
                                    <Text style={[{ color: colors.textSecondary, marginTop: 8 }]}>{t('backup_no_logs')}</Text>
                                </View>
                            ) : (
                                logs.map((log, i) => (
                                    <View key={log.id + i} style={[st.logItem, { borderBottomColor: colors.borderLight }]}>
                                        <View style={[st.logDot, { backgroundColor: log.status === 'deleted' ? colors.accent : log.status === 'dry_run' ? colors.warning : colors.danger }]} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={[{ color: colors.text, fontSize: 13, fontWeight: '500' }]} numberOfLines={1}>{log.postText}</Text>
                                            <Text style={[{ color: colors.textTertiary, fontSize: 10, marginTop: 2 }]}>
                                                {log.postType} • {log.status.replace('_', ' ')} • {new Date(log.timestamp).toLocaleString()}
                                            </Text>
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>
                    </View>
                )}
                <View style={{ height: 100 }} />
            </ScrollView>
        </Animated.View>
    );
}

const st = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingTop: 60, paddingBottom: Spacing.lg, paddingHorizontal: Spacing.xl, borderBottomLeftRadius: BorderRadius.xl, borderBottomRightRadius: BorderRadius.xl },
    headerTitle: { fontSize: 30, fontWeight: '700', color: '#FFF' },
    tabRow: { flexDirection: 'row', marginHorizontal: 16, marginTop: 16, borderRadius: 14, padding: 4 },
    tab: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
    tabTxt: { fontSize: 14, fontWeight: '600' },
    scroll: { paddingHorizontal: 16, paddingTop: 16 },
    section: { padding: 16, borderRadius: 14, marginBottom: 16 },
    secTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
    secDesc: { fontSize: 13, marginBottom: 16 },
    exportBtn: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 10, gap: 12 },
    exportIcon: { fontSize: 24 },
    exportTitle: { fontSize: 16, fontWeight: '600' },
    exportDesc: { fontSize: 11, marginTop: 2 },
    logsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    clearBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
    empty: { alignItems: 'center', paddingVertical: 32 },
    logItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, gap: 10 },
    logDot: { width: 8, height: 8, borderRadius: 4 },
});
