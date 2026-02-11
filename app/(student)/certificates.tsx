import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { printToFileAsync } from 'expo-print';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import Theme from '../../constants/theme';
import { useLocalization } from '../../src/context/LocalizationContext';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/features/auth/AuthContext';
import { fetchMyCertificates, generateCertificateHTML, loadCertificateTemplate } from '../../src/features/certificates/certificateService';
import { Certificate } from '../../src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CertificateCardProps {
    certificate: Certificate;
    index: number;
    onPress: () => void;
}

const CertificateCard: React.FC<CertificateCardProps> = ({ certificate, index, onPress }) => {
    const { colors, isDark } = useTheme();
    const { t, formatDate, isRTL, getLocalizedText } = useLocalization();
    const styles = useMemo(() => createStyles(colors, isDark, isRTL), [colors, isDark, isRTL]);
    const cardAnim = useRef(new Animated.Value(0)).current;

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
        outputRange: [0.9, 1],
    });

    return (
        <Animated.View style={[styles.cardWrapper, { transform: [{ scale }], opacity: cardAnim }]}>
            <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={styles.awardIcon}>
                        <Ionicons name="ribbon" size={28} color={colors.warning} />
                    </View>
                    <View style={styles.cardHeaderText}>
                        <Text style={styles.cardTitle} numberOfLines={2}>
                            {getLocalizedText(certificate.diploma?.title, certificate.diploma?.title_ar) || t.myCertificates}
                        </Text>
                        <Text style={styles.cardDate}>
                            {t.issuedOn} {formatDate(certificate.issued_at, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                            })}
                        </Text>
                    </View>
                </View>

                <View style={styles.cardDivider} />

                <View style={styles.cardDetails}>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>{t.certificateNumber}</Text>
                        <Text style={styles.detailValue} numberOfLines={1}>
                            {certificate.certificate_number}
                        </Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>{t.verificationCode}</Text>
                        <Text style={[styles.detailValue, styles.verificationCode]}>
                            {certificate.verification_code}
                        </Text>
                    </View>
                </View>

                <View style={styles.cardFooter}>
                    <View style={styles.viewButton}>
                        <Text style={styles.viewButtonText}>{t.viewCertificate}</Text>
                        <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={16} color={colors.primary} />
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

