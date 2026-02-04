import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { I18nManager, Alert } from 'react-native';

// Supported languages
export type Language = 'en' | 'ar';

// Translation keys - comprehensive for full app localization
interface Translations {
    // Common
    loading: string;
    error: string;
    success: string;
    cancel: string;
    confirm: string;
    save: string;
    delete: string;
    edit: string;
    back: string;
    next: string;
    search: string;
    filter: string;
    all: string;
    ok: string;
    done: string;
    close: string;
    retry: string;
    seeAll: string;
    noData: string;
    required: string;
    optional: string;
    
    // Auth
    signIn: string;
    signOut: string;
    signUp: string;
    email: string;
    password: string;
    forgotPassword: string;
    welcomeBack: string;
    createAccount: string;
    signOutConfirm: string;
    signingOut: string;
    invalidCredentials: string;
    passwordResetSent: string;
    
    // Navigation
    home: string;
    courses: string;
    profile: string;
    settings: string;
    support: string;
    downloads: string;
    certificates: string;
    rankings: string;
    alerts: string;
    learn: string;
    
    // Dashboard
    welcomeMessage: string;
    continueLearning: string;
    yourProgress: string;
    recentActivity: string;
    upcomingSessions: string;
    viewAllCourses: string;
    noCourses: string;
    startLearning: string;
    
    // Course
    startCourse: string;
    resumeCourse: string;
    completed: string;
    progress: string;
    lessons: string;
    quiz: string;
    video: string;
    text: string;
    audio: string;
    assignment: string;
    chapters: string;
    duration: string;
    instructor: string;
    enrolled: string;
    notEnrolled: string;
    courseDetails: string;
    courseContent: string;
    aboutCourse: string;
    requirements: string;
    whatYouWillLearn: string;
    
    // Lesson
    previousLesson: string;
    nextLesson: string;
    markComplete: string;
    lessonCompleted: string;
    lessonLocked: string;
    unlockLesson: string;
    downloadLesson: string;
    
    // Quiz
    startQuiz: string;
    submitQuiz: string;
    quizResults: string;
    yourScore: string;
    passingScore: string;
    passed: string;
    failed: string;
    tryAgain: string;
    attemptsRemaining: string;
    noAttemptsLeft: string;
    correctAnswers: string;
    timeTaken: string;
    timeRemaining: string;
    questionOf: string;
    
    // Leaderboard
    leaderboard: string;
    yourRank: string;
    topPerformers: string;
    totalPoints: string;
    quizzesCompleted: string;
    perfectScores: string;
    noRankYet: string;
    rankUp: string;
    rankDown: string;
    
    // Profile
    editProfile: string;
    changePassword: string;
    notifications: string;
    language: string;
    appearance: string;
    darkMode: string;
    lightMode: string;
    systemMode: string;
    deleteAccount: string;
    termsPrivacy: string;
    accountSettings: string;
    personalInfo: string;
    fullName: string;
    phone: string;
    updateProfile: string;
    profileUpdated: string;
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    passwordsNotMatch: string;
    passwordUpdated: string;
    passwordMinLength: string;
    
    // Legal & Privacy
    privacyPolicy: string;
    termsOfService: string;
    dataProtection: string;
    yourDataRights: string;
    accessData: string;
    correctData: string;
    deleteData: string;
    exportData: string;
    legalInfo: string;
    lastUpdated: string;
    questionsContact: string;
    
    // Delete Account
    deleteAccountTitle: string;
    deleteAccountWarning: string;
    requestDeletion: string;
    deletionRequested: string;
    deletionConfirmation: string;
    
    // Support
    contactSupport: string;
    submitTicket: string;
    viewTickets: string;
    faq: string;
    ticketSubject: string;
    ticketMessage: string;
    ticketPriority: string;
    priorityLow: string;
    priorityNormal: string;
    priorityHigh: string;
    priorityUrgent: string;
    ticketOpen: string;
    ticketInProgress: string;
    ticketResolved: string;
    ticketClosed: string;
    noTickets: string;
    ticketSubmitted: string;
    
