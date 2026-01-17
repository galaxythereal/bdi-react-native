import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Linking from 'expo-linking';
import React, { useState, useEffect, useCallback } from 'react';
import { 
    Alert,
    Animated, 
    Image, 
    Modal,
    Platform,
    RefreshControl,
    ScrollView, 
    StyleSheet, 
    Text, 
    TextInput,
    TouchableOpacity, 
    View 
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ComingSoonModal } from '../../src/components/ComingSoonModal';
import { ProfilePhotoUpload } from '../../src/components/media/ProfilePhotoUpload';
import { useAuth } from '../../src/features/auth/AuthContext';
import { fetchMyEnrollments } from '../../src/features/courses/courseService';
import { getDownloadRecords, removeDownloadRecord, deleteLessonDownload, getDownloadsStorageUsed } from '../../src/features/offline/downloadManager';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/context/ThemeContext';
import { BORDER_RADIUS, COLORS, FONT_SIZE, FONT_WEIGHT, SHADOWS, SPACING } from '../../src/lib/constants';

interface MenuItem {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    subtitle?: string;
    onPress: () => void;
    badge?: string;
    danger?: boolean;
}

interface StatsData {
    courses: number;
    progress: number;
    certificates: number;
}

interface DownloadItemData {
    id: string;
    title: string;
    courseTitle?: string;
    fileSize?: number;
    downloadedAt: string;
}

