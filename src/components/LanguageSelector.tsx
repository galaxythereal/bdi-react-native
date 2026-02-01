import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Theme from '../../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { Language, useLocalization } from '../context/LocalizationContext';

interface LanguageSelectorProps {
    visible: boolean;
    onClose: () => void;
}

interface LanguageOption {
    code: Language;
    name: string;
    nativeName: string;
    flag: string;
}

const languages: LanguageOption[] = [
    { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
];

export function LanguageSelector({ visible, onClose }: LanguageSelectorProps) {
    const { colors, isDark } = useTheme();
    const { language, setLanguage } = useLocalization();
    const styles = React.useMemo(() => createStyles(colors, isDark), [colors, isDark]);

    const handleSelectLanguage = async (lang: Language) => {
        if (lang !== language) {
            await setLanguage(lang);
        }
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity
                style={styles.overlay}
                activeOpacity={1}
                onPress={onClose}
            >
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Select Language</Text>
                        <Text style={styles.subtitle}>اختر اللغة</Text>
                    </View>

                    <View style={styles.languageList}>
                        {languages.map((lang) => (
                            <TouchableOpacity
                                key={lang.code}
                                style={[
                                    styles.languageItem,
                                    language === lang.code && styles.languageItemActive,
                                ]}
                                onPress={() => handleSelectLanguage(lang.code)}
                            >
                                <Text style={styles.flag}>{lang.flag}</Text>
                                <View style={styles.languageInfo}>
                                    <Text style={[
                                        styles.languageName,
                                        language === lang.code && styles.languageNameActive,
                                    ]}>
                                        {lang.name}
                                    </Text>
                                    <Text style={styles.nativeName}>{lang.nativeName}</Text>
                                </View>
                                {language === lang.code && (
                                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={styles.note}>
                        <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
                        <Text style={styles.noteText}>
                            Changing the language will restart the app to apply RTL layout changes.
                        </Text>
                    </View>

                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Text style={styles.closeButtonText}>Close</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: Theme.spacing.lg,
    },
    container: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: colors.surface,
        borderRadius: Theme.borderRadius.xl,
        padding: Theme.spacing.lg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    header: {
        alignItems: 'center',
        marginBottom: Theme.spacing.lg,
    },
    title: {
        fontSize: Theme.fontSize.xl,
        fontWeight: Theme.fontWeight.bold,
        color: colors.text,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: Theme.fontSize.base,
        color: colors.textSecondary,
    },
    languageList: {
        gap: Theme.spacing.sm,
    },
    languageItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Theme.spacing.md,
        borderRadius: Theme.borderRadius.lg,
        backgroundColor: colors.background,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    languageItemActive: {
        borderColor: colors.primary,
        backgroundColor: colors.primary + '10',
    },
    flag: {
        fontSize: 32,
        marginRight: Theme.spacing.md,
    },
    languageInfo: {
        flex: 1,
    },
    languageName: {
        fontSize: Theme.fontSize.base,
        fontWeight: Theme.fontWeight.semibold,
        color: colors.text,
    },
    languageNameActive: {
        color: colors.primary,
    },
    nativeName: {
        fontSize: Theme.fontSize.sm,
        color: colors.textSecondary,
        marginTop: 2,
    },
    note: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Theme.spacing.xs,
        marginTop: Theme.spacing.lg,
        padding: Theme.spacing.sm,
        backgroundColor: colors.background,
        borderRadius: Theme.borderRadius.md,
    },
    noteText: {
        flex: 1,
        fontSize: Theme.fontSize.xs,
        color: colors.textSecondary,
        lineHeight: 18,
    },
    closeButton: {
        marginTop: Theme.spacing.lg,
        paddingVertical: Theme.spacing.md,
        backgroundColor: colors.background,
        borderRadius: Theme.borderRadius.lg,
        alignItems: 'center',
    },
    closeButtonText: {
        fontSize: Theme.fontSize.base,
        fontWeight: Theme.fontWeight.semibold,
        color: colors.text,
    },
});
