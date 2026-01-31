import { Theme } from '@/constants/theme';
import { Award, BookOpen, TrendingUp, Users } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/features/auth/AuthContext';
import { supabase } from '../../src/lib/supabase';

interface DashboardStats {
    totalStudents: number;
    activeEnrollments: number;
    totalCourses: number;
    completedEnrollments: number;
}

export default function AdminDashboard() {
    const { colors } = useTheme();
    const { userProfile } = useAuth();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            // Get total students
            const { count: studentCount } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('role', 'student');

            // Get active enrollments
            const { count: activeCount } = await supabase
                .from('diploma_enrollments')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'active');

            // Get total courses
            const { count: courseCount } = await supabase
                .from('courses')
                .select('*', { count: 'exact', head: true });

            // Get completed enrollments
            const { count: completedCount } = await supabase
                .from('diploma_enrollments')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'completed');

            setStats({
                totalStudents: studentCount || 0,
                activeEnrollments: activeCount || 0,
                totalCourses: courseCount || 0,
                completedEnrollments: completedCount || 0,
            });
        } catch (error) {
            console.error('Error loading stats:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadStats();
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
        greeting: {
            fontSize: 14,
            color: colors.textSecondary,
            marginBottom: 4,
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
        content: {
            paddingHorizontal: 20,
        },
        sectionTitle: {
            fontSize: 18,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 16,
        },
        statsGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            marginHorizontal: -8,
        },
        statCard: {
            width: '50%',
            padding: 8,
        },
        statCardInner: {
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: colors.border,
        },
        statIcon: {
            width: 48,
            height: 48,
            borderRadius: 12,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 12,
        },
        statValue: {
            fontSize: 32,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 4,
        },
        statLabel: {
            fontSize: 14,
            color: colors.textSecondary,
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
        },
    });

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Loading dashboard...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                }
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.greeting}>Welcome back,</Text>
                    <Text style={styles.title}>{userProfile?.full_name || 'Admin'}</Text>
                    <Text style={styles.subtitle}>Admin Dashboard • Mobile View</Text>
                </View>

                {/* Stats Grid */}
                <View style={styles.content}>
                    <Text style={styles.sectionTitle}>Quick Stats</Text>

                    <View style={styles.statsGrid}>
                        <View style={styles.statCard}>
                            <View style={styles.statCardInner}>
                                <View style={[styles.statIcon, { backgroundColor: Theme.colors.light.primarySubtle }]}>
                                    <Users color={colors.primary} size={24} />
                                </View>
                                <Text style={styles.statValue}>{stats?.totalStudents || 0}</Text>
                                <Text style={styles.statLabel}>Total Students</Text>
                            </View>
                        </View>

                        <View style={styles.statCard}>
                            <View style={styles.statCardInner}>
                                <View style={[styles.statIcon, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
                                    <TrendingUp color="#22c55e" size={24} />
                                </View>
                                <Text style={styles.statValue}>{stats?.activeEnrollments || 0}</Text>
                                <Text style={styles.statLabel}>Active Enrollments</Text>
                            </View>
                        </View>

                        <View style={styles.statCard}>
                            <View style={styles.statCardInner}>
                                <View style={[styles.statIcon, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                                    <BookOpen color="#3b82f6" size={24} />
                                </View>
                                <Text style={styles.statValue}>{stats?.totalCourses || 0}</Text>
                                <Text style={styles.statLabel}>Total Courses</Text>
                            </View>
                        </View>

                        <View style={styles.statCard}>
                            <View style={styles.statCardInner}>
                                <View style={[styles.statIcon, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                                    <Award color="#f59e0b" size={24} />
                                </View>
                                <Text style={styles.statValue}>{stats?.completedEnrollments || 0}</Text>
                                <Text style={styles.statLabel}>Completed</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Info Section */}
                <View style={[styles.content, { marginTop: Theme.spacing.xl, paddingBottom: 40 }]}>
                    <View style={[styles.statCardInner, { backgroundColor: Theme.colors.light.primarySubtle }]}>
                        <Text style={[styles.sectionTitle, { marginBottom: Theme.spacing.xs, color: colors.primary }]}>
                            Student Impersonation
                        </Text>
                        <Text style={{ color: colors.text, lineHeight: 22 }}>
                            Go to the "Students" tab to search and view the app as any student.
                            This lets you see exactly what they see for support purposes.
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
