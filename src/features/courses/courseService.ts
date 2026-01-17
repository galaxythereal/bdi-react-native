import { supabase } from '../../lib/supabase';
import { CourseDetail, Enrollment } from '../../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
    saveCourseOffline, 
    getOfflineCourse,
    saveEnrollmentsOffline,
    getOfflineEnrollments,
    checkIsOnline,
} from '../offline/offlineManager';

export const fetchMyEnrollments = async (): Promise<Enrollment[]> => {
  try {
    const isOnline = await checkIsOnline();
    
    if (!isOnline) {
      // Return cached enrollments when offline
      console.log('Offline: Loading cached enrollments');
      return await getOfflineEnrollments();
    }
    
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
    const enrollments = data.map((enrollment: any) => ({
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
    
    // Cache enrollments for offline use
    try {
      await saveEnrollmentsOffline(enrollments);
    } catch (e) {
      console.warn('Failed to cache enrollments:', e);
    }
    
    return enrollments;
  } catch (error: any) {
    console.error('fetchMyEnrollments error:', error);
    
    // Try to return cached enrollments on error
    try {
      const cached = await getOfflineEnrollments();
      if (cached.length > 0) {
        console.log('Returning cached enrollments after error');
        return cached;
      }
    } catch {}
    
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

  // Fetch the edX-style hierarchy: sections -> subsections -> units -> blocks
  // The actual content (video, quiz, text) is stored in blocks
  const { data: sections, error: sectionsError } = await supabase
    .from('sections')
    .select(`
      id,
      title,
      order_index,
      subsections (
        id,
        title,
        order_index,
        units (
          id,
          title,
          order_index,
          blocks (
            id,
            title,
            type,
            content,
            order_index
          )
        )
      )
    `)
    .eq('course_id', courseId)
    .order('order_index');

  if (sectionsError) {
    console.warn('Error fetching sections:', sectionsError);
    // Try alternative simpler structure
    return await fetchCourseContentSimple(courseId, course);
  }

  // Transform edX structure to our frontend module/lesson interface
  const modules = (sections || []).map((section: any) => {
    // Flatten subsections > units > blocks into lessons
    const lessons: any[] = [];
    
    (section.subsections || [])
      .sort((a: any, b: any) => a.order_index - b.order_index)
      .forEach((subsection: any) => {
        (subsection.units || [])
          .sort((a: any, b: any) => a.order_index - b.order_index)
          .forEach((unit: any) => {
            // Each unit becomes a "lesson" with blocks as content
            const blocks = (unit.blocks || []).sort((a: any, b: any) => a.order_index - b.order_index);
            
            // Determine lesson type from the FIRST block (respects ordering)
            const firstBlock = blocks[0];
            const videoBlock = blocks.find((b: any) => b.type === 'video');
            const quizBlock = blocks.find((b: any) => b.type === 'quiz');
            const textBlock = blocks.find((b: any) => b.type === 'text');
            
            // Use first block's type as primary content type - DON'T override later!
            let content_type = firstBlock?.type || 'text';
            let video_url = null;
            let video_provider = 'direct';
            let content_html = null;
            let quiz_data: any = null;
            
            // Extract video data if present
            if (videoBlock) {
              video_url = videoBlock.content?.url || videoBlock.content?.video_url;
              video_provider = videoBlock.content?.provider || 'direct';
            }
            // Extract quiz data if present (but don't override content_type - keep first block's type)
            if (quizBlock) {
              // Transform quiz block content to QuizData format
              // New format stores questions array directly: { title, time_limit, passing_score, questions: [...] }
              // Legacy format is single question: { question, question_type, options, explanation, points, attempts }
              const quizContent = quizBlock.content || {};
              
              // Helper function to determine question type
              const getQuestionType = (qt: string): 'multiple_choice' | 'multiple_select' | 'true_false' | 'short_answer' => {
                if (qt === 'multiple_select') return 'multiple_select';
                if (qt === 'numeric' || qt === 'text') return 'short_answer';
                if (qt === 'true_false') return 'true_false';
                return 'multiple_choice';
              };
              
              // Helper function to get correct answer(s)
              const getCorrectAnswer = (q: any): string | number | number[] => {
                if (q.question_type === 'text' || q.question_type === 'numeric') {
                  return q.correct_text_answer || '';
                } else if (q.question_type === 'multiple_select') {
                  // Get all indices of correct options
                  return (q.options || [])
                    .map((opt: any, i: number) => opt.correct === true ? i : -1)
                    .filter((i: number) => i !== -1);
                }
                return (q.options || []).findIndex((opt: any) => opt.correct === true);
              };
              
              // Check if new multi-question format (has questions array)
              if (quizContent.questions && Array.isArray(quizContent.questions) && quizContent.questions.length > 0) {
                // New multi-question format from admin panel
                quiz_data = {
                  id: quizBlock.id,
                  title: quizContent.title || quizBlock.title || unit.title || 'Quiz',
                  description: 'Test your knowledge',
                  time_limit: quizContent.time_limit || 15,
                  passing_score: quizContent.passing_score || 70,
                  allow_retry: true,
                  questions: quizContent.questions.map((q: any, idx: number) => ({
                    id: q.id || `${quizBlock.id}_q${idx + 1}`,
                    question: q.question || 'Question',
                    type: getQuestionType(q.question_type),
                    options: (q.options || []).map((opt: any) => opt.text || opt),
                    correct_answer: getCorrectAnswer(q),
                    explanation: q.explanation,
                    points: q.points || 1,
                  })),
                };
              } else if (quizContent.question) {
                // Legacy single-question format
                quiz_data = {
                  id: quizBlock.id,
                  title: quizBlock.title || unit.title || 'Quiz',
                  description: quizContent.explanation || 'Test your knowledge',
                  time_limit: quizContent.time_limit || 15,
                  passing_score: quizContent.passing_score || 70,
                  allow_retry: quizContent.attempts !== 1,
                  questions: [{
                    id: quizBlock.id + '_q1',
                    question: quizContent.question || 'Question',
                    type: getQuestionType(quizContent.question_type),
                    options: (quizContent.options || []).map((opt: any) => opt.text || opt),
                    correct_answer: getCorrectAnswer(quizContent),
                    explanation: quizContent.explanation,
                    points: quizContent.points || 1,
                  }],
                };
                
                // Also gather any additional quiz blocks in this unit (legacy behavior)
                const additionalQuizBlocks = blocks.filter((b: any) => b.type === 'quiz' && b.id !== quizBlock.id);
                additionalQuizBlocks.forEach((qb: any, idx: number) => {
                  const qc = qb.content || {};
                  if (qc.question) {
                    quiz_data.questions.push({
                      id: qb.id + '_q' + (idx + 2),
                      question: qc.question || 'Question ' + (idx + 2),
                      type: getQuestionType(qc.question_type),
                      options: (qc.options || []).map((opt: any) => opt.text || opt),
                      correct_answer: getCorrectAnswer(qc),
                      explanation: qc.explanation,
                      points: qc.points || 1,
                    });
                  }
                });
              } else {
                // Empty quiz - create placeholder
                quiz_data = {
                  id: quizBlock.id,
                  title: quizBlock.title || unit.title || 'Quiz',
                  description: 'Test your knowledge',
                  time_limit: 15,
                  passing_score: 70,
                  allow_retry: true,
                  questions: [],
                };
              }
            }
            if (textBlock) {
              content_html = textBlock.content?.html || textBlock.content;
            }
            
            lessons.push({
              id: unit.id,
              title: unit.title || subsection.title,
              slug: unit.id,
              content_type,
              video_url,
              video_provider,
              content_html,
              quiz_data,
              blocks,
              is_preview: false,
              order_index: lessons.length,
            });
          });
      });
    
    return {
      id: section.id,
      title: section.title,
      order_index: section.order_index,
      lessons,
    };
  });

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

// Fallback for simpler schema or when edX structure isn't available
const fetchCourseContentSimple = async (courseId: string, course: any): Promise<CourseDetail> => {
  // Try to fetch sections with subsections directly (without units/blocks)
  const { data: sections, error: sectionsError } = await supabase
    .from('sections')
    .select(`
      id,
      title,
      order_index,
      subsections (
        id,
        title,
        order_index
      )
    `)
    .eq('course_id', courseId)
    .order('order_index');

  if (sectionsError || !sections?.length) {
    console.warn('No sections found for course');
    return { ...course, modules: [] };
  }

  const modules = sections.map((section: any) => ({
    id: section.id,
    title: section.title,
    order_index: section.order_index,
    lessons: (section.subsections || [])
      .sort((a: any, b: any) => a.order_index - b.order_index)
      .map((sub: any, idx: number) => ({
        id: sub.id,
        title: sub.title,
        slug: sub.id,
        content_type: 'text',
        video_url: null,
        content_html: null,
        is_preview: false,
        order_index: idx,
      })),
  }));

  return { ...course, modules };
};

// Update enrollment progress when lessons are completed
export const updateEnrollmentProgress = async (
  courseId: string, 
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
      .from('enrollments')
      .update({ 
        progress,
        status: progress >= 100 ? 'completed' : 'active',
        last_accessed_at: new Date().toISOString(),
      })
      .eq('course_id', courseId)
      .eq('user_id', user.id);

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
 * Fetch course content with comprehensive offline support
 * - Online: Fetches from server, caches for offline
 * - Offline: Returns cached data with local file paths
 */
export const fetchCourseContentWithOfflineSupport = async (courseId: string): Promise<CourseDetail> => {
  const isOnline = await checkIsOnline();
  
  if (!isOnline) {
    // Offline mode - try to get from offline storage
    console.log('Offline: Loading cached course:', courseId);
    
    const offlineCourse = await getOfflineCourse(courseId);
    if (offlineCourse) {
      // Transform offline course to CourseDetail format
      // Replace remote URLs with local paths where available
      const courseDetail: CourseDetail = {
        id: offlineCourse.id,
        title: offlineCourse.title,
        description: offlineCourse.description,
        thumbnail_url: offlineCourse.thumbnail_local || offlineCourse.thumbnail_url,
        slug: offlineCourse.slug,
        created_at: offlineCourse.created_at,
        modules: offlineCourse.modules.map(mod => ({
          id: mod.id,
          title: mod.title,
          order_index: mod.order_index,
          lessons: mod.lessons.map(lesson => ({
            id: lesson.id,
            title: lesson.title,
            slug: lesson.slug,
            content_type: lesson.content_type,
            // Use local video path if available and downloaded
            video_url: lesson.video_local || lesson.video_url,
            video_provider: lesson.video_local ? 'direct' : lesson.video_provider, // Local files are always direct
            content_html: lesson.content_html,
            duration: lesson.duration || null,
            is_preview: lesson.is_preview,
            order_index: lesson.order_index,
            description: lesson.description,
            quiz_data: lesson.quiz_data,
            // Transform blocks to use local URIs
            blocks: lesson.blocks?.map(block => ({
              ...block,
              content: block.localUri 
                ? { ...block.content, url: block.localUri }
                : block.content,
            })),
          })),
        })),
      };
      
      return courseDetail;
    }
    
    // Also check legacy cache
    try {
      const cached = await AsyncStorage.getItem(`course_cache_${courseId}`);
      if (cached) {
        console.log('Using legacy course cache');
        return JSON.parse(cached);
      }
    } catch {}
    
    throw new Error('Course not available offline. Please download it first or connect to the internet.');
  }
  
  // Online mode - fetch from server
  try {
    const course = await fetchCourseContent(courseId);
    
    // Save to new offline storage for better offline support
    try {
      await saveCourseOffline(course);
    } catch (e) {
      console.warn('Failed to save course to offline storage:', e);
    }
    
    return course;
  } catch (error) {
    console.log('Network fetch failed, trying offline cache for course:', courseId);
    
    // Try new offline storage first
    const offlineCourse = await getOfflineCourse(courseId);
    if (offlineCourse) {
      // Return basic course detail from offline storage
      return {
        id: offlineCourse.id,
        title: offlineCourse.title,
        description: offlineCourse.description,
        thumbnail_url: offlineCourse.thumbnail_url,
        slug: offlineCourse.slug,
        created_at: offlineCourse.created_at,
        modules: offlineCourse.modules.map(mod => ({
          id: mod.id,
          title: mod.title,
          order_index: mod.order_index,
          lessons: mod.lessons.map(lesson => ({
            id: lesson.id,
            title: lesson.title,
            slug: lesson.slug,
            content_type: lesson.content_type,
            video_url: lesson.video_local || lesson.video_url,
            video_provider: lesson.video_local ? 'direct' : lesson.video_provider,
            content_html: lesson.content_html,
            duration: lesson.duration || null,
            is_preview: lesson.is_preview,
            order_index: lesson.order_index,
            description: lesson.description,
            quiz_data: lesson.quiz_data,
            blocks: lesson.blocks,
          })),
        })),
      };
    }
    
    // Try legacy cache
    try {
      const cached = await AsyncStorage.getItem(`course_cache_${courseId}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (cacheError) {
      console.warn('Failed to load course from legacy cache', cacheError);
    }
    
    throw error; // Throw original error if no cache
  }
};