export default function CertificatesScreen() {
    const [certificates, setCertificates] = useState<Certificate[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null);
    const [showViewer, setShowViewer] = useState(false);
    const { t, isRTL } = useLocalization();
    const [userName, setUserName] = useState(t.studentLabel);
    const [templateBase64, setTemplateBase64] = useState<string | undefined>(undefined);
    const { session } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const { colors, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, isDark, isRTL), [colors, isDark, isRTL]);

    // Load the certificate template on mount
    useEffect(() => {
        const loadTemplate = async () => {
            const base64 = await loadCertificateTemplate();
            setTemplateBase64(base64);
        };
        loadTemplate();
    }, []);

    const loadData = async () => {
        try {
            // Fetch user profile name
            if (session?.user?.id) {
                const { supabase } = await import('../../src/lib/supabase');
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', session.user.id)
                    .single();
                if (profile?.full_name) {
                    setUserName(profile.full_name);
                } else if (session.user.email) {
                    setUserName(session.user.email);
                }
            }
            const data = await fetchMyCertificates();
            setCertificates(data);

            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }).start();
        } catch (error: any) {
            console.error('Error loading certificates:', error);
            Alert.alert(t.error, error.message || t.failedLoadCertificates);
            setCertificates([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleViewCertificate = (certificate: Certificate) => {
        setSelectedCertificate(certificate);
        setShowViewer(true);
    };

    const handleShareCertificate = async () => {
        if (!selectedCertificate) return;

        try {
            const html = generateCertificateHTML(selectedCertificate, userName, templateBase64);

            // Generate PDF
            const { uri } = await printToFileAsync({
                html,
                base64: false,
            });

            // Share the PDF
            const canShare = await Sharing.isAvailableAsync();
            if (canShare) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: `${t.shareCertificate} - ${selectedCertificate.diploma?.title}`,
                });
            } else {
                Alert.alert(t.sharingNotAvailable, t.sharingNotAvailable);
            }
        } catch (error) {
            console.error('Error sharing certificate:', error);
            Alert.alert(t.error, t.failedShareCertificate);
        }
    };

    const handleDownloadCertificate = async () => {
        if (!selectedCertificate) return;

        try {
            const html = generateCertificateHTML(selectedCertificate, userName, templateBase64);

            // Generate and save PDF
            const { uri } = await printToFileAsync({
                html,
                base64: false,
            });

            // Move to documents directory
            const fileName = `Certificate_${selectedCertificate.certificate_number}.pdf`;
            const destUri = FileSystem.documentDirectory + fileName;

            await FileSystem.moveAsync({
                from: uri,
                to: destUri,
            });

            Alert.alert(
                t.certificateSavedTitle,
                t.certificateSavedMessage.replace('{fileName}', fileName),
                [
                    { text: t.ok },
                    {
                        text: t.shareAction,
                        onPress: async () => {
                            const canShare = await Sharing.isAvailableAsync();
                            if (canShare) {
                                await Sharing.shareAsync(destUri, {
                                    mimeType: 'application/pdf',
                                });
                            }
                        },
                    },
                ]
            );
        } catch (error) {
            console.error('Error downloading certificate:', error);
            Alert.alert(t.error, t.failedDownloadCertificate);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>{t.loadingCertificates}</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>{t.certificates}</Text>
                    <Text style={styles.headerSubtitle}>
                        {certificates.length > 0
                            ? t.certificatesEarned.replace('{count}', String(certificates.length))
                            : t.completeCoursesToEarnCertificates}
                    </Text>
                </View>
                <View style={styles.headerIcon}>
                    <Ionicons name="ribbon" size={32} color={colors.warning} />
                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: insets.bottom + 100 },
                ]}
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
                {certificates.length === 0 ? (
                    <Animated.View style={[styles.emptyState, { opacity: fadeAnim }]}>
                        <View style={styles.emptyIcon}>
                            <Ionicons name="trophy-outline" size={64} color={colors.textTertiary} />
                        </View>
                        <Text style={styles.emptyTitle}>{t.noCertificatesYet}</Text>
                        <Text style={styles.emptyText}>
                            {t.completeCoursesToEarnCertificates}
                        </Text>
                        <TouchableOpacity
                            style={styles.emptyButton}
                            onPress={() => router.push('/(student)/courses')}
                        >
                            <Text style={styles.emptyButtonText}>{t.viewMyCourses}</Text>
                            <Ionicons name={isRTL ? "arrow-back" : "arrow-forward"} size={16} color={colors.primary} />
                        </TouchableOpacity>
                    </Animated.View>
                ) : (
                    <Animated.View style={{ opacity: fadeAnim }}>
                        {certificates.map((certificate, index) => (
                            <CertificateCard
                                key={certificate.id}
                                certificate={certificate}
                                index={index}
                                onPress={() => handleViewCertificate(certificate)}
                            />
                        ))}
                    </Animated.View>
                )}
            </ScrollView>

            {/* Certificate Viewer Modal */}
            <Modal
                visible={showViewer}
                animationType="slide"
                presentationStyle="fullScreen"
                onRequestClose={() => setShowViewer(false)}
            >
                <SafeAreaView style={styles.viewerContainer}>
                    <View style={styles.viewerHeader}>
                        <TouchableOpacity
                            style={styles.viewerCloseButton}
                            onPress={() => setShowViewer(false)}
                        >
                            <Ionicons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={styles.viewerTitle} numberOfLines={1}>
                            {selectedCertificate?.diploma?.title || t.certificateTitle}
                        </Text>
                        <View style={styles.viewerActions}>
                            <TouchableOpacity
                                style={styles.viewerActionButton}
                                onPress={handleShareCertificate}
                            >
                                <Ionicons name="share-outline" size={22} color={colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.viewerActionButton}
                                onPress={handleDownloadCertificate}
                            >
                                <Ionicons name="download-outline" size={22} color={colors.primary} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {selectedCertificate && (
                        <WebView
                            source={{
                                html: generateCertificateHTML(
                                    selectedCertificate,
                                    userName,
                                    templateBase64
                                ),
                            }}
                            style={styles.webView}
                            scalesPageToFit={true}
                            bounces={false}
                        />
                    )}
                </SafeAreaView>
            </Modal>
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
        },
        loadingText: {
            marginTop: Theme.spacing.md,
            fontSize: Theme.fontSize.base,
            color: colors.textSecondary,
        },
        header: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: Theme.spacing.lg,
            paddingTop: Theme.spacing.md,
        },
        headerTitle: {
            fontSize: Theme.fontSize['3xl'],
            fontWeight: Theme.fontWeight.bold,
            color: colors.text,
            textAlign: isRTL ? 'right' : 'left',
        },
        headerSubtitle: {
            fontSize: Theme.fontSize.sm,
            color: colors.textSecondary,
            marginTop: 4,
            textAlign: isRTL ? 'right' : 'left',
        },
        headerIcon: {
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.warning + '15',
            justifyContent: 'center',
            alignItems: 'center',
        },
        scrollView: {
            flex: 1,
        },
        scrollContent: {
            padding: Theme.spacing.lg,
            paddingTop: 0,
        },
        cardWrapper: {
            marginBottom: Theme.spacing.md,
        },
        card: {
            backgroundColor: colors.surface,
            borderRadius: Theme.borderRadius.xl,
            padding: Theme.spacing.lg,
            ...Theme.shadows[isDark ? 'dark' : 'light'].md,
        },
        cardHeader: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
        },
        awardIcon: {
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: colors.warning + '15',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: isRTL ? 0 : Theme.spacing.md,
            marginLeft: isRTL ? Theme.spacing.md : 0,
        },
        cardHeaderText: {
            flex: 1,
        },
        cardTitle: {
            fontSize: Theme.fontSize.lg,
            fontWeight: Theme.fontWeight.bold,
            color: colors.text,
            marginBottom: 4,
            textAlign: isRTL ? 'right' : 'left',
        },
        cardDate: {
            fontSize: Theme.fontSize.sm,
            color: colors.textSecondary,
            textAlign: isRTL ? 'right' : 'left',
        },
        cardDivider: {
            height: 1,
            backgroundColor: colors.border,
            marginVertical: Theme.spacing.md,
        },
        cardDetails: {
            gap: Theme.spacing.sm,
        },
        detailRow: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        detailLabel: {
            fontSize: Theme.fontSize.sm,
            color: colors.textSecondary,
            textAlign: isRTL ? 'right' : 'left',
        },
        detailValue: {
            fontSize: Theme.fontSize.sm,
            color: colors.text,
            fontWeight: Theme.fontWeight.medium,
            maxWidth: '60%',
            textAlign: isRTL ? 'left' : 'right',
        },
        verificationCode: {
            fontFamily: 'monospace',
            color: colors.primary,
        },
        cardFooter: {
            marginTop: Theme.spacing.md,
            paddingTop: Theme.spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        viewButton: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'center',
        },
        viewButtonText: {
            fontSize: Theme.fontSize.base,
            color: colors.primary,
            fontWeight: Theme.fontWeight.semibold,
            marginRight: isRTL ? 0 : 4,
            marginLeft: isRTL ? 4 : 0,
        },
        emptyState: {
            alignItems: 'center',
            paddingVertical: Theme.spacing['3xl'],
        },
        emptyIcon: {
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: colors.surface,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: Theme.spacing.lg,
        },
        emptyTitle: {
            fontSize: Theme.fontSize.xl,
            fontWeight: Theme.fontWeight.bold,
            color: colors.text,
            marginBottom: Theme.spacing.sm,
            textAlign: isRTL ? 'right' : 'left',
        },
        emptyText: {
            fontSize: Theme.fontSize.base,
            color: colors.textSecondary,
            textAlign: 'center',
            paddingHorizontal: Theme.spacing.xl,
            marginBottom: Theme.spacing.lg,
        },
        emptyButton: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            paddingVertical: Theme.spacing.sm,
            paddingHorizontal: Theme.spacing.lg,
            backgroundColor: colors.primary + '15',
            borderRadius: Theme.borderRadius.full,
            gap: Theme.spacing.xs,
        },
        emptyButtonText: {
            fontSize: Theme.fontSize.base,
            color: colors.primary,
            fontWeight: Theme.fontWeight.semibold,
        },
        viewerContainer: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            backgroundColor: colors.background,
        },
        viewerHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: Theme.spacing.md,
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        viewerCloseButton: {
            padding: Theme.spacing.sm,
            textAlign: isRTL ? 'right' : 'left',
        },
        viewerTitle: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            fontSize: Theme.fontSize.lg,
            fontWeight: Theme.fontWeight.semibold,
            color: colors.text,
            marginHorizontal: Theme.spacing.sm,
        },
        viewerActions: {
            flexDirection: 'row',
            gap: Theme.spacing.xs,
        },
        viewerActionButton: {
            padding: Theme.spacing.sm,
        },
        webView: {
            flex: 1,
            backgroundColor: '#1a1a2e',
        },
    });
}
