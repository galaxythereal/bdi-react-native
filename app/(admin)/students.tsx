import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { useImpersonation } from '../../src/context/ImpersonationContext';
import { supabase } from '../../src/lib/supabase';
import { Search, User, Eye, GraduationCap } from 'lucide-react-native';

interface Student {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    status: string;
}

export default function StudentsScreen() {
    const { colors } = useTheme();
    const { startImpersonation } = useImpersonation();
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('');
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    const searchStudents = useCallback(async (term: string) => {
        if (term.length < 2) {
            setStudents([]);
            setSearched(false);
            return;
        }

        setLoading(true);
        setSearched(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, email, full_name, avatar_url, status')
                .eq('role', 'student')
                .or(`email.ilike.%${term}%,full_name.ilike.%${term}%`)
                .limit(20);

            if (error) throw error;
            setStudents(data || []);
        } catch (error) {
            console.error('Error searching students:', error);
            setStudents([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleImpersonate = async (student: Student) => {
        Alert.alert(
            'View as Student',
            `You will now see the app exactly as ${student.full_name || student.email} sees it.\n\nThis is for support purposes only.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Continue',
                    onPress: async () => {
                        try {
                            await startImpersonation({
                                id: student.id,
                                email: student.email,
                                fullName: student.full_name || 'Unknown',
                                avatarUrl: student.avatar_url || undefined,
                            });
                            // Navigate to student dashboard
                            router.replace('/(student)/dashboard');
                        } catch (error) {
                            console.error('Error impersonating:', error);
                            Alert.alert('Error', 'Failed to start impersonation');
                        }
                    },
                },
            ]
        );
    };

    const styles = StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        header: {
            padding: 24,
            paddingTop: 16,
        },
        title: {
            fontSize: 28,
            fontWeight: '700',
            color: colors.text,
        },
        subtitle: {
            fontSize: 15,
            color: colors.textSecondary,
            marginTop: 8,
        },
        searchContainer: {
            paddingHorizontal: 20,
            marginBottom: 16,
        },
        searchInputContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderRadius: 12,
            paddingHorizontal: 16,
            borderWidth: 1,
            borderColor: colors.border,
        },
        searchInput: {
            flex: 1,
            paddingVertical: 16,
            paddingLeft: 12,
            fontSize: 16,
            color: colors.text,
        },
        content: {
            flex: 1,
            paddingHorizontal: 20,
        },
        emptyState: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingBottom: 100,
        },
        emptyText: {
            fontSize: 16,
            color: colors.textSecondary,
            marginTop: 16,
            textAlign: 'center',
        },
        emptyHint: {
            fontSize: 14,
            color: colors.textSecondary,
            marginTop: 8,
            opacity: 0.7,
        },
        studentCard: {
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: 'row',
            alignItems: 'center',
        },
        avatar: {
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: colors.primary + '20',
            justifyContent: 'center',
            alignItems: 'center',
        },
        studentInfo: {
            flex: 1,
            marginLeft: 16,
        },
        studentName: {
            fontSize: 17,
            fontWeight: '600',
            color: colors.text,
        },
        studentEmail: {
            fontSize: 14,
            color: colors.textSecondary,
            marginTop: 2,
        },
        statusBadge: {
            marginTop: 6,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 8,
            alignSelf: 'flex-start',
        },
        statusText: {
            fontSize: 12,
            fontWeight: '600',
        },
        viewButton: {
            backgroundColor: colors.primary + '15',
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 10,
            flexDirection: 'row',
            alignItems: 'center',
        },
        viewButtonText: {
            color: colors.primary,
            fontWeight: '600',
            marginLeft: 6,
        },
        infoBox: {
            backgroundColor: colors.primary + '10',
            borderRadius: 12,
            padding: 16,
            marginHorizontal: 20,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: colors.primary + '30',
        },
        infoTitle: {
            fontSize: 15,
            fontWeight: '600',
            color: colors.primary,
            marginBottom: 6,
        },
        infoText: {
            fontSize: 14,
            color: colors.text,
            lineHeight: 20,
        },
    });

    const renderStudent = ({ item }: { item: Student }) => (
        <View style={styles.studentCard}>
            <View style={styles.avatar}>
                <User color={colors.primary} size={24} />
            </View>
            <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{item.full_name || 'No name'}</Text>
                <Text style={styles.studentEmail}>{item.email}</Text>
                <View
                    style={[
                        styles.statusBadge,
                        {
                            backgroundColor:
                                item.status === 'active' ? '#22c55e20' : '#6b728020',
                        },
                    ]}
                >
                    <Text
                        style={[
                            styles.statusText,
                            { color: item.status === 'active' ? '#22c55e' : '#6b7280' },
                        ]}
                    >
                        {item.status}
                    </Text>
                </View>
            </View>
            <TouchableOpacity style={styles.viewButton} onPress={() => handleImpersonate(item)}>
                <Eye color={colors.primary} size={18} />
                <Text style={styles.viewButtonText}>View as</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Student Impersonation</Text>
                <Text style={styles.subtitle}>Search and view app as any student</Text>
            </View>

            {/* Info Box */}
            <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>🔍 How to use</Text>
                <Text style={styles.infoText}>
                    Search for a student by name or email, then tap "View as" to see the app exactly as they see it.
                    All data will be shown from their perspective.
                </Text>
            </View>

            {/* Search */}
            <View style={styles.searchContainer}>
                <View style={styles.searchInputContainer}>
                    <Search color={colors.textSecondary} size={22} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by email or name..."
                        placeholderTextColor={colors.textSecondary}
                        value={searchTerm}
                        onChangeText={(text) => {
                            setSearchTerm(text);
                            searchStudents(text);
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                </View>
            </View>

            {/* Results */}
            <View style={styles.content}>
                {loading ? (
                    <View style={styles.emptyState}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                ) : students.length > 0 ? (
                    <FlatList
                        data={students}
                        renderItem={renderStudent}
                        keyExtractor={(item) => item.id}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 20 }}
                    />
                ) : searched ? (
                    <View style={styles.emptyState}>
                        <User color={colors.textSecondary} size={48} />
                        <Text style={styles.emptyText}>No students found</Text>
                        <Text style={styles.emptyHint}>Try a different search term</Text>
                    </View>
                ) : (
                    <View style={styles.emptyState}>
                        <GraduationCap color={colors.textSecondary} size={48} />
                        <Text style={styles.emptyText}>Search for students</Text>
                        <Text style={styles.emptyHint}>Enter at least 2 characters</Text>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}
