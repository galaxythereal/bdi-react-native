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
    startYourJourney: string;
    browsePrograms: string;
    browseAvailablePrograms: string;
    contactInstructor: string;
    getEnrolled: string;
    course: string;
    untitledDiploma: string;
    continueLabel: string;
    startLabel: string;
    failedLoadCourses: string;
    diplomasLabel: string;
    overallProgress: string;
    yourDiploma: string;
    yourDiplomas: string;
    courseLabel: string;
    contactForPricing: string;
    letsGetStarted: string;
    doingGreat: string;
    almostThere: string;
    beginLearningJourney: string;
    keepMomentum: string;
    finishStrong: string;
    aboutProgram: string;
    courseCurriculum: string;
    enrollmentRequiredMessage: string;
    
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
    locked: string;
    inProgress: string;
    notStarted: string;
    enrollIn: string;
    allCoursesStarted: string;
    noCourses: string;
    noCompletedCourses: string;
    noCoursesInProgress: string;
    enrollInCourses: string;
    tryDifferentFilter: string;
    loadingCourses: string;
    myCourses: string;
    all: string;
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
    loadingLeaderboards: string;
    failedLoadLeaderboards: string;
    noRankingsYet: string;
    leaderboardEmptySubtitle: string;
    noRankingsForCourse: string;
    points: string;
    pointsShort: string;
    quizzes: string;
    average: string;
    anonymous: string;
    youLabel: string;
    batchLabel: string;
    diplomaLabel: string;
    
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
    noTicketsSubtitle: string;
    ticketSubmitted: string;
    loadingTickets: string;
    openTicketsCount: string;
    needHelpCreateTicket: string;
    createTicket: string;
    newTicketTitle: string;
    createAction: string;
    ticketSubjectPlaceholder: string;
    ticketMessagePlaceholder: string;
    originalMessageLabel: string;
    loadingMessages: string;
    typeMessagePlaceholder: string;
    sendMessage: string;
    noRepliesYet: string;
    failedLoadTickets: string;
    failedCreateTicket: string;
    failedSendMessage: string;
    validationError: string;
    fillAllFields: string;
    
    // Notifications
    notificationSettings: string;
    pushNotifications: string;
    emailNotifications: string;
    markAllRead: string;
    noNotifications: string;
    newNotification: string;
    loadingNotifications: string;
    markRead: string;
    notificationsCaughtUp: string;
    
    // Downloads
    downloadedContent: string;
    downloading: string;
    downloadComplete: string;
    downloadFailed: string;
    removeDownload: string;
    noDownloads: string;
    offlineAvailable: string;
    downloadedOn: string;
    deleteCourseTitle: string;
    deleteLessonTitle: string;
    clearAllDownloadsTitle: string;
    removeCourseMessage: string;
    removeLessonMessage: string;
    clearAllDownloadsMessage: string;
    clearAllAction: string;
    browseCourses: string;
    noDownloadsYet: string;
    downloadOfflineHint: string;
    goToCourseDownload: string;
    failedDeleteCourse: string;
    failedDeleteLesson: string;
    failedClearDownloads: string;
    failedLoadOfflineData: string;
    
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
    joinNow: string;
    join: string;
    joinQuestion: string;
    viewAll: string;
    started: string;
    startingNow: string;
    in: string;
    liveNow: string;
    happeningNow: string;
    session: string;
    sessionEnded: string;
    sessionStartsIn: string;
    noSessions: string;
    noSessionsSubtitle: string;
    noBatches: string;
    noBatchesSubtitle: string;
    loadingSessions: string;
    noMeetingLink: string;
    sessionsTab: string;
    myBatches: string;
    upcoming: string;

    // Catalog & Enrollment
    diplomaCatalog: string;
    explorePrograms: string;
    searchDiplomas: string;
    noDiplomasFound: string;
    tryDifferentSearch: string;
    checkBackLater: string;
    diplomaOutline: string;
    courseOutline: string;
    enrollmentRequired: string;
    continueLearning: string;
    contactAdminEnrollment: string;
    enrollmentInquiry: string;
    inquirySubtitle: string;
    inquirySubtitleWithTitle: string;
    fullNameLabel: string;
    emailLabel: string;
    phoneNumberLabel: string;
    whatsappNumberLabel: string;
    messageOptionalLabel: string;
    enterFullName: string;
    enterEmail: string;
    enterPhoneNumber: string;
    enterWhatsappNumber: string;
    messagePlaceholder: string;
    fillRequiredFields: string;
    inquirySuccess: string;
    submitInquiryFailed: string;
    submitInquiry: string;
    loadingDiplomas: string;
    
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
    thisWeek: string;
    older: string;
    justNow: string;
    tomorrow: string;
    minutes: string;
    hours: string;
    days: string;
    weeks: string;
    ago: string;
    
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
    startYourJourney: 'Start Your Learning Journey',
    browsePrograms: 'Browse Programs',
    browseAvailablePrograms: 'Browse All Programs',
    contactInstructor: 'Browse our diploma programs below and contact your instructor to get enrolled.',
    getEnrolled: 'Get Enrolled',
    course: 'course',
    untitledDiploma: 'Untitled Diploma',
    continueLabel: 'Continue',
    startLabel: 'Start',
    failedLoadCourses: 'Failed to load courses.',
    diplomasLabel: 'Diplomas',
    overallProgress: 'Overall Progress',
    yourDiploma: 'Your Diploma',
    yourDiplomas: 'Your Diplomas',
    courseLabel: 'Course',
    contactForPricing: 'Contact for pricing',
    letsGetStarted: "Let's get started!",
    doingGreat: "You're doing great!",
    almostThere: 'Almost there!',
    beginLearningJourney: 'Begin your learning journey today',
    keepMomentum: 'Keep up the momentum',
    finishStrong: 'Finish strong and earn your certificates',
    aboutProgram: 'About This Program',
    courseCurriculum: 'Course Curriculum',
    enrollmentRequiredMessage: 'Please enroll in this diploma program to access courses.',
    
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
    locked: 'Locked',
    inProgress: 'In Progress',
    notStarted: 'Not Started',
    enrollIn: 'Enroll In',
    allCoursesStarted: 'All courses started!',
    noCourses: 'No courses yet',
    noCompletedCourses: 'No completed courses',
    noCoursesInProgress: 'No courses in progress',
    enrollInCourses: 'Enroll in courses to start learning',
    tryDifferentFilter: 'Try selecting a different filter',
    loadingCourses: 'Loading courses...',
    myCourses: 'My Courses',
    all: 'All',
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
    loadingLeaderboards: 'Loading leaderboards...',
    failedLoadLeaderboards: 'Failed to load leaderboards',
    noRankingsYet: 'No Rankings Yet',
    leaderboardEmptySubtitle: 'Complete quizzes in your batches to appear on the leaderboard!',
    noRankingsForCourse: 'No rankings available for this course yet.',
    points: 'Points',
    pointsShort: 'pts',
    quizzes: 'Quizzes',
    average: 'Average',
    anonymous: 'Anonymous',
    youLabel: 'You',
    batchLabel: 'Batch',
    diplomaLabel: 'Diploma',
    
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
    noTicketsSubtitle: 'Having issues or questions? Create a support ticket and we will help you out.',
    ticketSubmitted: 'Ticket submitted successfully',
    loadingTickets: 'Loading tickets...',
    openTicketsCount: '{count} open ticket{plural}',
    needHelpCreateTicket: 'Need help? Create a ticket',
    createTicket: 'Create Ticket',
    newTicketTitle: 'New Ticket',
    createAction: 'Create',
    ticketSubjectPlaceholder: 'Enter ticket subject',
    ticketMessagePlaceholder: 'Describe your issue',
    originalMessageLabel: 'Original Message',
    loadingMessages: 'Loading messages...',
    typeMessagePlaceholder: 'Type your message...',
    sendMessage: 'Send',
    noRepliesYet: 'No replies yet',
    failedLoadTickets: 'Failed to load tickets.',
    failedCreateTicket: 'Failed to create ticket.',
    failedSendMessage: 'Failed to send message.',
    validationError: 'Validation Error',
    fillAllFields: 'Please fill in all fields.',
    
    // Notifications
    notificationSettings: 'Notification Settings',
    pushNotifications: 'Push Notifications',
    emailNotifications: 'Email Notifications',
    markAllRead: 'Mark All as Read',
    noNotifications: 'No notifications',
    newNotification: 'New Notification',
    loadingNotifications: 'Loading notifications...',
    markRead: 'Read',
    notificationsCaughtUp: "You're all caught up! We'll notify you when something new happens.",
    
    // Downloads
    downloadedContent: 'Downloaded Content',
    downloading: 'Downloading...',
    downloadComplete: 'Download Complete',
    downloadFailed: 'Download Failed',
    removeDownload: 'Remove Download',
    noDownloads: 'No downloaded content',
    offlineAvailable: 'Available Offline',
    downloadedOn: 'Downloaded',
    deleteCourseTitle: 'Delete Course',
    deleteLessonTitle: 'Delete Lesson',
    clearAllDownloadsTitle: 'Clear All Downloads',
    removeCourseMessage: 'Remove "{title}" and all its downloaded content? This will free up {size}.',
    removeLessonMessage: 'Remove this lesson\'s downloaded content?',
    clearAllDownloadsMessage: 'This will delete all {count} downloaded courses and free up {size}. This cannot be undone.',
    clearAllAction: 'Clear All',
    browseCourses: 'Browse Courses',
    noDownloadsYet: 'No Downloads Yet',
    downloadOfflineHint: 'Download courses to watch them offline.',
    goToCourseDownload: 'Go to a course and tap the download button.',
    failedDeleteCourse: 'Failed to delete course',
    failedDeleteLesson: 'Failed to delete lesson',
    failedClearDownloads: 'Failed to clear downloads',
    failedLoadOfflineData: 'Failed to load offline data',
    
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
    joinNow: 'Join Now',
    join: 'Join',
    joinQuestion: 'Join',
    viewAll: 'View All',
    started: 'Started',
    startingNow: 'Starting now',
    in: 'In',
    liveNow: 'LIVE NOW',
    happeningNow: 'Happening now',
    session: 'session',
    sessionEnded: 'Session Ended',
    sessionStartsIn: 'Starts in',
    noSessions: 'No upcoming sessions',
    noSessionsSubtitle: "When live sessions are scheduled, they'll appear here",
    noBatches: 'No Batches',
    noBatchesSubtitle: "You're not enrolled in any batch programs",
    loadingSessions: 'Loading sessions...',
    noMeetingLink: 'The meeting link is not yet available.',
    sessionsTab: 'Sessions',
    myBatches: 'My Batches',
    upcoming: 'upcoming',

    // Catalog & Enrollment
    diplomaCatalog: 'Diploma Catalog',
    explorePrograms: 'Explore our programs',
    searchDiplomas: 'Search diplomas...',
    noDiplomasFound: 'No diplomas found',
    tryDifferentSearch: 'Try a different search term',
    checkBackLater: 'Check back later for new programs',
    diplomaOutline: 'Diploma Outline',
    courseOutline: 'Course Outline',
    enrollmentRequired: 'Enrollment required',
    continueLearning: 'Continue Learning',
    contactAdminEnrollment: 'Contact your administrator for enrollment',
    enrollmentInquiry: 'Enrollment Inquiry',
    inquirySubtitle: 'Fill out the form below and we will contact you via WhatsApp.',
    inquirySubtitleWithTitle: 'Interested in "{title}"? Fill out the form below and we will contact you via WhatsApp.',
    fullNameLabel: 'Full Name',
    emailLabel: 'Email',
    phoneNumberLabel: 'Phone Number',
    whatsappNumberLabel: 'WhatsApp Number',
    messageOptionalLabel: 'Message (Optional)',
    enterFullName: 'Enter your full name',
    enterEmail: 'Enter your email',
    enterPhoneNumber: 'Enter your phone number',
    enterWhatsappNumber: 'Enter your WhatsApp number',
    messagePlaceholder: 'Any questions or comments?',
    fillRequiredFields: 'Please fill in all required fields',
    inquirySuccess: 'Your inquiry has been submitted. Our team will contact you on WhatsApp shortly.',
    submitInquiryFailed: 'Failed to submit inquiry. Please try again.',
    submitInquiry: 'Submit Inquiry',
    loadingDiplomas: 'Loading diplomas...',
    
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
    thisWeek: 'This Week',
    older: 'Older',
    justNow: 'Just now',
    tomorrow: 'Tomorrow',
    minutes: 'minutes',
    hours: 'hours',
    days: 'days',
    weeks: 'weeks',
    ago: 'ago',
    
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
    startYourJourney: 'ابدأ رحلة التعلم الخاصة بك',
    browsePrograms: 'استعرض البرامج',
    browseAvailablePrograms: 'استعرض جميع البرامج',
    contactInstructor: 'استعرض برامج الدبلومات الخاصة بنا وتواصل مع مدربك للتسجيل.',
    getEnrolled: 'التسجيل',
    course: 'دورة',
    untitledDiploma: 'دبلوم بدون عنوان',
    continueLabel: 'تابع',
    startLabel: 'ابدأ',
    failedLoadCourses: 'فشل تحميل الدورات.',
    diplomasLabel: 'الدبلومات',
    overallProgress: 'التقدم الإجمالي',
    yourDiploma: 'دبلومك',
    yourDiplomas: 'دبلوماتك',
    courseLabel: 'دورة',
    contactForPricing: 'تواصل لمعرفة السعر',
    letsGetStarted: 'لنبدأ!',
    doingGreat: 'أنت تقوم بعمل رائع!',
    almostThere: 'أوشكت على الانتهاء!',
    beginLearningJourney: 'ابدأ رحلة التعلم اليوم',
    keepMomentum: 'حافظ على الزخم',
    finishStrong: 'أنهِ بقوة واحصل على شهاداتك',
    aboutProgram: 'حول هذا البرنامج',
    courseCurriculum: 'منهج الدورات',
    enrollmentRequiredMessage: 'يرجى التسجيل في هذا البرنامج للوصول إلى الدورات.',
    
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
    locked: 'مغلق',
    inProgress: 'قيد التقدم',
    notStarted: 'لم يبدأ',
    enrollIn: 'التسجيل في',
    allCoursesStarted: 'تم بدء جميع الدورات!',
    noCourses: 'لا توجد دورات بعد',
    noCompletedCourses: 'لا توجد دورات مكتملة',
    noCoursesInProgress: 'لا توجد دورات قيد التقدم',
    enrollInCourses: 'سجل في الدورات لبدء التعلم',
    tryDifferentFilter: 'جرب تحديد مرشح مختلف',
    loadingCourses: 'جاري تحميل الدورات...',
    myCourses: 'دوراتي',
    all: 'الكل',
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
    loadingLeaderboards: 'جاري تحميل لوحة المتصدرين...',
    failedLoadLeaderboards: 'فشل تحميل لوحة المتصدرين',
    noRankingsYet: 'لا توجد تصنيفات بعد',
    leaderboardEmptySubtitle: 'أكمل الاختبارات ضمن دفعاتك للظهور في لوحة المتصدرين!',
    noRankingsForCourse: 'لا توجد تصنيفات متاحة لهذه الدورة بعد.',
    points: 'نقاط',
    pointsShort: 'ن',
    quizzes: 'اختبارات',
    average: 'المتوسط',
    anonymous: 'مجهول',
    youLabel: 'أنت',
    batchLabel: 'دفعة',
    diplomaLabel: 'دبلوم',
    
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
    noTicketsSubtitle: 'هل لديك مشكلة أو سؤال؟ أنشئ تذكرة دعم وسنساعدك.',
    ticketSubmitted: 'تم إرسال التذكرة بنجاح',
    loadingTickets: 'جارٍ تحميل التذاكر...',
    openTicketsCount: '{count} تذكرة مفتوحة',
    needHelpCreateTicket: 'تحتاج مساعدة؟ أنشئ تذكرة',
    createTicket: 'إنشاء تذكرة',
    newTicketTitle: 'تذكرة جديدة',
    createAction: 'إنشاء',
    ticketSubjectPlaceholder: 'أدخل موضوع التذكرة',
    ticketMessagePlaceholder: 'اشرح مشكلتك',
    originalMessageLabel: 'الرسالة الأصلية',
    loadingMessages: 'جارٍ تحميل الرسائل...',
    typeMessagePlaceholder: 'اكتب رسالتك...',
    sendMessage: 'إرسال',
    noRepliesYet: 'لا توجد ردود بعد',
    failedLoadTickets: 'فشل تحميل التذاكر.',
    failedCreateTicket: 'فشل إنشاء التذكرة.',
    failedSendMessage: 'فشل إرسال الرسالة.',
    validationError: 'خطأ في التحقق',
    fillAllFields: 'يرجى تعبئة جميع الحقول.',
    
    // Notifications
    notificationSettings: 'إعدادات الإشعارات',
    pushNotifications: 'إشعارات الدفع',
    emailNotifications: 'إشعارات البريد الإلكتروني',
    markAllRead: 'تعليم الكل كمقروء',
    noNotifications: 'لا توجد إشعارات',
    newNotification: 'إشعار جديد',
    loadingNotifications: 'جاري تحميل الإشعارات...',
    markRead: 'تمت القراءة',
    notificationsCaughtUp: 'أنت على اطلاع بكل شيء! سنخطرك عندما يحدث شيء جديد.',
    
    // Downloads
    downloadedContent: 'المحتوى المحمل',
    downloading: 'جارٍ التحميل...',
    downloadComplete: 'اكتمل التحميل',
    downloadFailed: 'فشل التحميل',
    removeDownload: 'إزالة التحميل',
    noDownloads: 'لا يوجد محتوى محمل',
    offlineAvailable: 'متاح بدون اتصال',
    downloadedOn: 'تم التنزيل',
    deleteCourseTitle: 'حذف الدورة',
    deleteLessonTitle: 'حذف الدرس',
    clearAllDownloadsTitle: 'حذف جميع التنزيلات',
    removeCourseMessage: 'هل تريد إزالة "{title}" وجميع محتواه المحمّل؟ سيؤدي ذلك إلى تحرير {size}.',
    removeLessonMessage: 'هل تريد إزالة محتوى هذا الدرس المحمّل؟',
    clearAllDownloadsMessage: 'سيتم حذف جميع الدورات المحمّلة وعددها {count} وتحرير {size}. لا يمكن التراجع عن هذا الإجراء.',
    clearAllAction: 'حذف الكل',
    browseCourses: 'تصفح الدورات',
    noDownloadsYet: 'لا توجد تنزيلات بعد',
    downloadOfflineHint: 'حمّل الدورات لمشاهدتها بدون اتصال.',
    goToCourseDownload: 'اذهب إلى الدورة واضغط زر التنزيل.',
    failedDeleteCourse: 'فشل حذف الدورة',
    failedDeleteLesson: 'فشل حذف الدرس',
    failedClearDownloads: 'فشل حذف التنزيلات',
    failedLoadOfflineData: 'فشل تحميل بيانات عدم الاتصال',
    
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
    joinNow: 'انضم الآن',
    join: 'انضم',
    joinQuestion: 'انضم',
    viewAll: 'عرض الكل',
    started: 'بدأت',
    startingNow: 'تبدأ الآن',
    in: 'بعد',
    liveNow: 'مباشر الآن',
    happeningNow: 'يحدث الآن',
    session: 'جلسة',
    sessionEnded: 'انتهت الجلسة',
    sessionStartsIn: 'تبدأ خلال',
    noSessions: 'لا توجد جلسات قادمة',
    noSessionsSubtitle: 'عند جدولة الجلسات المباشرة ستظهر هنا',
    noBatches: 'لا توجد دفعات',
    noBatchesSubtitle: 'أنت غير مسجل في أي برامج دفعية',
    loadingSessions: 'جاري تحميل الجلسات...',
    noMeetingLink: 'رابط الاجتماع غير متاح بعد.',
    sessionsTab: 'الجلسات',
    myBatches: 'دفعاتي',
    upcoming: 'قادمة',

    // Catalog & Enrollment
    diplomaCatalog: 'كتالوج الدبلومات',
    explorePrograms: 'استكشف برامجنا',
    searchDiplomas: 'ابحث عن الدبلومات...',
    noDiplomasFound: 'لم يتم العثور على دبلومات',
    tryDifferentSearch: 'جرّب مصطلح بحث مختلف',
    checkBackLater: 'تحقق لاحقاً من البرامج الجديدة',
    diplomaOutline: 'مخطط الدبلوم',
    courseOutline: 'مخطط الدورات',
    enrollmentRequired: 'يتطلب التسجيل',
    continueLearning: 'تابع التعلم',
    contactAdminEnrollment: 'تواصل مع الإدارة للتسجيل',
    enrollmentInquiry: 'استفسار التسجيل',
    inquirySubtitle: 'املأ النموذج أدناه وسنتواصل معك عبر واتساب.',
    inquirySubtitleWithTitle: 'مهتم بـ "{title}"؟ املأ النموذج أدناه وسنتواصل معك عبر واتساب.',
    fullNameLabel: 'الاسم الكامل',
    emailLabel: 'البريد الإلكتروني',
    phoneNumberLabel: 'رقم الهاتف',
    whatsappNumberLabel: 'رقم واتساب',
    messageOptionalLabel: 'رسالة (اختياري)',
    enterFullName: 'أدخل اسمك الكامل',
    enterEmail: 'أدخل بريدك الإلكتروني',
    enterPhoneNumber: 'أدخل رقم هاتفك',
    enterWhatsappNumber: 'أدخل رقم واتساب',
    messagePlaceholder: 'أي أسئلة أو ملاحظات؟',
    fillRequiredFields: 'يرجى تعبئة جميع الحقول المطلوبة',
    inquirySuccess: 'تم إرسال استفسارك. سيتواصل فريقنا معك عبر واتساب قريباً.',
    submitInquiryFailed: 'فشل إرسال الاستفسار. يرجى المحاولة مرة أخرى.',
    submitInquiry: 'إرسال الاستفسار',
    loadingDiplomas: 'جارٍ تحميل الدبلومات...',
    
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
    thisWeek: 'هذا الأسبوع',
    older: 'أقدم',
    justNow: 'الآن',
    tomorrow: 'غداً',
    minutes: 'دقائق',
    hours: 'ساعات',
    days: 'أيام',
    weeks: 'أسابيع',
    ago: 'منذ',
    
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
    locale: string;
    formatDate: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
    formatTime: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
    formatDateTime: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
    formatRelativeTime: (date: Date | string | number) => string;
    getLocalizedText: (value?: string | null, valueAr?: string | null) => string;
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

    const locale = language === 'ar' ? 'ar' : 'en-US';

    const formatDate = (date: Date | string | number, options?: Intl.DateTimeFormatOptions) =>
        new Date(date).toLocaleDateString(locale, options);

    const formatTime = (date: Date | string | number, options?: Intl.DateTimeFormatOptions) =>
        new Date(date).toLocaleTimeString(locale, options);

    const formatDateTime = (date: Date | string | number, options?: Intl.DateTimeFormatOptions) =>
        new Date(date).toLocaleString(locale, options);

    const formatNumber = (value: number, options?: Intl.NumberFormatOptions) =>
        new Intl.NumberFormat(locale, options).format(value);

    const formatRelativeTime = (date: Date | string | number) => {
        const target = new Date(date);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - target.getTime()) / 1000);

        if (diffInSeconds < 60) {
            return translations[language].justNow;
        }

        if (diffInSeconds < 3600) {
            const minutes = Math.floor(diffInSeconds / 60);
            return `${formatNumber(minutes)} ${translations[language].minutes} ${translations[language].ago}`;
        }

        if (diffInSeconds < 86400) {
            const hours = Math.floor(diffInSeconds / 3600);
            return `${formatNumber(hours)} ${translations[language].hours} ${translations[language].ago}`;
        }

        if (diffInSeconds < 604800) {
            const days = Math.floor(diffInSeconds / 86400);
            return `${formatNumber(days)} ${translations[language].days} ${translations[language].ago}`;
        }

        return formatDate(target, { month: 'short', day: 'numeric' });
    };

    const getLocalizedText = (value?: string | null, valueAr?: string | null) => {
        if (language === 'ar' && valueAr) {
            return valueAr;
        }
        return value || '';
    };

    const value: LocalizationContextType = {
        language,
        isRTL: language === 'ar',
        t: translations[language],
        locale,
        formatDate,
        formatTime,
        formatDateTime,
        formatNumber,
        formatRelativeTime,
        getLocalizedText,
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
