import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, Animated, Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
    NAVIGATE_TO_ACTIVITY, SCAN_POSTS_SCRIPT, SCROLL_DOWN_SCRIPT,
    filterPosts, FilterCriteria, DEFAULT_FILTERS,
} from '../utils/linkedinService';
import { PostData, saveScannedPosts, incrementStat } from '../utils/storage';
import { Typography, Spacing, BorderRadius } from '../theme/typography';

interface Props {
    onPostsSelected: (posts: PostData[]) => void;
    deletedPostIds?: string[];
    onCleanup?: () => void;
}

export default function ScannerScreen({ onPostsSelected, deletedPostIds, onCleanup }: Props) {
    const { colors } = useTheme();
    const { t } = useLanguage();
    const webViewRef = useRef<WebView>(null);
    const [isScanning, setIsScanning] = useState(false);
    const isScanningRef = useRef(false);
    const scrollRoundRef = useRef(0);
    const prevPostCountRef = useRef(0);
    const noNewPostsCountRef = useRef(0);
    const MAX_SCROLL_ROUNDS = 15;
    const MAX_NO_NEW_POSTS = 2;
    const [posts, setPosts] = useState<PostData[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [filters, setFilters] = useState<FilterCriteria>(DEFAULT_FILTERS);
    const [showFilters, setShowFilters] = useState(true);
    const [scanProgress, setScanProgress] = useState(0);
    const [keywordInput, setKeywordInput] = useState('');
    const [excludeInput, setExcludeInput] = useState('');
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }, []);

    // Filter out deleted posts when returning from DeleteScreen
    useEffect(() => {
        if (deletedPostIds && deletedPostIds.length > 0) {
            console.log('Scanner: Removing ' + deletedPostIds.length + ' deleted posts');
            setPosts(prev => prev.filter(p => !deletedPostIds.includes(p.id)));
            setSelectedIds(prev => {
                const newSet = new Set(prev);
                deletedPostIds.forEach(id => newSet.delete(id));
                return newSet;
            });
            if (onCleanup) onCleanup();
        }
    }, [deletedPostIds, onCleanup]);

    const handleWebViewMessage = useCallback((event: { nativeEvent: { data: string } }) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'DEBUG_LOG') {
                console.log('WebView Debug:', data.message);
            } else if (data.type === 'SCAN_RESULTS') {
                const filtered = filterPosts(data.posts, filters);
                const mapped: PostData[] = filtered.map((p: any) => ({ ...p, selected: false }));
                setPosts(prev => {
                    const ids = new Set(prev.map(pp => pp.id));
                    const newPosts = mapped.filter(p => !ids.has(p.id));
                    const updated = [...prev, ...newPosts];

                    // Track if new posts were found
                    if (newPosts.length === 0) {
                        noNewPostsCountRef.current++;
                        console.log('Scanner: No new posts found, count=' + noNewPostsCountRef.current);
                    } else {
                        noNewPostsCountRef.current = 0;
                    }
                    prevPostCountRef.current = updated.length;
                    return updated;
                });
                setScanProgress(prev => prev + data.totalFound);
            } else if (data.type === 'SCROLL_DONE') {
                // Use ref to check scanning state (avoids stale closure)
                if (!isScanningRef.current) {
                    console.log('Scanner: Stopped by user, ignoring SCROLL_DONE');
                    return;
                }

                scrollRoundRef.current++;
                console.log('Scanner: Round ' + scrollRoundRef.current + '/' + MAX_SCROLL_ROUNDS);

                // Stop condition 1: Max scroll rounds reached
                if (scrollRoundRef.current >= MAX_SCROLL_ROUNDS) {
                    console.log('Scanner: Max rounds reached, stopping');
                    finishScan('Max scroll rounds reached');
                    return;
                }

                // Stop condition 2: No new posts found for consecutive rounds
                if (noNewPostsCountRef.current >= MAX_NO_NEW_POSTS) {
                    console.log('Scanner: No new posts for ' + MAX_NO_NEW_POSTS + ' rounds, stopping');
                    finishScan('No more new posts found');
                    return;
                }

                const { scrollY, innerHeight, totalHeight } = data;

                // Stop condition 3: Reached bottom of page
                if (scrollY + (innerHeight || 1000) >= totalHeight - 100) {
                    console.log('Scanner: Reached bottom', scrollY, totalHeight);
                    finishScan('Reached end of page');
                    return;
                }

                // Continue scanning: reduced delays (was 1500+2000 = 3500ms, now 800+1200 = 2000ms)
                setTimeout(() => {
                    if (!isScanningRef.current) return;
                    webViewRef.current?.injectJavaScript(SCAN_POSTS_SCRIPT);
                    setTimeout(() => {
                        if (!isScanningRef.current) return;
                        webViewRef.current?.injectJavaScript(SCROLL_DOWN_SCRIPT);
                    }, 1200);
                }, 800);
            } else if (data.type === 'SCAN_ERROR') {
                Alert.alert(t('error'), data.error);
                isScanningRef.current = false;
                setIsScanning(false);
            }
        } catch (e) { console.log('Parse error:', e); }
    }, [filters, t]);

    const finishScan = (reason: string) => {
        isScanningRef.current = false;
        setIsScanning(false);
        console.log('Scanner: Finished - ' + reason + ', total posts: ' + prevPostCountRef.current);
        Alert.alert(t('scanner_finished'), `${reason}. Found ${prevPostCountRef.current} posts.`);
    };

    const startScan = () => {
        setPosts([]); setSelectedIds(new Set()); setScanProgress(0);
        scrollRoundRef.current = 0;
        prevPostCountRef.current = 0;
        noNewPostsCountRef.current = 0;
        isScanningRef.current = true;
        setIsScanning(true);
        webViewRef.current?.injectJavaScript(NAVIGATE_TO_ACTIVITY);
        setTimeout(() => {
            if (!isScanningRef.current) return;
            webViewRef.current?.injectJavaScript(SCAN_POSTS_SCRIPT);
            setTimeout(() => {
                if (!isScanningRef.current) return;
                webViewRef.current?.injectJavaScript(SCROLL_DOWN_SCRIPT);
            }, 1200);
        }, 3000);
    };

    const stopScan = async () => {
        isScanningRef.current = false;
        setIsScanning(false);
        await incrementStat('totalScanned', posts.length);
        await saveScannedPosts(posts);
    };

    const toggleSel = (id: string) => {
        setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    };

    const proceedToDelete = async () => {
        const sel = posts.filter(p => selectedIds.has(p.id));
        await incrementStat('totalSelected', sel.length);
        onPostsSelected(sel);
    };

    const toggleType = (type: string) => {
        setFilters(prev => ({
            ...prev, postTypes: prev.postTypes.includes(type) ? prev.postTypes.filter(t2 => t2 !== type) : [...prev.postTypes, type],
        }));
    };

    const addKW = (inc: boolean) => {
        const v = inc ? keywordInput.trim() : excludeInput.trim();
        if (!v) return;
        setFilters(prev => ({ ...prev, ...(inc ? { includeKeywords: [...prev.includeKeywords, v] } : { excludeKeywords: [...prev.excludeKeywords, v] }) }));
        inc ? setKeywordInput('') : setExcludeInput('');
    };

    const removeKW = (kw: string, inc: boolean) => {
        setFilters(prev => ({ ...prev, ...(inc ? { includeKeywords: prev.includeKeywords.filter(k => k !== kw) } : { excludeKeywords: prev.excludeKeywords.filter(k => k !== kw) }) }));
    };

    const dateOpts = [{ key: 'all', label: t('filter_all_time') }, { key: 'today', label: t('filter_today') }, { key: '7days', label: t('filter_7days') }, { key: '30days', label: t('filter_30days') }];
    const typeOpts = [{ key: 'text', label: t('filter_text'), e: '📝' }, { key: 'image', label: t('filter_image'), e: '🖼️' }, { key: 'video', label: t('filter_video'), e: '🎬' }, { key: 'poll', label: t('filter_poll'), e: '📊' }, { key: 'repost', label: t('filter_repost'), e: '🔄' }];
    const visOpts = [{ key: 'all', label: t('filter_all') }, { key: 'public', label: t('filter_public') }, { key: 'connections', label: t('filter_connections') }];

    const Chip = ({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) => (
        <TouchableOpacity style={[s.chip, { backgroundColor: active ? colors.chipActiveBg : colors.chipBg, borderColor: active ? colors.primary : 'transparent' }]} onPress={onPress}>
            <Text style={[s.chipTxt, { color: active ? colors.chipActiveText : colors.textSecondary }]}>{label}</Text>
        </TouchableOpacity>
    );

    return (
        <Animated.View style={[s.container, { backgroundColor: colors.background, opacity: fadeAnim }]}>
            <View style={s.hiddenWV}>
                <WebView ref={webViewRef} source={{ uri: 'https://www.linkedin.com/feed/' }} onMessage={handleWebViewMessage} onLoadEnd={() => console.log('WebView Loaded')} javaScriptEnabled domStorageEnabled sharedCookiesEnabled thirdPartyCookiesEnabled userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" />
            </View>
            <View style={[s.header, { backgroundColor: colors.primary }]}>
                <Text style={s.headerTitle}>{t('scanner_title')}</Text>
                {isScanning && <Text style={s.headerSub}>{t('scanner_scanning')} {scanProgress} {t('scanner_found')}</Text>}
            </View>
            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
                <TouchableOpacity style={[s.scanBtn, { backgroundColor: isScanning ? colors.danger : colors.primary }]} onPress={isScanning ? stopScan : startScan} activeOpacity={0.8}>
                    <Text style={s.scanBtnIcon}>{isScanning ? '⏹️' : '🔍'}</Text>
                    <Text style={s.scanBtnTxt}>{isScanning ? t('scanner_stop') : t('scanner_start')}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[s.filterToggle, { backgroundColor: colors.card }]} onPress={() => setShowFilters(!showFilters)}>
                    <Text style={[s.filterToggleTxt, { color: colors.text }]}>🎛️ {t('filter_title')}</Text>
                    <Text style={{ color: colors.textSecondary }}>{showFilters ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {showFilters && (
                    <View style={[s.filterBox, { backgroundColor: colors.card }]}>
                        <Text style={[s.fLabel, { color: colors.text }]}>📅 {t('filter_date')}</Text>
                        <View style={s.chipRow}>{dateOpts.map(o => <Chip key={o.key} active={filters.dateRange === o.key} label={o.label} onPress={() => setFilters(p => ({ ...p, dateRange: o.key as any }))} />)}</View>

                        <Text style={[s.fLabel, { color: colors.text }]}>📌 {t('filter_post_type')}</Text>
                        <View style={s.chipRow}>{typeOpts.map(o => <Chip key={o.key} active={filters.postTypes.includes(o.key)} label={`${o.e} ${o.label}`} onPress={() => toggleType(o.key)} />)}</View>

                        <Text style={[s.fLabel, { color: colors.text }]}>💬 {t('filter_engagement')}</Text>
                        <View style={s.chipRow}>
                            <Chip active={filters.noLikes} label={`👎 ${t('filter_no_likes')}`} onPress={() => setFilters(p => ({ ...p, noLikes: !p.noLikes }))} />
                            <Chip active={filters.noComments} label={`🔇 ${t('filter_no_comments')}`} onPress={() => setFilters(p => ({ ...p, noComments: !p.noComments }))} />
                        </View>

                        <Text style={[s.fLabel, { color: colors.text }]}>🔤 {t('filter_keywords')}</Text>
                        <View style={s.kwRow}>
                            <TextInput style={[s.kwInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]} placeholder={`${t('filter_include')}...`} placeholderTextColor={colors.textTertiary} value={keywordInput} onChangeText={setKeywordInput} onSubmitEditing={() => addKW(true)} />
                            <TouchableOpacity style={[s.kwAdd, { backgroundColor: colors.accent }]} onPress={() => addKW(true)}><Text style={s.kwAddTxt}>+</Text></TouchableOpacity>
                        </View>
                        {filters.includeKeywords.length > 0 && <View style={s.chipRow}>{filters.includeKeywords.map(k => <TouchableOpacity key={k} style={[s.kwChip, { backgroundColor: colors.accentLight }]} onPress={() => removeKW(k, true)}><Text style={{ color: colors.accent, fontSize: 12 }}>{k} ✕</Text></TouchableOpacity>)}</View>}
                        <View style={s.kwRow}>
                            <TextInput style={[s.kwInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]} placeholder={`${t('filter_exclude')}...`} placeholderTextColor={colors.textTertiary} value={excludeInput} onChangeText={setExcludeInput} onSubmitEditing={() => addKW(false)} />
                            <TouchableOpacity style={[s.kwAdd, { backgroundColor: colors.danger }]} onPress={() => addKW(false)}><Text style={s.kwAddTxt}>+</Text></TouchableOpacity>
                        </View>
                        {filters.excludeKeywords.length > 0 && <View style={s.chipRow}>{filters.excludeKeywords.map(k => <TouchableOpacity key={k} style={[s.kwChip, { backgroundColor: colors.dangerLight }]} onPress={() => removeKW(k, false)}><Text style={{ color: colors.danger, fontSize: 12 }}>{k} ✕</Text></TouchableOpacity>)}</View>}

                        <Text style={[s.fLabel, { color: colors.text }]}>👁️ {t('filter_visibility')}</Text>
                        <View style={s.chipRow}>{visOpts.map(o => <Chip key={o.key} active={filters.visibility === o.key} label={o.label} onPress={() => setFilters(p => ({ ...p, visibility: o.key as any }))} />)}</View>
                    </View>
                )}

                {posts.length > 0 && (
                    <View style={[s.results, { backgroundColor: colors.card }]}>
                        <Text style={[s.resultTitle, { color: colors.text }]}>{t('scanner_results')} ({posts.length})</Text>
                        <View style={s.selBtns}>
                            <TouchableOpacity onPress={() => setSelectedIds(new Set(posts.map(p => p.id)))} style={[s.selBtn, { backgroundColor: colors.primaryLight }]}><Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>{t('scanner_select_all')}</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => setSelectedIds(new Set())} style={[s.selBtn, { backgroundColor: colors.chipBg }]}><Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>{t('scanner_deselect_all')}</Text></TouchableOpacity>
                        </View>
                        {posts.map((post, i) => (
                            <TouchableOpacity key={post.id + i} style={[s.postItem, { borderColor: selectedIds.has(post.id) ? colors.primary : colors.borderLight, backgroundColor: selectedIds.has(post.id) ? colors.primaryLight : 'transparent' }]} onPress={() => toggleSel(post.id)} activeOpacity={0.7}>
                                <View style={[s.cb, { borderColor: selectedIds.has(post.id) ? colors.primary : colors.border, backgroundColor: selectedIds.has(post.id) ? colors.primary : 'transparent' }]}>{selectedIds.has(post.id) && <Text style={{ color: '#FFF', fontSize: 14 }}>✓</Text>}</View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[{ color: colors.text, fontSize: 14 }]} numberOfLines={2}>{post.text}</Text>
                                    <View style={s.postMeta}>
                                        <Text style={{ color: colors.primary, fontSize: 11 }}>{post.type === 'text' ? '📝' : post.type === 'image' ? '🖼️' : post.type === 'video' ? '🎬' : post.type === 'poll' ? '📊' : '🔄'} {post.type}</Text>
                                        <Text style={{ color: colors.textTertiary, fontSize: 11 }}>❤️ {post.likes} • 💬 {post.comments}</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        ))}
                        {selectedIds.size > 0 && (
                            <TouchableOpacity style={[s.proceedBtn, { backgroundColor: colors.danger }]} onPress={proceedToDelete} activeOpacity={0.8}>
                                <Text style={s.proceedTxt}>🗑️ {t('scanner_proceed')} ({selectedIds.size})</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
                {posts.length === 0 && !isScanning && (
                    <View style={[s.empty, { backgroundColor: colors.card }]}><Text style={{ fontSize: 50 }}>🔍</Text><Text style={{ color: colors.textSecondary, fontSize: 16, textAlign: 'center', marginTop: 12 }}>{t('scanner_no_results')}</Text></View>
                )}
                <View style={{ height: 100 }} />
            </ScrollView>
        </Animated.View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1 },
    hiddenWV: { height: 0, width: 0, opacity: 0, position: 'absolute' },
    header: { paddingTop: 60, paddingBottom: Spacing.lg, paddingHorizontal: Spacing.xl, borderBottomLeftRadius: BorderRadius.xl, borderBottomRightRadius: BorderRadius.xl },
    headerTitle: { fontSize: 30, fontWeight: '700', color: '#FFF' },
    headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
    scroll: { paddingHorizontal: 16, paddingTop: 20 },
    scanBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 14, gap: 8, marginBottom: 12 },
    scanBtnIcon: { fontSize: 20 },
    scanBtnTxt: { color: '#FFF', fontSize: 18, fontWeight: '700' },
    filterToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 14, marginBottom: 8 },
    filterToggleTxt: { fontSize: 16, fontWeight: '600' },
    filterBox: { padding: 16, borderRadius: 14, marginBottom: 16 },
    fLabel: { fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 8 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5 },
    chipTxt: { fontSize: 12, fontWeight: '500' },
    kwRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    kwInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, fontSize: 14 },
    kwAdd: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    kwAddTxt: { color: '#FFF', fontSize: 20, fontWeight: '700' },
    kwChip: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
    results: { padding: 16, borderRadius: 14, marginBottom: 16 },
    resultTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
    selBtns: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    selBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
    postItem: { flexDirection: 'row', padding: 12, borderRadius: 10, borderWidth: 1.5, marginBottom: 8, alignItems: 'center', gap: 12 },
    cb: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
    postMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    proceedBtn: { padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 12 },
    proceedTxt: { color: '#FFF', fontSize: 18, fontWeight: '700' },
    empty: { alignItems: 'center', paddingVertical: 40, borderRadius: 14 },
});
