import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Batch, CatalogDiploma, DiplomaDetail, Enrollment, LiveSession } from '../../types';
import { checkIsOnline } from '../offline/offlineManager';

const CACHE_KEY_CATALOG = 'bdi_diploma_catalog';
const CACHE_KEY_ENROLLMENTS = 'bdi_diploma_enrollments';
const CACHE_KEY_BATCHES = 'bdi_my_batches';

/**
 * Fetch all published diplomas for the catalog
 */
export const fetchDiplomaCatalog = async (): Promise<CatalogDiploma[]> => {
    try {
        const isOnline = await checkIsOnline();

        if (!isOnline) {
            const cached = await AsyncStorage.getItem(CACHE_KEY_CATALOG);
            if (cached) {
                return JSON.parse(cached);
            }
            return [];
        }

        const { data: diplomas, error } = await supabase
            .from('diplomas')
            .select(`
                id,
                title,
                title_ar,
                description,
                description_ar,
                thumbnail_url,
                slug,
                status,
                is_featured,
                duration_weeks,
                price,
                currency,
                created_at,
                updated_at
            `)
            .eq('status', 'published')
            .order('order_index', { ascending: true });

        if (error) throw error;

        // Fetch courses for each diploma
        const catalogWithCourses: CatalogDiploma[] = await Promise.all(
            (diplomas || []).map(async (diploma) => {
                const { data: courses } = await supabase
                    .from('courses')
                    .select('id, title, title_ar, description, thumbnail_url, order_index, status')
                    .eq('diploma_id', diploma.id)
                    .eq('status', 'published')
                    .order('order_index');

                // Fetch chapters for each course
                const coursesWithChapters = await Promise.all(
                    (courses || []).map(async (course) => {
                        const { data: chapters } = await supabase
                            .from('chapters')
                            .select('id, title, title_ar')
                            .eq('course_id', course.id)
                            .order('order_index');

                        // Count lessons in each chapter
                        const chaptersWithLessonCount = await Promise.all(
                            (chapters || []).map(async (ch) => {
                                const { count } = await supabase
                                    .from('lessons')
                                    .select('id', { count: 'exact', head: true })
                                    .eq('chapter_id', ch.id);

                                return {
                                    id: ch.id,
                                    title: ch.title,
                                    title_ar: ch.title_ar,
                                    lessons_count: count || 0,
                                };
                            })
                        );

                        return {
                            ...course,
                            chapters: chaptersWithLessonCount,
                        };
                    })
                );

                return {
                    ...diploma,
                    courses: coursesWithChapters,
                } as CatalogDiploma;
            })
        );

        // Cache for offline
        try {
            await AsyncStorage.setItem(CACHE_KEY_CATALOG, JSON.stringify(catalogWithCourses));
        } catch (e) {
            console.warn('Failed to cache diploma catalog:', e);
        }

        return catalogWithCourses;
    } catch (error) {
        console.error('Error fetching diploma catalog:', error);

        // Try to return cached data on error
        try {
            const cached = await AsyncStorage.getItem(CACHE_KEY_CATALOG);
            if (cached) {
                return JSON.parse(cached);
            }
        } catch { }

        return [];
    }
};

/**
 * Fetch a single diploma by ID with full details (public/catalog view)
 */
export const fetchDiplomaById = async (diplomaId: string): Promise<CatalogDiploma | null> => {
    try {
        const isOnline = await checkIsOnline();

        if (!isOnline) {
            const cached = await AsyncStorage.getItem(CACHE_KEY_CATALOG);
            if (cached) {
                const catalog: CatalogDiploma[] = JSON.parse(cached);
                return catalog.find(d => d.id === diplomaId) || null;
            }
            return null;
        }

        const { data: diploma, error } = await supabase
            .from('diplomas')
            .select(`
                id,
                title,
                title_ar,
                description,
                description_ar,
                thumbnail_url,
                slug,
                status,
                is_featured,
                duration_weeks,
                price,
                currency,
                created_at,
                updated_at
            `)
            .eq('id', diplomaId)
            .single();

        if (error) throw error;
        if (!diploma) return null;

        // Fetch courses for the diploma
        const { data: courses } = await supabase
            .from('courses')
            .select('id, title, title_ar, description, thumbnail_url, order_index, status')
            .eq('diploma_id', diploma.id)
            .eq('status', 'published')
            .order('order_index');

        // Fetch chapters for each course
        const coursesWithChapters = await Promise.all(
            (courses || []).map(async (course) => {
                const { data: chapters } = await supabase
                    .from('chapters')
                    .select('id, title, title_ar')
                    .eq('course_id', course.id)
                    .order('order_index');

                // Count lessons in each chapter
                const chaptersWithLessonCount = await Promise.all(
                    (chapters || []).map(async (ch) => {
                        const { count } = await supabase
                            .from('lessons')
                            .select('id', { count: 'exact', head: true })
                            .eq('chapter_id', ch.id);

                        return {
                            id: ch.id,
                            title: ch.title,
                            title_ar: ch.title_ar,
                            lessons_count: count || 0,
                        };
                    })
                );

                return {
                    ...course,
                    chapters: chaptersWithLessonCount,
                };
            })
        );

        return {
            ...diploma,
            courses: coursesWithChapters,
        } as CatalogDiploma;

    } catch (error) {
        console.error('Error fetching diploma details:', error);
        return null;
    }
};