    // Notifications
    notificationSettings: string;
    pushNotifications: string;
    emailNotifications: string;
    markAllRead: string;
    noNotifications: string;
    newNotification: string;
    
    // Downloads
    downloadedContent: string;
    downloading: string;
    downloadComplete: string;
    downloadFailed: string;
    removeDownload: string;
    noDownloads: string;
    offlineAvailable: string;
    
    // Certificates
    myCertificates: string;
    viewCertificate: string;
    downloadCertificate: string;
    shareCertificate: string;
    certificateNumber: string;
    issuedOn: string;
    verificationCode: string;
    noCertificates: string;
    
    // Live Sessions
    liveSessions: string;
    upcomingSession: string;
    joinSession: string;
    sessionEnded: string;
    sessionStartsIn: string;
    noSessions: string;
    
    // Status
    active: string;
    pending: string;
    suspended: string;
    offline: string;
    online: string;
    expired: string;
    
    // Time
    today: string;
    yesterday: string;
    tomorrow: string;
    minutes: string;
    hours: string;
    days: string;
    weeks: string;
    
    // Misc
    comingSoon: string;
    featureComingSoon: string;
    bookmarks: string;
    savedLessons: string;
    restartRequired: string;
    restartMessage: string;
}

// English translations
const en: Translations = {
    // Common
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    cancel: 'Cancel',
    confirm: 'Confirm',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    back: 'Back',
    next: 'Next',
    search: 'Search',
    filter: 'Filter',
    all: 'All',
    ok: 'OK',
    done: 'Done',
    close: 'Close',
    retry: 'Retry',
    seeAll: 'See All',
    noData: 'No data available',
    required: 'Required',
    optional: 'Optional',
    
    // Auth
    signIn: 'Sign In',
    signOut: 'Sign Out',
    signUp: 'Sign Up',
    email: 'Email',
    password: 'Password',
    forgotPassword: 'Forgot Password?',
    welcomeBack: 'Welcome Back',
    createAccount: 'Create Account',
    signOutConfirm: 'Are you sure you want to sign out?',
    signingOut: 'Signing out...',
    invalidCredentials: 'Invalid email or password',
    passwordResetSent: 'Password reset email sent',
    
    // Navigation
    home: 'Home',
    courses: 'Courses',
    profile: 'Profile',
    settings: 'Settings',
    support: 'Support',
    downloads: 'Downloads',
    certificates: 'Certificates',
    rankings: 'Rankings',
    alerts: 'Alerts',
    learn: 'Learn',
    
    // Dashboard
    welcomeMessage: 'Welcome back',
    continueLearning: 'Continue Learning',
    yourProgress: 'Your Progress',
    recentActivity: 'Recent Activity',
    upcomingSessions: 'Upcoming Sessions',
    viewAllCourses: 'View All Courses',
    noCourses: 'No courses yet',
    startLearning: 'Start Learning',
    
    // Course
    startCourse: 'Start Course',
    resumeCourse: 'Resume Course',
    completed: 'Completed',
    progress: 'Progress',
    lessons: 'Lessons',
    quiz: 'Quiz',
    video: 'Video',
    text: 'Text',
    audio: 'Audio',
    assignment: 'Assignment',
    chapters: 'Chapters',
    duration: 'Duration',
    instructor: 'Instructor',
    enrolled: 'Enrolled',
    notEnrolled: 'Not Enrolled',
    courseDetails: 'Course Details',
    courseContent: 'Course Content',
    aboutCourse: 'About This Course',
    requirements: 'Requirements',
    whatYouWillLearn: 'What You Will Learn',
    
    // Lesson
    previousLesson: 'Previous Lesson',
    nextLesson: 'Next Lesson',
    markComplete: 'Mark as Complete',
    lessonCompleted: 'Lesson Completed!',
    lessonLocked: 'Lesson Locked',
    unlockLesson: 'Complete previous lessons to unlock',
    downloadLesson: 'Download Lesson',
    
    // Quiz
    startQuiz: 'Start Quiz',
    submitQuiz: 'Submit Quiz',
    quizResults: 'Quiz Results',
    yourScore: 'Your Score',
    passingScore: 'Passing Score',
    passed: 'Passed',
    failed: 'Failed',
    tryAgain: 'Try Again',
    attemptsRemaining: 'Attempts Remaining',
    noAttemptsLeft: 'No attempts left',
    correctAnswers: 'Correct Answers',
    timeTaken: 'Time Taken',
    timeRemaining: 'Time Remaining',
    questionOf: 'Question {current} of {total}',
    
    // Leaderboard
    leaderboard: 'Leaderboard',
    yourRank: 'Your Rank',
    topPerformers: 'Top Performers',
    totalPoints: 'Total Points',
    quizzesCompleted: 'Quizzes Completed',
    perfectScores: 'Perfect Scores',
    noRankYet: 'Complete quizzes to get ranked',
    rankUp: 'Moved up',
    rankDown: 'Moved down',
    
    // Profile
    editProfile: 'Edit Profile',
    changePassword: 'Change Password',
    notifications: 'Notifications',
    language: 'Language',
    appearance: 'Appearance',
    darkMode: 'Dark Mode',
    lightMode: 'Light Mode',
    systemMode: 'System',
    deleteAccount: 'Delete Account',
    termsPrivacy: 'Terms & Privacy',
    accountSettings: 'Account Settings',
    personalInfo: 'Personal Information',
    fullName: 'Full Name',
    phone: 'Phone Number',
    updateProfile: 'Update Profile',
    profileUpdated: 'Profile updated successfully',
    currentPassword: 'Current Password',
    newPassword: 'New Password',
    confirmPassword: 'Confirm Password',
    passwordsNotMatch: 'Passwords do not match',
    passwordUpdated: 'Password updated successfully',
    passwordMinLength: 'Password must be at least 6 characters',
    
    // Legal & Privacy
    privacyPolicy: 'Privacy Policy',
    termsOfService: 'Terms of Service',
    dataProtection: 'Data Protection',
    yourDataRights: 'Your Data Rights',
    accessData: 'Access',
    correctData: 'Correct',
    deleteData: 'Delete',
    exportData: 'Export',
    legalInfo: 'Legal Information',
    lastUpdated: 'Last updated',
    questionsContact: 'If you have questions, contact us at',
    
    // Delete Account
    deleteAccountTitle: 'Delete Account',
    deleteAccountWarning: 'Are you sure you want to delete your account? This action cannot be undone. All your data, progress, and certificates will be permanently deleted.',
    requestDeletion: 'Request Deletion',
    deletionRequested: 'Deletion Requested',
    deletionConfirmation: 'Your account deletion request has been submitted. Your account will be deleted within 30 days.',
    
    // Support
    contactSupport: 'Contact Support',
    submitTicket: 'Submit Ticket',
    viewTickets: 'View Tickets',
    faq: 'FAQ',
    ticketSubject: 'Subject',
    ticketMessage: 'Message',
    ticketPriority: 'Priority',
    priorityLow: 'Low',
    priorityNormal: 'Normal',
    priorityHigh: 'High',
    priorityUrgent: 'Urgent',
    ticketOpen: 'Open',
    ticketInProgress: 'In Progress',
    ticketResolved: 'Resolved',
    ticketClosed: 'Closed',
    noTickets: 'No support tickets',
    ticketSubmitted: 'Ticket submitted successfully',
    
    // Notifications
    notificationSettings: 'Notification Settings',
    pushNotifications: 'Push Notifications',
    emailNotifications: 'Email Notifications',
    markAllRead: 'Mark All as Read',
    noNotifications: 'No notifications',
    newNotification: 'New Notification',
    
    // Downloads
    downloadedContent: 'Downloaded Content',
    downloading: 'Downloading...',
    downloadComplete: 'Download Complete',
    downloadFailed: 'Download Failed',
    removeDownload: 'Remove Download',
    noDownloads: 'No downloaded content',
    offlineAvailable: 'Available Offline',
    
    // Certificates
    myCertificates: 'My Certificates',
    viewCertificate: 'View Certificate',
    downloadCertificate: 'Download Certificate',
    shareCertificate: 'Share Certificate',
    certificateNumber: 'Certificate Number',
    issuedOn: 'Issued On',
    verificationCode: 'Verification Code',
    noCertificates: 'No certificates yet',
    
    // Live Sessions
    liveSessions: 'Live Sessions',
    upcomingSession: 'Upcoming Session',
    joinSession: 'Join Session',
    sessionEnded: 'Session Ended',
    sessionStartsIn: 'Starts in',
    noSessions: 'No upcoming sessions',
    
    // Status
    active: 'Active',
    pending: 'Pending',
    suspended: 'Suspended',
    offline: 'Offline',
    online: 'Online',
    expired: 'Expired',
    
    // Time
    today: 'Today',
    yesterday: 'Yesterday',
    tomorrow: 'Tomorrow',
    minutes: 'minutes',
    hours: 'hours',
    days: 'days',
    weeks: 'weeks',
    
    // Misc
    comingSoon: 'Coming Soon',
    featureComingSoon: 'This feature is coming soon!',
    bookmarks: 'Bookmarks',
    savedLessons: 'Saved lessons and resources',
    restartRequired: 'Restart Required',
    restartMessage: 'Please restart the app to apply the language change.',
};

