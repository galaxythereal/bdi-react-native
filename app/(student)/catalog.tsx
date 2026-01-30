import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Image,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Linking,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BORDER_RADIUS, COLORS, FONT_SIZE, FONT_WEIGHT, SHADOWS, SPACING } from '../../src/lib/constants';
import { CatalogDiploma, Enrollment } from '../../src/types';
import { fetchDiplomaCatalog, fetchMyEnrollments, submitDiplomaInquiry } from '../../src/features/diplomas/diplomaService';
import { useAuth } from '../../src/features/auth/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Diploma Card Component
interface DiplomaCardProps {
    diploma: CatalogDiploma;
    isEnrolled: boolean;
    enrollmentProgress?: number;
    index: number;
    onPress: () => void;
    onInquire: () => void;
}

const DiplomaCard: React.FC<DiplomaCardProps> = ({
    diploma,
    isEnrolled,
    enrollmentProgress,
    index,
    onPress,
    onInquire,
}) => {
    const cardAnim = useRef(new Animated.Value(0)).current;
    const totalCourses = diploma.courses?.length || 0;
    const totalChapters = diploma.courses?.reduce((sum, c) => sum + (c.chapters?.length || 0), 0) || 0;

    useEffect(() => {
        Animated.spring(cardAnim, {
            toValue: 1,
            delay: index * 80,
            tension: 80,
            friction: 10,
            useNativeDriver: true,
        }).start();
    }, []);

    const scale = cardAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.95, 1],
    });

    return (
        <Animated.View
            style={[
                styles.diplomaCard,
                { transform: [{ scale }], opacity: cardAnim },
            ]}
        >
            <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
                {/* Thumbnail */}
                <View style={styles.thumbnailContainer}>
                    {diploma.thumbnail_url ? (
                        <Image
                            source={{ uri: diploma.thumbnail_url }}
                            style={styles.thumbnail}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={styles.thumbnailPlaceholder}>
                            <Ionicons name="school" size={48} color={COLORS.primary} />
                        </View>
                    )}

                    {/* Status Badge */}
                    {isEnrolled ? (
                        <View style={[styles.statusBadge, styles.enrolledBadge]}>
                            <Ionicons name="checkmark-circle" size={14} color="#fff" />
                            <Text style={styles.statusBadgeText}>Enrolled</Text>
                        </View>
                    ) : (
                        <View style={[styles.statusBadge, styles.lockedBadge]}>
                            <Ionicons name="lock-closed" size={14} color="#fff" />
                            <Text style={styles.statusBadgeText}>Locked</Text>
                        </View>
                    )}

                    {/* Price Badge */}
                    {diploma.price && !isEnrolled && (
                        <View style={styles.priceBadge}>
                            <Text style={styles.priceText}>
                                {diploma.currency} {diploma.price.toLocaleString()}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Content */}
                <View style={styles.cardContent}>
                    <Text style={styles.diplomaTitle} numberOfLines={2}>
                        {diploma.title}
                    </Text>

                    {diploma.description && (
                        <Text style={styles.diplomaDescription} numberOfLines={2}>
                            {diploma.description}
                        </Text>
                    )}

                    {/* Stats */}
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Ionicons name="book-outline" size={16} color={COLORS.textSecondary} />
                            <Text style={styles.statText}>{totalCourses} Courses</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Ionicons name="list-outline" size={16} color={COLORS.textSecondary} />
                            <Text style={styles.statText}>{totalChapters} Chapters</Text>
                        </View>
                        {diploma.duration_weeks && (
                            <View style={styles.statItem}>
                                <Ionicons name="time-outline" size={16} color={COLORS.textSecondary} />
                                <Text style={styles.statText}>{diploma.duration_weeks} Weeks</Text>
                            </View>
                        )}
                    </View>

                    {/* Progress or Inquire Button */}
                    {isEnrolled && enrollmentProgress !== undefined ? (
                        <View style={styles.progressSection}>
                            <View style={styles.progressHeader}>
                                <Text style={styles.progressLabel}>Progress</Text>
                                <Text style={styles.progressValue}>{enrollmentProgress}%</Text>
                            </View>
                            <View style={styles.progressBar}>
                                <View
                                    style={[
                                        styles.progressFill,
                                        {
                                            width: `${enrollmentProgress}%`,
                                            backgroundColor: enrollmentProgress >= 100
                                                ? COLORS.success
                                                : COLORS.primary,
                                        }
                                    ]}
                                />
                            </View>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={styles.inquireButton}
                            onPress={onInquire}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                            <Text style={styles.inquireButtonText}>Inquire via WhatsApp</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

// Diploma Detail Modal - Shows outline without content
interface DiplomaDetailModalProps {
    diploma: CatalogDiploma | null;
    isEnrolled: boolean;
    visible: boolean;
    onClose: () => void;
    onInquire: () => void;
    onContinue: () => void;
}

const DiplomaDetailModal: React.FC<DiplomaDetailModalProps> = ({
    diploma,
    isEnrolled,
    visible,
    onClose,
    onInquire,
    onContinue,
}) => {
    const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());

    if (!diploma) return null;

    const toggleCourse = (courseId: string) => {
        setExpandedCourses(prev => {
            const newSet = new Set(prev);
            if (newSet.has(courseId)) {
                newSet.delete(courseId);
            } else {
                newSet.add(courseId);
            }
            return newSet;
        });
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <SafeAreaView style={styles.modalContainer}>
                {/* Header */}
                <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color={COLORS.text} />
                    </TouchableOpacity>
                    <Text style={styles.modalTitle}>Diploma Outline</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView
                    style={styles.modalContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Diploma Info */}
                    <View style={styles.diplomaInfo}>
                        {diploma.thumbnail_url && (
                            <Image
                                source={{ uri: diploma.thumbnail_url }}
                                style={styles.modalThumbnail}
                                resizeMode="cover"
                            />
                        )}

                        <Text style={styles.modalDiplomaTitle}>{diploma.title}</Text>

                        {diploma.description && (
                            <Text style={styles.modalDescription}>{diploma.description}</Text>
                        )}

                        {/* Quick Stats */}
                        <View style={styles.quickStats}>
                            <View style={styles.quickStatItem}>
                                <Text style={styles.quickStatValue}>
                                    {diploma.courses?.length || 0}
                                </Text>
                                <Text style={styles.quickStatLabel}>Courses</Text>
                            </View>
                            <View style={styles.quickStatDivider} />
                            <View style={styles.quickStatItem}>
                                <Text style={styles.quickStatValue}>
                                    {diploma.courses?.reduce((sum, c) => sum + (c.chapters?.length || 0), 0) || 0}
                                </Text>
                                <Text style={styles.quickStatLabel}>Chapters</Text>
                            </View>
                            <View style={styles.quickStatDivider} />
                            <View style={styles.quickStatItem}>
                                <Text style={styles.quickStatValue}>
                                    {diploma.duration_weeks || '-'}
                                </Text>
                                <Text style={styles.quickStatLabel}>Weeks</Text>
                            </View>
                        </View>
                    </View>

                    {/* Course Outline */}
                    <View style={styles.outlineSection}>
                        <Text style={styles.outlineTitle}>Course Outline</Text>

                        {diploma.courses?.map((course, courseIndex) => (
                            <View key={course.id} style={styles.courseItem}>
                                <TouchableOpacity
                                    style={styles.courseHeader}
                                    onPress={() => toggleCourse(course.id)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.courseNumber}>
                                        <Text style={styles.courseNumberText}>{courseIndex + 1}</Text>
                                    </View>
                                    <View style={styles.courseInfo}>
                                        <Text style={styles.courseTitle}>{course.title}</Text>
                                        <Text style={styles.courseChapters}>
                                            {course.chapters?.length || 0} chapters
                                        </Text>
                                    </View>
                                    <Ionicons
                                        name={expandedCourses.has(course.id) ? 'chevron-up' : 'chevron-down'}
                                        size={20}
                                        color={COLORS.textSecondary}
                                    />
                                </TouchableOpacity>

                                {/* Chapters List */}
                                {expandedCourses.has(course.id) && (
                                    <View style={styles.chaptersList}>
                                        {course.chapters?.map((chapter, chapterIndex) => (
                                            <View key={chapter.id} style={styles.chapterItem}>
                                                <View style={styles.chapterBullet}>
                                                    {isEnrolled ? (
                                                        <Ionicons name="play-circle" size={16} color={COLORS.primary} />
                                                    ) : (
                                                        <Ionicons name="lock-closed" size={14} color={COLORS.textTertiary} />
                                                    )}
                                                </View>
                                                <Text style={[
                                                    styles.chapterTitle,
                                                    !isEnrolled && styles.chapterTitleLocked
                                                ]}>
                                                    {chapter.title}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        ))}
                    </View>

                    <View style={{ height: 120 }} />
                </ScrollView>

                {/* Bottom Action */}
                <View style={styles.modalFooter}>
                    {isEnrolled ? (
                        <TouchableOpacity
                            style={styles.continueButton}
                            onPress={onContinue}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.continueButtonText}>Continue Learning</Text>
                            <Ionicons name="arrow-forward" size={20} color="#fff" />
                        </TouchableOpacity>
                    ) : (
                        <>
                            {diploma.price && (
                                <View style={styles.priceInfo}>
                                    <Text style={styles.priceLabel}>Price</Text>
                                    <Text style={styles.priceAmount}>
                                        {diploma.currency} {diploma.price.toLocaleString()}
                                    </Text>
                                </View>
                            )}
                            <TouchableOpacity
                                style={styles.whatsappButton}
                                onPress={onInquire}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                                <Text style={styles.whatsappButtonText}>Inquire to Enroll</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </SafeAreaView>
        </Modal>
    );
};

// Inquiry Form Modal
interface InquiryModalProps {
    diploma: CatalogDiploma | null;
    visible: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
}

const InquiryModal: React.FC<InquiryModalProps> = ({ diploma, visible, onClose, onSubmit }) => {
    const { session } = useAuth();
    const [formData, setFormData] = useState({
        name: '',
        email: session?.user?.email || '',
        phone: '',
        whatsapp_number: '',
        message: '',
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!formData.name || !formData.email || !formData.whatsapp_number) {
            Alert.alert('Error', 'Please fill in all required fields');
            return;
        }

        setLoading(true);
        try {
            await onSubmit(formData);
            Alert.alert(
                'Success!',
                'Your inquiry has been submitted. Our team will contact you on WhatsApp shortly.',
                [{ text: 'OK', onPress: onClose }]
            );
        } catch (error) {
            Alert.alert('Error', 'Failed to submit inquiry. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <SafeAreaView style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color={COLORS.text} />
                    </TouchableOpacity>
                    <Text style={styles.modalTitle}>Enrollment Inquiry</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView style={styles.formContent} showsVerticalScrollIndicator={false}>
                    <Text style={styles.formSubtitle}>
                        Interested in "{diploma?.title}"? Fill out the form below and we'll contact you via WhatsApp.
                    </Text>

                    <View style={styles.formGroup}>
                        <Text style={styles.formLabel}>Full Name *</Text>
                        <TextInput
                            style={styles.formInput}
                            value={formData.name}
                            onChangeText={(text) => setFormData({ ...formData, name: text })}
                            placeholder="Enter your full name"
                            placeholderTextColor={COLORS.textTertiary}
                        />
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.formLabel}>Email *</Text>
                        <TextInput
                            style={styles.formInput}
                            value={formData.email}
                            onChangeText={(text) => setFormData({ ...formData, email: text })}
                            placeholder="Enter your email"
                            placeholderTextColor={COLORS.textTertiary}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.formLabel}>Phone Number</Text>
                        <TextInput
                            style={styles.formInput}
                            value={formData.phone}
                            onChangeText={(text) => setFormData({ ...formData, phone: text })}
                            placeholder="Enter your phone number"
                            placeholderTextColor={COLORS.textTertiary}
                            keyboardType="phone-pad"
                        />
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.formLabel}>WhatsApp Number *</Text>
                        <TextInput
                            style={styles.formInput}
                            value={formData.whatsapp_number}
                            onChangeText={(text) => setFormData({ ...formData, whatsapp_number: text })}
                            placeholder="Enter your WhatsApp number"
                            placeholderTextColor={COLORS.textTertiary}
                            keyboardType="phone-pad"
                        />
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.formLabel}>Message (Optional)</Text>
                        <TextInput
                            style={[styles.formInput, styles.formTextarea]}
                            value={formData.message}
                            onChangeText={(text) => setFormData({ ...formData, message: text })}
                            placeholder="Any questions or comments?"
                            placeholderTextColor={COLORS.textTertiary}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                        onPress={handleSubmit}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="send" size={18} color="#fff" />
                                <Text style={styles.submitButtonText}>Submit Inquiry</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <View style={{ height: 40 }} />
                </ScrollView>
            </SafeAreaView>
        </Modal>
    );
};

// Main Catalog Screen
export default function DiplomaCatalogScreen() {
    const [diplomas, setDiplomas] = useState<CatalogDiploma[]>([]);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDiploma, setSelectedDiploma] = useState<CatalogDiploma | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showInquiryModal, setShowInquiryModal] = useState(false);
    const router = useRouter();

    const loadData = useCallback(async () => {
        try {
            const [catalogData, enrollmentData] = await Promise.all([
                fetchDiplomaCatalog(),
                fetchMyEnrollments(),
            ]);
            setDiplomas(catalogData);
            setEnrollments(enrollmentData);
        } catch (error) {
            console.error('Error loading catalog:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const filteredDiplomas = diplomas.filter(d =>
        d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const isEnrolled = (diplomaId: string) =>
        enrollments.some(e => e.diploma_id === diplomaId && e.status === 'active');

    const getEnrollmentProgress = (diplomaId: string) =>
        enrollments.find(e => e.diploma_id === diplomaId)?.progress || 0;

    const handleInquiry = async (data: any) => {
        if (!selectedDiploma) return;
        await submitDiplomaInquiry(selectedDiploma.id, data);
    };

    const handleContinueLearning = () => {
        if (!selectedDiploma) return;
        setShowDetailModal(false);
        // Navigate to the diploma course view
        router.push(`/course/${selectedDiploma.id}` as any);
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading diplomas...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Diploma Catalog</Text>
                    <Text style={styles.headerSubtitle}>
                        Explore our programs
                    </Text>
                </View>
            </View>

            {/* Search */}
            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color={COLORS.textSecondary} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search diplomas..."
                    placeholderTextColor={COLORS.textTertiary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Diploma List */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={COLORS.primary}
                    />
                }
                showsVerticalScrollIndicator={false}
            >
                {filteredDiplomas.length > 0 ? (
                    filteredDiplomas.map((diploma, index) => (
                        <DiplomaCard
                            key={diploma.id}
                            diploma={diploma}
                            isEnrolled={isEnrolled(diploma.id)}
                            enrollmentProgress={getEnrollmentProgress(diploma.id)}
                            index={index}
                            onPress={() => {
                                setSelectedDiploma(diploma);
                                setShowDetailModal(true);
                            }}
                            onInquire={() => {
                                setSelectedDiploma(diploma);
                                setShowInquiryModal(true);
                            }}
                        />
                    ))
                ) : (
                    <View style={styles.emptyState}>
                        <Ionicons name="school-outline" size={64} color={COLORS.textTertiary} />
                        <Text style={styles.emptyTitle}>No diplomas found</Text>
                        <Text style={styles.emptySubtitle}>
                            {searchQuery ? 'Try a different search term' : 'Check back later for new programs'}
                        </Text>
                    </View>
                )}

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Detail Modal */}
            <DiplomaDetailModal
                diploma={selectedDiploma}
                isEnrolled={selectedDiploma ? isEnrolled(selectedDiploma.id) : false}
                visible={showDetailModal}
                onClose={() => setShowDetailModal(false)}
                onInquire={() => {
                    setShowDetailModal(false);
                    setShowInquiryModal(true);
                }}
                onContinue={handleContinueLearning}
            />

            {/* Inquiry Modal */}
            <InquiryModal
                diploma={selectedDiploma}
                visible={showInquiryModal}
                onClose={() => setShowInquiryModal(false)}
                onSubmit={handleInquiry}
            />
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
        backgroundColor: COLORS.background,
    },
    loadingText: {
        marginTop: SPACING.md,
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
    },
    header: {
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
    },
    headerTitle: {
        fontSize: FONT_SIZE.xxl,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
    },
    headerSubtitle: {
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
        marginTop: SPACING.xs,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        marginHorizontal: SPACING.lg,
        paddingHorizontal: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        ...SHADOWS.sm,
    },
    searchInput: {
        flex: 1,
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.sm,
        fontSize: FONT_SIZE.md,
        color: COLORS.text,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: SPACING.lg,
    },
    diplomaCard: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        marginBottom: SPACING.md,
        overflow: 'hidden',
        ...SHADOWS.md,
    },
    thumbnailContainer: {
        height: 160,
        position: 'relative',
    },
    thumbnail: {
        width: '100%',
        height: '100%',
    },
    thumbnailPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: COLORS.backgroundSecondary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusBadge: {
        position: 'absolute',
        top: SPACING.sm,
        left: SPACING.sm,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.full,
        gap: 4,
    },
    enrolledBadge: {
        backgroundColor: COLORS.success,
    },
    lockedBadge: {
        backgroundColor: COLORS.textSecondary,
    },
    statusBadgeText: {
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.semibold,
        color: '#fff',
    },
    priceBadge: {
        position: 'absolute',
        top: SPACING.sm,
        right: SPACING.sm,
        backgroundColor: COLORS.secondary,
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.full,
    },
    priceText: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.bold,
        color: '#fff',
    },
    cardContent: {
        padding: SPACING.md,
    },
    diplomaTitle: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        marginBottom: SPACING.xs,
    },
    diplomaDescription: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
        lineHeight: 20,
        marginBottom: SPACING.sm,
    },
    statsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.md,
        marginBottom: SPACING.md,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },
    statText: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
    },
    progressSection: {
        marginTop: SPACING.xs,
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: SPACING.xs,
    },
    progressLabel: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
    },
    progressValue: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.primary,
    },
    progressBar: {
        height: 6,
        backgroundColor: COLORS.border,
        borderRadius: BORDER_RADIUS.full,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: BORDER_RADIUS.full,
    },
    inquireButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#25D366', // WhatsApp green
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.md,
        gap: SPACING.xs,
    },
    inquireButtonText: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
        color: '#fff',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.xxxl,
    },
    emptyTitle: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        marginTop: SPACING.md,
    },
    emptySubtitle: {
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
        marginTop: SPACING.xs,
    },

    // Modal Styles
    modalContainer: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    closeButton: {
        padding: SPACING.xs,
    },
    modalTitle: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
    },
    modalContent: {
        flex: 1,
    },
    diplomaInfo: {
        padding: SPACING.lg,
        alignItems: 'center',
    },
    modalThumbnail: {
        width: '100%',
        height: 180,
        borderRadius: BORDER_RADIUS.lg,
        marginBottom: SPACING.md,
    },
    modalDiplomaTitle: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        textAlign: 'center',
        marginBottom: SPACING.sm,
    },
    modalDescription: {
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },
    quickStats: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: SPACING.lg,
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        ...SHADOWS.sm,
    },
    quickStatItem: {
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
    },
    quickStatValue: {
        fontSize: FONT_SIZE.xxl,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.primary,
    },
    quickStatLabel: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
        marginTop: SPACING.xs,
    },
    quickStatDivider: {
        width: 1,
        height: 40,
        backgroundColor: COLORS.border,
    },
    outlineSection: {
        padding: SPACING.lg,
    },
    outlineTitle: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        marginBottom: SPACING.md,
    },
    courseItem: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.md,
        marginBottom: SPACING.sm,
        overflow: 'hidden',
        ...SHADOWS.sm,
    },
    courseHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
    },
    courseNumber: {
        width: 32,
        height: 32,
        borderRadius: BORDER_RADIUS.full,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.sm,
    },
    courseNumberText: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
        color: '#fff',
    },
    courseInfo: {
        flex: 1,
    },
    courseTitle: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
        color: COLORS.text,
    },
    courseChapters: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    chaptersList: {
        paddingHorizontal: SPACING.md,
        paddingBottom: SPACING.md,
        paddingLeft: SPACING.md + 32 + SPACING.sm,
    },
    chapterItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.xs,
    },
    chapterBullet: {
        marginRight: SPACING.sm,
    },
    chapterTitle: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.text,
        flex: 1,
    },
    chapterTitleLocked: {
        color: COLORS.textTertiary,
    },
    modalFooter: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: COLORS.surface,
        padding: SPACING.lg,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        flexDirection: 'row',
        alignItems: 'center',
        ...SHADOWS.lg,
    },
    priceInfo: {
        marginRight: SPACING.lg,
    },
    priceLabel: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.textSecondary,
    },
    priceAmount: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
    },
    whatsappButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#25D366',
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        gap: SPACING.xs,
    },
    whatsappButtonText: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
        color: '#fff',
    },
    continueButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.primary,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        gap: SPACING.xs,
    },
    continueButtonText: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
        color: '#fff',
    },

    // Form Styles
    formContent: {
        flex: 1,
        padding: SPACING.lg,
    },
    formSubtitle: {
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
        marginBottom: SPACING.lg,
        lineHeight: 22,
    },
    formGroup: {
        marginBottom: SPACING.md,
    },
    formLabel: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.medium,
        color: COLORS.text,
        marginBottom: SPACING.xs,
    },
    formInput: {
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: BORDER_RADIUS.md,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        fontSize: FONT_SIZE.md,
        color: COLORS.text,
    },
    formTextarea: {
        minHeight: 100,
        paddingTop: SPACING.sm,
    },
    submitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.primary,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        marginTop: SPACING.lg,
        gap: SPACING.xs,
    },
    submitButtonDisabled: {
        opacity: 0.6,
    },
    submitButtonText: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
        color: '#fff',
    },
});
