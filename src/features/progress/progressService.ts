import { supabase } from '../../lib/supabase';

export interface LessonProgressDetail {
  id: string;
  user_id: string;
  enrollment_id: string;
  lesson_id: string;
  status: 'locked' | 'available' | 'in_progress' | 'completed' | 'failed';
  progress_percentage: number;
  has_quiz: boolean;
  quiz_passed: boolean | null;
  quiz_score: number | null;
  quiz_attempts: number;
  time_spent_seconds: number;
  started_at: string | null;
  completed_at: string | null;
  last_accessed_at: string;
  created_at: string;
  updated_at: string;
}

export interface CourseProgressSummary {
  enrollment_id: string;
  course_id: string;
  total_lessons: number;
  completed_lessons: number;
  in_progress_lessons: number;
  locked_lessons: number;
  total_quizzes: number;
  passed_quizzes: number;
  overall_progress: number;
  last_accessed_lesson_id: string | null;
  last_accessed_at: string | null;
}

export interface CourseSettings {
  course_id: string;
  leaderboard_enabled: boolean;
  leaderboard_visibility: 'public' | 'private' | 'hidden';
  count_first_attempt_only: boolean;
  sequential_lessons: boolean;
  require_quiz_pass: boolean;
  min_passing_score: number;
  max_quiz_attempts: number | null;
  points_per_correct_answer: number;
  perfect_score_bonus: number;
  time_bonus_enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Get course settings with defaults if not found
 */
export async function getCourseSettings(courseId: string): Promise<CourseSettings> {
  try {
    const { data, error } = await supabase
      .from('course_settings')
      .select('*')
      .eq('course_id', courseId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      throw error;
    }

    // Return defaults if not found
    if (!data) {
      return {
        course_id: courseId,
        leaderboard_enabled: false,
        leaderboard_visibility: 'public',
        count_first_attempt_only: true,
        sequential_lessons: false,
        require_quiz_pass: false,
        min_passing_score: 70,
        max_quiz_attempts: null,
        points_per_correct_answer: 10,
        perfect_score_bonus: 50,
        time_bonus_enabled: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    return data;
  } catch (error) {
    console.error('Error fetching course settings:', error);
    throw error;
  }
}

/**
 * Get all lesson progress for an enrollment
 */
export async function getLessonProgress(enrollmentId: string): Promise<Map<string, LessonProgressDetail>> {
  try {
    const { data, error } = await supabase
      .from('lesson_progress')
      .select('*')
      .eq('enrollment_id', enrollmentId);

    if (error) throw error;

    const progressMap = new Map<string, LessonProgressDetail>();
    (data || []).forEach((progress) => {
      progressMap.set(progress.lesson_id, progress);
    });

    return progressMap;
  } catch (error) {
    console.error('Error fetching lesson progress:', error);
    return new Map();
  }
}

/**
 * Get course progress summary
 */
export async function getCourseProgressSummary(enrollmentId: string): Promise<CourseProgressSummary | null> {
  try {
    const { data, error } = await supabase
      .from('lesson_progress')
      .select('*')
      .eq('enrollment_id', enrollmentId);

    if (error) throw error;

    if (!data || data.length === 0) return null;

    const totalLessons = data.length;
    const completedLessons = data.filter(p => p.status === 'completed').length;
    const inProgressLessons = data.filter(p => p.status === 'in_progress').length;
    const availableLessons = data.filter(p => p.status === 'available').length;
    const lockedLessons = data.filter(p => p.status === 'locked').length;
    const totalQuizzes = data.filter(p => p.has_quiz).length;
    const passedQuizzes = data.filter(p => p.quiz_passed).length;
    
    // Accurate progress calculation: only completed lessons count
    const overallProgress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    // Find last accessed lesson
    const sortedByAccess = [...data].sort((a, b) => 
      new Date(b.last_accessed_at || 0).getTime() - new Date(a.last_accessed_at || 0).getTime()
    );
    const lastAccessed = sortedByAccess[0];

    return {
      enrollment_id: enrollmentId,
      course_id: data[0]?.course_id || '',
      total_lessons: totalLessons,
      completed_lessons: completedLessons,
      in_progress_lessons: inProgressLessons,
      locked_lessons: lockedLessons,
      total_quizzes: totalQuizzes,
      passed_quizzes: passedQuizzes,
      overall_progress: overallProgress,
      last_accessed_lesson_id: lastAccessed?.lesson_id || null,
      last_accessed_at: lastAccessed?.last_accessed_at || null,
    };
  } catch (error) {
    console.error('Error fetching course progress summary:', error);
    return null;
  }
}

/**
 * Check if a lesson is accessible
 */
export async function isLessonAccessible(
  lessonId: string,
  enrollmentId: string,
  settings: CourseSettings
): Promise<{ accessible: boolean; reason?: string }> {
  try {
    // Get the lesson progress
    const { data: progress, error } = await supabase
      .from('lesson_progress')
      .select('*')
      .eq('lesson_id', lessonId)
      .eq('enrollment_id', enrollmentId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // If no progress record, lesson hasn't been initialized
    if (!progress) {
      return { accessible: false, reason: 'Lesson not initialized. Please reload the course.' };
    }

    // Check if lesson is locked
    if (progress.status === 'locked') {
      if (settings.sequential_lessons) {
        return { accessible: false, reason: 'Complete previous lessons first.' };
      }
      return { accessible: false, reason: 'This lesson is locked.' };
    }

    // Lesson is accessible
    return { accessible: true };
  } catch (error) {
    console.error('Error checking lesson accessibility:', error);
    return { accessible: false, reason: 'Error checking lesson access.' };
  }
}

/**
 * Mark lesson as started
 */
export async function markLessonStarted(
  lessonId: string,
  enrollmentId: string
): Promise<void> {
  try {
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('lesson_progress')
      .update({
        status: 'in_progress',
        started_at: now,
        last_accessed_at: now,
        updated_at: now,
      })
      .eq('lesson_id', lessonId)
      .eq('enrollment_id', enrollmentId);

    if (error) throw error;
  } catch (error) {
    console.error('Error marking lesson started:', error);
    throw error;
  }
}

/**
 * Update lesson progress percentage
 */
export async function updateLessonProgressPercentage(
  lessonId: string,
  enrollmentId: string,
  percentage: number
): Promise<void> {
  try {
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('lesson_progress')
      .update({
        progress_percentage: Math.min(100, Math.max(0, percentage)),
        last_accessed_at: now,
        updated_at: now,
      })
      .eq('lesson_id', lessonId)
      .eq('enrollment_id', enrollmentId);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating lesson progress:', error);
    throw error;
  }
}

/**
 * Mark lesson as completed
 */
export async function markLessonCompleted(
  lessonId: string,
  enrollmentId: string,
  courseId: string
): Promise<void> {
  try {
    const now = new Date().toISOString();

    // Get lesson order to unlock next lesson
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select('id, order_index, chapter_id')
      .eq('id', lessonId)
      .single();

    if (lessonError) throw lessonError;

    // Mark current lesson as completed
    const { error: updateError } = await supabase
      .from('lesson_progress')
      .update({
        status: 'completed',
        progress_percentage: 100,
        completed_at: now,
        last_accessed_at: now,
        updated_at: now,
      })
      .eq('lesson_id', lessonId)
      .eq('enrollment_id', enrollmentId);

    if (updateError) throw updateError;

    // Call the database function to unlock next lesson
    const { error: unlockError } = await supabase.rpc('check_and_unlock_next_lesson', {
      p_user_id: (await supabase.auth.getUser()).data.user?.id,
      p_enrollment_id: enrollmentId,
      p_lesson_id: lessonId,
    });

    if (unlockError) {
      console.warn('Error unlocking next lesson:', unlockError);
    }
  } catch (error) {
    console.error('Error marking lesson completed:', error);
    throw error;
  }
}

/**
 * Update quiz result for lesson
 */
export async function updateLessonQuizResult(
  lessonId: string,
  enrollmentId: string,
  score: number,
  passed: boolean,
  attemptNumber: number
): Promise<void> {
  try {
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('lesson_progress')
      .update({
        quiz_score: score,
        quiz_passed: passed,
        quiz_attempts: attemptNumber,
        last_accessed_at: now,
        updated_at: now,
      })
      .eq('lesson_id', lessonId)
      .eq('enrollment_id', enrollmentId);

    if (error) throw error;

    // If quiz passed, mark lesson as completed
    if (passed) {
      const { data: progress } = await supabase
        .from('lesson_progress')
        .select('course_id')
        .eq('lesson_id', lessonId)
        .eq('enrollment_id', enrollmentId)
        .single();

      if (progress) {
        await markLessonCompleted(lessonId, enrollmentId, progress.course_id);
      }
    }
  } catch (error) {
    console.error('Error updating quiz result:', error);
    throw error;
  }
}
