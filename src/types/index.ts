export interface Course {
    id: string;
    title: string;
    description: string;
    thumbnail_url: string | null;
    slug: string;
    created_at: string;
}

export interface Enrollment {
    id: string;
    user_id: string;
    course_id: string;
    enrolled_at: string;
    progress: number; // 0-100
    course: Course;
}

export interface Profile {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    role: 'student' | 'admin' | 'instructor';
}

export interface Lesson {
    id: string;
    title: string;
    slug: string;
    content_type: 'video' | 'text' | 'quiz' | 'image' | 'file';
    video_url: string | null;
    video_provider?: 'youtube' | 'vimeo' | 'wistia' | 'direct';
    content_html: string | null;
    duration: number | null;
    is_preview: boolean;
    order_index: number;
    description?: string | null;
    quiz_data?: any;
    blocks?: any[];
}

export interface Module {
    id: string;
    title: string;
    lessons: Lesson[];
    order_index: number;
}

export interface CourseDetail extends Course {
    modules: Module[];
}

