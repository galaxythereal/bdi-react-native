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
    const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
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
                            {certificate.diploma?.title || 'Diploma Certificate'}
                        </Text>
                        <Text style={styles.cardDate}>
                            Issued {new Date(certificate.issued_at).toLocaleDateString('en-US', {
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
                        <Text style={styles.detailLabel}>Certificate #</Text>
                        <Text style={styles.detailValue} numberOfLines={1}>
                            {certificate.certificate_number}
                        </Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Verification</Text>
                        <Text style={[styles.detailValue, styles.verificationCode]}>
                            {certificate.verification_code}
                        </Text>
                    </View>
                </View>

                <View style={styles.cardFooter}>
                    <View style={styles.viewButton}>
                        <Text style={styles.viewButtonText}>View Certificate</Text>
                        <Ionicons name="chevron-forward" size={16} color={colors.primary} />
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
    const [userName, setUserName] = useState('Student');
    const [templateBase64, setTemplateBase64] = useState<string | undefined>(undefined);
    const { session } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const { colors, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

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
            Alert.alert('Error', error.message || 'Failed to load certificates.');
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
                    dialogTitle: `Share Certificate - ${selectedCertificate.diploma?.title}`,
                });
            } else {
                Alert.alert('Sharing not available', 'Unable to share on this device.');
            }
        } catch (error) {
            console.error('Error sharing certificate:', error);
            Alert.alert('Error', 'Failed to share certificate.');
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
                'Certificate Saved',
                `Certificate saved as ${fileName}`,
                [
                    { text: 'OK' },
                    {
                        text: 'Share',
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
            Alert.alert('Error', 'Failed to download certificate.');
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading certificates...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Certificates</Text>
                    <Text style={styles.headerSubtitle}>
                        {certificates.length > 0
                            ? `${certificates.length} certificate${certificates.length !== 1 ? 's' : ''} earned`
                            : 'Complete courses to earn certificates'}
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
                        <Text style={styles.emptyTitle}>No Certificates Yet</Text>
                        <Text style={styles.emptyText}>
                            Complete your courses to earn certificates of completion.
                        </Text>
                        <TouchableOpacity
                            style={styles.emptyButton}
                            onPress={() => router.push('/(student)/courses')}
                        >
                            <Text style={styles.emptyButtonText}>View My Courses</Text>
                            <Ionicons name="arrow-forward" size={16} color={colors.primary} />
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
                            {selectedCertificate?.diploma?.title || 'Certificate'}
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

function createStyles(colors: typeof Theme.colors.light, isDark: boolean) {
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
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: Theme.spacing.lg,
            paddingTop: Theme.spacing.md,
        },
        headerTitle: {
            fontSize: Theme.fontSize['3xl'],
            fontWeight: Theme.fontWeight.bold,
            color: colors.text,
        },
        headerSubtitle: {
            fontSize: Theme.fontSize.sm,
            color: colors.textSecondary,
            marginTop: 4,
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
            flexDirection: 'row',
            alignItems: 'flex-start',
        },
        awardIcon: {
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: colors.warning + '15',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: Theme.spacing.md,
        },
        cardHeaderText: {
            flex: 1,
        },
        cardTitle: {
            fontSize: Theme.fontSize.lg,
            fontWeight: Theme.fontWeight.bold,
            color: colors.text,
            marginBottom: 4,
        },
        cardDate: {
            fontSize: Theme.fontSize.sm,
            color: colors.textSecondary,
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
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        detailLabel: {
            fontSize: Theme.fontSize.sm,
            color: colors.textSecondary,
        },
        detailValue: {
            fontSize: Theme.fontSize.sm,
            color: colors.text,
            fontWeight: Theme.fontWeight.medium,
            maxWidth: '60%',
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
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
        },
        viewButtonText: {
            fontSize: Theme.fontSize.base,
            color: colors.primary,
            fontWeight: Theme.fontWeight.semibold,
            marginRight: 4,
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
        },
        emptyText: {
            fontSize: Theme.fontSize.base,
            color: colors.textSecondary,
            textAlign: 'center',
            paddingHorizontal: Theme.spacing.xl,
            marginBottom: Theme.spacing.lg,
        },
        emptyButton: {
            flexDirection: 'row',
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
            flex: 1,
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
        },
        viewerTitle: {
            flex: 1,
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