/**
 * Fetch user's diploma enrollments
 */
export const fetchMyEnrollments = async (): Promise<Enrollment[]> => {
    try {
        const isOnline = await checkIsOnline();

        if (!isOnline) {
            const cached = await AsyncStorage.getItem(CACHE_KEY_ENROLLMENTS);
            if (cached) {
                return JSON.parse(cached);
            }
            return [];
        }

        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            throw new Error('Not authenticated');
        }

        const { data, error } = await supabase
            .from('diploma_enrollments')
            .select(`
                *,
                diploma:diplomas (
                    id,
                    title,
                    title_ar,
                    description,
                    thumbnail_url,
                    slug,
                    duration_weeks,
                    price,
                    currency
                ),
                batch:batches (
                    id,
                    name,
                    name_ar,
                    start_date,
                    end_date,
                    status,
                    whatsapp_group_link,
                    instructor:profiles!batches_instructor_id_fkey (
                        id,
                        full_name,
                        avatar_url
                    )
                )
            `)
            .eq('user_id', user.id)
            .in('status', ['active', 'pending', 'completed'])
            .order('enrolled_at', { ascending: false });

        if (error) throw error;

        const enrollments = (data || []).map((enrollment: any) => ({
            ...enrollment,
            progress: enrollment.progress || 0,
        })) as Enrollment[];

        // Cache for offline
        try {
            await AsyncStorage.setItem(CACHE_KEY_ENROLLMENTS, JSON.stringify(enrollments));
        } catch (e) {
            console.warn('Failed to cache enrollments:', e);
        }

        return enrollments;
    } catch (error) {
        console.error('Error fetching enrollments:', error);

        try {
            const cached = await AsyncStorage.getItem(CACHE_KEY_ENROLLMENTS);
            if (cached) {
                return JSON.parse(cached);
            }
        } catch { }

        return [];
    }
};

/**
 * Fetch full diploma content for enrolled users
 */
export const fetchDiplomaContent = async (diplomaId: string): Promise<DiplomaDetail | null> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            throw new Error('Not authenticated');
        }

        // Check if user is enrolled in diploma
        const { data: enrollment } = await supabase
            .from('diploma_enrollments')
            .select('id, status')
            .eq('user_id', user.id)
            .eq('diploma_id', diplomaId)
            .eq('status', 'active')
            .single();

        if (!enrollment) {
            throw new Error('Not enrolled in this diploma');
        }

        // Fetch full diploma with all content
        const { data: diploma, error } = await supabase
            .from('diplomas')
            .select(`
                *,
                courses:courses (
                    *,
                    chapters:chapters (
                        *,
                        lessons:lessons (*)
                    )
                )
            `)
            .eq('id', diplomaId)
            .single();

        if (error) throw error;

        // Sort courses, chapters, and lessons by order_index
        const detail: DiplomaDetail = {
            ...diploma,
            courses: (diploma.courses || [])
                .sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))
                .map((course: any) => ({
                    ...course,
                    chapters: (course.chapters || [])
                        .sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))
                        .map((chapter: any) => ({
                            ...chapter,
                            lessons: (chapter.lessons || [])
                                .sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0)),
                        })),
                })),
        };

        return detail;
    } catch (error) {
        console.error('Error fetching diploma content:', error);
        throw error;
    }
};

/**
 * Fetch user's batches with details
 */
export const fetchMyBatches = async (): Promise<Batch[]> => {
    try {
        const isOnline = await checkIsOnline();

        if (!isOnline) {
            const cached = await AsyncStorage.getItem(CACHE_KEY_BATCHES);
            if (cached) {
                return JSON.parse(cached);
            }
            return [];
        }

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            throw new Error('Not authenticated');
        }

        // Get enrollments with batches
        const { data: enrollments, error } = await supabase
            .from('diploma_enrollments')
            .select(`
                batch:batches (
                    *,
                    diploma:diplomas (
                        id,
                        title,
                        title_ar,
                        thumbnail_url
                    ),
                    instructor:profiles!batches_instructor_id_fkey (
                        id,
                        full_name,
                        avatar_url
                    )
                )
            `)
            .eq('user_id', user.id)
            .eq('enrollment_type', 'batch')
            .not('batch_id', 'is', null);

        if (error) throw error;

        const batches = (enrollments || [])
            .filter((e: any) => e.batch)
            .map((e: any) => e.batch) as Batch[];

        // Cache for offline
        try {
            await AsyncStorage.setItem(CACHE_KEY_BATCHES, JSON.stringify(batches));
        } catch (e) {
            console.warn('Failed to cache batches:', e);
        }

        return batches;
    } catch (error) {
        console.error('Error fetching batches:', error);

        try {
            const cached = await AsyncStorage.getItem(CACHE_KEY_BATCHES);
            if (cached) {
                return JSON.parse(cached);
            }
        } catch { }

        return [];
    }
};

