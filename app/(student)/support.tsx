import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/features/auth/AuthContext';
import {
    createTicket,
    fetchMyTickets,
    fetchTicketMessages,
    getPriorityColor,
    getTicketStatusColor,
    sendTicketMessage,
} from '../../src/features/support/supportService';
import { BORDER_RADIUS, COLORS, FONT_SIZE, FONT_WEIGHT, SHADOWS, SPACING } from '../../src/lib/constants';
import { SupportTicket, TicketMessage } from '../../src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Ticket Card Component
interface TicketCardProps {
    ticket: SupportTicket;
    index: number;
    onPress: () => void;
}

const TicketCard: React.FC<TicketCardProps> = ({ ticket, index, onPress }) => {
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
                            {new Date(ticket.created_at).toLocaleDateString('en-US', {
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
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Loading tickets...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Support</Text>
                    <Text style={styles.headerSubtitle}>
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
                        tintColor={COLORS.primary}
                    />
                }
                showsVerticalScrollIndicator={false}
            >
                {tickets.length === 0 ? (
                    <Animated.View style={[styles.emptyState, { opacity: fadeAnim }]}>
                        <View style={styles.emptyIcon}>
                            <Ionicons name="chatbubbles-outline" size={64} color={COLORS.textTertiary} />
                        </View>
                        <Text style={styles.emptyTitle}>No Support Tickets</Text>
                        <Text style={styles.emptyText}>
                            Having issues or questions? Create a support ticket and we'll help you out.
                        </Text>
                        <TouchableOpacity
                            style={styles.emptyButton}
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
                                <ActivityIndicator size="small" color={COLORS.primary} />
                            ) : (
                                <Text style={styles.modalSubmit}>Create</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalContent}>
                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>Subject *</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="Brief summary of your issue"
                                placeholderTextColor={COLORS.textTertiary}
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
                                placeholderTextColor={COLORS.textTertiary}
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
                            <Ionicons name="close" size={24} color={COLORS.text} />
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
                            {selectedTicket && new Date(selectedTicket.created_at).toLocaleString()}
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
                        >
                            {loadingMessages ? (
                                <View style={styles.messagesLoading}>
                                    <ActivityIndicator size="small" color={COLORS.primary} />
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
                                                {new Date(msg.created_at).toLocaleTimeString([], {
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
                        <View style={[styles.messageInputContainer, { paddingBottom: insets.bottom || SPACING.md }]}>
                            <TextInput
                                style={styles.messageInput}
                                placeholder="Type a message..."
                                placeholderTextColor={COLORS.textTertiary}
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
    createButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        ...SHADOWS.md,
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
        marginBottom: SPACING.sm,
    },
    statusIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.md,
    },
    cardHeaderText: {
        flex: 1,
    },
    cardTitle: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
        color: COLORS.text,
        marginBottom: 4,
    },
    cardDate: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.textTertiary,
    },
    cardDescription: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
        marginBottom: SPACING.md,
        lineHeight: 20,
    },
    cardFooter: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    statusBadge: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.sm,
    },
    statusText: {
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.bold,
    },
    priorityBadge: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.sm,
    },
    priorityText: {
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.bold,
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
        backgroundColor: COLORS.primary,
        borderRadius: BORDER_RADIUS.round,
        gap: SPACING.xs,
    },
    emptyButtonText: {
        fontSize: FONT_SIZE.md,
        color: '#fff',
        fontWeight: FONT_WEIGHT.semibold,
    },
    // Modal styles
    modalContainer: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    modalCancel: {
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
    },
    modalTitle: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.semibold,
        color: COLORS.text,
    },
    modalSubmit: {
        fontSize: FONT_SIZE.md,
        color: COLORS.primary,
        fontWeight: FONT_WEIGHT.semibold,
    },
    modalContent: {
        flex: 1,
        padding: SPACING.lg,
    },
    formGroup: {
        marginBottom: SPACING.lg,
    },
    formLabel: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.medium,
        color: COLORS.text,
        marginBottom: SPACING.sm,
    },
    formInput: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        fontSize: FONT_SIZE.md,
        color: COLORS.text,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    formTextArea: {
        height: 150,
        textAlignVertical: 'top',
    },
    priorityOptions: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    priorityOption: {
        flex: 1,
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.sm,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 2,
        alignItems: 'center',
        backgroundColor: COLORS.surface,
    },
    priorityOptionActive: {
        backgroundColor: COLORS.background,
    },
    priorityOptionText: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.medium,
        color: COLORS.textSecondary,
    },
    // Detail modal
    detailContainer: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    detailHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    detailCloseButton: {
        padding: SPACING.sm,
    },
    detailHeaderContent: {
        flex: 1,
        marginLeft: SPACING.sm,
    },
    detailTitle: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.semibold,
        color: COLORS.text,
    },
    detailBadges: {
        flexDirection: 'row',
        marginTop: 4,
    },
    detailBadge: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: 2,
        borderRadius: BORDER_RADIUS.sm,
    },
    detailBadgeText: {
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.bold,
    },
    originalMessage: {
        padding: SPACING.lg,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    originalLabel: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.textTertiary,
        marginBottom: SPACING.xs,
        textTransform: 'uppercase',
        fontWeight: FONT_WEIGHT.bold,
    },
    originalText: {
        fontSize: FONT_SIZE.md,
        color: COLORS.text,
        lineHeight: 22,
    },
    originalDate: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.textTertiary,
        marginTop: SPACING.sm,
    },
    messagesContainer: {
        flex: 1,
    },
    messagesList: {
        flex: 1,
    },
    messagesContent: {
        padding: SPACING.md,
    },
    messagesLoading: {
        alignItems: 'center',
        padding: SPACING.xl,
    },
    messagesLoadingText: {
        marginTop: SPACING.sm,
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
    },
    noMessages: {
        alignItems: 'center',
        padding: SPACING.xl,
    },
    noMessagesText: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textTertiary,
    },
    messageBubble: {
        maxWidth: '80%',
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        marginBottom: SPACING.sm,
    },
    messageBubbleMe: {
        alignSelf: 'flex-end',
        backgroundColor: COLORS.primary,
        borderBottomRightRadius: 4,
    },
    messageBubbleOther: {
        alignSelf: 'flex-start',
        backgroundColor: COLORS.surface,
        borderBottomLeftRadius: 4,
    },
    messageAuthor: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.primary,
        fontWeight: FONT_WEIGHT.semibold,
        marginBottom: 4,
    },
    messageText: {
        fontSize: FONT_SIZE.md,
        color: COLORS.text,
        lineHeight: 20,
    },
    messageTextMe: {
        color: '#fff',
    },
    messageTime: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.textTertiary,
        marginTop: 4,
        alignSelf: 'flex-end',
    },
    messageTimeMe: {
        color: 'rgba(255,255,255,0.7)',
    },
    messageInputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: SPACING.md,
        backgroundColor: COLORS.surface,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        gap: SPACING.sm,
    },
    messageInput: {
        flex: 1,
        backgroundColor: COLORS.background,
        borderRadius: BORDER_RADIUS.lg,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        fontSize: FONT_SIZE.md,
        color: COLORS.text,
        maxHeight: 100,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        opacity: 0.5,
    },
});
