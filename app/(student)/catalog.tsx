import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Theme from '../../constants/theme';
import { useLocalization } from '../../src/context/LocalizationContext';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/features/auth/AuthContext';
import { fetchDiplomaCatalog, fetchMyEnrollments, submitDiplomaInquiry } from '../../src/features/diplomas/diplomaService';
import { CatalogDiploma, Enrollment } from '../../src/types';

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
    const { colors, isDark } = useTheme();
    const { t, formatNumber, getLocalizedText, isRTL } = useLocalization();
    const styles = useMemo(() => createStyles(colors, isDark, isRTL), [colors, isDark, isRTL]);
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
                            <Ionicons name="school" size={48} color={colors.primary} />
                        </View>
                    )}

                    {/* Status Badge */}
                    {isEnrolled ? (
                        <View style={[styles.statusBadge, styles.enrolledBadge]}>
                            <Ionicons name="checkmark-circle" size={14} color="#fff" />
                            <Text style={styles.statusBadgeText}>{t.enrolled}</Text>
                        </View>
                    ) : (
                        <View style={[styles.statusBadge, styles.lockedBadge]}>
                            <Ionicons name="lock-closed" size={14} color="#fff" />
                            <Text style={styles.statusBadgeText}>{t.locked}</Text>
                        </View>
                    )}

                    {/* Price Badge */}
                    {diploma.price && !isEnrolled && (
                        <View style={styles.priceBadge}>
                            <Text style={styles.priceText}>
                                {diploma.currency} {formatNumber(diploma.price)}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Content */}
                <View style={styles.cardContent}>
                    <Text style={styles.diplomaTitle} numberOfLines={2}>
                        {getLocalizedText(diploma.title, diploma.title_ar) || t.untitledDiploma}
                    </Text>

                    {getLocalizedText(diploma.description, diploma.description_ar) && (
                        <Text style={styles.diplomaDescription} numberOfLines={2}>
                            {getLocalizedText(diploma.description, diploma.description_ar)}
                        </Text>
                    )}

                    {/* Stats */}
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Ionicons name="book-outline" size={16} color={colors.textSecondary} />
                            <Text style={styles.statText}>{totalCourses} {t.courses}</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Ionicons name="list-outline" size={16} color={colors.textSecondary} />
                            <Text style={styles.statText}>{totalChapters} {t.chapters}</Text>
                        </View>
                        {diploma.duration_weeks && (
                            <View style={styles.statItem}>
                                <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                                <Text style={styles.statText}>{diploma.duration_weeks} {t.weeks}</Text>
                            </View>
                        )}
                    </View>

                    {/* Progress or Locked Message */}
                    {isEnrolled && enrollmentProgress !== undefined ? (
                        <View style={styles.progressSection}>
                            <View style={styles.progressHeader}>
                                <Text style={styles.progressLabel}>{t.progress}</Text>
                                <Text style={styles.progressValue}>{enrollmentProgress}%</Text>
                            </View>
                            <View style={styles.progressBar}>
                                <View
                                    style={[
                                        styles.progressFill,
                                        {
                                            width: `${enrollmentProgress}%`,
                                            backgroundColor: enrollmentProgress >= 100
                                                ? colors.success
                                                : colors.primary,
                                        }
                                    ]}
                                />
                            </View>
                        </View>
                    ) : (
                        <View style={styles.lockedInfoContainer}>
                            <Ionicons name="lock-closed" size={16} color={colors.textSecondary} />
                            <Text style={styles.lockedInfoText}>{t.enrollmentRequired}</Text>
                        </View>
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
    const { colors, isDark } = useTheme();
    const { t, getLocalizedText, isRTL } = useLocalization();
    const styles = useMemo(() => createStyles(colors, isDark, isRTL), [colors, isDark, isRTL]);
    const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!visible) {
            setExpandedCourses(new Set());
        }
    }, [visible]);

    const toggleCourse = useCallback((courseId: string) => {
        setExpandedCourses((prev) => {
            const next = new Set(prev);
            if (next.has(courseId)) {
                next.delete(courseId);
            } else {
                next.add(courseId);
            }
            return next;
        });
    }, []);

    if (!diploma) {
        return null;
    }

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
                        <Ionicons name="close" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.modalTitle}>{t.diplomaCatalog}</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.diplomaInfo}>
                        {diploma.thumbnail_url && (
                            <Image
                                source={{ uri: diploma.thumbnail_url }}
                                style={styles.modalThumbnail}
                                resizeMode="cover"
                            />
                        )}

                        <Text style={styles.modalDiplomaTitle}>
                            {getLocalizedText(diploma.title, diploma.title_ar) || t.untitledDiploma}
                        </Text>

                        {getLocalizedText(diploma.description, diploma.description_ar) && (
                            <Text style={styles.modalDescription}>
                                {getLocalizedText(diploma.description, diploma.description_ar)}
                            </Text>
                        )}

                        {/* Quick Stats */}
                        <View style={styles.quickStats}>
                            <View style={styles.quickStatItem}>
                                <Text style={styles.quickStatValue}>
                                    {diploma.courses?.length || 0}
                                </Text>
                                <Text style={styles.quickStatLabel}>{t.courses}</Text>
                            </View>
                            <View style={styles.quickStatDivider} />
                            <View style={styles.quickStatItem}>
                                <Text style={styles.quickStatValue}>
                                    {diploma.courses?.reduce((sum, c) => sum + (c.chapters?.length || 0), 0) || 0}
                                </Text>
                                <Text style={styles.quickStatLabel}>{t.chapters}</Text>
                            </View>
                            <View style={styles.quickStatDivider} />
                            <View style={styles.quickStatItem}>
                                <Text style={styles.quickStatValue}>
                                    {diploma.duration_weeks || '-'}
                                </Text>
                                <Text style={styles.quickStatLabel}>{t.weeks}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Course Outline */}
                    <View style={styles.outlineSection}>
                        <Text style={styles.outlineTitle}>{t.courseOutline}</Text>

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
                                        <Text style={styles.courseTitle}>
                                            {getLocalizedText(course.title, course.title_ar)}
                                        </Text>
                                        <Text style={styles.courseChapters}>
                                            {course.chapters?.length || 0} {t.chapters}
                                        </Text>
                                    </View>
                                    <Ionicons
                                        name={expandedCourses.has(course.id) ? 'chevron-up' : 'chevron-down'}
                                        size={20}
                                        color={colors.textSecondary}
                                    />
                                </TouchableOpacity>

                                {/* Chapters List */}
                                {expandedCourses.has(course.id) && (
                                    <View style={styles.chaptersList}>
                                        {course.chapters?.map((chapter) => (
                                            <View key={chapter.id} style={styles.chapterItem}>
                                                <View style={styles.chapterBullet}>
                                                    {isEnrolled ? (
                                                        <Ionicons name="play-circle" size={16} color={colors.primary} />
                                                    ) : (
                                                        <Ionicons name="lock-closed" size={14} color={colors.textTertiary} />
                                                    )}
                                                </View>
                                                <Text
                                                    style={[
                                                        styles.chapterTitle,
                                                        !isEnrolled && styles.chapterTitleLocked,
                                                    ]}
                                                >
                                                    {getLocalizedText(chapter.title, chapter.title_ar)}
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
                            <Text style={styles.continueButtonText}>{t.continueLearning}</Text>
                            <Ionicons name="arrow-forward" size={20} color="#fff" />
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.enrollmentRequiredInfo}>
                            <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
                            <Text style={styles.enrollmentRequiredText}>
                                {t.contactAdminEnrollment}
                            </Text>
                        </View>
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
    const { colors, isDark } = useTheme();
    const { t, isRTL } = useLocalization();
    const styles = useMemo(() => createStyles(colors, isDark, isRTL), [colors, isDark, isRTL]);
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
            Alert.alert(t.error, t.fillRequiredFields);
            return;
        }

        setLoading(true);
        try {
            await onSubmit(formData);
            Alert.alert(
                t.success,
                t.inquirySuccess,
                [{ text: t.ok, onPress: onClose }]
            );
        } catch (error) {
            Alert.alert(t.error, t.submitInquiryFailed);
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
                        <Ionicons name="close" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.modalTitle}>{t.enrollmentInquiry}</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView style={styles.formContent} showsVerticalScrollIndicator={false}>
                    <Text style={styles.formSubtitle}>
                        {t.inquirySubtitleWithTitle.replace('{title}', diploma?.title || '')}
                    </Text>

                    <View style={styles.formGroup}>
                        <Text style={styles.formLabel}>{t.fullNameLabel} *</Text>
                        <TextInput
                            style={styles.formInput}
                            value={formData.name}
                            onChangeText={(text) => setFormData({ ...formData, name: text })}
                            placeholder={t.enterFullName}
                            placeholderTextColor={colors.textTertiary}
                        />
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.formLabel}>{t.emailLabel} *</Text>
                        <TextInput
                            style={styles.formInput}
                            value={formData.email}
                            onChangeText={(text) => setFormData({ ...formData, email: text })}
                            placeholder={t.enterEmail}
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.formLabel}>{t.phoneNumberLabel}</Text>
                        <TextInput
                            style={styles.formInput}
                            value={formData.phone}
                            onChangeText={(text) => setFormData({ ...formData, phone: text })}
                            placeholder={t.enterPhoneNumber}
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="phone-pad"
                        />
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.formLabel}>{t.whatsappNumberLabel} *</Text>
                        <TextInput
                            style={styles.formInput}
                            value={formData.whatsapp_number}
                            onChangeText={(text) => setFormData({ ...formData, whatsapp_number: text })}
                            placeholder={t.enterWhatsappNumber}
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="phone-pad"
                        />
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.formLabel}>{t.messageOptionalLabel}</Text>
                        <TextInput
                            style={[styles.formInput, styles.formTextarea]}
                            value={formData.message}
                            onChangeText={(text) => setFormData({ ...formData, message: text })}
                            placeholder={t.messagePlaceholder}
                            placeholderTextColor={colors.textTertiary}
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
                                <Text style={styles.submitButtonText}>{t.submitInquiry}</Text>
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
    const { colors, isDark } = useTheme();
    const { formatNumber, t, isRTL } = useLocalization();
    const router = useRouter();
    const styles = useMemo(() => createStyles(colors, isDark, isRTL), [colors, isDark, isRTL]);

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
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>{t.loadingDiplomas}</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>{t.diplomaCatalog}</Text>
                    <Text style={styles.headerSubtitle}>{t.explorePrograms}</Text>
                </View>
            </View>

            {/* Search */}
            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color={colors.textSecondary} />
                <TextInput
                    style={styles.searchInput}
                    placeholder={t.searchDiplomas}
                    placeholderTextColor={colors.textTertiary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Diploma List */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                scrollEnabled={true}
                scrollEventThrottle={16}
                bounces={true}
                alwaysBounceVertical={true}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.primary}
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
                                // Inquiry functionality removed for Apple App Store compliance
                            }}
                        />
                    ))
                ) : (
                    <View style={styles.emptyState}>
                        <Ionicons name="school-outline" size={64} color={colors.textTertiary} />
                        <Text style={styles.emptyTitle}>{t.noDiplomasFound}</Text>
                        <Text style={styles.emptySubtitle}>
                            {searchQuery ? t.tryDifferentSearch : t.checkBackLater}
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
                    // Inquiry functionality removed for Apple App Store compliance
                }}
                onContinue={handleContinueLearning}
            />
        </SafeAreaView>
    );
}

