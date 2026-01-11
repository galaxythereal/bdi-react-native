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
            
            // Use first block's type as primary content type
            let content_type = firstBlock?.type || 'text';
            let video_url = null;
            let video_provider = 'direct';
            let content_html = null;
            let quiz_data = null;
            
            // Extract video data if present
            if (videoBlock) {
              video_url = videoBlock.content?.url || videoBlock.content?.video_url;
              video_provider = videoBlock.content?.provider || 'direct';
              // If first block is video, set content_type
              if (firstBlock?.type === 'video') {
                content_type = 'video';
              }
            }
            // Extract quiz data if present
            if (quizBlock) {
              content_type = 'quiz';
              // Transform quiz block content to QuizData format
              // New format stores questions array directly: { title, time_limit, passing_score, questions: [...] }
              // Legacy format is single question: { question, question_type, options, explanation, points, attempts }
              const quizContent = quizBlock.content || {};
              
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
                    type: q.question_type === 'multiple_select' ? 'multiple_choice' : 
                          q.question_type === 'numeric' ? 'short_answer' :
                          q.question_type === 'text' ? 'short_answer' :
                          q.question_type || 'multiple_choice',
                    options: (q.options || []).map((opt: any) => opt.text || opt),
                    correct_answer: q.question_type === 'text' || q.question_type === 'numeric' 
                      ? q.correct_text_answer || ''
                      : (q.options || []).findIndex((opt: any) => opt.correct === true),
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
                    type: quizContent.question_type === 'multiple_select' ? 'multiple_choice' : 
                          quizContent.question_type === 'numeric' ? 'short_answer' :
                          quizContent.question_type === 'text' ? 'short_answer' :
                          quizContent.question_type || 'multiple_choice',
                    options: (quizContent.options || []).map((opt: any) => opt.text || opt),
                    correct_answer: quizContent.question_type === 'text' || quizContent.question_type === 'numeric'
                      ? quizContent.correct_text_answer || ''
                      : (quizContent.options || []).findIndex((opt: any) => opt.correct === true),
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
                      type: qc.question_type === 'multiple_select' ? 'multiple_choice' : 
                            qc.question_type === 'numeric' ? 'short_answer' :
                            qc.question_type === 'text' ? 'short_answer' :
                            qc.question_type || 'multiple_choice',
                      options: (qc.options || []).map((opt: any) => opt.text || opt),
                      correct_answer: qc.question_type === 'text' || qc.question_type === 'numeric'
                        ? qc.correct_text_answer || ''
                        : (qc.options || []).findIndex((opt: any) => opt.correct === true),
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

