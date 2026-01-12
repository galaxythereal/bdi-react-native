import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { printToFileAsync } from 'expo-print';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useAuth } from '../../src/features/auth/AuthContext';
import { fetchMyCertificates, generateCertificateHTML } from '../../src/features/certificates/certificateService';
import { BORDER_RADIUS, COLORS, FONT_SIZE, FONT_WEIGHT, SHADOWS, SPACING } from '../../src/lib/constants';
import { useTheme } from '../../src/context/ThemeContext';
import { Certificate } from '../../src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CertificateCardProps {
    certificate: Certificate;
    index: number;
    onPress: () => void;
}

const CertificateCard: React.FC<CertificateCardProps> = ({ certificate, index, onPress }) => {
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
                        <Ionicons name="ribbon" size={28} color={COLORS.warning} />
                    </View>
                    <View style={styles.cardHeaderText}>
                        <Text style={styles.cardTitle} numberOfLines={2}>
                            {certificate.course?.title || 'Course Certificate'}
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
                        <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
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
    const { session } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const { colors } = useTheme();

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
            const html = generateCertificateHTML(selectedCertificate, userName);
            
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
                    dialogTitle: `Share Certificate - ${selectedCertificate.course?.title}`,
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
            const html = generateCertificateHTML(selectedCertificate, userName);
            
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
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading certificates...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Certificates</Text>
                    <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                        {certificates.length > 0
                            ? `${certificates.length} certificate${certificates.length !== 1 ? 's' : ''} earned`
                            : 'Complete courses to earn certificates'}
                    </Text>
                </View>
                <View style={styles.headerIcon}>
                    <Ionicons name="ribbon" size={32} color={COLORS.warning} />
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
                            <Ionicons name="trophy-outline" size={64} color={COLORS.textTertiary} />
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
                            <Ionicons name="arrow-forward" size={16} color={COLORS.primary} />
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
                            <Ionicons name="close" size={24} color={COLORS.text} />
                        </TouchableOpacity>
                        <Text style={styles.viewerTitle} numberOfLines={1}>
                            {selectedCertificate?.course?.title || 'Certificate'}
                        </Text>
                        <View style={styles.viewerActions}>
                            <TouchableOpacity
                                style={styles.viewerActionButton}
                                onPress={handleShareCertificate}
                            >
                                <Ionicons name="share-outline" size={22} color={COLORS.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.viewerActionButton}
                                onPress={handleDownloadCertificate}
                            >
                                <Ionicons name="download-outline" size={22} color={COLORS.primary} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    
                    {selectedCertificate && (
                        <WebView
                            source={{
                                html: generateCertificateHTML(
                                    selectedCertificate,
                                    userName
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: SPACING.md,
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.lg,
        paddingTop: SPACING.md,
    },
    headerTitle: {
        fontSize: FONT_SIZE.xxxl,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
    },
    headerSubtitle: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
        marginTop: 4,
    },
    headerIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: COLORS.warning + '15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: SPACING.lg,
        paddingTop: 0,
    },
    cardWrapper: {
        marginBottom: SPACING.md,
    },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.xl,
        padding: SPACING.lg,
        ...SHADOWS.md,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    awardIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: COLORS.warning + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.md,
    },
    cardHeaderText: {
        flex: 1,
    },
    cardTitle: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        marginBottom: 4,
    },
    cardDate: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
    },
    cardDivider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginVertical: SPACING.md,
    },
    cardDetails: {
        gap: SPACING.sm,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    detailLabel: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
    },
    detailValue: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.text,
        fontWeight: FONT_WEIGHT.medium,
        maxWidth: '60%',
    },
    verificationCode: {
        fontFamily: 'monospace',
        color: COLORS.primary,
    },
    cardFooter: {
        marginTop: SPACING.md,
        paddingTop: SPACING.md,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    viewButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    viewButtonText: {
        fontSize: FONT_SIZE.md,
        color: COLORS.primary,
        fontWeight: FONT_WEIGHT.semibold,
        marginRight: 4,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: SPACING.xxxl,
    },
    emptyIcon: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: COLORS.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.lg,
    },
    emptyTitle: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        marginBottom: SPACING.sm,
    },
    emptyText: {
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
        textAlign: 'center',
        paddingHorizontal: SPACING.xl,
        marginBottom: SPACING.lg,
    },
    emptyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.lg,
        backgroundColor: COLORS.primary + '15',
        borderRadius: BORDER_RADIUS.round,
        gap: SPACING.xs,
    },
    emptyButtonText: {
        fontSize: FONT_SIZE.md,
        color: COLORS.primary,
        fontWeight: FONT_WEIGHT.semibold,
    },
    viewerContainer: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    viewerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    viewerCloseButton: {
        padding: SPACING.sm,
    },
    viewerTitle: {
        flex: 1,
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.semibold,
        color: COLORS.text,
        marginHorizontal: SPACING.sm,
    },
    viewerActions: {
        flexDirection: 'row',
        gap: SPACING.xs,
    },
    viewerActionButton: {
        padding: SPACING.sm,
    },
    webView: {
        flex: 1,
        backgroundColor: '#1a1a2e',
    },
});