function createStyles(colors: typeof Theme.colors.light, isDark: boolean, isRTL: boolean) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.background,
        },
        loadingText: {
            marginTop: Theme.spacing.md,
            fontSize: Theme.fontSize.base,
            color: colors.textSecondary,
        },
        header: {
            paddingHorizontal: Theme.spacing.lg,
            paddingVertical: Theme.spacing.md,
        },
        headerTitle: {
            fontSize: Theme.fontSize['2xl'],
            fontWeight: Theme.fontWeight.bold,
            color: colors.text,
            textAlign: isRTL ? 'right' : 'left',
        },
        headerSubtitle: {
            fontSize: Theme.fontSize.base,
            color: colors.textSecondary,
            marginTop: Theme.spacing.xs,
            textAlign: isRTL ? 'right' : 'left',
        },
        searchContainer: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            marginHorizontal: Theme.spacing.lg,
            paddingHorizontal: Theme.spacing.md,
            borderRadius: Theme.borderRadius.md,
            ...Theme.shadows[isDark ? 'dark' : 'light'].sm,
        },
        searchInput: {
            flex: 1,
            paddingVertical: Theme.spacing.sm,
            paddingHorizontal: Theme.spacing.sm,
            fontSize: Theme.fontSize.base,
            color: colors.text,
            textAlign: isRTL ? 'right' : 'left',
        },
        scrollView: {
            flex: 1,
        },
        scrollContent: {
            padding: Theme.spacing.lg,
        },
        diplomaCard: {
            backgroundColor: colors.surface,
            borderRadius: Theme.borderRadius.lg,
            marginBottom: Theme.spacing.md,
            overflow: 'hidden',
            ...Theme.shadows[isDark ? 'dark' : 'light'].md,
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
            backgroundColor: colors.backgroundSecondary,
            justifyContent: 'center',
            alignItems: 'center',
        },
        statusBadge: {
            position: 'absolute',
            top: Theme.spacing.sm,
            left: isRTL ? undefined : Theme.spacing.sm,
            right: isRTL ? Theme.spacing.sm : undefined,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            paddingHorizontal: Theme.spacing.sm,
            paddingVertical: Theme.spacing.xs,
            borderRadius: Theme.borderRadius.full,
            gap: 4,
        },
        enrolledBadge: {
            backgroundColor: colors.success,
        },
        lockedBadge: {
            backgroundColor: colors.textSecondary,
        },
        statusBadgeText: {
            fontSize: Theme.fontSize.xs,
            fontWeight: Theme.fontWeight.semibold,
            color: '#fff',
        },
        priceBadge: {
            position: 'absolute',
            top: Theme.spacing.sm,
            right: isRTL ? undefined : Theme.spacing.sm,
            left: isRTL ? Theme.spacing.sm : undefined,
            backgroundColor: colors.secondary,
            paddingHorizontal: Theme.spacing.sm,
            paddingVertical: Theme.spacing.xs,
            borderRadius: Theme.borderRadius.full,
        },
        priceText: {
            fontSize: Theme.fontSize.sm,
            fontWeight: Theme.fontWeight.bold,
            color: '#fff',
        },
        cardContent: {
            padding: Theme.spacing.md,
        },
        diplomaTitle: {
            fontSize: Theme.fontSize.lg,
            fontWeight: Theme.fontWeight.bold,
            textAlign: isRTL ? 'right' : 'left',
            color: colors.text,
            marginBottom: Theme.spacing.xs,
        },
        diplomaDescription: {
            fontSize: Theme.fontSize.sm,
            color: colors.textSecondary,
            lineHeight: 20,
            marginBottom: Theme.spacing.sm,
            textAlign: isRTL ? 'right' : 'left',
        },
        statsRow: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            flexWrap: 'wrap',
            gap: Theme.spacing.md,
            marginBottom: Theme.spacing.md,
        },
        statItem: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: Theme.spacing.xs,
        },
        statText: {
            fontSize: Theme.fontSize.sm,
            color: colors.textSecondary,
            textAlign: isRTL ? 'right' : 'left',
        },
        progressSection: {
            marginTop: Theme.spacing.xs,
        },
        progressHeader: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: Theme.spacing.xs,
        },
        progressLabel: {
            fontSize: Theme.fontSize.sm,
            color: colors.textSecondary,
            textAlign: isRTL ? 'right' : 'left',
        },
        progressValue: {
            fontSize: Theme.fontSize.sm,
            fontWeight: Theme.fontWeight.bold,
            color: colors.primary,
        },
        progressBar: {
            height: 6,
            backgroundColor: colors.border,
            borderRadius: Theme.borderRadius.full,
            overflow: 'hidden',
        },
        progressFill: {
            height: '100%',
            borderRadius: Theme.borderRadius.full,
        },
        lockedInfoContainer: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceSubtle,
            paddingVertical: Theme.spacing.sm,
            borderRadius: Theme.borderRadius.md,
            gap: Theme.spacing.xs,
        },
        lockedInfoText: {
            fontSize: Theme.fontSize.sm,
            fontWeight: Theme.fontWeight.medium,
            color: colors.textSecondary,
            textAlign: isRTL ? 'right' : 'left',
        },
        emptyState: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: Theme.spacing['3xl'],
        },
        emptyTitle: {
            fontSize: Theme.fontSize.lg,
            fontWeight: Theme.fontWeight.bold,
            color: colors.text,
            marginTop: Theme.spacing.md,
            textAlign: isRTL ? 'right' : 'left',
        },
        emptySubtitle: {
            fontSize: Theme.fontSize.base,
            color: colors.textSecondary,
            marginTop: Theme.spacing.xs,
            textAlign: isRTL ? 'right' : 'left',
        },

        // Modal Styles
        modalContainer: {
            flex: 1,
            backgroundColor: colors.background,
        },
        modalHeader: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: Theme.spacing.md,
            paddingVertical: Theme.spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        closeButton: {
            padding: Theme.spacing.xs,
        },
        modalTitle: {
            fontSize: Theme.fontSize.lg,
            fontWeight: Theme.fontWeight.bold,
            color: colors.text,
            textAlign: isRTL ? 'right' : 'left',
        },
        modalContent: {
            flex: 1,
        },
        diplomaInfo: {
            padding: Theme.spacing.lg,
            alignItems: 'center',
        },
        modalThumbnail: {
            width: '100%',
            height: 180,
            borderRadius: Theme.borderRadius.lg,
            marginBottom: Theme.spacing.md,
        },
        modalDiplomaTitle: {
            fontSize: Theme.fontSize.xl,
            fontWeight: Theme.fontWeight.bold,
            color: colors.text,
            textAlign: 'center',
            marginBottom: Theme.spacing.sm,
        },
        modalDescription: {
            fontSize: Theme.fontSize.base,
            color: colors.textSecondary,
            textAlign: 'center',
            lineHeight: 22,
        },
        quickStats: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: Theme.spacing.lg,
            backgroundColor: colors.surface,
            borderRadius: Theme.borderRadius.lg,
            padding: Theme.spacing.md,
            ...Theme.shadows[isDark ? 'dark' : 'light'].sm,
        },
        quickStatItem: {
            alignItems: 'center',
            paddingHorizontal: Theme.spacing.lg,
        },
        quickStatValue: {
            fontSize: Theme.fontSize['2xl'],
            fontWeight: Theme.fontWeight.bold,
            color: colors.primary,
        },
        quickStatLabel: {
            fontSize: Theme.fontSize.sm,
            color: colors.textSecondary,
            marginTop: Theme.spacing.xs,
        },
        quickStatDivider: {
            width: 1,
            height: 40,
            backgroundColor: colors.border,
        },
        outlineSection: {
            padding: Theme.spacing.lg,
        },
        outlineTitle: {
            fontSize: Theme.fontSize.lg,
            fontWeight: Theme.fontWeight.bold,
            color: colors.text,
            marginBottom: Theme.spacing.md,
        },
        courseItem: {
            backgroundColor: colors.surface,
            borderRadius: Theme.borderRadius.md,
            marginBottom: Theme.spacing.sm,
            overflow: 'hidden',
            ...Theme.shadows[isDark ? 'dark' : 'light'].sm,
        },
        courseHeader: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            padding: Theme.spacing.md,
        },
        courseNumber: {
            width: 32,
            height: 32,
            borderRadius: Theme.borderRadius.full,
            backgroundColor: colors.primary,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: isRTL ? 0 : Theme.spacing.sm,
            marginLeft: isRTL ? Theme.spacing.sm : 0,
        },
        courseNumberText: {
            fontSize: Theme.fontSize.base,
            fontWeight: Theme.fontWeight.bold,
            color: '#fff',
        },
        courseInfo: {
            flex: 1,
        },
        courseTitle: {
            fontSize: Theme.fontSize.base,
            fontWeight: Theme.fontWeight.semibold,
            color: colors.text,
            textAlign: isRTL ? 'right' : 'left',
        },
        courseChapters: {
            fontSize: Theme.fontSize.sm,
            color: colors.textSecondary,
            marginTop: 2,
            textAlign: isRTL ? 'right' : 'left',
        },
        chaptersList: {
            paddingHorizontal: Theme.spacing.md,
            paddingBottom: Theme.spacing.md,
            paddingLeft: isRTL ? Theme.spacing.md : Theme.spacing.md + 32 + Theme.spacing.sm,
            paddingRight: isRTL ? Theme.spacing.md + 32 + Theme.spacing.sm : Theme.spacing.md,
        },
        chapterItem: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            paddingVertical: Theme.spacing.xs,
        },
        chapterBullet: {
            marginRight: isRTL ? 0 : Theme.spacing.sm,
            marginLeft: isRTL ? Theme.spacing.sm : 0,
        },
        chapterTitle: {
            fontSize: Theme.fontSize.sm,
            color: colors.text,
            flex: 1,
            textAlign: isRTL ? 'right' : 'left',
        },
        chapterTitleLocked: {
            color: colors.textTertiary,
        },
        modalFooter: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: colors.surface,
            padding: Theme.spacing.lg,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            ...Theme.shadows[isDark ? 'dark' : 'light'].lg,
        },
        enrollmentRequiredInfo: {
            flex: 1,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceSubtle,
            borderRadius: Theme.borderRadius.md,
            paddingVertical: Theme.spacing.sm,
            gap: Theme.spacing.sm,
        },
        enrollmentRequiredText: {
            fontSize: Theme.fontSize.sm,
            fontWeight: Theme.fontWeight.medium,
            color: colors.textSecondary,
            textAlign: isRTL ? 'right' : 'left',
        },
        continueButton: {
            flex: 1,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
            paddingVertical: Theme.spacing.md,
            borderRadius: Theme.borderRadius.md,
            gap: Theme.spacing.xs,
        },
        continueButtonText: {
            fontSize: Theme.fontSize.base,
            fontWeight: Theme.fontWeight.semibold,
            color: '#fff',
        },

        // Form Styles
        formContent: {
            flex: 1,
            padding: Theme.spacing.lg,
        },
        formSubtitle: {
            color: colors.textSecondary,
            marginBottom: Theme.spacing.lg,
            lineHeight: 22,
            textAlign: isRTL ? 'right' : 'left',
        },
        formGroup: {
            marginBottom: Theme.spacing.md,
        },
        formLabel: {
            fontSize: Theme.fontSize.sm,
            fontWeight: Theme.fontWeight.medium,
            color: colors.text,
            marginBottom: Theme.spacing.xs,
            textAlign: isRTL ? 'right' : 'left',
        },
        formInput: {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: Theme.borderRadius.md,
            paddingHorizontal: Theme.spacing.md,
            paddingVertical: Theme.spacing.sm,
            fontSize: Theme.fontSize.base,
            color: colors.text,
            textAlign: isRTL ? 'right' : 'left',
        },
        formTextarea: {
            minHeight: 100,
            paddingTop: Theme.spacing.sm,
            textAlignVertical: 'top',
        },
        submitButton: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
            paddingVertical: Theme.spacing.md,
            borderRadius: Theme.borderRadius.md,
            marginTop: Theme.spacing.lg,
            gap: Theme.spacing.xs,
        },
        submitButtonDisabled: {
            opacity: 0.6,
        },
        submitButtonText: {
            fontSize: Theme.fontSize.base,
            fontWeight: Theme.fontWeight.semibold,
            color: '#fff',
        },
    });
}
