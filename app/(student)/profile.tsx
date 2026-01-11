import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import React, { useState, useEffect } from 'react';
import { 
    Alert,
    Animated, 
    Image, 
    Modal,
    RefreshControl,
    ScrollView, 
    StyleSheet, 
    Text, 
    TextInput,
    TouchableOpacity, 
    View 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { useAuth } from '../../src/features/auth/AuthContext';
import { fetchMyEnrollments } from '../../src/features/courses/courseService';
import { getDownloadRecords, removeDownloadRecord, deleteLessonDownload, getDownloadsStorageUsed } from '../../src/features/offline/downloadManager';
import { supabase } from '../../src/lib/supabase';
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
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState<StatsData>({ courses: 0, progress: 0, certificates: 0 });
    
    // Modal states
    const [editProfileVisible, setEditProfileVisible] = useState(false);
    const [changePasswordVisible, setChangePasswordVisible] = useState(false);
    const [downloadsVisible, setDownloadsVisible] = useState(false);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    
    // Form states
    const [fullName, setFullName] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [downloads, setDownloads] = useState<DownloadItemData[]>([]);
    const [storageUsed, setStorageUsed] = useState(0);
    
    // Animations
    const fadeAnim = React.useRef(new Animated.Value(0)).current;
    const slideAnim = React.useRef(new Animated.Value(30)).current;

    useEffect(() => {
        loadStats();
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
                    .select('full_name')
                    .eq('id', user.id)
                    .single();
                if (profile?.full_name) {
                    setFullName(profile.full_name);
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
                    onPress: () => Alert.alert('Bookmarks', 'Bookmarks feature coming soon!')
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
                    icon: 'moon-outline', 
                    label: 'Appearance',
                    subtitle: 'Theme and display settings',
                    onPress: () => Alert.alert('Appearance', 'Dark mode coming soon!')
                },
                { 
                    icon: 'language-outline', 
                    label: 'Language',
                    subtitle: 'English',
                    onPress: () => Alert.alert('Language', 'Additional languages coming soon!')
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
                    onPress: () => Linking.openURL('https://help.bdi.com')
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
                    onPress: () => Linking.openURL('https://bdi.com/privacy')
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
        <SafeAreaView style={styles.container}>
            <ScrollView 
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={COLORS.primary}
                        colors={[COLORS.primary]}
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
                    <View style={styles.headerBackground} />
                    
                    <View style={styles.avatarContainer}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{getUserInitials()}</Text>
                        </View>
                        <TouchableOpacity style={styles.editAvatarButton}>
                            <Ionicons name="camera" size={16} color={COLORS.surface} />
                        </TouchableOpacity>
                    </View>
                    
                    <Text style={styles.userName}>{getUserName()}</Text>
                    <Text style={styles.email}>{session?.user.email}</Text>
                    
                    <View style={styles.roleBadge}>
                        <Ionicons name="school-outline" size={14} color={COLORS.primary} />
                        <Text style={styles.roleText}>Student</Text>
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
                    <Card style={styles.statsCard}>
                        <View style={styles.statItem}>
                            <View style={[styles.statIconContainer, { backgroundColor: COLORS.primary + '15' }]}>
                                <Ionicons name="library" size={22} color={COLORS.primary} />
                            </View>
                            <Text style={styles.statValue}>{stats.courses}</Text>
                            <Text style={styles.statLabel}>Courses</Text>
                        </View>
                        
                        <View style={styles.statDivider} />
                        
                        <View style={styles.statItem}>
                            <View style={[styles.statIconContainer, { backgroundColor: COLORS.success + '15' }]}>
                                <Ionicons name="trending-up" size={22} color={COLORS.success} />
                            </View>
                            <Text style={styles.statValue}>{stats.progress}%</Text>
                            <Text style={styles.statLabel}>Progress</Text>
                        </View>
                        
                        <View style={styles.statDivider} />
                        
                        <View style={styles.statItem}>
                            <View style={[styles.statIconContainer, { backgroundColor: COLORS.warning + '15' }]}>
                                <Ionicons name="trophy" size={22} color={COLORS.warning} />
                            </View>
                            <Text style={styles.statValue}>{stats.certificates}</Text>
                            <Text style={styles.statLabel}>Certificates</Text>
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
                        <Text style={styles.sectionTitle}>{section.title}</Text>
                        <View style={styles.menuCard}>
                            {section.items.map((item, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.menuItem,
                                        index < section.items.length - 1 && styles.menuItemBorder,
                                        item.danger && styles.menuItemDanger,
                                    ]}
                                    onPress={item.onPress}
                                    activeOpacity={0.7}
                                >
                                    <View style={[
                                        styles.menuIconContainer,
                                        item.danger && styles.menuIconContainerDanger,
                                    ]}>
                                        <Ionicons 
                                            name={item.icon} 
                                            size={20} 
                                            color={item.danger ? COLORS.error : COLORS.primary} 
                                        />
                                    </View>
                                    
                                    <View style={styles.menuItemContent}>
                                        <Text style={[
                                            styles.menuItemText,
                                            item.danger && styles.menuItemTextDanger,
                                        ]}>
                                            {item.label}
                                        </Text>
                                        {item.subtitle && (
                                            <Text style={styles.menuItemSubtitle} numberOfLines={1}>
                                                {item.subtitle}
                                            </Text>
                                        )}
                                    </View>
                                    
                                    <View style={styles.menuItemRight}>
                                        {item.badge && (
                                            <View style={styles.badge}>
                                                <Text style={styles.badgeText}>{item.badge}</Text>
                                            </View>
                                        )}
                                        <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
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
                        style={styles.signOutButton}
                        onPress={handleSignOut}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="log-out-outline" size={22} color={COLORS.error} />
                        <Text style={styles.signOutText}>Sign Out</Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.version}>BDI Learning • Version 1.0.0</Text>
                    <Text style={styles.copyright}>© 2026 BDI. All rights reserved.</Text>
                </View>
            </ScrollView>

            {/* Edit Profile Modal */}
            <Modal
                visible={editProfileVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setEditProfileVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Edit Profile</Text>
                            <TouchableOpacity onPress={() => setEditProfileVisible(false)}>
                                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Full Name</Text>
                            <TextInput
                                style={styles.input}
                                value={fullName}
                                onChangeText={setFullName}
                                placeholder="Enter your full name"
                                placeholderTextColor={COLORS.textTertiary}
                            />
                        </View>
                        
                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Email</Text>
                            <TextInput
                                style={[styles.input, styles.inputDisabled]}
                                value={session?.user.email || ''}
                                editable={false}
                            />
                        </View>
                        
                        <TouchableOpacity style={styles.modalButton} onPress={handleUpdateProfile}>
                            <Text style={styles.modalButtonText}>Save Changes</Text>
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
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Change Password</Text>
                            <TouchableOpacity onPress={() => setChangePasswordVisible(false)}>
                                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>New Password</Text>
                            <TextInput
                                style={styles.input}
                                value={newPassword}
                                onChangeText={setNewPassword}
                                placeholder="Enter new password"
                                placeholderTextColor={COLORS.textTertiary}
                                secureTextEntry
                            />
                        </View>
                        
                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Confirm Password</Text>
                            <TextInput
                                style={styles.input}
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                placeholder="Confirm new password"
                                placeholderTextColor={COLORS.textTertiary}
                                secureTextEntry
                            />
                        </View>
                        
                        <TouchableOpacity style={styles.modalButton} onPress={handleChangePassword}>
                            <Text style={styles.modalButtonText}>Update Password</Text>
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
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxHeight: '80%' }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Downloads</Text>
                            <TouchableOpacity onPress={() => setDownloadsVisible(false)}>
                                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={styles.storageInfo}>
                            <Ionicons name="folder-outline" size={20} color={COLORS.primary} />
                            <Text style={styles.storageText}>Storage Used: {formatBytes(storageUsed)}</Text>
                        </View>
                        
                        <ScrollView style={styles.downloadsList}>
                            {downloads.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <Ionicons name="cloud-download-outline" size={48} color={COLORS.textTertiary} />
                                    <Text style={styles.emptyStateText}>No downloads yet</Text>
                                    <Text style={styles.emptyStateSubtext}>Downloaded videos will appear here</Text>
                                </View>
                            ) : (
                                downloads.map((item) => (
                                    <View key={item.id} style={styles.downloadItem}>
                                        <View style={styles.downloadItemIcon}>
                                            <Ionicons name="videocam" size={24} color={COLORS.primary} />
                                        </View>
                                        <View style={styles.downloadItemInfo}>
                                            <Text style={styles.downloadItemTitle} numberOfLines={1}>{item.title}</Text>
                                            <Text style={styles.downloadItemSubtitle}>
                                                {item.courseTitle} • {formatBytes(item.fileSize || 0)}
                                            </Text>
                                        </View>
                                        <TouchableOpacity 
                                            onPress={() => handleDeleteDownload(item.id)}
                                            style={styles.downloadItemDelete}
                                        >
                                            <Ionicons name="trash-outline" size={20} color={COLORS.error} />
                                        </TouchableOpacity>
                                    </View>
                                ))
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        paddingBottom: SPACING.xxxl,
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
});