// Arabic translations
const ar: Translations = {
    // Common
    loading: 'جارٍ التحميل...',
    error: 'خطأ',
    success: 'نجاح',
    cancel: 'إلغاء',
    confirm: 'تأكيد',
    save: 'حفظ',
    delete: 'حذف',
    edit: 'تعديل',
    back: 'رجوع',
    next: 'التالي',
    search: 'بحث',
    filter: 'تصفية',
    all: 'الكل',
    ok: 'حسناً',
    done: 'تم',
    close: 'إغلاق',
    retry: 'إعادة المحاولة',
    seeAll: 'عرض الكل',
    noData: 'لا توجد بيانات',
    required: 'مطلوب',
    optional: 'اختياري',
    
    // Auth
    signIn: 'تسجيل الدخول',
    signOut: 'تسجيل الخروج',
    signUp: 'إنشاء حساب',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    forgotPassword: 'نسيت كلمة المرور؟',
    welcomeBack: 'مرحباً بعودتك',
    createAccount: 'إنشاء حساب جديد',
    signOutConfirm: 'هل أنت متأكد من تسجيل الخروج؟',
    signingOut: 'جارٍ تسجيل الخروج...',
    invalidCredentials: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
    passwordResetSent: 'تم إرسال رابط إعادة تعيين كلمة المرور',
    
    // Navigation
    home: 'الرئيسية',
    courses: 'الدورات',
    profile: 'الملف الشخصي',
    settings: 'الإعدادات',
    support: 'الدعم',
    downloads: 'التنزيلات',
    certificates: 'الشهادات',
    rankings: 'الترتيب',
    alerts: 'التنبيهات',
    learn: 'تعلم',
    
    // Dashboard
    welcomeMessage: 'مرحباً بعودتك',
    continueLearning: 'متابعة التعلم',
    yourProgress: 'تقدمك',
    recentActivity: 'النشاط الأخير',
    upcomingSessions: 'الجلسات القادمة',
    viewAllCourses: 'عرض جميع الدورات',
    noCourses: 'لا توجد دورات بعد',
    startLearning: 'ابدأ التعلم',
    
    // Course
    startCourse: 'بدء الدورة',
    resumeCourse: 'متابعة الدورة',
    completed: 'مكتمل',
    progress: 'التقدم',
    lessons: 'الدروس',
    quiz: 'اختبار',
    video: 'فيديو',
    text: 'نص',
    audio: 'صوت',
    assignment: 'مهمة',
    chapters: 'الفصول',
    duration: 'المدة',
    instructor: 'المدرب',
    enrolled: 'مسجل',
    notEnrolled: 'غير مسجل',
    courseDetails: 'تفاصيل الدورة',
    courseContent: 'محتوى الدورة',
    aboutCourse: 'عن هذه الدورة',
    requirements: 'المتطلبات',
    whatYouWillLearn: 'ماذا ستتعلم',
    
    // Lesson
    previousLesson: 'الدرس السابق',
    nextLesson: 'الدرس التالي',
    markComplete: 'وضع علامة مكتمل',
    lessonCompleted: 'تم إكمال الدرس!',
    lessonLocked: 'الدرس مقفل',
    unlockLesson: 'أكمل الدروس السابقة للفتح',
    downloadLesson: 'تحميل الدرس',
    
    // Quiz
    startQuiz: 'بدء الاختبار',
    submitQuiz: 'تقديم الاختبار',
    quizResults: 'نتائج الاختبار',
    yourScore: 'درجتك',
    passingScore: 'درجة النجاح',
    passed: 'نجحت',
    failed: 'لم تنجح',
    tryAgain: 'حاول مرة أخرى',
    attemptsRemaining: 'المحاولات المتبقية',
    noAttemptsLeft: 'لا توجد محاولات متبقية',
    correctAnswers: 'الإجابات الصحيحة',
    timeTaken: 'الوقت المستغرق',
    timeRemaining: 'الوقت المتبقي',
    questionOf: 'السؤال {current} من {total}',
    
    // Leaderboard
    leaderboard: 'لوحة المتصدرين',
    yourRank: 'ترتيبك',
    topPerformers: 'أفضل المتعلمين',
    totalPoints: 'إجمالي النقاط',
    quizzesCompleted: 'الاختبارات المكتملة',
    perfectScores: 'الدرجات الكاملة',
    noRankYet: 'أكمل الاختبارات للحصول على ترتيب',
    rankUp: 'ارتفع',
    rankDown: 'انخفض',
    
    // Profile
    editProfile: 'تعديل الملف الشخصي',
    changePassword: 'تغيير كلمة المرور',
    notifications: 'الإشعارات',
    language: 'اللغة',
    appearance: 'المظهر',
    darkMode: 'الوضع المظلم',
    lightMode: 'الوضع الفاتح',
    systemMode: 'حسب النظام',
    deleteAccount: 'حذف الحساب',
    termsPrivacy: 'الشروط والخصوصية',
    accountSettings: 'إعدادات الحساب',
    personalInfo: 'المعلومات الشخصية',
    fullName: 'الاسم الكامل',
    phone: 'رقم الهاتف',
    updateProfile: 'تحديث الملف الشخصي',
    profileUpdated: 'تم تحديث الملف الشخصي بنجاح',
    currentPassword: 'كلمة المرور الحالية',
    newPassword: 'كلمة المرور الجديدة',
    confirmPassword: 'تأكيد كلمة المرور',
    passwordsNotMatch: 'كلمات المرور غير متطابقة',
    passwordUpdated: 'تم تحديث كلمة المرور بنجاح',
    passwordMinLength: 'يجب أن تكون كلمة المرور 6 أحرف على الأقل',
    
    // Legal & Privacy
    privacyPolicy: 'سياسة الخصوصية',
    termsOfService: 'شروط الخدمة',
    dataProtection: 'حماية البيانات',
    yourDataRights: 'حقوق بياناتك',
    accessData: 'الوصول',
    correctData: 'التصحيح',
    deleteData: 'الحذف',
    exportData: 'التصدير',
    legalInfo: 'المعلومات القانونية',
    lastUpdated: 'آخر تحديث',
    questionsContact: 'إذا كان لديك أسئلة، تواصل معنا على',
    
    // Delete Account
    deleteAccountTitle: 'حذف الحساب',
    deleteAccountWarning: 'هل أنت متأكد من حذف حسابك؟ لا يمكن التراجع عن هذا الإجراء. سيتم حذف جميع بياناتك وتقدمك وشهاداتك بشكل دائم.',
    requestDeletion: 'طلب الحذف',
    deletionRequested: 'تم طلب الحذف',
    deletionConfirmation: 'تم تقديم طلب حذف حسابك. سيتم حذف حسابك خلال 30 يوماً.',
    
    // Support
    contactSupport: 'تواصل مع الدعم',
    submitTicket: 'إرسال تذكرة',
    viewTickets: 'عرض التذاكر',
    faq: 'الأسئلة الشائعة',
    ticketSubject: 'الموضوع',
    ticketMessage: 'الرسالة',
    ticketPriority: 'الأولوية',
    priorityLow: 'منخفضة',
    priorityNormal: 'عادية',
    priorityHigh: 'عالية',
    priorityUrgent: 'عاجلة',
    ticketOpen: 'مفتوحة',
    ticketInProgress: 'قيد التنفيذ',
    ticketResolved: 'تم الحل',
    ticketClosed: 'مغلقة',
    noTickets: 'لا توجد تذاكر دعم',
    ticketSubmitted: 'تم إرسال التذكرة بنجاح',
    
    // Notifications
    notificationSettings: 'إعدادات الإشعارات',
    pushNotifications: 'إشعارات الدفع',
    emailNotifications: 'إشعارات البريد الإلكتروني',
    markAllRead: 'تعليم الكل كمقروء',
    noNotifications: 'لا توجد إشعارات',
    newNotification: 'إشعار جديد',
    
    // Downloads
    downloadedContent: 'المحتوى المحمل',
    downloading: 'جارٍ التحميل...',
    downloadComplete: 'اكتمل التحميل',
    downloadFailed: 'فشل التحميل',
    removeDownload: 'إزالة التحميل',
    noDownloads: 'لا يوجد محتوى محمل',
    offlineAvailable: 'متاح بدون اتصال',
    
    // Certificates
    myCertificates: 'شهاداتي',
    viewCertificate: 'عرض الشهادة',
    downloadCertificate: 'تحميل الشهادة',
    shareCertificate: 'مشاركة الشهادة',
    certificateNumber: 'رقم الشهادة',
    issuedOn: 'صدرت في',
    verificationCode: 'رمز التحقق',
    noCertificates: 'لا توجد شهادات بعد',
    
    // Live Sessions
    liveSessions: 'الجلسات المباشرة',
    upcomingSession: 'جلسة قادمة',
    joinSession: 'انضم للجلسة',
    sessionEnded: 'انتهت الجلسة',
    sessionStartsIn: 'تبدأ خلال',
    noSessions: 'لا توجد جلسات قادمة',
    
    // Status
    active: 'نشط',
    pending: 'قيد الانتظار',
    suspended: 'موقوف',
    offline: 'غير متصل',
    online: 'متصل',
    expired: 'منتهي',
    
    // Time
    today: 'اليوم',
    yesterday: 'أمس',
    tomorrow: 'غداً',
    minutes: 'دقائق',
    hours: 'ساعات',
    days: 'أيام',
    weeks: 'أسابيع',
    
    // Misc
    comingSoon: 'قريباً',
    featureComingSoon: 'هذه الميزة قادمة قريباً!',
    bookmarks: 'المفضلة',
    savedLessons: 'الدروس والموارد المحفوظة',
    restartRequired: 'إعادة التشغيل مطلوبة',
    restartMessage: 'يرجى إعادة تشغيل التطبيق لتطبيق تغيير اللغة.',
};

