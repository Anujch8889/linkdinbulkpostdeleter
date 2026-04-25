import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getSession } from '../utils/storage';
import { PostData } from '../utils/storage';

// Screens
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import ScannerScreen from '../screens/ScannerScreen';
import DeleteScreen from '../screens/DeleteScreen';
import BackupLogsScreen from '../screens/BackupLogsScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

export default function AppNavigator() {
    const { colors, isDark } = useTheme();
    const { t } = useLanguage();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [postsToDelete, setPostsToDelete] = useState<PostData[]>([]);
    const [deletedPostIds, setDeletedPostIds] = useState<string[]>([]);
    const insets = useSafeAreaInsets();

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        const session = await getSession();
        // setIsAuthenticated(!!session);
        setIsLoading(false);
    };

    const handleLoginSuccess = () => {
        setIsAuthenticated(true);
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
    };

    const handlePostsSelected = (posts: PostData[]) => {
        setPostsToDelete(posts);
    };

    const handleDeletionComplete = (ids: string[] = []) => {
        setPostsToDelete([]);
        if (ids.length > 0) {
            setDeletedPostIds(ids);
        }
    };

    const handleCleanupDeleted = () => {
        setDeletedPostIds([]);
    };

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!isAuthenticated) {
        return (
            <NavigationContainer>
                <LoginScreen onLoginSuccess={handleLoginSuccess} />
            </NavigationContainer>
        );
    }

    return (
        <NavigationContainer>
            <Tab.Navigator
                screenOptions={({ route }) => ({
                    headerShown: false,
                    tabBarStyle: {
                        backgroundColor: colors.tabBar,
                        borderTopColor: colors.tabBarBorder,
                        height: 60 + insets.bottom,
                        paddingBottom: insets.bottom + 8,
                        paddingTop: 8,
                    },
                    tabBarActiveTintColor: colors.primary,
                    tabBarInactiveTintColor: colors.icon,
                    tabBarLabelStyle: {
                        fontSize: 12,
                        fontWeight: '500',
                    },
                    tabBarIcon: ({ focused, color, size }) => {
                        let iconName = '';
                        if (route.name === 'Dashboard') iconName = '📊';
                        else if (route.name === 'Scanner') iconName = '🔍';
                        else if (route.name === 'Delete') iconName = '🗑️';
                        else if (route.name === 'Backup') iconName = '💾';
                        else if (route.name === 'Settings') iconName = '⚙️';

                        return <View style={{ opacity: focused ? 1 : 0.7 }}><Text style={{ fontSize: 24, color: color }}>{iconName}</Text></View>;
                    },
                })}
            >
                <Tab.Screen
                    name="Dashboard"
                    component={DashboardScreen}
                    options={{ title: t('tab_dashboard') }}
                />
                <Tab.Screen
                    name="Scanner"
                    children={({ navigation }: any) => (
                        <ScannerScreen
                            deletedPostIds={deletedPostIds}
                            onCleanup={handleCleanupDeleted}
                            onPostsSelected={(posts) => {
                                handlePostsSelected(posts);
                                navigation.navigate('Delete');
                            }}
                        />
                    )}
                    options={{ title: t('tab_scanner') }}
                />
                <Tab.Screen
                    name="Delete"
                    children={({ navigation }: any) => (
                        <DeleteScreen
                            posts={postsToDelete}
                            onComplete={(deletedIds) => {
                                handleDeletionComplete(deletedIds);
                                navigation.navigate('Dashboard');
                            }}
                        />
                    )}
                    options={{
                        title: t('tab_delete'),
                        tabBarBadge: postsToDelete.length > 0 ? postsToDelete.length : undefined,
                        tabBarBadgeStyle: { backgroundColor: colors.danger, color: '#FFFFFF' }
                    }}
                />
                <Tab.Screen
                    name="Backup"
                    component={BackupLogsScreen}
                    options={{ title: t('tab_backup') }}
                />
                <Tab.Screen
                    name="Settings"
                    children={() => <SettingsScreen onLogout={handleLogout} />}
                    options={{ title: t('tab_settings') }}
                />
            </Tab.Navigator>
        </NavigationContainer>
    );
}
