/**
 * Leaderboard Service
 * Handles quiz scoring, leaderboard rankings, and lesson progression with locking
 */

import { supabase } from '../../lib/supabase';

// ============================================================================
// TYPES
// ============================================================================

export interface CourseSettings {
    id: string;
    course_id: string;
    leaderboard_enabled: boolean;
    leaderboard_visibility: 'public' | 'private' | 'hidden';
    sequential_lessons: boolean;
    require_quiz_pass: boolean;
    min_passing_score: number;
    max_quiz_attempts: number | null;
    count_first_attempt_only: boolean;
    points_per_correct_answer: number;
    time_bonus_enabled: boolean;
    perfect_score_bonus: number;
}

export interface QuizAttemptData {
    lesson_id: string;
    course_id: string;
    enrollment_id: string;
    quiz_id: string;
    answers: Record<string, any>;
    score: number;
    max_score: number;
    percentage: number;
    passed: boolean;
    total_questions: number;
    correct_answers: number;
    time_taken_seconds?: number;
}

export interface QuizAttempt extends QuizAttemptData {
    id: string;
    user_id: string;
    attempt_number: number;
    is_first_attempt: boolean;
    time_bonus_points: number;
    perfect_score_bonus: number;
    counts_for_leaderboard: boolean;
    leaderboard_score: number;
    completed_at: string;
}

export interface LeaderboardEntry {
    id: string;
    course_id: string;
    user_id: string;
    total_score: number;
    total_quizzes_completed: number;
    total_perfect_scores: number;
    average_score: number;
    rank: number;
    previous_rank: number | null;
    last_quiz_at: string;
    // Joined user data
    full_name?: string;
    avatar_url?: string;
}

export interface LessonProgress {
    id: string;
    user_id: string;
    enrollment_id: string;
    lesson_id: string;
    status: 'locked' | 'available' | 'in_progress' | 'completed' | 'failed';
    completed: boolean;
    completed_at: string | null;
    has_quiz: boolean;
    quiz_passed: boolean;
    quiz_attempts: number;
    best_quiz_score: number;
    first_attempt_score: number | null;
    progress_percentage: number;
    time_spent_seconds: number;
    last_position: any;
    unlocked_at: string | null;
    last_accessed_at: string | null;
}

// ============================================================================
// COURSE SETTINGS
// ============================================================================

/**
 * Get course settings
 */
export const getCourseSettings = async (courseId: string): Promise<CourseSettings | null> => {
    try {
        const { data, error } = await supabase
            .from('course_settings')
            .select('*')
            .eq('course_id', courseId)
            .single();

        if (error) {
            // If no settings exist, return defaults
            if (error.code === 'PGRST116') {
                return {
                    id: '',
                    course_id: courseId,
                    leaderboard_enabled: true,
                    leaderboard_visibility: 'public',
                    sequential_lessons: false,
                    require_quiz_pass: false,
                    min_passing_score: 70,
                    max_quiz_attempts: null,
                    count_first_attempt_only: true,
                    points_per_correct_answer: 10,
                    time_bonus_enabled: true,
                    perfect_score_bonus: 50,
                };
            }
            throw error;
        }

        return data;
    } catch (error) {
        console.error('Error fetching course settings:', error);
        return null;
    }
};

/**
 * Check if lesson is unlocked for user
 */
export const isLessonUnlocked = async (
    lessonId: string,
    enrollmentId: string
): Promise<boolean> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const { data, error } = await supabase
            .from('lesson_progress')
            .select('status')
            .eq('user_id', user.id)
            .eq('enrollment_id', enrollmentId)
            .eq('lesson_id', lessonId)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        // If no progress record, it's available by default
        if (!data) return true;

        return data.status !== 'locked';
    } catch (error) {
        console.error('Error checking lesson lock status:', error);
        return true; // Default to unlocked on error
    }
};

/**
 * Get all lesson progress for an enrollment
 */
export const getAllLessonProgress = async (
    enrollmentId: string
): Promise<Record<string, LessonProgress>> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return {};

        const { data, error } = await supabase
            .from('lesson_progress')
            .select('*')
            .eq('user_id', user.id)
            .eq('enrollment_id', enrollmentId);

        if (error) throw error;

        const progressMap: Record<string, LessonProgress> = {};
        (data || []).forEach(p => {
            progressMap[p.lesson_id] = p;
        });

        return progressMap;
    } catch (error) {
        console.error('Error fetching lesson progress:', error);
        return {};
    }
};

