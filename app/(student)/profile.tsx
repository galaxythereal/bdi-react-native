import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { useAuth } from '../../src/features/auth/AuthContext';
import { BORDER_RADIUS, COLORS, FONT_SIZE, FONT_WEIGHT, SHADOWS, SPACING } from '../../src/lib/constants';

export default function ProfileScreen() {
    const { signOut, session } = useAuth();

    const menuItems = [
        { icon: 'person-outline', label: 'Edit Profile', onPress: () => {} },
        { icon: 'notifications-outline', label: 'Notifications', onPress: () => {} },
        { icon: 'settings-outline', label: 'Settings', onPress: () => {} },
        { icon: 'help-circle-outline', label: 'Help & Support', onPress: () => {} },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView 
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {session?.user.email?.charAt(0).toUpperCase() || 'U'}
                        </Text>
                    </View>
                    <Text style={styles.email}>{session?.user.email}</Text>
                    <Text style={styles.role}>Student</Text>
                </View>

                <Card style={styles.statsCard}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>0</Text>
                        <Text style={styles.statLabel}>Courses</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>0%</Text>
                        <Text style={styles.statLabel}>Progress</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>0</Text>
                        <Text style={styles.statLabel}>Certificates</Text>
                    </View>
                </Card>

                <View style={styles.menuSection}>
                    {menuItems.map((item, index) => (
                        <TouchableOpacity
                            key={index}
                            style={styles.menuItem}
                            onPress={item.onPress}
                            activeOpacity={0.7}
                        >
                            <View style={styles.menuItemLeft}>
                                <Ionicons name={item.icon as any} size={24} color={COLORS.text} />
                                <Text style={styles.menuItemText}>{item.label}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.signOutSection}>
                    <Button 
                        title="Sign Out" 
                        onPress={signOut} 
                        variant="outline"
                        style={styles.signOutButton}
                    />
                </View>

                <Text style={styles.version}>Version 1.0.0</Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        padding: SPACING.lg,
    },
    header: {
        alignItems: 'center',
        marginVertical: SPACING.xl,
    },
    avatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.lg,
        ...SHADOWS.lg,
    },
    avatarText: {
        fontSize: 48,
        fontWeight: FONT_WEIGHT.extrabold,
        color: COLORS.surface,
    },
    email: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        marginBottom: SPACING.xs,
    },
    role: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        fontWeight: FONT_WEIGHT.semibold,
    },
    statsCard: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingVertical: SPACING.xl,
        marginBottom: SPACING.xl,
        ...SHADOWS.sm,
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statValue: {
        fontSize: FONT_SIZE.xxl,
        fontWeight: FONT_WEIGHT.extrabold,
        color: COLORS.primary,
        marginBottom: SPACING.xs,
    },
    statLabel: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
        fontWeight: FONT_WEIGHT.medium,
    },
    statDivider: {
        width: 1,
        height: 40,
        backgroundColor: COLORS.border,
    },
    menuSection: {
        marginBottom: SPACING.xl,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: SPACING.lg,
        paddingHorizontal: SPACING.lg,
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        marginBottom: SPACING.md,
        ...SHADOWS.sm,
    },
    menuItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
    },
    menuItemText: {
        fontSize: FONT_SIZE.md,
        color: COLORS.text,
        fontWeight: FONT_WEIGHT.semibold,
    },
    signOutSection: {
        marginTop: SPACING.md,
        marginBottom: SPACING.lg,
    },
    signOutButton: {
        width: '100%',
    },
    version: {
        textAlign: 'center',
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.sm,
        marginTop: SPACING.lg,
        marginBottom: SPACING.xl,
    },
});