const translations: Record<Language, Translations> = { en, ar };

interface LocalizationContextType {
    language: Language;
    isRTL: boolean;
    t: Translations;
    setLanguage: (lang: Language) => Promise<void>;
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

const LANGUAGE_KEY = '@bdi_language';

interface LocalizationProviderProps {
    children: ReactNode;
}

export function LocalizationProvider({ children }: LocalizationProviderProps) {
    const [language, setLanguageState] = useState<Language>('en');
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        loadSavedLanguage();
    }, []);

    const loadSavedLanguage = async () => {
        try {
            const savedLang = await AsyncStorage.getItem(LANGUAGE_KEY);
            if (savedLang === 'ar' || savedLang === 'en') {
                setLanguageState(savedLang);
                // Set RTL on app load based on saved language
                const isRTL = savedLang === 'ar';
                if (I18nManager.isRTL !== isRTL) {
                    I18nManager.allowRTL(isRTL);
                    I18nManager.forceRTL(isRTL);
                }
            }
        } catch (error) {
            console.error('Error loading saved language:', error);
        } finally {
            setIsInitialized(true);
        }
    };

    const setLanguage = async (lang: Language) => {
        try {
            await AsyncStorage.setItem(LANGUAGE_KEY, lang);
            setLanguageState(lang);
            
            const isRTL = lang === 'ar';
            
            // Apply RTL settings without requiring restart using react-native-reanimated
            // The layout direction change will be handled by React context re-render
            if (I18nManager.isRTL !== isRTL) {
                I18nManager.allowRTL(isRTL);
                I18nManager.forceRTL(isRTL);
                
                // For full RTL change on Android, a restart is needed
                // But we can minimize the impact by updating context-aware styles
                // Alert only if the system RTL doesn't match
                Alert.alert(
                    lang === 'ar' ? 'إعادة التشغيل مطلوبة' : 'Restart Required',
                    lang === 'ar' 
                        ? 'يرجى إعادة تشغيل التطبيق لتطبيق تغيير اللغة بالكامل.'
                        : 'Please restart the app to fully apply the language change.',
                    [{ text: lang === 'ar' ? 'حسناً' : 'OK' }]
                );
            }
        } catch (error) {
            console.error('Error setting language:', error);
        }
    };

    const value: LocalizationContextType = {
        language,
        isRTL: language === 'ar',
        t: translations[language],
        setLanguage,
    };

    if (!isInitialized) {
        return null; // Or a loading spinner
    }

    return (
        <LocalizationContext.Provider value={value}>
            {children}
        </LocalizationContext.Provider>
    );
}

