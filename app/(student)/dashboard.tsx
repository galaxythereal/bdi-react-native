import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Image,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/features/auth/AuthContext';
import { fetchMyEnrollments } from '../../src/features/courses/courseService';
import { fetchUpcomingLiveSessions, fetchDiplomaCatalog } from '../../src/features/diplomas/diplomaService';
import { BORDER_RADIUS, COLORS, FONT_SIZE, FONT_WEIGHT, SHADOWS, SPACING } from '../../src/lib/constants';
import { useTheme } from '../../src/context/ThemeContext';
import { useNotifications } from '../../src/context/NotificationContext';
import { NotificationBell } from '../../src/features/notifications/NotificationComponents';
import { Enrollment, LiveSession, CatalogDiploma } from '../../src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - SPACING.lg * 2 - CARD_GAP) / 2;

// Compact Course Card for Grid
interface CourseCardProps {
    item: Enrollment;
    index: number;
    onPress: () => void;
}

const CourseCard: React.FC<CourseCardProps> = ({ item, index, onPress }) => {
    const cardAnim = useRef(new Animated.Value(0)).current;
    const progress = Math.round(item.progress || 0);
    const diploma = item.diploma;

    useEffect(() => {
        Animated.spring(cardAnim, {
            toValue: 1,
            delay: index * 60,
            tension: 80,
            friction: 10,
            useNativeDriver: true,
        }).start();
    }, []);

    const scale = cardAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.9, 1],
    });

    const translateY = cardAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [20, 0],
    });

    // Progress color based on completion
    const getProgressColor = () => {
        if (progress >= 100) return COLORS.success;
        if (progress >= 50) return COLORS.primary;
        return COLORS.warning;
    };

    return (
        <Animated.View
            style={[
                styles.cardWrapper,
                {
                    transform: [{ scale }, { translateY }],
                    opacity: cardAnim,
                },
            ]}
        >
            <TouchableOpacity
                onPress={onPress}
                activeOpacity={0.9}
                style={styles.card}
            >
                {/* Thumbnail */}
                <View style={styles.thumbnailContainer}>
                    {diploma?.thumbnail_url ? (
                        <Image
                            source={{ uri: diploma.thumbnail_url }}
                            style={styles.thumbnail}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={styles.thumbnailPlaceholder}>
                            <Ionicons name="school" size={28} color={COLORS.primary} />
                        </View>
                    )}
                    {/* Progress badge */}
                    <View style={[styles.progressBadge, { backgroundColor: getProgressColor() }]}>
                        <Text style={styles.progressBadgeText}>{progress}%</Text>
                    </View>
                </View>

                {/* Info */}
                <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                        {diploma?.title || 'Untitled Diploma'}
                    </Text>

                    {/* Progress bar */}
                    <View style={styles.progressContainer}>
                        <View style={styles.progressBar}>
                            <View
                                style={[
                                    styles.progressFill,
                                    { width: `${progress}%`, backgroundColor: getProgressColor() }
                                ]}
                            />
                        </View>
                    </View>

                    {/* Action text */}
                    <Text style={styles.actionText}>
                        {progress > 0 ? 'Continue' : 'Start'} →
                    </Text>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

// Stats Card Component
interface StatCardProps {
    icon: keyof typeof Ionicons.glyphMap;
    value: string | number;
    label: string;
    color: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, value, label, color }) => (
    <View style={styles.statCard}>
        <View style={[styles.statIconContainer, { backgroundColor: color + '15' }]}>
            <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
    </View>
);