// ============================================================================
// QUIZ ATTEMPTS
// ============================================================================

/**
 * Submit quiz attempt
 */
export const submitQuizAttempt = async (
    attemptData: QuizAttemptData
): Promise<QuizAttempt | null> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Get course settings
        const settings = await getCourseSettings(attemptData.course_id);
        if (!settings) throw new Error('Course settings not found');

        // Get previous attempts count
        const { data: prevAttempts, error: countError } = await supabase
            .from('quiz_attempts')
            .select('attempt_number, is_first_attempt')
            .eq('user_id', user.id)
            .eq('lesson_id', attemptData.lesson_id)
            .order('attempt_number', { ascending: false })
            .limit(1);

        if (countError) throw countError;

        const attemptNumber = prevAttempts && prevAttempts.length > 0 
            ? prevAttempts[0].attempt_number + 1 
            : 1;
        const isFirstAttempt = attemptNumber === 1;

        // Calculate bonus points
        let timeBonusPoints = 0;
        let perfectScoreBonus = 0;

        if (settings.time_bonus_enabled && attemptData.time_taken_seconds) {
            // Award bonus for quick completion (under 60% of expected time)
            const expectedTime = attemptData.total_questions * 30; // 30 sec per question
            if (attemptData.time_taken_seconds < expectedTime * 0.6) {
                timeBonusPoints = Math.round(settings.points_per_correct_answer * 0.5);
            }
        }

        if (attemptData.percentage === 100) {
            perfectScoreBonus = settings.perfect_score_bonus;
        }

        // Determine if this counts for leaderboard
        const countsForLeaderboard = settings.count_first_attempt_only 
            ? isFirstAttempt 
            : attemptData.passed;

        // Insert attempt
        const { data, error } = await supabase
            .from('quiz_attempts')
            .insert({
                user_id: user.id,
                enrollment_id: attemptData.enrollment_id,
                lesson_id: attemptData.lesson_id,
                course_id: attemptData.course_id,
                quiz_id: attemptData.quiz_id,
                attempt_number: attemptNumber,
                is_first_attempt: isFirstAttempt,
                answers: attemptData.answers,
                score: attemptData.score,
                max_score: attemptData.max_score,
                percentage: attemptData.percentage,
                passed: attemptData.passed,
                total_questions: attemptData.total_questions,
                correct_answers: attemptData.correct_answers,
                time_taken_seconds: attemptData.time_taken_seconds,
                time_bonus_points: timeBonusPoints,
                perfect_score_bonus: perfectScoreBonus,
                counts_for_leaderboard: countsForLeaderboard,
                completed_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) throw error;

        // Update lesson progress
        await updateLessonProgressAfterQuiz(
            attemptData.lesson_id,
            attemptData.enrollment_id,
            {
                quiz_passed: attemptData.passed,
                quiz_attempts: attemptNumber,
                best_quiz_score: attemptData.score,
                first_attempt_score: isFirstAttempt ? attemptData.score : undefined,
            }
        );

        // If quiz passed and sequential mode, unlock next lesson
        if (attemptData.passed && settings.sequential_lessons) {
            await supabase.rpc('check_and_unlock_next_lesson', {
                p_user_id: user.id,
                p_enrollment_id: attemptData.enrollment_id,
                p_completed_lesson_id: attemptData.lesson_id,
            });
        }

        return data;
    } catch (error) {
        console.error('Error submitting quiz attempt:', error);
        return null;
    }
};

/**
 * Get quiz attempts for a lesson
 */
export const getQuizAttempts = async (
    lessonId: string
): Promise<QuizAttempt[]> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('quiz_attempts')
            .select('*')
            .eq('user_id', user.id)
            .eq('lesson_id', lessonId)
            .order('attempt_number', { ascending: true });

        if (error) throw error;

        return data || [];
    } catch (error) {
        console.error('Error fetching quiz attempts:', error);
        return [];
    }
};

/**
 * Get remaining quiz attempts
 */
export const getRemainingAttempts = async (
    lessonId: string,
    courseId: string
): Promise<number | null> => {
    try {
        const settings = await getCourseSettings(courseId);
        if (!settings || settings.max_quiz_attempts === null) {
            return null; // Unlimited
        }

        const attempts = await getQuizAttempts(lessonId);
        const remaining = settings.max_quiz_attempts - attempts.length;

        return Math.max(0, remaining);
    } catch (error) {
        console.error('Error calculating remaining attempts:', error);
        return null;
    }
};