export default function ProfileScreen() {
    const { signOut, session } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { colors, isDark, theme, setTheme } = useTheme();
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState<StatsData>({ courses: 0, progress: 0, certificates: 0 });
    
    // Modal states
    const [editProfileVisible, setEditProfileVisible] = useState(false);
    const [changePasswordVisible, setChangePasswordVisible] = useState(false);
    const [downloadsVisible, setDownloadsVisible] = useState(false);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [themeModalVisible, setThemeModalVisible] = useState(false);
    const [comingSoonVisible, setComingSoonVisible] = useState(false);
    const [comingSoonConfig, setComingSoonConfig] = useState({ title: '', description: '', icon: 'rocket-outline' as any });
    
    // Form states
    const [fullName, setFullName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [downloads, setDownloads] = useState<DownloadItemData[]>([]);
    const [storageUsed, setStorageUsed] = useState(0);
    
    // Animations
    const fadeAnim = React.useRef(new Animated.Value(0)).current;
    const slideAnim = React.useRef(new Animated.Value(30)).current;
    
    // Tab bar height
    const TAB_BAR_HEIGHT = 56 + Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 24);

    // Show coming soon modal helper
    const showComingSoon = (title: string, description: string, icon: keyof typeof Ionicons.glyphMap = 'rocket-outline') => {
        setComingSoonConfig({ title, description, icon });
        setComingSoonVisible(true);
    };

    // Refresh stats when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            loadStats();
        }, [])
    );

    useEffect(() => {
        loadProfile();
        animateIn();
    }, []);

    const animateIn = () => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 50,
                friction: 8,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const loadStats = async () => {
        try {
            const enrollments = await fetchMyEnrollments();
            const totalProgress = enrollments.length > 0
                ? Math.round(enrollments.reduce((acc, e) => acc + (e.progress || 0), 0) / enrollments.length)
                : 0;
            
            setStats({
                courses: enrollments.length,
                progress: totalProgress,
                certificates: enrollments.filter(e => e.progress === 100).length,
            });
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    };

    const loadProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name, avatar_url')
                    .eq('id', user.id)
                    .single();
                if (profile?.full_name) {
                    setFullName(profile.full_name);
                }
                if (profile?.avatar_url) {
                    setAvatarUrl(profile.avatar_url);
                }
            }
        } catch (error) {
            console.error('Error loading profile:', error);
        }
    };

    const loadDownloads = async () => {
        try {
            const downloadsList = await getDownloadRecords();
            setDownloads(downloadsList);
            const storage = await getDownloadsStorageUsed();
            setStorageUsed(storage);
        } catch (error) {
            console.error('Error loading downloads:', error);
        }
    };

    const handleUpdateProfile = async () => {
        if (!fullName.trim()) {
            Alert.alert('Error', 'Please enter your name');
            return;
        }
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { error } = await supabase
                    .from('profiles')
                    .update({ full_name: fullName.trim() })
                    .eq('id', user.id);
                
                if (error) throw error;
                Alert.alert('Success', 'Profile updated successfully');
                setEditProfileVisible(false);
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to update profile');
        }
    };

    const handleAvatarChange = async (url: string | null) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { error } = await supabase
                    .from('profiles')
                    .update({ avatar_url: url })
                    .eq('id', user.id);
                
                if (error) throw error;
                setAvatarUrl(url);
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to update avatar');
        }
    };

    const handleChangePassword = async () => {
        if (!newPassword || newPassword.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters');
            return;
        }
        if (newPassword !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            Alert.alert('Success', 'Password updated successfully');
            setChangePasswordVisible(false);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to update password');
        }
    };

    const handleDeleteDownload = async (id: string) => {
        Alert.alert(
            'Delete Download',
            'Are you sure you want to delete this download?',
            [
                { text: 'Cancel', style: 'cancel' },
                { 
                    text: 'Delete', 
                    style: 'destructive', 
                    onPress: async () => {
                        try {
                            await deleteLessonDownload(id);
                            loadDownloads();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete download');
                        }
                    }
                },
            ]
        );
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadStats();
        setRefreshing(false);
    };

    const handleSignOut = () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', style: 'destructive', onPress: signOut },
            ]
        );
    };

    const menuSections: { title: string; items: MenuItem[] }[] = [
        {
            title: 'Account',
            items: [
                { 
                    icon: 'person-outline', 
                    label: 'Edit Profile',
                    subtitle: 'Update your personal information',
                    onPress: () => setEditProfileVisible(true)
                },
                { 
                    icon: 'lock-closed-outline', 
                    label: 'Change Password',
                    subtitle: 'Update your security settings',
                    onPress: () => setChangePasswordVisible(true)
                },
            ],
        },
        {
            title: 'Learning',
            items: [
                { 
                    icon: 'cloud-download-outline', 
                    label: 'Downloads',
                    subtitle: 'Manage offline content',
                    onPress: () => {
                        loadDownloads();
                        setDownloadsVisible(true);
                    }
                },
                { 
                    icon: 'bookmark-outline', 
                    label: 'Bookmarks',
                    subtitle: 'Saved lessons and resources',
                    onPress: () => showComingSoon(
                        'Bookmarks',
                        'Save your favorite lessons and resources for quick access. This feature is coming in our next update!',
                        'bookmark-outline'
                    )
                },
                { 
                    icon: 'trophy-outline', 
                    label: 'Certificates',
                    subtitle: 'View your achievements',
                    badge: stats.certificates > 0 ? String(stats.certificates) : undefined,
                    onPress: () => {
                        if (stats.certificates > 0) {
                            Alert.alert('Certificates', `You have earned ${stats.certificates} certificate(s)! View them in your completed courses.`);
                        } else {
                            Alert.alert('Certificates', 'Complete courses to earn certificates!');
                        }
                    }
                },
            ],
        },
        {
            title: 'Preferences',
            items: [
                { 
                    icon: 'notifications-outline', 
                    label: 'Notifications',
                    subtitle: notificationsEnabled ? 'Enabled' : 'Disabled',
                    onPress: () => {
                        setNotificationsEnabled(!notificationsEnabled);
                        Alert.alert(
                            'Notifications',
                            `Notifications ${!notificationsEnabled ? 'enabled' : 'disabled'}`
                        );
                    }
                },
                { 
                    icon: isDark ? 'moon' : 'sunny-outline', 
                    label: 'Appearance',
                    subtitle: theme === 'system' ? 'System' : (isDark ? 'Dark Mode' : 'Light Mode'),
                    onPress: () => setThemeModalVisible(true)
                },
                { 
                    icon: 'language-outline', 
                    label: 'Language',
                    subtitle: 'English',
                    onPress: () => showComingSoon(
                        'Multiple Languages',
                        'Support for Arabic, French, and more languages is coming soon. Stay tuned for our internationalization update!',
                        'language-outline'
                    )
                },
            ],
        },
        {
            title: 'Support',
            items: [
                { 
                    icon: 'help-circle-outline', 
                    label: 'Help Center',
                    subtitle: 'FAQs and guides',
                    onPress: () => showComingSoon(
                        'Help Center',
                        'Our comprehensive help center with FAQs, guides, and tutorials is being built. For now, contact support directly!',
                        'help-circle-outline'
                    )
                },
                { 
                    icon: 'chatbubble-outline', 
                    label: 'Contact Support',
                    subtitle: 'Get help from our team',
                    onPress: () => Linking.openURL('mailto:support@bdi.com?subject=Support%20Request')
                },
                { 
                    icon: 'document-text-outline', 
                    label: 'Terms & Privacy',
                    subtitle: 'Legal information',
                    onPress: () => showComingSoon(
                        'Terms & Privacy',
                        'Our terms of service and privacy policy documentation is being finalized. These will be available before public launch.',
                        'document-text-outline'
                    )
                },
            ],
        },
    ];

    const getUserInitials = () => {
        const email = session?.user.email || '';
        if (email.includes('@')) {
            return email.charAt(0).toUpperCase();
        }
        return 'U';
    };

    const getUserName = () => {
        const email = session?.user.email || 'User';
        return email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScrollView 
                contentContainerStyle={[styles.scrollContent, { paddingBottom: TAB_BAR_HEIGHT + SPACING.lg }]}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.primary}
                        colors={[colors.primary]}
                    />
                }
            >
                {/* Header */}
                <Animated.View style={[
                    styles.header,
                    {
                        opacity: fadeAnim,
                        transform: [{ translateY: slideAnim }],
                    },
                ]}>
                    <View style={[styles.headerBackground, { backgroundColor: colors.primary }]} />
                    
                    <ProfilePhotoUpload
                        value={avatarUrl}
                        onChange={handleAvatarChange}
                        userId={session?.user?.id}
                        size={100}
                        name={fullName || session?.user?.email?.split('@')[0]}
                        showEditButton={true}
                    />
                    
                    <Text style={[styles.userName, { color: colors.text }]}>{getUserName()}</Text>
                    <Text style={[styles.email, { color: colors.textSecondary }]}>{session?.user.email}</Text>
                    
                    <View style={[styles.roleBadge, { backgroundColor: colors.primary + '15' }]}>
                        <Ionicons name="school-outline" size={14} color={colors.primary} />
                        <Text style={[styles.roleText, { color: colors.primary }]}>Student</Text>
                    </View>
                </Animated.View>

                {/* Stats Card */}
                <Animated.View style={[
                    styles.statsCardWrapper,
                    {
                        opacity: fadeAnim,
                        transform: [{ translateY: slideAnim }],
                    },
                ]}>
                    <Card style={[styles.statsCard, { backgroundColor: colors.surface }]}>
                        <View style={styles.statItem}>
                            <View style={[styles.statIconContainer, { backgroundColor: colors.primary + '15' }]}>
                                <Ionicons name="library" size={22} color={colors.primary} />
                            </View>
                            <Text style={[styles.statValue, { color: colors.text }]}>{stats.courses}</Text>
                            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Courses</Text>
                        </View>
                        
                        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                        
                        <View style={styles.statItem}>
                            <View style={[styles.statIconContainer, { backgroundColor: colors.success + '15' }]}>
                                <Ionicons name="trending-up" size={22} color={colors.success} />
                            </View>
                            <Text style={[styles.statValue, { color: colors.text }]}>{stats.progress}%</Text>
                            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Progress</Text>
                        </View>
                        
                        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                        
                        <View style={styles.statItem}>
                            <View style={[styles.statIconContainer, { backgroundColor: colors.warning + '15' }]}>
                                <Ionicons name="trophy" size={22} color={colors.warning} />
                            </View>
                            <Text style={[styles.statValue, { color: colors.text }]}>{stats.certificates}</Text>
                            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Certificates</Text>
                        </View>
                    </Card>
                </Animated.View>

                {/* Menu Sections */}
                {menuSections.map((section, sectionIndex) => (
                    <Animated.View 
                        key={section.title}
                        style={[
                            styles.menuSection,
                            {
                                opacity: fadeAnim,
                                transform: [{ translateY: slideAnim }],
                            },
                        ]}
                    >
                        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{section.title}</Text>
                        <View style={[styles.menuCard, { backgroundColor: colors.surface }]}>
                            {section.items.map((item, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.menuItem,
                                        index < section.items.length - 1 && [styles.menuItemBorder, { borderBottomColor: colors.borderLight }],
                                        item.danger && styles.menuItemDanger,
                                    ]}
                                    onPress={item.onPress}
                                    activeOpacity={0.7}
                                >
                                    <View style={[
                                        styles.menuIconContainer,
                                        { backgroundColor: item.danger ? colors.error + '10' : colors.primary + '10' },
                                    ]}>
                                        <Ionicons 
                                            name={item.icon} 
                                            size={20} 
                                            color={item.danger ? colors.error : colors.primary} 
                                        />
                                    </View>
                                    
                                    <View style={styles.menuItemContent}>
                                        <Text style={[
                                            styles.menuItemText,
                                            { color: item.danger ? colors.error : colors.text },
                                        ]}>
                                            {item.label}
                                        </Text>
                                        {item.subtitle && (
                                            <Text style={[styles.menuItemSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                                                {item.subtitle}
                                            </Text>
                                        )}
                                    </View>
                                    
                                    <View style={styles.menuItemRight}>
                                        {item.badge && (
                                            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                                                <Text style={[styles.badgeText, { color: colors.surface }]}>{item.badge}</Text>
                                            </View>
                                        )}
                                        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </Animated.View>
                ))}

                {/* Sign Out */}
                <Animated.View style={[
                    styles.signOutSection,
                    {
                        opacity: fadeAnim,
                        transform: [{ translateY: slideAnim }],
                    },
                ]}>
                    <TouchableOpacity 
                        style={[styles.signOutButton, { backgroundColor: colors.error + '10', borderColor: colors.error + '30' }]}
                        onPress={handleSignOut}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="log-out-outline" size={22} color={colors.error} />
                        <Text style={[styles.signOutText, { color: colors.error }]}>Sign Out</Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={[styles.version, { color: colors.textSecondary }]}>BDI Learning • Version 1.0.0</Text>
                    <Text style={[styles.copyright, { color: colors.textTertiary }]}>© 2026 BDI. All rights reserved.</Text>
                </View>
            </ScrollView>

            {/* Edit Profile Modal */}
            <Modal
                visible={editProfileVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setEditProfileVisible(false)}
            >
                <View style={[styles.modalOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)' }]}>
                    <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Edit Profile</Text>
                            <TouchableOpacity onPress={() => setEditProfileVisible(false)}>
                                <Ionicons name="close" size={24} color={colors.textPrimary} />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={styles.inputContainer}>
                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Full Name</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
                                value={fullName}
                                onChangeText={setFullName}
                                placeholder="Enter your full name"
                                placeholderTextColor={colors.textTertiary}
                            />
                        </View>
                        
                        <View style={styles.inputContainer}>
                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Email</Text>
                            <TextInput
                                style={[styles.input, styles.inputDisabled, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
                                value={session?.user.email || ''}
                                editable={false}
                            />
                        </View>
                        
                        <TouchableOpacity style={[styles.modalButton, { backgroundColor: colors.primary }]} onPress={handleUpdateProfile}>
                            <Text style={[styles.modalButtonText, { color: colors.surface }]}>Save Changes</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Change Password Modal */}
            <Modal
                visible={changePasswordVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setChangePasswordVisible(false)}
            >
                <View style={[styles.modalOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)' }]}>
                    <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Change Password</Text>
                            <TouchableOpacity onPress={() => setChangePasswordVisible(false)}>
                                <Ionicons name="close" size={24} color={colors.textPrimary} />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={styles.inputContainer}>
                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>New Password</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
                                value={newPassword}
                                onChangeText={setNewPassword}
                                placeholder="Enter new password"
                                placeholderTextColor={colors.textTertiary}
                                secureTextEntry
                            />
                        </View>
                        
                        <View style={styles.inputContainer}>
                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Confirm Password</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                placeholder="Confirm new password"
                                placeholderTextColor={colors.textTertiary}
                                secureTextEntry
                            />
                        </View>
                        
                        <TouchableOpacity style={[styles.modalButton, { backgroundColor: colors.primary }]} onPress={handleChangePassword}>
                            <Text style={[styles.modalButtonText, { color: colors.surface }]}>Update Password</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Downloads Modal */}
            <Modal
                visible={downloadsVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setDownloadsVisible(false)}
            >
                <View style={[styles.modalOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)' }]}>
                    <View style={[styles.modalContent, { maxHeight: '80%', backgroundColor: colors.surface }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Downloads</Text>
                            <TouchableOpacity onPress={() => setDownloadsVisible(false)}>
                                <Ionicons name="close" size={24} color={colors.textPrimary} />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={[styles.storageInfo, { backgroundColor: colors.primary + '10' }]}>
                            <Ionicons name="folder-outline" size={20} color={colors.primary} />
                            <Text style={[styles.storageText, { color: colors.textPrimary }]}>Storage Used: {formatBytes(storageUsed)}</Text>
                        </View>
                        
                        <ScrollView style={styles.downloadsList}>
                            {downloads.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <Ionicons name="cloud-download-outline" size={48} color={colors.textTertiary} />
                                    <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>No downloads yet</Text>
                                    <Text style={[styles.emptyStateSubtext, { color: colors.textTertiary }]}>Downloaded videos will appear here</Text>
                                </View>
                            ) : (
                                downloads.map((item) => (
                                    <View key={item.id} style={[styles.downloadItem, { borderBottomColor: colors.border }]}>
                                        <View style={[styles.downloadItemIcon, { backgroundColor: colors.primary + '10' }]}>
                                            <Ionicons name="videocam" size={24} color={colors.primary} />
                                        </View>
                                        <View style={styles.downloadItemInfo}>
                                            <Text style={[styles.downloadItemTitle, { color: colors.textPrimary }]} numberOfLines={1}>{item.title}</Text>
                                            <Text style={[styles.downloadItemSubtitle, { color: colors.textSecondary }]}>
                                                {item.courseTitle} • {formatBytes(item.fileSize || 0)}
                                            </Text>
                                        </View>
                                        <TouchableOpacity 
                                            onPress={() => handleDeleteDownload(item.id)}
                                            style={styles.downloadItemDelete}
                                        >
                                            <Ionicons name="trash-outline" size={20} color={colors.error} />
                                        </TouchableOpacity>
                                    </View>
                                ))
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Theme Selection Modal */}
            <Modal
                visible={themeModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setThemeModalVisible(false)}
            >
                <View style={[styles.modalOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)' }]}>
                    <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Appearance</Text>
                            <TouchableOpacity onPress={() => setThemeModalVisible(false)}>
                                <Ionicons name="close" size={24} color={colors.textPrimary} />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={styles.themeOptions}>
                            {[
                                { value: 'light', label: 'Light', icon: 'sunny-outline' },
                                { value: 'dark', label: 'Dark', icon: 'moon-outline' },
                                { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
                            ].map((option) => (
                                <TouchableOpacity
                                    key={option.value}
                                    style={[
                                        styles.themeOption,
                                        { 
                                            backgroundColor: theme === option.value ? colors.primary + '15' : colors.background,
                                            borderColor: theme === option.value ? colors.primary : colors.border,
                                        }
                                    ]}
                                    onPress={() => {
                                        setTheme(option.value as any);
                                        setThemeModalVisible(false);
                                    }}
                                >
                                    <Ionicons 
                                        name={option.icon as any} 
                                        size={24} 
                                        color={theme === option.value ? colors.primary : colors.textSecondary} 
                                    />
                                    <Text style={[
                                        styles.themeOptionText, 
                                        { color: theme === option.value ? colors.primary : colors.text }
                                    ]}>
                                        {option.label}
                                    </Text>
                                    {theme === option.value && (
                                        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Coming Soon Modal */}
            <ComingSoonModal
                visible={comingSoonVisible}
                onClose={() => setComingSoonVisible(false)}
                title={comingSoonConfig.title}
                description={comingSoonConfig.description}
                icon={comingSoonConfig.icon}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        // paddingBottom handled dynamically via TAB_BAR_HEIGHT
    },
    header: {
        alignItems: 'center',
        paddingBottom: SPACING.xl,
        paddingHorizontal: SPACING.lg,
    },
    headerBackground: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 160,
        backgroundColor: COLORS.primary,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    avatarContainer: {
        position: 'relative',
        marginTop: SPACING.xl,
        marginBottom: SPACING.md,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: COLORS.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
        borderColor: COLORS.surface,
        ...SHADOWS.lg,
    },
    avatarText: {
        fontSize: 40,
        fontWeight: FONT_WEIGHT.extrabold,
        color: COLORS.primary,
    },
    editAvatarButton: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: COLORS.surface,
    },
    userName: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        marginBottom: SPACING.xs,
    },
    email: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
        marginBottom: SPACING.sm,
    },
    roleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        backgroundColor: COLORS.primary + '15',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.round,
    },
    roleText: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.primary,
        fontWeight: FONT_WEIGHT.bold,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statsCardWrapper: {
        paddingHorizontal: SPACING.lg,
        marginTop: -SPACING.md,
    },
    statsCard: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingVertical: SPACING.lg,
        ...SHADOWS.md,
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.sm,
    },
    statValue: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.extrabold,
        color: COLORS.text,
        marginBottom: 2,
    },
    statLabel: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.textSecondary,
        fontWeight: FONT_WEIGHT.medium,
    },
    statDivider: {
        width: 1,
        height: 50,
        backgroundColor: COLORS.border,
    },
    menuSection: {
        paddingHorizontal: SPACING.lg,
        marginTop: SPACING.xl,
    },
    sectionTitle: {
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: SPACING.sm,
        marginLeft: SPACING.xs,
    },
    menuCard: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.xl,
        overflow: 'hidden',
        ...SHADOWS.sm,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
    },
    menuItemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderLight,
    },
    menuItemDanger: {},
    menuIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: COLORS.primary + '10',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.md,
    },
    menuIconContainerDanger: {
        backgroundColor: COLORS.error + '10',
    },
    menuItemContent: {
        flex: 1,
    },
    menuItemText: {
        fontSize: FONT_SIZE.md,
        color: COLORS.text,
        fontWeight: FONT_WEIGHT.medium,
    },
    menuItemTextDanger: {
        color: COLORS.error,
    },
    menuItemSubtitle: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    menuItemRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    badge: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 2,
        borderRadius: BORDER_RADIUS.round,
        minWidth: 22,
        alignItems: 'center',
    },
    badgeText: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.surface,
        fontWeight: FONT_WEIGHT.bold,
    },
    signOutSection: {
        paddingHorizontal: SPACING.lg,
        marginTop: SPACING.xxl,
    },
    signOutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.sm,
        backgroundColor: COLORS.error + '10',
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.error + '30',
    },
    signOutText: {
        fontSize: FONT_SIZE.md,
        color: COLORS.error,
        fontWeight: FONT_WEIGHT.semibold,
    },
    footer: {
        alignItems: 'center',
        marginTop: SPACING.xxl,
        paddingHorizontal: SPACING.lg,
    },
    version: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
        fontWeight: FONT_WEIGHT.medium,
        marginBottom: SPACING.xs,
    },
    copyright: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.textTertiary,
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: SPACING.lg,
        paddingBottom: SPACING.xxxl,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.lg,
    },
    modalTitle: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.textPrimary,
    },
    inputContainer: {
        marginBottom: SPACING.md,
    },
    inputLabel: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.medium,
        color: COLORS.textSecondary,
        marginBottom: SPACING.xs,
    },
    input: {
        backgroundColor: COLORS.background,
        borderRadius: BORDER_RADIUS.md,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        fontSize: FONT_SIZE.md,
        color: COLORS.textPrimary,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    inputDisabled: {
        opacity: 0.6,
    },
    modalButton: {
        backgroundColor: COLORS.primary,
        borderRadius: BORDER_RADIUS.md,
        paddingVertical: SPACING.md,
        alignItems: 'center',
        marginTop: SPACING.md,
    },
    modalButtonText: {
        color: COLORS.surface,
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
    },
    storageInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        backgroundColor: COLORS.primary + '10',
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        marginBottom: SPACING.md,
    },
    storageText: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textPrimary,
        fontWeight: FONT_WEIGHT.medium,
    },
    downloadsList: {
        maxHeight: 400,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: SPACING.xxl,
    },
    emptyStateText: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.medium,
        color: COLORS.textSecondary,
        marginTop: SPACING.md,
    },
    emptyStateSubtext: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textTertiary,
        marginTop: SPACING.xs,
    },
    downloadItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    downloadItemIcon: {
        width: 44,
        height: 44,
        borderRadius: BORDER_RADIUS.md,
        backgroundColor: COLORS.primary + '10',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.md,
    },
    downloadItemInfo: {
        flex: 1,
    },
    downloadItemTitle: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.medium,
        color: COLORS.textPrimary,
    },
    downloadItemSubtitle: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    downloadItemDelete: {
        padding: SPACING.sm,
    },
    themeOptions: {
        gap: SPACING.sm,
    },
    themeOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1.5,
        gap: SPACING.md,
    },
    themeOptionText: {
        flex: 1,
        fontSize: FONT_SIZE.md,
        fontFamily: 'Inter-Medium',
    },
});
