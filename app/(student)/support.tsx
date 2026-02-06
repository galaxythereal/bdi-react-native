import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    KeyboardAvoidingView,
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
import { useLocalization } from '../../src/context/LocalizationContext';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/features/auth/AuthContext';
import {
    createTicket,
    fetchMyTickets,
    fetchTicketMessages,
    getPriorityColor,
    getTicketStatusColor,
    sendTicketMessage,
} from '../../src/features/support/supportService';
import { SupportTicket, TicketMessage } from '../../src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Ticket Card Component
interface TicketCardProps {
    ticket: SupportTicket;
    index: number;
    onPress: () => void;
    styles: any;
}

const TicketCard: React.FC<TicketCardProps> = ({ ticket, index, onPress, styles }) => {
    const { formatDateTime } = useLocalization();
    const cardAnim = useRef(new Animated.Value(0)).current;

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

    const statusColor = getTicketStatusColor(ticket.status);
    const priorityColor = getPriorityColor(ticket.priority);

    const getStatusIcon = () => {
        switch (ticket.status) {
            case 'open': return 'alert-circle';
            case 'in_progress': return 'time';
            case 'resolved': return 'checkmark-circle';
            case 'closed': return 'close-circle';
            default: return 'help-circle';
        }
    };

    return (
        <Animated.View style={[styles.cardWrapper, { transform: [{ scale }], opacity: cardAnim }]}>
            <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={[styles.statusIcon, { backgroundColor: statusColor + '20' }]}>
                        <Ionicons name={getStatusIcon() as any} size={20} color={statusColor} />
                    </View>
                    <View style={styles.cardHeaderText}>
                        <Text style={styles.cardTitle} numberOfLines={2}>
                            {ticket.subject}
                        </Text>
                        <Text style={styles.cardDate}>
                            {formatDateTime(ticket.created_at, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </Text>
                    </View>
                </View>

                <Text style={styles.cardDescription} numberOfLines={2}>
                    {ticket.description}
                </Text>

                <View style={styles.cardFooter}>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>
                            {ticket.status.replace('_', ' ').toUpperCase()}
                        </Text>
                    </View>
                    <View style={[styles.priorityBadge, { backgroundColor: priorityColor + '15' }]}>
                        <Text style={[styles.priorityText, { color: priorityColor }]}>
                            {ticket.priority.toUpperCase()}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

export default function SupportScreen() {
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showTicketDetail, setShowTicketDetail] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
    const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [sendingMessage, setSendingMessage] = useState(false);

    // New ticket form
    const [newTicket, setNewTicket] = useState({
        subject: '',
        description: '',
        priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    });
    const [creatingTicket, setCreatingTicket] = useState(false);

    const { session } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const messagesScrollRef = useRef<ScrollView>(null);
    const { colors, isDark } = useTheme();
    const { formatDateTime, formatTime } = useLocalization();
    const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

    const loadData = async () => {
        try {
            const data = await fetchMyTickets();
            setTickets(data);

            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }).start();
        } catch (error: any) {
            console.error('Error loading tickets:', error);
            Alert.alert('Error', error.message || 'Failed to load tickets.');
            setTickets([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const loadMessages = async (ticketId: string) => {
        setLoadingMessages(true);
        try {
            const messages = await fetchTicketMessages(ticketId);
            setTicketMessages(messages);

            // Scroll to bottom
            setTimeout(() => {
                messagesScrollRef.current?.scrollToEnd({ animated: false });
            }, 100);
        } catch (error) {
            console.error('Error loading messages:', error);
        } finally {
            setLoadingMessages(false);
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

    const handleViewTicket = async (ticket: SupportTicket) => {
        setSelectedTicket(ticket);
        setShowTicketDetail(true);
        await loadMessages(ticket.id);
    };

    const handleCreateTicket = async () => {
        if (!newTicket.subject.trim() || !newTicket.description.trim()) {
            Alert.alert('Validation Error', 'Please fill in all fields.');
            return;
        }

        setCreatingTicket(true);
        try {
            await createTicket(newTicket.subject, newTicket.description, newTicket.priority);
            setShowCreateModal(false);
            setNewTicket({ subject: '', description: '', priority: 'medium' });
            Alert.alert('Success', 'Your support ticket has been created. We will respond soon.');
            loadData();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to create ticket.');
        } finally {
            setCreatingTicket(false);
        }
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !selectedTicket) return;

        setSendingMessage(true);
        try {
            await sendTicketMessage(selectedTicket.id, newMessage.trim());
            setNewMessage('');
            await loadMessages(selectedTicket.id);
            loadData(); // Refresh ticket list to update status

            // Scroll to bottom
            setTimeout(() => {
                messagesScrollRef.current?.scrollToEnd({ animated: true });
            }, 100);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to send message.');
        } finally {
            setSendingMessage(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading tickets...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Support</Text>
                    <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                        {tickets.length > 0
                            ? `${tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length} open ticket${tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length !== 1 ? 's' : ''}`
                            : 'Need help? Create a ticket'}
                    </Text>
                </View>
                <TouchableOpacity
                    style={styles.createButton}
                    onPress={() => setShowCreateModal(true)}
                >
                    <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
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
                scrollEnabled={true}
                scrollEventThrottle={16}
                bounces={true}
                alwaysBounceVertical={true}
            >
                {tickets.length === 0 ? (
                    <Animated.View style={[styles.emptyState, { opacity: fadeAnim }]}>
                        <View style={[styles.emptyIcon, { backgroundColor: colors.backgroundSecondary }]}>
                            <Ionicons name="chatbubbles-outline" size={64} color={colors.textTertiary} />
                        </View>
                        <Text style={[styles.emptyTitle, { color: colors.text }]}>No Support Tickets</Text>
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                            Having issues or questions? Create a support ticket and we'll help you out.
                        </Text>
                        <TouchableOpacity
                            style={[styles.emptyButton, { backgroundColor: colors.primary }]}
                            onPress={() => setShowCreateModal(true)}
                        >
                            <Ionicons name="add" size={18} color="#fff" />
                            <Text style={styles.emptyButtonText}>Create Ticket</Text>
                        </TouchableOpacity>
                    </Animated.View>
                ) : (
                    <Animated.View style={{ opacity: fadeAnim }}>
                        {tickets.map((ticket, index) => (
                            <TicketCard
                                key={ticket.id}
                                ticket={ticket}
                                index={index}
                                onPress={() => handleViewTicket(ticket)}
                                styles={styles}
                            />
                        ))}
                    </Animated.View>
                )}
            </ScrollView>

            {/* Create Ticket Modal */}
            <Modal
                visible={showCreateModal}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowCreateModal(false)}
            >
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                            <Text style={styles.modalCancel}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>New Ticket</Text>
                        <TouchableOpacity onPress={handleCreateTicket} disabled={creatingTicket}>
                            {creatingTicket ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                                <Text style={styles.modalSubmit}>Create</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <ScrollView 
                        style={styles.modalContent}
                        scrollEnabled={true}
                        scrollEventThrottle={16}
                        bounces={true}
                        alwaysBounceVertical={true}
                    >
                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>Subject *</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="Brief summary of your issue"
                                placeholderTextColor={colors.textTertiary}
                                value={newTicket.subject}
                                onChangeText={(text) => setNewTicket(prev => ({ ...prev, subject: text }))}
                            />
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>Priority</Text>
                            <View style={styles.priorityOptions}>
                                {(['low', 'medium', 'high', 'urgent'] as const).map((priority) => (
                                    <TouchableOpacity
                                        key={priority}
                                        style={[
                                            styles.priorityOption,
                                            newTicket.priority === priority && styles.priorityOptionActive,
                                            { borderColor: getPriorityColor(priority) },
                                        ]}
                                        onPress={() => setNewTicket(prev => ({ ...prev, priority }))}
                                    >
                                        <Text style={[
                                            styles.priorityOptionText,
                                            newTicket.priority === priority && { color: getPriorityColor(priority) },
                                        ]}>
                                            {priority.charAt(0).toUpperCase() + priority.slice(1)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>Description *</Text>
                            <TextInput
                                style={[styles.formInput, styles.formTextArea]}
                                placeholder="Please describe your issue in detail..."
                                placeholderTextColor={colors.textTertiary}
                                value={newTicket.description}
                                onChangeText={(text) => setNewTicket(prev => ({ ...prev, description: text }))}
                                multiline
                                numberOfLines={6}
                                textAlignVertical="top"
                            />
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </Modal>

            {/* Ticket Detail Modal */}
            <Modal
                visible={showTicketDetail}
                animationType="slide"
                presentationStyle="fullScreen"
                onRequestClose={() => setShowTicketDetail(false)}
            >
                <SafeAreaView style={styles.detailContainer}>
                    <View style={styles.detailHeader}>
                        <TouchableOpacity
                            style={styles.detailCloseButton}
                            onPress={() => setShowTicketDetail(false)}
                        >
                            <Ionicons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                        <View style={styles.detailHeaderContent}>
                            <Text style={styles.detailTitle} numberOfLines={1}>
                                {selectedTicket?.subject}
                            </Text>
                            <View style={styles.detailBadges}>
                                <View style={[
                                    styles.detailBadge,
                                    { backgroundColor: getTicketStatusColor(selectedTicket?.status || 'open') + '20' }
                                ]}>
                                    <Text style={[
                                        styles.detailBadgeText,
                                        { color: getTicketStatusColor(selectedTicket?.status || 'open') }
                                    ]}>
                                        {(selectedTicket?.status || 'open').replace('_', ' ').toUpperCase()}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Original message */}
                    <View style={styles.originalMessage}>
                        <Text style={styles.originalLabel}>Original Message</Text>
                        <Text style={styles.originalText}>{selectedTicket?.description}</Text>
                        <Text style={styles.originalDate}>
                            {selectedTicket && formatDateTime(selectedTicket.created_at)}
                        </Text>
                    </View>

                    {/* Messages */}
                    <KeyboardAvoidingView
                        style={styles.messagesContainer}
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        keyboardVerticalOffset={100}
                    >
                        <ScrollView
                            ref={messagesScrollRef}
                            style={styles.messagesList}
                            contentContainerStyle={styles.messagesContent}
                            scrollEnabled={true}
                            scrollEventThrottle={16}
                            bounces={true}
                            alwaysBounceVertical={true}
                        >
                            {loadingMessages ? (
                                <View style={styles.messagesLoading}>
                                    <ActivityIndicator size="small" color={colors.primary} />
                                    <Text style={styles.messagesLoadingText}>Loading messages...</Text>
                                </View>
                            ) : ticketMessages.length === 0 ? (
                                <View style={styles.noMessages}>
                                    <Text style={styles.noMessagesText}>No replies yet</Text>
                                </View>
                            ) : (
                                ticketMessages.map((msg) => {
                                    const isMe = msg.user_id === session?.user?.id;
                                    return (
                                        <View
                                            key={msg.id}
                                            style={[
                                                styles.messageBubble,
                                                isMe ? styles.messageBubbleMe : styles.messageBubbleOther,
                                            ]}
                                        >
                                            {!isMe && (
                                                <Text style={styles.messageAuthor}>
                                                    {msg.profile?.full_name || 'Support'}
                                                </Text>
                                            )}
                                            <Text style={[
                                                styles.messageText,
                                                isMe && styles.messageTextMe,
                                            ]}>
                                                {msg.message}
                                            </Text>
                                            <Text style={[
                                                styles.messageTime,
                                                isMe && styles.messageTimeMe,
                                            ]}>
                                                {formatTime(msg.created_at, {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </Text>
                                        </View>
                                    );
                                })
                            )}
                        </ScrollView>

                        {/* Message Input */}
                        <View style={[styles.messageInputContainer, { paddingBottom: insets.bottom || Theme.spacing.md }]}>
                            <TextInput
                                style={styles.messageInput}
                                placeholder="Type a message..."
                                placeholderTextColor={colors.textTertiary}
                                value={newMessage}
                                onChangeText={setNewMessage}
                                multiline
                            />
                            <TouchableOpacity
                                style={[
                                    styles.sendButton,
                                    (!newMessage.trim() || sendingMessage) && styles.sendButtonDisabled,
                                ]}
                                onPress={handleSendMessage}
                                disabled={!newMessage.trim() || sendingMessage}
                            >
                                {sendingMessage ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Ionicons name="send" size={20} color="#fff" />
                                )}
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
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
        createButton: {
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: colors.primary,
            justifyContent: 'center',
            alignItems: 'center',
            ...Theme.shadows[isDark ? 'dark' : 'light'].md,
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
            marginBottom: Theme.spacing.sm,
        },
        statusIcon: {
            width: 40,
            height: 40,
            borderRadius: 10,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: Theme.spacing.md,
        },
        cardHeaderText: {
            flex: 1,
        },
        cardTitle: {
            fontSize: Theme.fontSize.base,
            fontWeight: Theme.fontWeight.semibold,
            color: colors.text,
            marginBottom: 4,
        },
        cardDate: {
            fontSize: Theme.fontSize.xs,
            color: colors.textTertiary,
        },
        cardDescription: {
            fontSize: Theme.fontSize.sm,
            color: colors.textSecondary,
            marginBottom: Theme.spacing.md,
            lineHeight: 20,
        },
        cardFooter: {
            flexDirection: 'row',
            gap: Theme.spacing.sm,
        },
        statusBadge: {
            paddingHorizontal: Theme.spacing.sm,
            paddingVertical: 4,
            borderRadius: Theme.borderRadius.sm,
        },
        statusText: {
            fontSize: Theme.fontSize.xs,
            fontWeight: Theme.fontWeight.bold,
        },
        priorityBadge: {
            paddingHorizontal: Theme.spacing.sm,
            paddingVertical: 4,
            borderRadius: Theme.borderRadius.sm,
        },
        priorityText: {
            fontSize: Theme.fontSize.xs,
            fontWeight: Theme.fontWeight.bold,
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
            backgroundColor: colors.primary,
            borderRadius: Theme.borderRadius.full,
            gap: Theme.spacing.xs,
        },
        emptyButtonText: {
            fontSize: Theme.fontSize.base,
            color: '#fff',
            fontWeight: Theme.fontWeight.semibold,
        },
        // Modal styles
        modalContainer: {
            flex: 1,
            backgroundColor: colors.background,
        },
        modalHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: Theme.spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        modalCancel: {
            fontSize: Theme.fontSize.base,
            color: colors.textSecondary,
        },
        modalTitle: {
            fontSize: Theme.fontSize.lg,
            fontWeight: Theme.fontWeight.semibold,
            color: colors.text,
        },
        modalSubmit: {
            fontSize: Theme.fontSize.base,
            color: colors.primary,
            fontWeight: Theme.fontWeight.semibold,
        },
        modalContent: {
            flex: 1,
            padding: Theme.spacing.lg,
        },
        formGroup: {
            marginBottom: Theme.spacing.lg,
        },
        formLabel: {
            fontSize: Theme.fontSize.sm,
            fontWeight: Theme.fontWeight.medium,
            color: colors.text,
            marginBottom: Theme.spacing.sm,
        },
        formInput: {
            backgroundColor: colors.surface,
            borderRadius: Theme.borderRadius.lg,
            padding: Theme.spacing.md,
            fontSize: Theme.fontSize.base,
            color: colors.text,
            borderWidth: 1,
            borderColor: colors.border,
        },
        formTextArea: {
            height: 150,
            textAlignVertical: 'top',
        },
        priorityOptions: {
            flexDirection: 'row',
            gap: Theme.spacing.sm,
        },
        priorityOption: {
            flex: 1,
            paddingVertical: Theme.spacing.sm,
            paddingHorizontal: Theme.spacing.sm,
            borderRadius: Theme.borderRadius.md,
            borderWidth: 2,
            alignItems: 'center',
            backgroundColor: colors.surface,
        },
        priorityOptionActive: {
            backgroundColor: colors.background,
        },
        priorityOptionText: {
            fontSize: Theme.fontSize.sm,
            fontWeight: Theme.fontWeight.medium,
            color: colors.textSecondary,
        },
        // Detail modal
        detailContainer: {
            flex: 1,
            backgroundColor: colors.background,
        },
        detailHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: Theme.spacing.md,
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        detailCloseButton: {
            padding: Theme.spacing.sm,
        },
        detailHeaderContent: {
            flex: 1,
            marginLeft: Theme.spacing.sm,
        },
        detailTitle: {
            fontSize: Theme.fontSize.lg,
            fontWeight: Theme.fontWeight.semibold,
            color: colors.text,
        },
        detailBadges: {
            flexDirection: 'row',
            marginTop: 4,
        },
        detailBadge: {
            paddingHorizontal: Theme.spacing.sm,
            paddingVertical: 2,
            borderRadius: Theme.borderRadius.sm,
        },
        detailBadgeText: {
            fontSize: Theme.fontSize.xs,
            fontWeight: Theme.fontWeight.bold,
        },
        originalMessage: {
            padding: Theme.spacing.lg,
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        originalLabel: {
            fontSize: Theme.fontSize.xs,
            color: colors.textTertiary,
            marginBottom: Theme.spacing.xs,
            textTransform: 'uppercase',
            fontWeight: Theme.fontWeight.bold,
        },
        originalText: {
            fontSize: Theme.fontSize.base,
            color: colors.text,
            lineHeight: 22,
        },
        originalDate: {
            fontSize: Theme.fontSize.xs,
            color: colors.textTertiary,
            marginTop: Theme.spacing.sm,
        },
        messagesContainer: {
            flex: 1,
        },
        messagesList: {
            flex: 1,
        },
        messagesContent: {
            padding: Theme.spacing.md,
        },
        messagesLoading: {
            alignItems: 'center',
            padding: Theme.spacing.xl,
        },
        messagesLoadingText: {
            marginTop: Theme.spacing.sm,
            fontSize: Theme.fontSize.sm,
            color: colors.textSecondary,
        },
        noMessages: {
            alignItems: 'center',
            padding: Theme.spacing.xl,
        },
        noMessagesText: {
            fontSize: Theme.fontSize.sm,
            color: colors.textTertiary,
        },
        messageBubble: {
            maxWidth: '80%',
            padding: Theme.spacing.md,
            borderRadius: Theme.borderRadius.lg,
            marginBottom: Theme.spacing.sm,
        },
        messageBubbleMe: {
            alignSelf: 'flex-end',
            backgroundColor: colors.primary,
            borderBottomRightRadius: 4,
        },
        messageBubbleOther: {
            alignSelf: 'flex-start',
            backgroundColor: colors.surface,
            borderBottomLeftRadius: 4,
        },
        messageAuthor: {
            fontSize: Theme.fontSize.xs,
            color: colors.primary,
            fontWeight: Theme.fontWeight.semibold,
            marginBottom: 4,
        },
        messageText: {
            fontSize: Theme.fontSize.base,
            color: colors.text,
            lineHeight: 20,
        },
        messageTextMe: {
            color: '#fff',
        },
        messageTime: {
            fontSize: Theme.fontSize.xs,
            color: colors.textTertiary,
            marginTop: 4,
            alignSelf: 'flex-end',
        },
        messageTimeMe: {
            color: 'rgba(255,255,255,0.7)',
        },
        messageInputContainer: {
            flexDirection: 'row',
            alignItems: 'flex-end',
            padding: Theme.spacing.md,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            gap: Theme.spacing.sm,
        },
        messageInput: {
            flex: 1,
            backgroundColor: colors.background,
            borderRadius: Theme.borderRadius.lg,
            paddingHorizontal: Theme.spacing.md,
            paddingVertical: Theme.spacing.sm,
            fontSize: Theme.fontSize.base,
            color: colors.text,
            maxHeight: 100,
        },
        sendButton: {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.primary,
            justifyContent: 'center',
            alignItems: 'center',
        },
        sendButtonDisabled: {
            opacity: 0.5,
        },
    });
}
