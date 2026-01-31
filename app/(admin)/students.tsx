import { Theme } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { Eye, GraduationCap, Search, User } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useImpersonation } from '../../src/context/ImpersonationContext';
import { useTheme } from '../../src/context/ThemeContext';
import { supabase } from '../../src/lib/supabase';

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
            backgroundColor: Theme.colors.light.background,
        },
        header: {
            padding: Theme.spacing['2xl'],
            paddingTop: Theme.spacing.base,
        },
        title: {
            fontSize: Theme.fontSize['3xl'],
            fontWeight: Theme.fontWeight.bold,
            color: Theme.colors.light.text,
        },
        subtitle: {
            fontSize: Theme.fontSize.base,
            color: Theme.colors.light.textSecondary,
            marginTop: Theme.spacing.sm,
        },
        searchContainer: {
            paddingHorizontal: Theme.spacing.lg,
            marginBottom: Theme.spacing.base,
        },
        searchInputContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: Theme.colors.light.surface,
            borderRadius: Theme.borderRadius.md,
            paddingHorizontal: Theme.spacing.base,
            borderWidth: 1,
            borderColor: Theme.colors.light.border,
        },
        searchInput: {
            flex: 1,
            paddingVertical: Theme.spacing.base,
            paddingLeft: Theme.spacing.md,
            fontSize: Theme.fontSize.base,
            color: Theme.colors.light.text,
        },
        content: {
            flex: 1,
            paddingHorizontal: Theme.spacing.lg,
        },
        emptyState: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingBottom: 100, // Keep manual padding for centering visual
        },
        emptyText: {
            fontSize: Theme.fontSize.base,
            color: Theme.colors.light.textSecondary,
            marginTop: Theme.spacing.base,
            textAlign: 'center',
        },
        emptyHint: {
            fontSize: Theme.fontSize.sm,
            color: Theme.colors.light.textSecondary,
            marginTop: Theme.spacing.sm,
            opacity: 0.7,
        },
        studentCard: {
            backgroundColor: Theme.colors.light.surface,
            borderRadius: Theme.borderRadius.lg,
            padding: Theme.spacing.base,
            marginBottom: Theme.spacing.md,
            borderWidth: 1,
            borderColor: Theme.colors.light.border,
            flexDirection: 'row',
            alignItems: 'center',
        },
        avatar: {
            width: 52,
            height: 52,
            borderRadius: 26, // Half of width
            backgroundColor: Theme.colors.light.primarySubtle,
            justifyContent: 'center',
            alignItems: 'center',
        },
        studentInfo: {
            flex: 1,
            marginLeft: Theme.spacing.base,
        },
        studentName: {
            fontSize: Theme.fontSize.lg, // Changed from 17 to lg (18)
            fontWeight: Theme.fontWeight.semibold,
            color: Theme.colors.light.text,
        },
        studentEmail: {
            fontSize: Theme.fontSize.sm,
            color: Theme.colors.light.textSecondary,
            marginTop: 2,
        },
        statusBadge: {
            marginTop: 6,
            paddingHorizontal: Theme.spacing.sm,
            paddingVertical: 3,
            borderRadius: Theme.borderRadius.sm,
            alignSelf: 'flex-start',
        },
        statusText: {
            fontSize: Theme.fontSize.xs,
            fontWeight: Theme.fontWeight.semibold,
        },
        viewButton: {
            backgroundColor: 'rgba(219, 0, 17, 0.1)', // Primary with opacity
            paddingHorizontal: Theme.spacing.base,
            paddingVertical: Theme.spacing.sm, // Approx 10
            borderRadius: Theme.borderRadius.sm, // Approx 8-10
            flexDirection: 'row',
            alignItems: 'center',
        },
        viewButtonText: {
            color: Theme.colors.light.primary,
            fontWeight: Theme.fontWeight.semibold,
            marginLeft: 6,
        },
        infoBox: {
            backgroundColor: Theme.colors.light.primarySubtle,
            borderRadius: Theme.borderRadius.md,
            padding: Theme.spacing.base,
            marginHorizontal: Theme.spacing.lg,
            marginBottom: Theme.spacing.lg,
            borderWidth: 1,
            borderColor: 'rgba(219, 0, 17, 0.3)', // Primary border light
        },
        infoTitle: {
            fontSize: Theme.fontSize.base, // Changed from 15 to base (16)
            fontWeight: Theme.fontWeight.semibold,
            color: Theme.colors.light.primary,
            marginBottom: 6,
        },
        infoText: {
            fontSize: Theme.fontSize.sm,
            color: Theme.colors.light.text,
            lineHeight: 20,
        },
    });

    const renderStudent = ({ item }: { item: Student }) => (
        <View style={styles.studentCard}>
            <View style={styles.avatar}>
                <User color={Theme.colors.light.primary} size={24} />
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