// ============================================================================
// LEADERBOARD
// ============================================================================

/**
 * Get course leaderboard
 */
export const getCourseLeaderboard = async (
    courseId: string,
    limit: number = 100
): Promise<LeaderboardEntry[]> => {
    try {
        // First, get leaderboard entries
        const { data: leaderboardData, error: lbError } = await supabase
            .from('leaderboard')
            .select('*')
            .eq('course_id', courseId)
            .order('rank', { ascending: true })
            .limit(limit);

        if (lbError) {
            // Table might not exist - try to get from quiz_attempts instead
            if (lbError.code === '42P01') {
                return await calculateLeaderboardFromAttempts(courseId, limit);
            }
            throw lbError;
        }

        if (!leaderboardData || leaderboardData.length === 0) {
            return [];
        }

        // Get unique user IDs
        const userIds = [...new Set(leaderboardData.map(e => e.user_id))];

        // Fetch profiles separately
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('id', userIds);

        // Create a map of user profiles
        const profileMap = new Map((profiles || []).map(p => [p.id, p]));

        return leaderboardData.map(entry => ({
            ...entry,
            full_name: profileMap.get(entry.user_id)?.full_name,
            avatar_url: profileMap.get(entry.user_id)?.avatar_url,
        }));
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        // Fallback to calculating from quiz_attempts
        return await calculateLeaderboardFromAttempts(courseId, limit);
    }
};

/**
 * Calculate leaderboard from quiz_attempts when leaderboard table is unavailable
 */
const calculateLeaderboardFromAttempts = async (
    courseId: string,
    limit: number = 100
): Promise<LeaderboardEntry[]> => {
    try {
        const { data: attempts, error } = await supabase
            .from('quiz_attempts')
            .select('user_id, score, percentage')
            .eq('course_id', courseId)
            .eq('is_first_attempt', true);

        if (error || !attempts || attempts.length === 0) {
            return [];
        }

        // Aggregate scores by user
        const userScores: Record<string, {
            total_score: number;
            quizzes: number;
            perfect: number;
            total_percentage: number;
        }> = {};

        attempts.forEach((attempt: any) => {
            if (!userScores[attempt.user_id]) {
                userScores[attempt.user_id] = {
                    total_score: 0,
                    quizzes: 0,
                    perfect: 0,
                    total_percentage: 0,
                };
            }
            userScores[attempt.user_id].total_score += attempt.score || 0;
            userScores[attempt.user_id].quizzes += 1;
            userScores[attempt.user_id].total_percentage += attempt.percentage || 0;
            if (attempt.percentage === 100) {
                userScores[attempt.user_id].perfect += 1;
            }
        });

        // Get user IDs and fetch profiles
        const userIds = Object.keys(userScores);
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('id', userIds);

        const profileMap = new Map((profiles || []).map(p => [p.id, p]));

        // Convert to entries and rank
        const entries = Object.entries(userScores)
            .map(([userId, data]) => ({
                id: `${courseId}-${userId}`,
                course_id: courseId,
                user_id: userId,
                total_score: data.total_score,
                total_quizzes_completed: data.quizzes,
                total_perfect_scores: data.perfect,
                average_score: data.quizzes > 0 ? data.total_percentage / data.quizzes : 0,
                rank: 0,
                previous_rank: null,
                last_quiz_at: new Date().toISOString(),
                full_name: profileMap.get(userId)?.full_name,
                avatar_url: profileMap.get(userId)?.avatar_url,
            }))
            .sort((a, b) => b.total_score - a.total_score)
            .slice(0, limit)
            .map((entry, index) => ({ ...entry, rank: index + 1 }));

        return entries;
    } catch (error) {
        console.error('Error calculating leaderboard from attempts:', error);
        return [];
    }
};

/**
 * Get user's leaderboard position
 */
