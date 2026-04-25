import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
    SESSION: '@linkedin_session',
    STATS: '@deletion_stats',
    LOGS: '@deletion_logs',
    SETTINGS: '@app_settings',
    SCANNED_POSTS: '@scanned_posts',
};

export interface PostData {
    id: string;
    text: string;
    type: 'text' | 'image' | 'video' | 'poll' | 'repost';
    date: string;
    likes: number;
    comments: number;
    visibility: 'public' | 'connections';
    url: string;
    selected?: boolean;
}

export interface DeletionStats {
    totalScanned: number;
    totalSelected: number;
    totalDeleted: number;
    totalFailed: number;
    deletedByType: {
        text: number;
        image: number;
        video: number;
        poll: number;
        repost: number;
    };
}

export interface DeletionLog {
    id: string;
    postId: string;
    postText: string;
    postType: string;
    status: 'deleted' | 'failed' | 'dry_run';
    timestamp: string;
    errorMessage?: string;
}

export interface AppSettings {
    defaultSpeed: 'slow' | 'normal' | 'fast';
    defaultSessionLimit: number;
    humanLikeBehavior: boolean;
    backupBeforeDelete: boolean;
}

const DEFAULT_STATS: DeletionStats = {
    totalScanned: 0,
    totalSelected: 0,
    totalDeleted: 0,
    totalFailed: 0,
    deletedByType: { text: 0, image: 0, video: 0, poll: 0, repost: 0 },
};

const DEFAULT_SETTINGS: AppSettings = {
    defaultSpeed: 'slow',
    defaultSessionLimit: 25,
    humanLikeBehavior: true,
    backupBeforeDelete: true,
};

// Session
export const saveSession = async (cookies: string) => {
    await AsyncStorage.setItem(KEYS.SESSION, cookies);
};

export const getSession = async (): Promise<string | null> => {
    return AsyncStorage.getItem(KEYS.SESSION);
};

export const clearSession = async () => {
    await AsyncStorage.removeItem(KEYS.SESSION);
};

// Stats
export const getStats = async (): Promise<DeletionStats> => {
    try {
        const data = await AsyncStorage.getItem(KEYS.STATS);
        return data ? JSON.parse(data) : DEFAULT_STATS;
    } catch {
        return DEFAULT_STATS;
    }
};

export const updateStats = async (update: Partial<DeletionStats>) => {
    const current = await getStats();
    const updated = { ...current, ...update };
    await AsyncStorage.setItem(KEYS.STATS, JSON.stringify(updated));
    return updated;
};

export const incrementStat = async (
    key: keyof Pick<DeletionStats, 'totalScanned' | 'totalSelected' | 'totalDeleted' | 'totalFailed'>,
    amount: number = 1,
) => {
    const current = await getStats();
    current[key] += amount;
    await AsyncStorage.setItem(KEYS.STATS, JSON.stringify(current));
    return current;
};

export const incrementTypeCount = async (type: PostData['type']) => {
    const current = await getStats();
    current.deletedByType[type] += 1;
    await AsyncStorage.setItem(KEYS.STATS, JSON.stringify(current));
    return current;
};

// Logs
export const getLogs = async (): Promise<DeletionLog[]> => {
    try {
        const data = await AsyncStorage.getItem(KEYS.LOGS);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
};

export const addLog = async (log: DeletionLog) => {
    const logs = await getLogs();
    logs.unshift(log);
    // Keep max 500 logs
    if (logs.length > 500) {
        logs.splice(500);
    }
    await AsyncStorage.setItem(KEYS.LOGS, JSON.stringify(logs));
    return logs;
};

export const clearLogs = async () => {
    await AsyncStorage.removeItem(KEYS.LOGS);
};

// Settings
export const getSettings = async (): Promise<AppSettings> => {
    try {
        const data = await AsyncStorage.getItem(KEYS.SETTINGS);
        return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    } catch {
        return DEFAULT_SETTINGS;
    }
};

export const saveSettings = async (settings: Partial<AppSettings>) => {
    const current = await getSettings();
    const updated = { ...current, ...settings };
    await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(updated));
    return updated;
};

// Scanned Posts (temp storage)
export const saveScannedPosts = async (posts: PostData[]) => {
    await AsyncStorage.setItem(KEYS.SCANNED_POSTS, JSON.stringify(posts));
};

export const getScannedPosts = async (): Promise<PostData[]> => {
    try {
        const data = await AsyncStorage.getItem(KEYS.SCANNED_POSTS);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
};
