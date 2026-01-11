import { supabase } from '../../lib/supabase';
import { CourseDetail, Enrollment } from '../../types';

export const fetchMyEnrollments = async (): Promise<Enrollment[]> => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('Auth error:', userError);
      throw new Error('Not authenticated. Please sign in again.');
    }

    const { data, error } = await supabase
      .from('enrollments')
      .select(`
        *,
        course:courses (
          id,
          title,
          description,
          thumbnail_url,
          slug,
          created_at
        )
      `)
      .eq('user_id', user.id)
      .order('enrolled_at', { ascending: false });

    if (error) {
      console.error('Error fetching enrollments:', error);
      // If table doesn't exist or RLS issue, return empty array instead of throwing
      if (error.code === 'PGRST116' || error.message.includes('permission')) {
        console.warn('Enrollments table may not exist or RLS is blocking access');
        return [];
      }
      throw new Error(error.message || 'Failed to load courses');
    }

    // Ensure we return an array and handle null/undefined
    if (!data) {
      return [];
    }

    // Transform data to ensure course is always an object
    return data.map((enrollment: any) => ({
      ...enrollment,
      progress: enrollment.progress || 0,
      course: enrollment.course || {
        id: enrollment.course_id,
        title: 'Untitled Course',
        description: null,
        thumbnail_url: null,
        slug: '',
      },
    })) as Enrollment[];
  } catch (error: any) {
    console.error('fetchMyEnrollments error:', error);
    throw error;
  }
};

export const fetchCourseContent = async (courseId: string): Promise<CourseDetail> => {
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .single();

  if (courseError) throw courseError;

  // Fetch modules and lessons
  // Assuming a structure: modules -> lessons (or sections -> subunits in typical LMS)
  // Adjusting for the user's schema mentions: "course_media" and "quizzes".
  // Let's assume a simplified hierarchy for now or try to infer from typical schemas.
  // User mentioned 'enrollments', 'courses', 'course_media', 'quizzes'.
  // I will assume a 'modules' or 'sections' table exists or lessons are directly linked.
  // If not, I'll need to query whatever structure exists.
  // Given the user instructions didn't specify the exact schema for content hierarchy,
  // I will assume a standard Section -> Lesson structure.

  // NOTE: Based on "Fixing Schema Cache" conversation in history, there are 'sections' and 'subsections'.
  // Let's use that terminology if possible, mapping them to Module/Lesson types.

  const { data: sections, error: sectionsError } = await supabase
    .from('sections')
    .select(`
      id,
      title,
      order_index,
      lessons:subsections (
        id,
        title,
        slug,
        content_type, -- video, text, quiz
        video_url, -- or from course_media
        content_html,
        is_preview,
        order_index
      )
    `)
    .eq('course_id', courseId)
    .order('order_index');

  if (sectionsError) {
    console.warn('Error fetching sections, trying alternatives or empty', sectionsError);
    // Fallback if schema is different, but let's assume this for now based on context
    return { ...course, modules: [] };
  }

  // Transform to match our frontend interface
  const modules = sections.map((section: any) => ({
    id: section.id,
    title: section.title,
    order_index: section.order_index,
    lessons: section.lessons.sort((a: any, b: any) => a.order_index - b.order_index),
  }));

  const result = { ...course, modules };

  // Cache the result for offline use
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem(`course_cache_${courseId}`, JSON.stringify(result));
  } catch (e) {
    console.warn('Failed to cache course', e);
  }

  return result;
};

// Add offline fallback wrapper or modifying existing if called from UI?
// For now, the UI calls this directly. Let's make the fallback internal to this function or export a wrapper.
// Actually, let's wrap the whole body in a try/catch or handle the error in the caller?
// Caller `loadCourseContent` in `[id].tsx` catches error. 
// Better to handle it here: if network request fails, try cache.

export const fetchCourseContentWithOfflineSupport = async (courseId: string): Promise<CourseDetail> => {
  try {
    return await fetchCourseContent(courseId);
  } catch (error) {
    console.log('Network fetch failed, trying offline cache for course:', courseId);
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const cached = await AsyncStorage.getItem(`course_cache_${courseId}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (cacheError) {
      console.warn('Failed to load course from cache', cacheError);
    }
    throw error; // Throw original error if no cache
  }
};