/**
 * Fetch upcoming live sessions for user's batches
 */
export const fetchUpcomingLiveSessions = async (): Promise<LiveSession[]> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            throw new Error('Not authenticated');
        }

        // Get user's batch IDs
        const { data: enrollments } = await supabase
            .from('diploma_enrollments')
            .select('batch_id')
            .eq('user_id', user.id)
            .eq('enrollment_type', 'batch')
            .eq('status', 'active')
            .not('batch_id', 'is', null);

        if (!enrollments || enrollments.length === 0) {
            return [];
        }

        const batchIds = enrollments.map((e: any) => e.batch_id).filter(Boolean);

        if (batchIds.length === 0) {
            return [];
        }

        // Fetch upcoming sessions
        const { data: sessions, error } = await supabase
            .from('live_sessions')
            .select(`
                *,
                batch:batches (
                    id,
                    name,
                    name_ar,
                    diploma:diplomas (
                        id,
                        title,
                        title_ar
                    )
                ),
                instructor:profiles!live_sessions_instructor_id_fkey (
                    id,
                    full_name,
                    avatar_url
                )
            `)
            .in('batch_id', batchIds)
            .in('status', ['scheduled', 'live'])
            .gte('scheduled_at', new Date().toISOString())
            .order('scheduled_at', { ascending: true })
            .limit(10);

        if (error) throw error;

        return sessions || [];
    } catch (error) {
        console.error('Error fetching live sessions:', error);
        return [];
    }
};

/**
 * Submit WhatsApp inquiry for a diploma
 */
export const submitDiplomaInquiry = async (
    diplomaId: string,
    data: {
        name: string;
        email: string;
        phone: string;
        whatsapp_number?: string;
        message?: string;
    }
): Promise<void> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();

        const { error } = await supabase
            .from('whatsapp_inquiries')
            .insert({
                user_id: user?.id || null,
                diploma_id: diplomaId,
                user_name: data.name,
                user_email: data.email,
                user_phone: data.phone || data.whatsapp_number,
                inquiry_type: 'purchase',
                status: 'pending',
            });

        if (error) throw error;

        Alert.alert(
            'Inquiry Submitted',
            'Thank you for your interest! Our team will contact you shortly via WhatsApp.',
            [{ text: 'OK' }]
        );
    } catch (error) {
        console.error('Error submitting inquiry:', error);
        throw error;
    }
};

/**
 * Update lesson progress
 */
export const updateLessonProgress = async (
    lessonId: string,
    enrollmentId: string,
    data: {
        status?: 'not_started' | 'in_progress' | 'completed';
        progress_percentage?: number;
        time_spent_seconds?: number;
        last_position?: Record<string, any>;
    }
): Promise<void> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) throw new Error('Not authenticated');

        const updateData: any = {
            user_id: user.id,
            lesson_id: lessonId,
            enrollment_id: enrollmentId,
            updated_at: new Date().toISOString(),
        };

        if (data.status) {
            updateData.status = data.status;
            if (data.status === 'in_progress' && !updateData.started_at) {
                updateData.started_at = new Date().toISOString();
            }
            if (data.status === 'completed') {
                updateData.completed_at = new Date().toISOString();
                updateData.progress_percentage = 100;
            }
        }

        if (data.progress_percentage !== undefined) {
            updateData.progress_percentage = data.progress_percentage;
        }

        if (data.time_spent_seconds !== undefined) {
            updateData.time_spent_seconds = data.time_spent_seconds;
        }

        if (data.last_position) {
            updateData.last_position = data.last_position;
        }

        const { error } = await supabase
            .from('lesson_progress')
            .upsert(updateData, {
                onConflict: 'user_id,lesson_id',
            });

        if (error) throw error;

        // Recalculate enrollment progress
        await recalculateEnrollmentProgress(enrollmentId);
    } catch (error) {
        console.error('Error updating lesson progress:', error);
        throw error;
    }
};

/**
 * Recalculate overall enrollment progress
 */
