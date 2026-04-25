import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Switch, Animated, Alert,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getSettings, saveSettings, clearSession, AppSettings } from '../utils/storage';
import { SpeedMode } from '../utils/linkedinService';
import { Spacing, BorderRadius } from '../theme/typography';

interface Props { onLogout: () => void; }

export default function SettingsScreen({ onLogout }: Props) {
    const { colors, isDark, toggleTheme } = useTheme();
    const { t, language, setLanguage } = useLanguage();
    const [settings, setSettings] = useState<AppSettings>({ defaultSpeed: 'slow', defaultSessionLimit: 25, humanLikeBehavior: true, backupBeforeDelete: true });
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
        loadSettings();
    }, []);

    const loadSettings = async () => { setSettings(await getSettings()); };

    const updateSetting = async (key: keyof AppSettings, value: any) => {
        const updated = { ...settings, [key]: value };
        setSettings(updated);
        await saveSettings(updated);
    };

    const handleLogout = () => {
        Alert.alert(t('logout'), t('logout_confirm'), [
            { text: t('cancel'), style: 'cancel' },
            { text: t('logout'), style: 'destructive', onPress: async () => { await clearSession(); onLogout(); } },
        ]);
    };

    const speedOpts: { key: SpeedMode; label: string; emoji: string }[] = [
        { key: 'slow', label: t('delete_speed_slow'), emoji: '🐢' },
        { key: 'normal', label: t('delete_speed_normal'), emoji: '🚶' },
        { key: 'fast', label: t('delete_speed_fast'), emoji: '🏃' },
    ];

    const Row = ({ icon, label, desc, right }: { icon: string; label: string; desc?: string; right: React.ReactNode }) => (
        <View style={st.row}>
            <Text style={st.rowIcon}>{icon}</Text>
            <View style={{ flex: 1 }}>
                <Text style={[st.rowLabel, { color: colors.text }]}>{label}</Text>
                {desc && <Text style={[st.rowDesc, { color: colors.textTertiary }]}>{desc}</Text>}
            </View>
            {right}
        </View>
    );

    return (
        <Animated.View style={[st.container, { backgroundColor: colors.background, opacity: fadeAnim }]}>
            <View style={[st.header, { backgroundColor: colors.primary }]}>
                <Text style={st.headerTitle}>{t('settings_title')}</Text>
            </View>

            <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
                {/* Appearance */}
                <View style={[st.section, { backgroundColor: colors.card }]}>
                    <Text style={[st.secTitle, { color: colors.text }]}>🎨 {t('settings_theme')}</Text>
                    <Row icon={isDark ? '🌙' : '☀️'} label={t('settings_dark_mode')} right={
                        <Switch value={isDark} onValueChange={toggleTheme} trackColor={{ true: colors.primary, false: colors.progressBg }} thumbColor="#FFF" />
                    } />
                </View>

                {/* Language */}
                <View style={[st.section, { backgroundColor: colors.card }]}>
                    <Text style={[st.secTitle, { color: colors.text }]}>🌐 {t('settings_language')}</Text>
                    <View style={st.langRow}>
                        <TouchableOpacity style={[st.langBtn, { backgroundColor: language === 'en' ? colors.chipActiveBg : colors.chipBg, borderColor: language === 'en' ? colors.primary : 'transparent' }]} onPress={() => setLanguage('en')}>
                            <Text style={{ fontSize: 20 }}>🇺🇸</Text>
                            <Text style={[st.langTxt, { color: language === 'en' ? colors.chipActiveText : colors.textSecondary }]}>{t('settings_english')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[st.langBtn, { backgroundColor: language === 'hi' ? colors.chipActiveBg : colors.chipBg, borderColor: language === 'hi' ? colors.primary : 'transparent' }]} onPress={() => setLanguage('hi')}>
                            <Text style={{ fontSize: 20 }}>🇮🇳</Text>
                            <Text style={[st.langTxt, { color: language === 'hi' ? colors.chipActiveText : colors.textSecondary }]}>{t('settings_hindi')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Defaults */}
                <View style={[st.section, { backgroundColor: colors.card }]}>
                    <Text style={[st.secTitle, { color: colors.text }]}>⚙️ Defaults</Text>
                    <Text style={[st.fLabel, { color: colors.text }]}>⚡ {t('settings_default_speed')}</Text>
                    <View style={st.chipRow}>
                        {speedOpts.map(o => (
                            <TouchableOpacity key={o.key} style={[st.chip, { backgroundColor: settings.defaultSpeed === o.key ? colors.chipActiveBg : colors.chipBg, borderColor: settings.defaultSpeed === o.key ? colors.primary : 'transparent' }]} onPress={() => updateSetting('defaultSpeed', o.key)}>
                                <Text style={[st.chipTxt, { color: settings.defaultSpeed === o.key ? colors.chipActiveText : colors.textSecondary }]}>{o.emoji} {o.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={[st.fLabel, { color: colors.text, marginTop: 16 }]}>🔢 {t('settings_default_limit')}</Text>
                    <View style={st.chipRow}>
                        {[10, 25, 50, 100].map(n => (
                            <TouchableOpacity key={n} style={[st.chip, { backgroundColor: settings.defaultSessionLimit === n ? colors.chipActiveBg : colors.chipBg, borderColor: settings.defaultSessionLimit === n ? colors.primary : 'transparent' }]} onPress={() => updateSetting('defaultSessionLimit', n)}>
                                <Text style={[st.chipTxt, { color: settings.defaultSessionLimit === n ? colors.chipActiveText : colors.textSecondary }]}>{n}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={{ marginTop: 16 }}>
                        <Row icon="🤖" label={t('safety_human_like')} desc={t('safety_human_like_desc')} right={
                            <Switch value={settings.humanLikeBehavior} onValueChange={(v) => updateSetting('humanLikeBehavior', v)} trackColor={{ true: colors.primary, false: colors.progressBg }} thumbColor="#FFF" />
                        } />
                    </View>
                    <Row icon="💾" label={t('backup_before_delete')} right={
                        <Switch value={settings.backupBeforeDelete} onValueChange={(v) => updateSetting('backupBeforeDelete', v)} trackColor={{ true: colors.primary, false: colors.progressBg }} thumbColor="#FFF" />
                    } />
                </View>

                {/* About */}
                <View style={[st.section, { backgroundColor: colors.card }]}>
                    <Text style={[st.secTitle, { color: colors.text }]}>ℹ️ {t('settings_about')}</Text>
                    <Text style={[{ color: colors.textSecondary, fontSize: 13, lineHeight: 20 }]}>{t('settings_about_desc')}</Text>
                    <Text style={[{ color: colors.textTertiary, fontSize: 12, marginTop: 8 }]}>{t('settings_version')}: 1.0.0</Text>
                </View>

                {/* Logout */}
                <TouchableOpacity style={[st.logoutBtn, { backgroundColor: colors.dangerLight }]} onPress={handleLogout} activeOpacity={0.7}>
                    <Text style={[{ color: colors.danger, fontSize: 16, fontWeight: '700' }]}>🚪 {t('logout')}</Text>
                </TouchableOpacity>

                <View style={{ height: 100 }} />
            </ScrollView>
        </Animated.View>
    );
}

const st = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingTop: 60, paddingBottom: Spacing.lg, paddingHorizontal: Spacing.xl, borderBottomLeftRadius: BorderRadius.xl, borderBottomRightRadius: BorderRadius.xl },
    headerTitle: { fontSize: 30, fontWeight: '700', color: '#FFF' },
    scroll: { paddingHorizontal: 16, paddingTop: 20 },
    section: { padding: 16, borderRadius: 14, marginBottom: 16 },
    secTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
    rowIcon: { fontSize: 22 },
    rowLabel: { fontSize: 15, fontWeight: '600' },
    rowDesc: { fontSize: 11, marginTop: 2 },
    langRow: { flexDirection: 'row', gap: 12 },
    langBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, gap: 8, borderWidth: 1.5 },
    langTxt: { fontSize: 14, fontWeight: '600' },
    fLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1.5 },
    chipTxt: { fontSize: 12, fontWeight: '500' },
    logoutBtn: { padding: 16, borderRadius: 14, alignItems: 'center', marginBottom: 16 },
});
