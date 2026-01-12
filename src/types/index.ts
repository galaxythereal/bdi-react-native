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
    status?: 'active' | 'completed' | 'dropped' | 'pending';
    course: Course;
}

export interface Profile {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    role: 'student' | 'admin' | 'instructor' | 'support';
    status?: 'pending' | 'active' | 'suspended' | 'inactive';
}

export interface Certificate {
    id: string;
    user_id: string;
    course_id: string;
    enrollment_id: string;
    certificate_number: string;
    verification_code: string;
    issued_at: string;
    course?: Course;
}

export interface SupportTicket {
    id: string;
    user_id: string;
    assigned_to: string | null;
    subject: string;
    description: string;
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    created_at: string;
    updated_at: string;
    resolved_at: string | null;
    messages?: TicketMessage[];
}

export interface TicketMessage {
    id: string;
    ticket_id: string;
    user_id: string;
    message: string;
    is_internal: boolean;
    created_at: string;
    profile?: Profile;
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