const recalculateEnrollmentProgress = async (enrollmentId: string): Promise<void> => {
    try {
        // Use the database function
        const { error } = await supabase.rpc('calculate_diploma_progress', {
            p_enrollment_id: enrollmentId
        });

        if (error) {
            console.error('Error recalculating progress via RPC:', error);

            // Fallback to manual calculation
            const { data: enrollment } = await supabase
                .from('diploma_enrollments')
                .select('diploma_id, user_id')
                .eq('id', enrollmentId)
                .single();

            if (!enrollment) return;

            // Get all courses for the diploma
            const { data: courses } = await supabase
                .from('courses')
                .select('id')
                .eq('diploma_id', enrollment.diploma_id);

            if (!courses || courses.length === 0) return;

            const courseIds = courses.map(c => c.id);

            // Get all chapters for those courses
            const { data: chapters } = await supabase
                .from('chapters')
                .select('id')
                .in('course_id', courseIds);

            if (!chapters || chapters.length === 0) return;

            const chapterIds = chapters.map(ch => ch.id);

            // Count total mandatory lessons
            const { count: totalLessons } = await supabase
                .from('lessons')
                .select('id', { count: 'exact', head: true })
                .in('chapter_id', chapterIds)
                .eq('is_mandatory', true);

            // Count completed lessons
            const { count: completedLessons } = await supabase
                .from('lesson_progress')
                .select('id', { count: 'exact', head: true })
                .eq('enrollment_id', enrollmentId)
                .eq('user_id', enrollment.user_id)
                .eq('status', 'completed');

            // Calculate progress percentage
            const progress = totalLessons && totalLessons > 0
                ? Math.round((completedLessons || 0) / totalLessons * 100)
                : 0;

            // Update enrollment
            await supabase
                .from('diploma_enrollments')
                .update({
                    progress,
                    status: progress >= 100 ? 'completed' : 'active',
                    completed_at: progress >= 100 ? new Date().toISOString() : null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', enrollmentId);
        }
    } catch (error) {
        console.error('Error recalculating progress:', error);
    }
};

/**
 * Get lesson progress for current user
 */
export const getLessonProgress = async (lessonId: string): Promise<{
    status: string;
    progress_percentage: number;
    last_position?: Record<string, any>;
} | null> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return null;

        const { data, error } = await supabase
            .from('lesson_progress')
            .select('status, progress_percentage, last_position')
            .eq('user_id', user.id)
            .eq('lesson_id', lessonId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        return data;
    } catch (error) {
        console.error('Error getting lesson progress:', error);
        return null;
    }
};

/**
 * Get all lesson progress for an enrollment
 */
export const getEnrollmentLessonProgress = async (enrollmentId: string): Promise<Record<string, {
    status: string;
    progress_percentage: number;
}>> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return {};

        const { data, error } = await supabase
            .from('lesson_progress')
            .select('lesson_id, status, progress_percentage')
            .eq('enrollment_id', enrollmentId)
            .eq('user_id', user.id);

        if (error) throw error;

        const progressMap: Record<string, { status: string; progress_percentage: number }> = {};
        (data || []).forEach(p => {
            progressMap[p.lesson_id] = {
                status: p.status,
                progress_percentage: p.progress_percentage,
            };
        });

        return progressMap;
    } catch (error) {
        console.error('Error getting enrollment progress:', error);
        return {};
    }
};

/**
 * Request enrollment in a diploma (for admin approval)
 */
export const requestEnrollment = async (
    diplomaId: string,
    batchId?: string
): Promise<void> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) throw new Error('Not authenticated');

        // Check if already enrolled
        const { data: existing } = await supabase
            .from('diploma_enrollments')
            .select('id')
            .eq('user_id', user.id)
            .eq('diploma_id', diplomaId)
            .single();

        if (existing) {
            throw new Error('You are already enrolled in this diploma');
        }

        // Create pending enrollment
        const { error } = await supabase
            .from('diploma_enrollments')
            .insert({
                user_id: user.id,
                diploma_id: diplomaId,
                batch_id: batchId || null,
                enrollment_type: batchId ? 'batch' : 'individual',
                status: 'pending',
            });

        if (error) throw error;

        Alert.alert(
            'Enrollment Request Submitted',
            'Your enrollment request has been submitted and is pending approval.',
            [{ text: 'OK' }]
        );
    } catch (error: any) {
        console.error('Error requesting enrollment:', error);
        Alert.alert('Error', error.message || 'Failed to submit enrollment request');
        throw error;
    }
};

/**
 * Clear local cache
 */
export const clearDiplomaCache = async (): Promise<void> => {
    try {
        await AsyncStorage.multiRemove([
            CACHE_KEY_CATALOG,
            CACHE_KEY_ENROLLMENTS,
            CACHE_KEY_BATCHES,
        ]);
    } catch (error) {
        console.error('Error clearing cache:', error);
    }
};
