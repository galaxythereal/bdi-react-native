/**
 * Course Service - Diploma Model Only
 * Uses diploma → courses → chapters → lessons → lesson_blocks structure
 */
import { supabase } from '../../lib/supabase';
import { CourseDetail, Chapter, Lesson } from '../../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  saveCourseOffline,
  getOfflineCourse,
  checkIsOnline,
} from '../offline/offlineManager';

const CACHE_KEY_PREFIX = 'bdi_course_';

/**
 * Fetch course content with chapters, lessons, and lesson blocks
 */
export const fetchCourseContent = async (courseId: string): Promise<CourseDetail> => {
  try {
    const isOnline = await checkIsOnline();

    if (!isOnline) {
      // Try to get from offline storage
      console.log('Offline: Loading cached course:', courseId);
      const offlineCourse = await getOfflineCourse(courseId);
      if (offlineCourse) {
        return transformOfflineCourse(offlineCourse);
      }

      // Try legacy cache
      const cached = await AsyncStorage.getItem(`${CACHE_KEY_PREFIX}${courseId}`);
      if (cached) {
        return JSON.parse(cached);
      }

      throw new Error('Course not available offline. Please connect to the internet.');
    }

    // Fetch course with chapters and lessons
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select(`
        *,
        diploma:diplomas (
          id,
          title,
          thumbnail_url
        ),
        chapters (
          *,
          lessons (
            *,
            lesson_blocks (
              id,
              block_type,
              title,
              content,
              order_index
            )
          )
        )
      `)
      .eq('id', courseId)
      .single();

    if (courseError) throw courseError;
    if (!course) throw new Error('Course not found');

    // Transform and sort the data
    const courseDetail: CourseDetail = {
      id: course.id,
      title: course.title,
      description: course.description,
      thumbnail_url: course.thumbnail_url,
      slug: course.slug,
      diploma_id: course.diploma_id,
      status: course.status,
      order_index: course.order_index,
      created_at: course.created_at,
      updated_at: course.updated_at,
      chapters: (course.chapters || [])
        .sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))
        .map((chapter: any) => ({
          ...chapter,
          lessons: (chapter.lessons || [])
            .sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))
            .map((lesson: any) => transformLesson(lesson)),
        })),
    };

    // Cache for offline use
    try {
      await AsyncStorage.setItem(`${CACHE_KEY_PREFIX}${courseId}`, JSON.stringify(courseDetail));
      await saveCourseOffline(courseDetail);
    } catch (e) {
      console.warn('Failed to cache course:', e);
    }

    return courseDetail;
  } catch (error: any) {
    console.error('fetchCourseContent error:', error);

    // Try to return cached data on error
    try {
      const cached = await AsyncStorage.getItem(`${CACHE_KEY_PREFIX}${courseId}`);
      if (cached) {
        console.log('Returning cached course after error');
        return JSON.parse(cached);
      }
    } catch { }

    throw error;
  }
};

/**
 * Transform a lesson from database format to app format
 */
function transformLesson(lesson: any): Lesson {
  const blocks = lesson.lesson_blocks || [];

  // Determine primary content type from first block or lesson_type
  let content_type = lesson.lesson_type || 'text';
  let video_url: string | null = null;
  let video_provider: 'youtube' | 'vimeo' | 'wistia' | 'direct' = 'direct';
  let content_html: string | null = null;
  let quiz_data: any = null;
  let audio_url: string | null = null;
  let pdf_url: string | null = null;

  // Sort blocks by order_index
  const sortedBlocks = blocks.sort((a: any, b: any) =>
    (a.order_index || 0) - (b.order_index || 0)
  );

  // Extract primary content from blocks
  for (const block of sortedBlocks) {
    const content = block.content || {};

    switch (block.block_type) {
      case 'video':
        if (!video_url) {
          video_url = content.url || content.video_url || null;
          video_provider = (content.provider || 'direct') as typeof video_provider;
          content_type = 'video';
        }
        break;
      case 'text':
        if (!content_html) {
          content_html = content.html || null;
          if (content_type === 'text') content_type = 'text';
        }
        break;
      case 'quiz':
        if (!quiz_data && content.questions) {
          quiz_data = {
            id: block.id,
            title: content.title || block.title || lesson.title,
            description: 'Test your knowledge',
            time_limit: content.time_limit || 15,
            passing_score: content.passing_score || 70,
            allow_retry: true,
            questions: (content.questions || []).map((q: any, idx: number) => ({
              id: q.id || `${block.id}_q${idx + 1}`,
              question: q.question || 'Question',
              type: q.question_type || 'multiple_choice',
              options: (q.options || []).map((opt: any) => opt.text || opt),
              correct_answer: getCorrectAnswer(q),
              explanation: q.explanation,
              points: q.points || 1,
            })),
          };
          content_type = 'quiz';
        }
        break;
      case 'audio':
        if (!audio_url) {
          audio_url = content.url || content.audio_url || null;
          content_type = 'audio';
        }
        break;
      case 'pdf':
        if (!pdf_url) {
          pdf_url = content.url || null;
          content_type = 'pdf';
        }
        break;
    }
  }

  // Use lesson-level content as fallback
  if (!video_url && lesson.content_url && (lesson.lesson_type === 'video' || lesson.lesson_type === 'audio')) {
    video_url = lesson.content_url;
  }
  if (!content_html && lesson.content_html) {
    content_html = lesson.content_html;
  }

  return {
    id: lesson.id,
    chapter_id: lesson.chapter_id,
    title: lesson.title,
    slug: lesson.slug,
    content_type,
    video_url,
    video_provider,
    audio_url,
    pdf_url,
    content_html,
    duration: lesson.duration_minutes || null,
    is_preview: lesson.is_preview || false,
    order_index: lesson.order_index || 0,
    description: lesson.description,
    quiz_data,
    blocks: sortedBlocks,
  };
}