export const getUserLeaderboardPosition = async (
    courseId: string
): Promise<LeaderboardEntry | null> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        // First try the leaderboard table
        const { data, error } = await supabase
            .from('leaderboard')
            .select('*')
            .eq('course_id', courseId)
            .eq('user_id', user.id)
            .single();

        if (error) {
            // If table doesn't exist or no entry, calculate from quiz_attempts
            if (error.code === 'PGRST116' || error.code === '42P01') {
                const leaderboard = await calculateLeaderboardFromAttempts(courseId, 1000);
                return leaderboard.find(e => e.user_id === user.id) || null;
            }
            throw error;
        }

        if (!data) return null;

        // Fetch user profile separately
        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', user.id)
            .single();

        return {
            ...data,
            full_name: profile?.full_name,
            avatar_url: profile?.avatar_url,
        };
    } catch (error) {
        console.error('Error fetching user leaderboard position:', error);
        // Fallback to calculating from quiz_attempts
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;
            const leaderboard = await calculateLeaderboardFromAttempts(courseId, 1000);
            return leaderboard.find(e => e.user_id === user.id) || null;
        } catch {
            return null;
        }
    }
};

/**
 * Recalculate leaderboard for a course (admin function)
 */
export const recalculateLeaderboard = async (courseId: string): Promise<void> => {
    try {
        const { error } = await supabase.rpc('calculate_leaderboard_scores', {
            p_course_id: courseId,
        });

        if (error) throw error;
    } catch (error) {
        console.error('Error recalculating leaderboard:', error);
        throw error;
    }
};

// ============================================================================
// LESSON PROGRESS UPDATES
// ============================================================================

/**
 * Update lesson progress after quiz
 */
const updateLessonProgressAfterQuiz = async (
    lessonId: string,
    enrollmentId: string,
    data: {
        quiz_passed: boolean;
        quiz_attempts: number;
        best_quiz_score: number;
        first_attempt_score?: number;
    }
): Promise<void> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const updateData: any = {
            has_quiz: true,
            quiz_passed: data.quiz_passed,
            quiz_attempts: data.quiz_attempts,
            best_quiz_score: data.best_quiz_score,
            updated_at: new Date().toISOString(),
        };

        if (data.first_attempt_score !== undefined) {
            updateData.first_attempt_score = data.first_attempt_score;
        }

        if (data.quiz_passed) {
            updateData.completed = true;
            updateData.status = 'completed';
            updateData.completed_at = new Date().toISOString();
        }

        await supabase
            .from('lesson_progress')
            .upsert({
                user_id: user.id,
                enrollment_id: enrollmentId,
                lesson_id: lessonId,
                ...updateData,
            }, {
                onConflict: 'user_id,lesson_id,enrollment_id',
            });
    } catch (error) {
        console.error('Error updating lesson progress:', error);
    }
};

/**
 * Mark lesson as started
 */
export const markLessonStarted = async (
    lessonId: string,
    enrollmentId: string
): Promise<void> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase
            .from('lesson_progress')
            .upsert({
                user_id: user.id,
                enrollment_id: enrollmentId,
                lesson_id: lessonId,
                status: 'in_progress',
                last_accessed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'user_id,lesson_id,enrollment_id',
            });
    } catch (error) {
        console.error('Error marking lesson as started:', error);
    }
};

/**
 * Mark lesson as completed (non-quiz)
 */
export const markLessonCompleted = async (
    lessonId: string,
    enrollmentId: string,
    courseId: string
): Promise<void> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase
            .from('lesson_progress')
            .upsert({
                user_id: user.id,
                enrollment_id: enrollmentId,
                lesson_id: lessonId,
                status: 'completed',
                completed: true,
                completed_at: new Date().toISOString(),
                progress_percentage: 100,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'user_id,lesson_id,enrollment_id',
            });

        // Check if need to unlock next lesson
        const settings = await getCourseSettings(courseId);
        if (settings?.sequential_lessons) {
            await supabase.rpc('check_and_unlock_next_lesson', {
                p_user_id: user.id,
                p_enrollment_id: enrollmentId,
                p_completed_lesson_id: lessonId,
            });
        }
    } catch (error) {
        console.error('Error marking lesson as completed:', error);
    }
};

/**
 * Initialize lesson progress for new enrollment
 */
export const initializeLessonProgress = async (
    enrollmentId: string,
    courseId: string
): Promise<void> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase.rpc('initialize_lesson_progress_for_enrollment', {
            p_enrollment_id: enrollmentId,
            p_user_id: user.id,
            p_course_id: courseId,
        });
    } catch (error) {
        console.error('Error initializing lesson progress:', error);
    }
};
