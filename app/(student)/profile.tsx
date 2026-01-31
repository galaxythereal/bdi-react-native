import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Animated,
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
import Theme from '../../constants/theme';
import { Card } from '../../src/components/Card';
import { ComingSoonModal } from '../../src/components/ComingSoonModal';
import { ProfilePhotoUpload } from '../../src/components/media/ProfilePhotoUpload';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/features/auth/AuthContext';
import { fetchMyEnrollments } from '../../src/features/courses/courseService';
import { supabase } from '../../src/lib/supabase';
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



export default function ProfileScreen() {
    const { signOut, session } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { colors, isDark, theme, setTheme } = useTheme();
    const styles = React.useMemo(() => createStyles(colors, isDark), [colors, isDark]);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState<StatsData>({ courses: 0, progress: 0, certificates: 0 });

    // Modal states
    const [editProfileVisible, setEditProfileVisible] = useState(false);
    const [changePasswordVisible, setChangePasswordVisible] = useState(false);

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
                    onPress: () => router.push('/(student)/downloads')
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
                    onPress: () => router.push('/(student)/certificates')
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
                    icon: 'chatbubble-outline',
                    label: 'Contact Support',
                    subtitle: 'Get help from our team',
                    onPress: () => router.push('/(student)/support')
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
                contentContainerStyle={[styles.scrollContent, { paddingBottom: TAB_BAR_HEIGHT + Theme.spacing.lg }]}
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

const createStyles = (colors: typeof Theme.colors.light, isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollContent: {
        // paddingBottom handled dynamically via TAB_BAR_HEIGHT
    },
    header: {
        alignItems: 'center',
        paddingBottom: Theme.spacing.xl,
        paddingHorizontal: Theme.spacing.lg,
    },
    headerBackground: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 160,
        backgroundColor: colors.primary,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    avatarContainer: {
        position: 'relative',
        marginTop: Theme.spacing.xl,
        marginBottom: Theme.spacing.md,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
        borderColor: colors.surface,
        ...Theme.shadows[isDark ? 'dark' : 'light'].lg,
    },
    avatarText: {
        fontSize: 40,
        fontWeight: Theme.fontWeight.extrabold,
        color: colors.primary,
    },
    editAvatarButton: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: colors.surface,
    },
    userName: {
        fontSize: Theme.fontSize.xl,
        fontWeight: Theme.fontWeight.bold,
        color: colors.text,
        marginBottom: Theme.spacing.xs,
    },
    email: {
        fontSize: Theme.fontSize.sm,
        color: colors.textSecondary,
        marginBottom: Theme.spacing.sm,
    },
    roleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.xs,
        backgroundColor: colors.primary + '15',
        paddingHorizontal: Theme.spacing.md,
        paddingVertical: Theme.spacing.xs,
        borderRadius: Theme.borderRadius.round,
    },
    roleText: {
        fontSize: Theme.fontSize.xs,
        color: colors.primary,
        fontWeight: Theme.fontWeight.bold,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statsCardWrapper: {
        paddingHorizontal: Theme.spacing.lg,
        marginTop: -Theme.spacing.md,
    },
    statsCard: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingVertical: Theme.spacing.lg,
        ...Theme.shadows[isDark ? 'dark' : 'light'].md,
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
        marginBottom: Theme.spacing.sm,
    },
    statValue: {
        fontSize: Theme.fontSize.xl,
        fontWeight: Theme.fontWeight.extrabold,
        color: colors.text,
        marginBottom: 2,
    },
    statLabel: {
        fontSize: Theme.fontSize.xs,
        color: colors.textSecondary,
        fontWeight: Theme.fontWeight.medium,
    },
    statDivider: {
        width: 1,
        height: 50,
        backgroundColor: colors.border,
    },
    menuSection: {
        paddingHorizontal: Theme.spacing.lg,
        marginTop: Theme.spacing.xl,
    },
    sectionTitle: {
        fontSize: Theme.fontSize.xs,
        fontWeight: Theme.fontWeight.bold,
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: Theme.spacing.sm,
        marginLeft: Theme.spacing.xs,
    },
    menuCard: {
        backgroundColor: colors.surface,
        borderRadius: Theme.borderRadius.xl,
        overflow: 'hidden',
        ...Theme.shadows[isDark ? 'dark' : 'light'].sm,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Theme.spacing.md,
    },
    menuItemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: colors.borderLight,
    },
    menuItemDanger: {},
    menuIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: colors.primary + '10',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Theme.spacing.md,
    },
    menuIconContainerDanger: {
        backgroundColor: colors.error + '10',
    },
    menuItemContent: {
        flex: 1,
    },
    menuItemText: {
        fontSize: Theme.fontSize.base,
        color: colors.text,
        fontWeight: Theme.fontWeight.medium,
    },
    menuItemTextDanger: {
        color: colors.error,
    },
    menuItemSubtitle: {
        fontSize: Theme.fontSize.xs,
        color: colors.textSecondary,
        marginTop: 2,
    },
    menuItemRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.sm,
    },
    badge: {
        backgroundColor: colors.primary,
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: 2,
        borderRadius: Theme.borderRadius.round,
        minWidth: 22,
        alignItems: 'center',
    },
    badgeText: {
        fontSize: Theme.fontSize.xs,
        color: colors.surface,
        fontWeight: Theme.fontWeight.bold,
    },
    signOutSection: {
        paddingHorizontal: Theme.spacing.lg,
        marginTop: Theme.spacing["2xl"],
    },
    signOutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Theme.spacing.sm,
        backgroundColor: colors.error + '10',
        paddingVertical: Theme.spacing.md,
        borderRadius: Theme.borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.error + '30',
    },
    signOutText: {
        fontSize: Theme.fontSize.base,
        color: colors.error,
        fontWeight: Theme.fontWeight.semibold,
    },
    footer: {
        alignItems: 'center',
        marginTop: Theme.spacing["2xl"],
        paddingHorizontal: Theme.spacing.lg,
    },
    version: {
        fontSize: Theme.fontSize.sm,
        color: colors.textSecondary,
        fontWeight: Theme.fontWeight.medium,
        marginBottom: Theme.spacing.xs,
    },
    copyright: {
        fontSize: Theme.fontSize.xs,
        color: colors.textTertiary,
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: Theme.spacing.lg,
        paddingBottom: Theme.spacing["3xl"],
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Theme.spacing.lg,
    },
    modalTitle: {
        fontSize: Theme.fontSize.xl,
        fontWeight: Theme.fontWeight.bold,
        color: colors.textPrimary,
    },
    inputContainer: {
        marginBottom: Theme.spacing.md,
    },
    inputLabel: {
        fontSize: Theme.fontSize.sm,
        fontWeight: Theme.fontWeight.medium,
        color: colors.textSecondary,
        marginBottom: Theme.spacing.xs,
    },
    input: {
        backgroundColor: colors.background,
        borderRadius: Theme.borderRadius.md,
        paddingHorizontal: Theme.spacing.md,
        paddingVertical: Theme.spacing.sm,
        fontSize: Theme.fontSize.base,
        color: colors.textPrimary,
        borderWidth: 1,
        borderColor: colors.border,
    },
    inputDisabled: {
        opacity: 0.6,
    },
    modalButton: {
        backgroundColor: colors.primary,
        borderRadius: Theme.borderRadius.md,
        paddingVertical: Theme.spacing.md,
        alignItems: 'center',
        marginTop: Theme.spacing.md,
    },
    modalButtonText: {
        color: colors.surface,
        fontSize: Theme.fontSize.base,
        fontWeight: Theme.fontWeight.semibold,
    },
    storageInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.sm,
        backgroundColor: colors.primary + '10',
        padding: Theme.spacing.md,
        borderRadius: Theme.borderRadius.md,
        marginBottom: Theme.spacing.md,
    },
    storageText: {
        fontSize: Theme.fontSize.sm,
        color: colors.textPrimary,
        fontWeight: Theme.fontWeight.medium,
    },
    downloadsList: {
        maxHeight: 400,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: Theme.spacing["2xl"],
    },
    emptyStateText: {
        fontSize: Theme.fontSize.base,
        fontWeight: Theme.fontWeight.medium,
        color: colors.textSecondary,
        marginTop: Theme.spacing.md,
    },
    emptyStateSubtext: {
        fontSize: Theme.fontSize.sm,
        color: colors.textTertiary,
        marginTop: Theme.spacing.xs,
    },
    downloadItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Theme.spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    downloadItemIcon: {
        width: 44,
        height: 44,
        borderRadius: Theme.borderRadius.md,
        backgroundColor: colors.primary + '10',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Theme.spacing.md,
    },
    downloadItemInfo: {
        flex: 1,
    },
    downloadItemTitle: {
        fontSize: Theme.fontSize.base,
        fontWeight: Theme.fontWeight.medium,
        color: colors.textPrimary,
    },
    downloadItemSubtitle: {
        fontSize: Theme.fontSize.xs,
        color: colors.textSecondary,
        marginTop: 2,
    },
    downloadItemDelete: {
        padding: Theme.spacing.sm,
    },
    themeOptions: {
        gap: Theme.spacing.sm,
    },
    themeOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Theme.spacing.md,
        borderRadius: Theme.borderRadius.md,
        borderWidth: 1.5,
        gap: Theme.spacing.md,
    },
    themeOptionText: {
        flex: 1,
        fontSize: Theme.fontSize.base,
        fontFamily: 'Inter-Medium',
    },
});