/**
 * Get correct answer from quiz question
 */
function getCorrectAnswer(q: any): number | number[] | string {
  if (q.question_type === 'text' || q.question_type === 'short_answer') {
    return q.correct_text_answer || '';
  } else if (q.question_type === 'multiple_select') {
    return (q.options || [])
      .map((opt: any, i: number) => opt.correct === true ? i : -1)
      .filter((i: number) => i !== -1);
  }
  return (q.options || []).findIndex((opt: any) => opt.correct === true);
}

/**
 * Transform offline course to CourseDetail
 */
function transformOfflineCourse(offlineCourse: any): CourseDetail {
  return {
    id: offlineCourse.id,
    title: offlineCourse.title,
    description: offlineCourse.description,
    thumbnail_url: offlineCourse.thumbnail_local || offlineCourse.thumbnail_url,
    slug: offlineCourse.slug,
    created_at: offlineCourse.created_at,
    chapters: (offlineCourse.chapters || offlineCourse.modules || []).map((ch: any) => ({
      id: ch.id,
      course_id: offlineCourse.id,
      title: ch.title,
      order_index: ch.order_index,
      lessons: (ch.lessons || []).map((lesson: any) => ({
        ...lesson,
        video_url: lesson.video_local || lesson.video_url,
        video_provider: (lesson.video_local ? 'direct' : lesson.video_provider) as 'youtube' | 'vimeo' | 'wistia' | 'direct',
      })),
    })),
  };
}

/**
 * Update enrollment progress when lessons are completed
 */
export const updateEnrollmentProgress = async (
  enrollmentId: string,
  completedLessons: number,
  totalLessons: number
): Promise<void> => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.warn('Not authenticated, cannot update progress');
      return;
    }

    const progress = totalLessons > 0
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0;

    const { error } = await supabase
      .from('diploma_enrollments')
      .update({
        progress,
        status: progress >= 100 ? 'completed' : 'active',
        completed_at: progress >= 100 ? new Date().toISOString() : null,
        last_accessed_at: new Date().toISOString(),
      })
      .eq('id', enrollmentId);

    if (error) {
      console.error('Error updating enrollment progress:', error);
    } else {
      console.log(`Progress updated: ${completedLessons}/${totalLessons} = ${progress}%`);
    }
  } catch (error) {
    console.error('updateEnrollmentProgress error:', error);
  }
};

/**
 * Get course content with offline support
 */
export const fetchCourseContentWithOfflineSupport = async (courseId: string): Promise<CourseDetail> => {
  // This is now the same as fetchCourseContent since it has offline support built in
  return fetchCourseContent(courseId);
};

/**
 * Clear course cache
 */
export const clearCourseCache = async (courseId: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(`${CACHE_KEY_PREFIX}${courseId}`);
  } catch (error) {
    console.error('Error clearing course cache:', error);
  }
};

/**
 * Fetch current user's enrollments with diploma and course details
 */
export const fetchMyEnrollments = async (): Promise<any[]> => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.warn('Not authenticated, cannot fetch enrollments');
      return [];
    }

    // Fetch enrollments with diploma information
    const { data: enrollments, error } = await supabase
      .from('diploma_enrollments')
      .select(`
        *,
        diploma:diplomas (
          id,
          title,
          title_ar,
          description,
          thumbnail_url,
          courses (
            id,
            title,
            thumbnail_url,
            order_index
          )
        )
      `)
      .eq('user_id', user.id)
      .in('status', ['active', 'completed'])
      .order('enrolled_at', { ascending: false });

    if (error) {
      console.error('Error fetching enrollments:', error);
      throw error;
    }

    // Transform enrollments to diploma-centric format
    return (enrollments || []).map((enrollment: any) => ({
      id: enrollment.id,
      diploma_id: enrollment.diploma_id,
      user_id: enrollment.user_id,
      status: enrollment.status,
      progress: enrollment.progress || 0,
      enrolled_at: enrollment.enrolled_at,
      completed_at: enrollment.completed_at,
      last_accessed_at: enrollment.last_accessed_at,
      enrollment_type: enrollment.enrollment_type || 'individual',
      batch_id: enrollment.batch_id,
      expires_at: enrollment.expires_at,
      // Include diploma info
      diploma: enrollment.diploma,
      // Include courses within the diploma for navigation
      courses: enrollment.diploma?.courses || [],
    }));
  } catch (error) {
    console.error('fetchMyEnrollments error:', error);
    return [];
  }
};

/**
 * Fetch all available diplomas for browsing
 */
export const fetchAvailableDiplomas = async (): Promise<any[]> => {
  try {
    const { data: diplomas, error } = await supabase
      .from('diplomas')
      .select(`
        *,
        courses (
          id,
          title,
          thumbnail_url,
          order_index
        )
      `)
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching diplomas:', error);
      throw error;
    }

    return diplomas || [];
  } catch (error) {
    console.error('fetchAvailableDiplomas error:', error);
    return [];
  }
};