export function useLocalization() {
    const context = useContext(LocalizationContext);
    if (context === undefined) {
        throw new Error('useLocalization must be used within a LocalizationProvider');
    }
    return context;
}

// Helper function to get text alignment based on RTL
export function getTextAlign(isRTL: boolean): 'left' | 'right' {
    return isRTL ? 'right' : 'left';
}

// Helper function to get flex direction based on RTL
export function getFlexDirection(isRTL: boolean): 'row' | 'row-reverse' {
    return isRTL ? 'row-reverse' : 'row';
}

// Helper to transform horizontal styles for RTL
export function transformRTL(isRTL: boolean, style: any) {
    if (!isRTL) return style;
    
    const transformed = { ...style };
    
    // Swap left/right properties
    if ('marginLeft' in style || 'marginRight' in style) {
        transformed.marginLeft = style.marginRight;
        transformed.marginRight = style.marginLeft;
    }
    
    if ('paddingLeft' in style || 'paddingRight' in style) {
        transformed.paddingLeft = style.paddingRight;
        transformed.paddingRight = style.paddingLeft;
    }
    
    if ('left' in style || 'right' in style) {
        transformed.left = style.right;
        transformed.right = style.left;
    }
    
    return transformed;
}

// Dynamic style helpers for RTL-aware components
export function useRTLStyles() {
    const { isRTL } = useLocalization();
    
    return {
        textAlign: getTextAlign(isRTL),
        flexDirection: getFlexDirection(isRTL),
        isRTL,
        // Common RTL-aware style shortcuts
        row: { flexDirection: isRTL ? 'row-reverse' : 'row' } as const,
        marginStart: (value: number) => isRTL ? { marginRight: value } : { marginLeft: value },
        marginEnd: (value: number) => isRTL ? { marginLeft: value } : { marginRight: value },
        paddingStart: (value: number) => isRTL ? { paddingRight: value } : { paddingLeft: value },
        paddingEnd: (value: number) => isRTL ? { paddingLeft: value } : { paddingRight: value },
        start: (value: number) => isRTL ? { right: value } : { left: value },
        end: (value: number) => isRTL ? { left: value } : { right: value },
        // Icon transform for RTL
        iconTransform: isRTL ? [{ scaleX: -1 }] : [],
    };
}