export default function DashboardScreen() {
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
    const [allDiplomas, setAllDiplomas] = useState<CatalogDiploma[]>([]);
    const [selectedDiploma, setSelectedDiploma] = useState<CatalogDiploma | null>(null);
    const [showDiplomaModal, setShowDiplomaModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const { session } = useAuth();
    const { unreadCount } = useNotifications();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const { colors } = useTheme();

    const loadData = async () => {
        try {
            const [enrollmentsData, sessionsData, catalogData] = await Promise.all([
                fetchMyEnrollments(),
                fetchUpcomingLiveSessions(),
                fetchDiplomaCatalog(),
            ]);
            setEnrollments(enrollmentsData || []);
            setLiveSessions(sessionsData || []);
            setAllDiplomas(catalogData || []);

            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }).start();
        } catch (error: any) {
            console.error('Error loading enrollments:', error);
            Alert.alert('Error', error.message || 'Failed to load courses.');
            setEnrollments([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Reload data when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    // Calculate stats
    const totalCourses = enrollments.length;
    const avgProgress = totalCourses > 0
        ? Math.round(enrollments.reduce((acc, e) => acc + (e.progress || 0), 0) / totalCourses)
        : 0;
    const completedCourses = enrollments.filter(e => e.progress >= 100).length;
    const inProgressCourses = enrollments.filter(e => e.progress > 0 && e.progress < 100).length;

    // Get greeting based on time
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    };

    const getUserName = () => {
        const email = session?.user.email || '';
        const name = email.split('@')[0];
        return name.charAt(0).toUpperCase() + name.slice(1);
    };

    if (loading && !refreshing) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading your dashboard...</Text>
                </View>
            </SafeAreaView>
        );
    }

    // Tab bar height for bottom padding
    const TAB_BAR_HEIGHT = 56 + Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 24);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.primary}
                        colors={[colors.primary]}
                    />
                }
                contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + SPACING.lg }}
            >
                <Animated.View style={{ opacity: fadeAnim }}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerTop}>
                            <View style={styles.headerTextContainer}>
                                <Text style={styles.greeting}>{getGreeting()},</Text>
                                <Text style={styles.userName}>{getUserName()} 👋</Text>
                            </View>
                            <View style={styles.headerActions}>
                                <NotificationBell
                                    onPress={() => router.push('/(student)/notifications')}
                                    count={unreadCount}
                                />
                                <TouchableOpacity
                                    style={styles.avatar}
                                    onPress={() => router.push('/(student)/profile')}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.avatarText}>
                                        {session?.user.email?.charAt(0).toUpperCase() || 'S'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Quick Stats */}
                        {totalCourses > 0 && (
                            <View style={styles.statsRow}>
                                <StatCard
                                    icon="book"
                                    value={totalCourses}
                                    label="Courses"
                                    color={COLORS.primary}
                                />
                                <StatCard
                                    icon="trending-up"
                                    value={`${avgProgress}%`}
                                    label="Progress"
                                    color={COLORS.info}
                                />
                                <StatCard
                                    icon="checkmark-circle"
                                    value={completedCourses}
                                    label="Completed"
                                    color={COLORS.success}
                                />
                            </View>
                        )}
                    </View>

                    {/* Featured Live Sessions */}
                    {liveSessions.length > 0 && (
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <View style={styles.sectionTitleRow}>
                                    <View style={styles.liveDot} />
                                    <Text style={styles.sectionTitle}>Live Sessions</Text>
                                </View>
                                <TouchableOpacity onPress={() => router.push('/(student)/live-sessions')}>
                                    <Text style={styles.seeAllText}>View All</Text>
                                </TouchableOpacity>
                            </View>

                            {liveSessions.slice(0, 2).map((session, index) => {
                                const isLive = session.status === 'live';
                                const sessionDate = new Date(session.scheduled_at);
                                const now = new Date();
                                const diff = sessionDate.getTime() - now.getTime();
                                const hours = Math.floor(diff / 3600000);
                                const minutes = Math.floor((diff % 3600000) / 60000);
                                const isToday = now.toDateString() === sessionDate.toDateString();

                                return (
                                    <TouchableOpacity
                                        key={session.id}
                                        style={styles.liveSessionCard}
                                        onPress={() => {
                                            if (session.meeting_url) {
                                                Alert.alert(
                                                    'Join Session',
                                                    `Join "${session.title}"?`,
                                                    [
                                                        { text: 'Cancel', style: 'cancel' },
                                                        { text: 'Join', onPress: () => Linking.openURL(session.meeting_url!) },
                                                    ]
                                                );
                                            } else {
                                                router.push('/(student)/live-sessions');
                                            }
                                        }}
                                        activeOpacity={0.9}
                                    >
                                        <LinearGradient
                                            colors={isLive ? ['#EF4444', '#DC2626'] : [COLORS.primary, '#7C3AED']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={styles.liveSessionGradient}
                                        >
                                            {/* Live Badge */}
                                            {isLive && (
                                                <View style={styles.liveNowBadge}>
                                                    <View style={styles.liveNowDot} />
                                                    <Text style={styles.liveNowText}>LIVE NOW</Text>
                                                </View>
                                            )}

                                            {/* Content */}
                                            <View style={styles.liveSessionContent}>
                                                <View style={styles.liveSessionInfo}>
                                                    <Text style={styles.liveSessionTitle} numberOfLines={2}>
                                                        {session.title}
                                                    </Text>
                                                    <View style={styles.liveSessionMeta}>
                                                        <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.8)" />
                                                        <Text style={styles.liveSessionMetaText}>
                                                            {isLive ? 'Happening now' :
                                                                isToday ? `Today, ${sessionDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` :
                                                                    sessionDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                                        </Text>
                                                    </View>
                                                    {session.duration_minutes && (
                                                        <View style={styles.liveSessionMeta}>
                                                            <Ionicons name="videocam-outline" size={14} color="rgba(255,255,255,0.8)" />
                                                            <Text style={styles.liveSessionMetaText}>
                                                                {session.duration_minutes} min session
                                                            </Text>
                                                        </View>
                                                    )}
                                                </View>

                                                {/* Countdown or Join */}
                                                <View style={styles.liveSessionAction}>
                                                    {isLive ? (
                                                        <View style={styles.joinNowButton}>
                                                            <Ionicons name="videocam" size={18} color={COLORS.error} />
                                                            <Text style={styles.joinNowText}>Join</Text>
                                                        </View>
                                                    ) : diff > 0 && diff < 86400000 ? (
                                                        <View style={styles.countdownBox}>
                                                            <Text style={styles.countdownValue}>
                                                                {hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`}
                                                            </Text>
                                                            <Text style={styles.countdownLabel}>until live</Text>
                                                        </View>
                                                    ) : (
                                                        <View style={styles.joinNowButton}>
                                                            <Ionicons name="arrow-forward" size={18} color={COLORS.primary} />
                                                        </View>
                                                    )}
                                                </View>
                                            </View>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}

                    {/* Your Diploma(s) Section - Diploma-Centric Design */}
                    {enrollments.length > 0 ? (
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>
                                    {enrollments.length === 1 ? 'Your Diploma' : 'Your Diplomas'}
                                </Text>
                            </View>

                            {/* Enrolled Diplomas */}
                            {enrollments.map((enrollment, enrollmentIndex) => {
                                const diploma = enrollment.diploma;
                                const courses = enrollment.courses || [];
                                const overallProgress = enrollment.progress || 0;

                                return (
                                    <TouchableOpacity
                                        key={enrollment.id}
                                        style={[
                                            styles.enrolledDiplomaCard,
                                            enrollmentIndex > 0 && { marginTop: SPACING.md }
                                        ]}
                                        onPress={() => {
                                            // Find this diploma in catalog for richer data
                                            const catalogDiploma = allDiplomas.find(d => d.id === enrollment.diploma_id);
                                            if (catalogDiploma) {
                                                setSelectedDiploma(catalogDiploma);
                                                setShowDiplomaModal(true);
                                            } else if (diploma) {
                                                // Use enrollment diploma data if catalog not available
                                                setSelectedDiploma({
                                                    ...diploma,
                                                    courses: courses.map(c => ({
                                                        ...c,
                                                        description: null,
                                                        chapters: []
                                                    }))
                                                } as CatalogDiploma);
                                                setShowDiplomaModal(true);
                                            }
                                        }}
                                        activeOpacity={0.95}
                                    >
                                        {/* Diploma Hero Image */}
                                        <View style={styles.enrolledDiplomaHero}>
                                            {diploma?.thumbnail_url ? (
                                                <Image
                                                    source={{ uri: diploma.thumbnail_url }}
                                                    style={styles.enrolledDiplomaImage}
                                                    resizeMode="cover"
                                                />
                                            ) : (
                                                <LinearGradient
                                                    colors={[COLORS.primary, COLORS.primaryDark]}
                                                    style={styles.enrolledDiplomaImage}
                                                >
                                                    <Ionicons name="school" size={48} color="#fff" />
                                                </LinearGradient>
                                            )}
                                            <LinearGradient
                                                colors={['transparent', 'rgba(0,0,0,0.85)']}
                                                style={styles.enrolledDiplomaOverlay}
                                            >
                                                <View style={styles.enrolledDiplomaBadge}>
                                                    <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                                                    <Text style={styles.enrolledDiplomaBadgeText}>Enrolled</Text>
                                                </View>
                                                <Text style={styles.enrolledDiplomaTitle} numberOfLines={2}>
                                                    {diploma?.title || 'Your Diploma'}
                                                </Text>
                                                <Text style={styles.enrolledDiplomaCourseCount}>
                                                    {courses.length} {courses.length === 1 ? 'Course' : 'Courses'}
                                                </Text>
                                            </LinearGradient>
                                        </View>

                                        {/* Progress Section */}
                                        <View style={styles.enrolledDiplomaProgress}>
                                            <View style={styles.progressHeader}>
                                                <Text style={styles.progressLabel}>Overall Progress</Text>
                                                <Text style={styles.progressPercentage}>{overallProgress}%</Text>
                                            </View>
                                            <View style={styles.progressBarLarge}>
                                                <View
                                                    style={[
                                                        styles.progressBarFillLarge,
                                                        {
                                                            width: `${overallProgress}%`,
                                                            backgroundColor: overallProgress >= 100 ? COLORS.success : COLORS.primary
                                                        }
                                                    ]}
                                                />
                                            </View>
                                        </View>

                                        {/* Course Preview Cards */}
                                        {courses.length > 0 && (
                                            <View style={styles.coursePreviewSection}>
                                                <Text style={styles.coursePreviewTitle}>Courses</Text>
                                                <View style={styles.coursePreviewGrid}>
                                                    {courses.slice(0, 3).map((course, index) => (
                                                        <TouchableOpacity
                                                            key={course.id}
                                                            style={styles.coursePreviewItem}
                                                            onPress={() => router.push(`/course/${course.id}`)}
                                                            activeOpacity={0.8}
                                                        >
                                                            <View style={styles.coursePreviewNumber}>
                                                                <Text style={styles.coursePreviewNumberText}>{index + 1}</Text>
                                                            </View>
                                                            <Text style={styles.coursePreviewName} numberOfLines={2}>
                                                                {course.title}
                                                            </Text>
                                                            <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
                                                        </TouchableOpacity>
                                                    ))}
                                                    {courses.length > 3 && (
                                                        <View style={styles.coursePreviewMore}>
                                                            <Text style={styles.coursePreviewMoreText}>
                                                                +{courses.length - 3} more
                                                            </Text>
                                                        </View>
                                                    )}
                                                </View>
                                            </View>
                                        )}

                                        {/* View Details Button */}
                                        <View style={styles.viewDetailsButton}>
                                            <Text style={styles.viewDetailsText}>View Diploma Details</Text>
                                            <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    ) : (
                        /* Empty State for New Users */
                        <View style={styles.section}>
                            <View style={styles.emptyStateCard}>
                                <LinearGradient
                                    colors={[COLORS.primary + '15', COLORS.primaryLight + '10']}
                                    style={styles.emptyStateGradient}
                                >
                                    <View style={styles.emptyStateIcon}>
                                        <Ionicons name="school" size={40} color={COLORS.primary} />
                                    </View>
                                    <Text style={styles.emptyStateTitle}>Start Your Learning Journey</Text>
                                    <Text style={styles.emptyStateText}>
                                        Browse our diploma programs below and contact your instructor to get enrolled.
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.emptyStateButton}
                                        onPress={() => router.push('/(student)/catalog')}
                                    >
                                        <Text style={styles.emptyStateButtonText}>Browse Programs</Text>
                                        <Ionicons name="arrow-forward" size={16} color="#fff" />
                                    </TouchableOpacity>
                                </LinearGradient>
                            </View>
                        </View>
                    )}

                    {/* Browse All Diplomas Section */}
                    {allDiplomas.length > 0 && (
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>Browse All Programs</Text>
                                <TouchableOpacity onPress={() => router.push('/(student)/catalog')}>
                                    <Text style={styles.seeAllText}>View All</Text>
                                </TouchableOpacity>
                            </View>

                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.diplomasScrollContent}
                            >
                                {allDiplomas.map((diploma) => {
                                    const isEnrolled = enrollments.some(e => e.diploma_id === diploma.id);
                                    const enrollment = enrollments.find(e => e.diploma_id === diploma.id);
                                    const progress = enrollment?.progress || 0;

                                    return (
                                        <TouchableOpacity
                                            key={diploma.id}
                                            style={[
                                                styles.diplomaCard,
                                                !isEnrolled && styles.diplomaCardLocked
                                            ]}
                                            onPress={() => {
                                                setSelectedDiploma(diploma);
                                                setShowDiplomaModal(true);
                                            }}
                                            activeOpacity={0.9}
                                        >
                                            {/* Diploma Thumbnail */}
                                            <View style={styles.diplomaThumbnailContainer}>
                                                {diploma.thumbnail_url ? (
                                                    <Image
                                                        source={{ uri: diploma.thumbnail_url }}
                                                        style={styles.diplomaThumbnail}
                                                        resizeMode="cover"
                                                    />
                                                ) : (
                                                    <LinearGradient
                                                        colors={isEnrolled ? [COLORS.primary, COLORS.primaryLight] : ['#9CA3AF', '#6B7280']}
                                                        style={styles.diplomaThumbnail}
                                                    >
                                                        <Ionicons name="school" size={32} color="#fff" />
                                                    </LinearGradient>
                                                )}

                                                {/* Lock or Progress badge */}
                                                {!isEnrolled ? (
                                                    <View style={styles.lockBadge}>
                                                        <Ionicons name="lock-closed" size={12} color="#fff" />
                                                    </View>
                                                ) : progress > 0 && (
                                                    <View style={[styles.progressBadge, { backgroundColor: progress >= 100 ? COLORS.success : COLORS.primary }]}>
                                                        <Text style={styles.progressBadgeText}>{progress}%</Text>
                                                    </View>
                                                )}
                                            </View>

                                            {/* Diploma Info */}
                                            <View style={styles.diplomaInfo}>
                                                <Text style={[
                                                    styles.diplomaTitle,
                                                    !isEnrolled && styles.diplomaTitleLocked
                                                ]} numberOfLines={2}>
                                                    {diploma.title}
                                                </Text>
                                                <Text style={styles.diplomaCourseCount}>
                                                    {diploma.courses?.length || 0} courses
                                                </Text>
                                                {isEnrolled ? (
                                                    <View style={styles.enrolledBadge}>
                                                        <Ionicons name="checkmark-circle" size={12} color={COLORS.success} />
                                                        <Text style={styles.enrolledText}>Enrolled</Text>
                                                    </View>
                                                ) : (
                                                    <Text style={styles.diplomaPrice}>
                                                        {diploma.price && diploma.price > 0
                                                            ? `${diploma.currency || 'USD'} ${diploma.price}`
                                                            : 'Contact for pricing'
                                                        }
                                                    </Text>
                                                )}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    )}

                    {/* Motivational card */}
                    {totalCourses > 0 && avgProgress < 100 && (
                        <View style={styles.section}>
                            <View style={styles.motivationCard}>
                                <View style={styles.motivationIcon}>
                                    <Ionicons name="rocket" size={24} color={COLORS.primary} />
                                </View>
                                <View style={styles.motivationContent}>
                                    <Text style={styles.motivationTitle}>
                                        {avgProgress < 30 ? "Let's get started!" :
                                            avgProgress < 70 ? "You're doing great!" :
                                                "Almost there!"}
                                    </Text>
                                    <Text style={styles.motivationText}>
                                        {avgProgress < 30 ? "Begin your learning journey today" :
                                            avgProgress < 70 ? "Keep up the momentum" :
                                                "Finish strong and earn your certificates"}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    )}
                </Animated.View>
            </ScrollView>

            {/* Diploma Detail Modal */}
            <Modal
                visible={showDiplomaModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowDiplomaModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        {/* Modal Header */}
                        <View style={styles.modalHeader}>
                            <View style={styles.modalDragHandle} />
                            <TouchableOpacity
                                style={styles.modalCloseButton}
                                onPress={() => setShowDiplomaModal(false)}
                            >
                                <Ionicons name="close" size={24} color={COLORS.text} />
                            </TouchableOpacity>
                        </View>

                        {selectedDiploma && (
                            <ScrollView
                                showsVerticalScrollIndicator={false}
                                style={styles.modalScroll}
                                contentContainerStyle={styles.modalScrollContent}
                            >
                                {/* Diploma Hero */}
                                <View style={styles.modalHero}>
                                    {selectedDiploma.thumbnail_url ? (
                                        <Image
                                            source={{ uri: selectedDiploma.thumbnail_url }}
                                            style={styles.modalHeroImage}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <LinearGradient
                                            colors={[COLORS.primary, COLORS.primaryLight]}
                                            style={styles.modalHeroImage}
                                        >
                                            <Ionicons name="school" size={48} color="#fff" />
                                        </LinearGradient>
                                    )}
                                    <LinearGradient
                                        colors={['transparent', 'rgba(0,0,0,0.8)']}
                                        style={styles.modalHeroOverlay}
                                    >
                                        <Text style={styles.modalDiplomaTitle}>{selectedDiploma.title}</Text>
                                        <View style={styles.modalDiplomaMeta}>
                                            <View style={styles.modalMetaItem}>
                                                <Ionicons name="book-outline" size={14} color="#fff" />
                                                <Text style={styles.modalMetaText}>
                                                    {selectedDiploma.courses?.length || 0} Courses
                                                </Text>
                                            </View>
                                        </View>
                                    </LinearGradient>
                                </View>

                                {/* Description */}
                                {selectedDiploma.description && (
                                    <View style={styles.modalSection}>
                                        <Text style={styles.modalSectionTitle}>About This Program</Text>
                                        <Text style={styles.modalDescription}>
                                            {selectedDiploma.description}
                                        </Text>
                                    </View>
                                )}

                                {/* Courses List */}
                                <View style={styles.modalSection}>
                                    <Text style={styles.modalSectionTitle}>
                                        Course Curriculum ({selectedDiploma.courses?.length || 0})
                                    </Text>

                                    {selectedDiploma.courses?.map((course, index) => {
                                        const isEnrolled = enrollments.some(e => e.diploma_id === selectedDiploma.id);

                                        return (
                                            <TouchableOpacity
                                                key={course.id}
                                                style={[
                                                    styles.courseListItem,
                                                    !isEnrolled && styles.courseListItemLocked
                                                ]}
                                                onPress={() => {
                                                    if (isEnrolled) {
                                                        setShowDiplomaModal(false);
                                                        router.push(`/course/${course.id}`);
                                                    } else {
                                                        Alert.alert(
                                                            'Enrollment Required',
                                                            'Please contact your instructor to enroll in this diploma program.',
                                                            [{ text: 'OK' }]
                                                        );
                                                    }
                                                }}
                                                activeOpacity={0.8}
                                            >
                                                <View style={styles.courseListNumber}>
                                                    <Text style={styles.courseListNumberText}>{index + 1}</Text>
                                                </View>
                                                <View style={styles.courseListContent}>
                                                    <Text style={[
                                                        styles.courseListTitle,
                                                        !isEnrolled && styles.courseListTitleLocked
                                                    ]} numberOfLines={2}>
                                                        {course.title}
                                                    </Text>
                                                </View>
                                                {isEnrolled ? (
                                                    <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
                                                ) : (
                                                    <Ionicons name="lock-closed" size={18} color={COLORS.textTertiary} />
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                {/* Action Button */}
                                {!enrollments.some(e => e.diploma_id === selectedDiploma.id) && (
                                    <View style={styles.modalActionSection}>
                                        <TouchableOpacity
                                            style={styles.enrollButton}
                                            onPress={() => {
                                                setShowDiplomaModal(false);
                                                Alert.alert(
                                                    'Contact Instructor',
                                                    'Please contact your instructor or administrator to enroll in this diploma program.'
                                                );
                                            }}
                                        >
                                            <Text style={styles.enrollButtonText}>Request Enrollment</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </ScrollView>
                        )}
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: SPACING.md,
    },
    loadingText: {
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
        marginTop: SPACING.sm,
    },

    // Header
    header: {
        backgroundColor: COLORS.surface,
        paddingHorizontal: SPACING.lg,
        paddingTop: SPACING.md,
        paddingBottom: SPACING.xl,
        borderBottomLeftRadius: BORDER_RADIUS.xxl,
        borderBottomRightRadius: BORDER_RADIUS.xxl,
        ...SHADOWS.sm,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.lg,
    },
    headerTextContainer: {
        flex: 1,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    greeting: {
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
        fontWeight: FONT_WEIGHT.medium,
    },
    userName: {
        fontSize: FONT_SIZE.xxl,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        marginTop: 2,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.md,
    },
    avatarText: {
        color: COLORS.surface,
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
    },

    // Stats
    statsRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    statCard: {
        flex: 1,
        backgroundColor: COLORS.backgroundSecondary,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        alignItems: 'center',
    },
    statIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.xs,
    },
    statValue: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
    },
    statLabel: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.textSecondary,
        marginTop: 2,
    },

    // Section
    section: {
        paddingHorizontal: SPACING.lg,
        marginTop: SPACING.xl,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    sectionTitle: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
    },
    seeAllText: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.primary,
        fontWeight: FONT_WEIGHT.semibold,
    },

    // Featured Card (Continue Learning)
    featuredCard: {
        borderRadius: BORDER_RADIUS.xl,
        overflow: 'hidden',
        backgroundColor: COLORS.surface,
        ...SHADOWS.lg,
        marginTop: SPACING.xs,
    },
    featuredImage: {
        width: '100%',
        height: 200,
    },
    featuredPlaceholder: {
        backgroundColor: COLORS.primary + '15',
        alignItems: 'center',
        justifyContent: 'center',
    },
    featuredOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        paddingBottom: SPACING.lg,
        backgroundColor: 'rgba(0,0,0,0.75)',
    },
    featuredContent: {
        gap: SPACING.sm,
    },
    featuredTitle: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
        color: '#fff',
        lineHeight: 28,
    },
    featuredProgressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
    },
    featuredProgressBar: {
        flex: 1,
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    featuredProgressFill: {
        height: '100%',
        backgroundColor: COLORS.success,
        borderRadius: 3,
    },
    featuredProgressText: {
        fontSize: FONT_SIZE.md,
        color: '#fff',
        fontWeight: FONT_WEIGHT.bold,
        minWidth: 45,
    },
    featuredButton: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: COLORS.primary,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm + 2,
        borderRadius: BORDER_RADIUS.round,
        gap: SPACING.sm,
        marginTop: SPACING.xs,
    },
    featuredButtonText: {
        color: '#fff',
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
    },

    // Course Grid
    coursesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: CARD_GAP,
    },
    cardWrapper: {
        width: CARD_WIDTH,
    },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        overflow: 'hidden',
        ...SHADOWS.md,
    },
    thumbnailContainer: {
        position: 'relative',
        height: 100,
        backgroundColor: COLORS.backgroundSecondary,
    },
    thumbnail: {
        width: '100%',
        height: '100%',
    },
    thumbnailPlaceholder: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.primary + '10',
    },
    progressBadge: {
        position: 'absolute',
        top: SPACING.xs,
        right: SPACING.xs,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 3,
        borderRadius: BORDER_RADIUS.sm,
    },
    progressBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: FONT_WEIGHT.bold,
    },
    cardInfo: {
        padding: SPACING.sm,
    },
    cardTitle: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.semibold,
        color: COLORS.text,
        marginBottom: SPACING.xs,
        lineHeight: 18,
        minHeight: 36,
    },
    progressContainer: {
        marginBottom: SPACING.xs,
    },
    progressBar: {
        height: 4,
        backgroundColor: COLORS.border,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    actionText: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.primary,
        fontWeight: FONT_WEIGHT.semibold,
    },

    // Empty State
    emptyState: {
        padding: SPACING.xxl,
        alignItems: 'center',
    },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: COLORS.backgroundSecondary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.lg,
    },
    emptyTitle: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        marginBottom: SPACING.xs,
    },
    emptyText: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },

    // Motivation Card
    motivationCard: {
        flexDirection: 'row',
        backgroundColor: COLORS.primary + '10',
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        alignItems: 'center',
        gap: SPACING.md,
    },
    motivationIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    motivationContent: {
        flex: 1,
    },
    motivationTitle: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        marginBottom: 2,
    },
    motivationText: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
    },

    // Live Sessions on Home
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.error,
    },
    liveSessionCard: {
        borderRadius: BORDER_RADIUS.xl,
        overflow: 'hidden',
        marginBottom: SPACING.md,
        ...SHADOWS.lg,
    },
    liveSessionGradient: {
        padding: SPACING.lg,
    },
    liveNowBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255,255,255,0.25)',
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.full,
        gap: SPACING.xs,
        marginBottom: SPACING.sm,
    },
    liveNowDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#fff',
    },
    liveNowText: {
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.bold,
        color: '#fff',
        letterSpacing: 1,
    },
    liveSessionContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    liveSessionInfo: {
        flex: 1,
        marginRight: SPACING.md,
    },
    liveSessionTitle: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        color: '#fff',
        marginBottom: SPACING.xs,
    },
    liveSessionMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        marginTop: 4,
    },
    liveSessionMetaText: {
        fontSize: FONT_SIZE.sm,
        color: 'rgba(255,255,255,0.85)',
    },
    liveSessionAction: {
        alignItems: 'center',
    },
    joinNowButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.round,
        gap: SPACING.xs,
        ...SHADOWS.md,
    },
    joinNowText: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.error,
    },
    countdownBox: {
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.md,
    },
    countdownValue: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        color: '#fff',
    },
    countdownLabel: {
        fontSize: FONT_SIZE.xs,
        color: 'rgba(255,255,255,0.8)',
    },

    // Enrolled Diploma Card - Premium Design
    enrolledDiplomaCard: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.xxl,
        overflow: 'hidden',
        ...SHADOWS.lg,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    enrolledDiplomaHero: {
        height: 160,
        position: 'relative',
    },
    enrolledDiplomaImage: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    enrolledDiplomaOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: SPACING.lg,
        paddingTop: SPACING.xxxl,
    },
    enrolledDiplomaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.95)',
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.round,
        alignSelf: 'flex-start',
        marginBottom: SPACING.sm,
        gap: 4,
    },
    enrolledDiplomaBadgeText: {
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.semibold,
        color: COLORS.success,
    },
    enrolledDiplomaTitle: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
        color: '#fff',
        marginBottom: 4,
        letterSpacing: -0.3,
    },
    enrolledDiplomaCourseCount: {
        fontSize: FONT_SIZE.sm,
        color: 'rgba(255,255,255,0.85)',
    },
    enrolledDiplomaProgress: {
        padding: SPACING.lg,
        paddingBottom: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderLight,
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    progressLabel: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
        fontWeight: FONT_WEIGHT.medium,
    },
    progressPercentage: {
        fontSize: FONT_SIZE.lg,
        color: COLORS.primary,
        fontWeight: FONT_WEIGHT.bold,
    },
    progressBarLarge: {
        height: 10,
        backgroundColor: COLORS.backgroundSecondary,
        borderRadius: 5,
        overflow: 'hidden',
    },
    progressBarFillLarge: {
        height: '100%',
        borderRadius: 5,
    },
    coursePreviewSection: {
        padding: SPACING.lg,
        paddingTop: SPACING.md,
    },
    coursePreviewTitle: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.semibold,
        color: COLORS.textSecondary,
        marginBottom: SPACING.sm,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    coursePreviewGrid: {
        gap: SPACING.sm,
    },
    coursePreviewItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.backgroundSecondary,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        gap: SPACING.md,
    },
    coursePreviewNumber: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    coursePreviewNumberText: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.bold,
        color: '#fff',
    },
    coursePreviewName: {
        flex: 1,
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.medium,
        color: COLORS.text,
    },
    coursePreviewMore: {
        alignItems: 'center',
        paddingVertical: SPACING.sm,
    },
    coursePreviewMoreText: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.primary,
        fontWeight: FONT_WEIGHT.semibold,
    },
    viewDetailsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.md,
        borderTopWidth: 1,
        borderTopColor: COLORS.borderLight,
        gap: SPACING.xs,
    },
    viewDetailsText: {
        fontSize: FONT_SIZE.md,
        color: COLORS.primary,
        fontWeight: FONT_WEIGHT.semibold,
    },

    // Empty State Card
    emptyStateCard: {
        borderRadius: BORDER_RADIUS.xxl,
        overflow: 'hidden',
    },
    emptyStateGradient: {
        padding: SPACING.xl,
        alignItems: 'center',
    },
    emptyStateIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: COLORS.surface,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.lg,
        ...SHADOWS.sm,
    },
    emptyStateTitle: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        marginBottom: SPACING.sm,
        textAlign: 'center',
    },
    emptyStateText: {
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginBottom: SPACING.lg,
        lineHeight: 22,
    },
    emptyStateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        gap: SPACING.sm,
        ...SHADOWS.md,
    },
    emptyStateButtonText: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
        color: '#fff',
    },

    // Browse All Diplomas Section - Premium Design
    diplomasScrollContent: {
        paddingRight: SPACING.lg,
        paddingLeft: SPACING.xs,
        paddingVertical: SPACING.sm,
        gap: SPACING.md,
    },
    diplomaCard: {
        width: 200,
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.xl,
        overflow: 'hidden',
        ...SHADOWS.lg,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    diplomaCardLocked: {
        opacity: 0.75,
        borderColor: COLORS.border,
    },
    diplomaThumbnailContainer: {
        position: 'relative',
        height: 120,
    },
    diplomaThumbnail: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    lockBadge: {
        position: 'absolute',
        top: SPACING.sm,
        right: SPACING.sm,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(0,0,0,0.7)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    diplomaInfo: {
        padding: SPACING.md,
        paddingTop: SPACING.sm,
    },
    diplomaTitle: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        marginBottom: 6,
        minHeight: 42,
        lineHeight: 20,
    },
    diplomaTitleLocked: {
        color: COLORS.textSecondary,
    },
    diplomaCourseCount: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.textTertiary,
        marginBottom: SPACING.xs,
    },
    enrolledBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    enrolledText: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.success,
        fontWeight: FONT_WEIGHT.medium,
    },
    diplomaPrice: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.primary,
        fontWeight: FONT_WEIGHT.bold,
    },

    // Modal Styles - Premium Design
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        maxHeight: '92%',
        minHeight: '65%',
        ...SHADOWS.lg,
    },
    modalHeader: {
        alignItems: 'center',
        paddingTop: SPACING.md,
        paddingHorizontal: SPACING.lg,
        paddingBottom: SPACING.xs,
    },
    modalDragHandle: {
        width: 48,
        height: 5,
        backgroundColor: COLORS.border,
        borderRadius: 3,
        marginBottom: SPACING.xs,
    },
    modalCloseButton: {
        position: 'absolute',
        top: SPACING.md,
        right: SPACING.md,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.backgroundSecondary,
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.sm,
    },
    modalScroll: {
        flex: 1,
    },
    modalScrollContent: {
        paddingBottom: SPACING.xxxl + 20,
    },
    modalHero: {
        position: 'relative',
        height: 220,
        overflow: 'hidden',
    },
    modalHeroImage: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalHeroOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.lg,
        paddingTop: SPACING.xxxl,
    },
    modalDiplomaTitle: {
        fontSize: FONT_SIZE.xxl,
        fontWeight: FONT_WEIGHT.bold,
        color: '#fff',
        marginBottom: SPACING.xs,
    },
    modalDiplomaMeta: {
        flexDirection: 'row',
        gap: SPACING.md,
    },
    modalMetaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    modalMetaText: {
        fontSize: FONT_SIZE.sm,
        color: '#fff',
        fontWeight: FONT_WEIGHT.medium,
    },
    modalSection: {
        padding: SPACING.lg,
        paddingTop: SPACING.lg,
    },
    modalSectionTitle: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        marginBottom: SPACING.md,
        letterSpacing: -0.3,
    },
    modalDescription: {
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
        lineHeight: 24,
    },
    courseListItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.sm,
    },
    courseListItemLocked: {
        opacity: 0.65,
        backgroundColor: COLORS.backgroundSecondary,
    },
    courseListNumber: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.md,
    },
    courseListNumberText: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.bold,
        color: '#fff',
    },
    courseListContent: {
        flex: 1,
    },
    courseListTitle: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.medium,
        color: COLORS.text,
    },
    courseListTitleLocked: {
        color: COLORS.textSecondary,
    },
    modalActionSection: {
        padding: SPACING.lg,
        paddingTop: 0,
    },
    enrollButton: {
        backgroundColor: COLORS.primary,
        borderRadius: BORDER_RADIUS.lg,
        paddingVertical: SPACING.md,
        alignItems: 'center',
        ...SHADOWS.md,
    },
    enrollButtonText: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
        color: '#fff',
    },
});
