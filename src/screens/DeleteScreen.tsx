import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Animated, Alert, Switch,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getDeletePostScript, getRandomDelay, SpeedMode, CHECK_SAFETY_SCRIPT, WAIT_FOR_POSTS_SCRIPT, NAVIGATE_TO_ACTIVITY } from '../utils/linkedinService';
import { PostData, incrementStat, incrementTypeCount, addLog, getSettings } from '../utils/storage';
import { Typography, Spacing, BorderRadius } from '../theme/typography';

interface Props { posts: PostData[]; onComplete: (deletedIds: string[]) => void; }

export default function DeleteScreen({ posts, onComplete }: Props) {
    const { colors } = useTheme();
    const { t } = useLanguage();
    const webViewRef = useRef<WebView>(null);
    const [status, setStatus] = useState<'ready' | 'deleting' | 'paused' | 'completed'>('ready');
    const [dryRun, setDryRun] = useState(false);
    const [speed, setSpeed] = useState<SpeedMode>('slow');
    const [sessionLimit, setSessionLimit] = useState(25);
    const [progress, setProgress] = useState(0);
    const [currentPost, setCurrentPost] = useState('');
    const [deletedCount, setDeletedCount] = useState(0);
    const [failedCount, setFailedCount] = useState(0);
    const isPaused = useRef(false);
    const isStopped = useRef(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
        loadSettings();
    }, []);

    const loadSettings = async () => {
        const s = await getSettings();
        setSpeed(s.defaultSpeed);
        setSessionLimit(s.defaultSessionLimit);
    };

    const pageReady = useRef(false);
    const postsReadyResolve = useRef<((count: number) => void) | null>(null);
    const deletedIdsRef = useRef<string[]>([]);

    const pendingDeletionResolve = useRef<((success: boolean) => void) | null>(null);

    const handleWebViewMessage = useCallback((event: { nativeEvent: { data: string } }) => {
        try {
            console.log('NOTICE: WebView Message Received:', event.nativeEvent.data.substring(0, 200)); // Log first 200 chars
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'DELETE_RESULT') {
                if (pendingDeletionResolve.current) {
                    pendingDeletionResolve.current(data.success);
                    pendingDeletionResolve.current = null;
                }

                if (data.success) {
                    setDeletedCount(prev => prev + 1);
                    if (posts[data.postIndex]) {
                        deletedIdsRef.current.push(posts[data.postIndex].id);
                    }
                    console.log(`NOTICE: Successfully deleted post index ${data.postIndex}`);
                } else {
                    setFailedCount(prev => prev + 1);
                    console.log('NOTICE: Delete failed for post index ' + data.postIndex + ': ' + data.error);
                }
            } else if (data.type === 'POSTS_READY') {
                console.log('NOTICE: Posts ready on page, count:', data.count);
                pageReady.current = data.count > 0;
                if (postsReadyResolve.current) {
                    postsReadyResolve.current(data.count);
                    postsReadyResolve.current = null;
                }
            } else if (data.type === 'SAFETY_CHECK') {
                if (data.isCaptcha) { Alert.alert(t('warning'), t('safety_captcha')); setStatus('paused'); isPaused.current = true; }
                if (data.isSessionExpired) { Alert.alert(t('warning'), t('safety_session_expired')); setStatus('paused'); isStopped.current = true; }
            }
        } catch (e) { console.log('Parse error:', e); }
    }, [t]);

    const startDeletion = async () => {
        console.log('NOTICE: startDeletion called');
        setStatus('deleting');
        isPaused.current = false;
        isStopped.current = false;
        setProgress(0); setDeletedCount(0); setFailedCount(0);

        const limit = Math.min(posts.length, sessionLimit);
        console.log(`NOTICE: Starting deletion loop for ${limit} posts, dryRun=${dryRun}`);

        // CRITICAL: Wait for the WebView to load and posts to be rendered
        if (!pageReady.current) {
            console.log('NOTICE: Waiting for page to load posts...');
            webViewRef.current?.injectJavaScript(NAVIGATE_TO_ACTIVITY);
            await new Promise<void>(r => setTimeout(() => r(), 3000)); // Wait for navigation

            const postCount = await new Promise<number>((resolve) => {
                postsReadyResolve.current = resolve;
                webViewRef.current?.injectJavaScript(WAIT_FOR_POSTS_SCRIPT);
                // Timeout after 15s
                setTimeout(() => {
                    if (postsReadyResolve.current === resolve) {
                        resolve(0);
                        postsReadyResolve.current = null;
                    }
                }, 15000);
            });

            console.log('NOTICE: Page loaded with ' + postCount + ' posts');
            if (postCount === 0) {
                console.log('NOTICE: No posts found on page, aborting');
                Alert.alert('Error', 'Could not find posts on the page. Please try again.');
                setStatus('ready');
                return;
            }
        }

        for (let i = 0; i < limit; i++) {
            if (isStopped.current) { console.log('NOTICE: Deletion stopped by user'); break; }
            while (isPaused.current) {
                await new Promise<void>(r => setTimeout(() => r(), 500));
                if (isStopped.current) break;
            }
            if (isStopped.current) break;

            const post = posts[i];
            console.log(`NOTICE: Processing post ${i + 1}/${limit}: ID=${post.id}`);
            setCurrentPost(post.text.substring(0, 50) + '...');
            setProgress(((i + 1) / limit) * 100);

            if (dryRun) {
                await addLog({ id: Date.now().toString(), postId: post.id, postText: post.text.substring(0, 100), postType: post.type, status: 'dry_run', timestamp: new Date().toISOString() });
                setDeletedCount(prev => prev + 1);
            } else {
                console.log('NOTICE: Injecting safety check...');
                webViewRef.current?.injectJavaScript(CHECK_SAFETY_SCRIPT);
                await new Promise<void>(r => setTimeout(() => r(), 500));

                // Use post ID for precise targeting, fallback to checked index if needed
                console.log(`NOTICE: Injecting delete script for post ${post.id} at index ${i}`);

                const deletePromise = new Promise<boolean>((resolve) => {
                    pendingDeletionResolve.current = resolve;
                    // Timeout
                    setTimeout(() => {
                        if (pendingDeletionResolve.current === resolve) {
                            console.log('NOTICE: Deletion TIMEOUT for post ' + i);
                            resolve(false);
                            pendingDeletionResolve.current = null;
                        }
                    }, 15000); // 15s timeout for network lag
                });

                const deleteScript = getDeletePostScript(post.id, i);
                webViewRef.current?.injectJavaScript(deleteScript);

                const success = await deletePromise;

                if (success) {
                    await incrementStat('totalDeleted', 1);
                    await incrementTypeCount(post.type);
                    await addLog({ id: Date.now().toString(), postId: post.id, postText: post.text.substring(0, 100), postType: post.type, status: 'deleted', timestamp: new Date().toISOString() });
                } else {
                    await addLog({ id: Date.now().toString(), postId: post.id, postText: post.text.substring(0, 100), postType: post.type, status: 'failed', timestamp: new Date().toISOString() });
                }
            }

            const delay = getRandomDelay(speed);
            console.log(`NOTICE: Waiting ${delay}ms before next post...`);
            await new Promise<void>(r => setTimeout(() => r(), delay));
        }

        setStatus('completed');
        console.log('NOTICE: Deletion completed');
    };

    const speedOptions: { key: SpeedMode; label: string; emoji: string }[] = [
        { key: 'slow', label: t('delete_speed_slow'), emoji: '🐢' },
        { key: 'normal', label: t('delete_speed_normal'), emoji: '🚶' },
        { key: 'fast', label: t('delete_speed_fast'), emoji: '🏃' },
    ];

    const progressPct = Math.round(progress);

    return (
        <Animated.View style={[st.container, { backgroundColor: colors.background, opacity: fadeAnim }]}>
            <View style={st.hiddenWV}>
                <WebView ref={webViewRef} source={{ uri: 'https://www.linkedin.com/in/me/recent-activity/all/' }} onMessage={handleWebViewMessage} onLoadEnd={() => {
                    console.log('NOTICE: DeleteScreen WebView loaded');
                    // Auto-check for posts on page load
                    setTimeout(() => {
                        webViewRef.current?.injectJavaScript(WAIT_FOR_POSTS_SCRIPT);
                    }, 2000);
                }} javaScriptEnabled domStorageEnabled sharedCookiesEnabled thirdPartyCookiesEnabled userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" />
            </View>
            <View style={[st.header, { backgroundColor: colors.danger }]}>
                <Text style={st.headerTitle}>{t('delete_title')}</Text>
                <Text style={st.headerSub}>{posts.length} {t('delete_confirm_count')}</Text>
            </View>

            <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
                {/* Stats Row */}
                <View style={st.statsRow}>
                    <View style={[st.miniStat, { backgroundColor: colors.accentLight }]}><Text style={st.miniStatIcon}>✅</Text><Text style={[st.miniStatVal, { color: colors.accent }]}>{deletedCount}</Text><Text style={[st.miniStatLabel, { color: colors.textSecondary }]}>{t('dashboard_deleted')}</Text></View>
                    <View style={[st.miniStat, { backgroundColor: colors.dangerLight }]}><Text style={st.miniStatIcon}>❌</Text><Text style={[st.miniStatVal, { color: colors.danger }]}>{failedCount}</Text><Text style={[st.miniStatLabel, { color: colors.textSecondary }]}>{t('dashboard_failed')}</Text></View>
                    <View style={[st.miniStat, { backgroundColor: colors.infoLight }]}><Text style={st.miniStatIcon}>📊</Text><Text style={[st.miniStatVal, { color: colors.info }]}>{progressPct}%</Text><Text style={[st.miniStatLabel, { color: colors.textSecondary }]}>Progress</Text></View>
                </View>

                {/* Progress Bar */}
                {status !== 'ready' && (
                    <View style={[st.progressSection, { backgroundColor: colors.card }]}>
                        <View style={[st.progressBg, { backgroundColor: colors.progressBg }]}>
                            <Animated.View style={[st.progressFill, { width: `${progressPct}%`, backgroundColor: status === 'completed' ? colors.accent : colors.primary }]} />
                        </View>
                        {currentPost ? <Text style={[st.currentPostTxt, { color: colors.textSecondary }]} numberOfLines={1}>{currentPost}</Text> : null}
                    </View>
                )}

                {/* Controls */}
                <View style={[st.section, { backgroundColor: colors.card }]}>
                    {/* Dry Run Toggle */}
                    <View style={st.toggleRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={[st.toggleLabel, { color: colors.text }]}>🧪 {t('delete_dry_run')}</Text>
                            <Text style={[st.toggleDesc, { color: colors.textTertiary }]}>{t('delete_dry_run_desc')}</Text>
                        </View>
                        <Switch value={dryRun} onValueChange={setDryRun} trackColor={{ true: colors.primary, false: colors.progressBg }} thumbColor="#FFF" disabled={status === 'deleting'} />
                    </View>

                    {/* Speed Control */}
                    <Text style={[st.sLabel, { color: colors.text }]}>⚡ {t('delete_speed')}</Text>
                    <View style={st.chipRow}>
                        {speedOptions.map(o => (
                            <TouchableOpacity key={o.key} style={[st.speedChip, { backgroundColor: speed === o.key ? colors.chipActiveBg : colors.chipBg, borderColor: speed === o.key ? colors.primary : 'transparent' }]} onPress={() => setSpeed(o.key)} disabled={status === 'deleting'}>
                                <Text style={[st.speedTxt, { color: speed === o.key ? colors.chipActiveText : colors.textSecondary }]}>{o.emoji} {o.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Session Limit */}
                    <Text style={[st.sLabel, { color: colors.text }]}>🔢 {t('delete_session_limit')}: {sessionLimit}</Text>
                    <View style={st.limitRow}>
                        {[10, 25, 50, 100].map(n => (
                            <TouchableOpacity key={n} style={[st.limitBtn, { backgroundColor: sessionLimit === n ? colors.chipActiveBg : colors.chipBg, borderColor: sessionLimit === n ? colors.primary : 'transparent' }]} onPress={() => setSessionLimit(n)} disabled={status === 'deleting'}>
                                <Text style={[st.limitTxt, { color: sessionLimit === n ? colors.chipActiveText : colors.textSecondary }]}>{n}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Action Buttons */}
                <View style={st.actionRow}>
                    {status === 'ready' && (
                        <TouchableOpacity style={[st.actionBtn, { backgroundColor: colors.danger }]} onPress={() => {
                            Alert.alert(t('delete_confirm'), `${posts.length} ${t('delete_confirm_count')}`, [
                                { text: t('cancel'), style: 'cancel' },
                                { text: dryRun ? t('delete_dry_run') : t('delete'), style: 'destructive', onPress: startDeletion },
                            ]);
                        }} activeOpacity={0.8}>
                            <Text style={st.actionTxt}>🗑️ {dryRun ? t('delete_dry_run') : t('delete_bulk')}</Text>
                        </TouchableOpacity>
                    )}
                    {status === 'deleting' && (
                        <View style={st.controlRow}>
                            <TouchableOpacity style={[st.ctrlBtn, { backgroundColor: colors.warning }]} onPress={() => { isPaused.current = true; setStatus('paused'); }}>
                                <Text style={st.ctrlTxt}>⏸️ {t('delete_pause')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[st.ctrlBtn, { backgroundColor: colors.danger }]} onPress={() => { isStopped.current = true; setStatus('completed'); }}>
                                <Text style={st.ctrlTxt}>⏹️ {t('delete_stop')}</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    {status === 'paused' && (
                        <View style={st.controlRow}>
                            <TouchableOpacity style={[st.ctrlBtn, { backgroundColor: colors.accent }]} onPress={() => { isPaused.current = false; setStatus('deleting'); }}>
                                <Text style={st.ctrlTxt}>▶️ {t('delete_resume')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[st.ctrlBtn, { backgroundColor: colors.danger }]} onPress={() => { isStopped.current = true; setStatus('completed'); }}>
                                <Text style={st.ctrlTxt}>⏹️ {t('delete_stop')}</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    {status === 'completed' && (
                        <View style={{ alignItems: 'center', gap: 12 }}>
                            <Text style={{ fontSize: 40 }}>🎉</Text>
                            <Text style={[{ fontSize: 18, fontWeight: '700', color: colors.accent }]}>{t('delete_completed')}</Text>
                            <TouchableOpacity style={[st.actionBtn, { backgroundColor: colors.primary }]} onPress={() => onComplete(deletedIdsRef.current)} activeOpacity={0.8}>
                                <Text style={st.actionTxt}>{t('done')}</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        </Animated.View>
    );
}

const st = StyleSheet.create({
    container: { flex: 1 },
    hiddenWV: { height: 0, width: 0, opacity: 0, position: 'absolute' },
    header: { paddingTop: 60, paddingBottom: Spacing.lg, paddingHorizontal: Spacing.xl, borderBottomLeftRadius: BorderRadius.xl, borderBottomRightRadius: BorderRadius.xl },
    headerTitle: { fontSize: 30, fontWeight: '700', color: '#FFF' },
    headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
    scroll: { paddingHorizontal: 16, paddingTop: 20 },
    statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    miniStat: { flex: 1, padding: 12, borderRadius: 14, alignItems: 'center' },
    miniStatIcon: { fontSize: 20, marginBottom: 4 },
    miniStatVal: { fontSize: 24, fontWeight: '800' },
    miniStatLabel: { fontSize: 10, marginTop: 2 },
    progressSection: { padding: 16, borderRadius: 14, marginBottom: 16 },
    progressBg: { height: 12, borderRadius: 6, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 6 },
    currentPostTxt: { fontSize: 11, marginTop: 8 },
    section: { padding: 16, borderRadius: 14, marginBottom: 16 },
    toggleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    toggleLabel: { fontSize: 15, fontWeight: '600' },
    toggleDesc: { fontSize: 11, marginTop: 2 },
    sLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 4 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    speedChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1.5 },
    speedTxt: { fontSize: 12, fontWeight: '500' },
    limitRow: { flexDirection: 'row', gap: 8 },
    limitBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5 },
    limitTxt: { fontSize: 14, fontWeight: '600' },
    actionRow: { marginBottom: 16 },
    actionBtn: { padding: 16, borderRadius: 14, alignItems: 'center' },
    actionTxt: { color: '#FFF', fontSize: 18, fontWeight: '700' },
    controlRow: { flexDirection: 'row', gap: 12 },
    ctrlBtn: { flex: 1, padding: 14, borderRadius: 14, alignItems: 'center' },
    ctrlTxt: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
