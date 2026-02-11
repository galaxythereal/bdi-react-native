// ===========================================
// DIPLOMA-BASED LMS STRUCTURE
// Hierarchy: Diplomas → Courses → Chapters → Lessons
// ===========================================

// Diploma - Top level educational program
export interface Diploma {
  id: string;
  title: string;
  title_ar?: string | null;
  description: string | null;
  description_ar?: string | null;
  thumbnail_url: string | null;
  slug: string;
  status: "draft" | "published" | "archived";
  is_public?: boolean;
  is_featured?: boolean;
  duration_weeks: number | null;
  price: number | null;
  currency: string;
  created_at: string;
  updated_at: string;
  courses_count?: number;
  enrolled_count?: number;
}

// Course - Part of a diploma
export interface Course {
  id: string;
  diploma_id: string | null;
  title: string;
  title_ar?: string | null;
  description: string | null;
  description_ar?: string | null;
  thumbnail_url: string | null;
  slug: string;
  status: "draft" | "published" | "archived";
  is_public: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
  chapters_count?: number;
  diploma?: Diploma;
}

// Chapter - Container for lessons within a course
export interface Chapter {
  id: string;
  course_id: string;
  title: string;
  title_ar?: string | null;
  description: string | null;
  description_ar?: string | null;
  order_index: number;
  is_locked: boolean;
  unlock_date: string | null;
  created_at: string;
  lessons?: Lesson[];
  lessons_count?: number;
}

// Lesson - Individual learning content
export interface Lesson {
  id: string;
  chapter_id: string;
  title: string;
  title_ar?: string | null;
  slug: string;
  content_type: "video" | "text" | "quiz" | "image" | "file" | "audio" | "pdf";
  video_url: string | null;
  video_provider?: "youtube" | "vimeo" | "wistia" | "direct";
  audio_url?: string | null;
  pdf_url?: string | null;
  content_html: string | null;
  duration: number | null;
  is_preview: boolean;
  order_index: number;
  description?: string | null;
  quiz_data?: any;
  blocks?: any[];
  created_at?: string;
  updated_at?: string;
}

// Enrollment - User's enrollment in a diploma
export interface Enrollment {
  id: string;
  user_id: string;
  diploma_id: string;
  batch_id: string | null;
  enrolled_at: string;
  progress: number; // 0-100
  status: "pending" | "active" | "completed" | "dropped" | "suspended";
  enrollment_type: "batch" | "individual";
  expires_at: string | null;
  last_accessed_at?: string | null;
  completed_at?: string | null;
  diploma?: Diploma;
  batch?: Batch;
  courses?: {
    id: string;
    title: string;
    title_ar?: string | null;
    thumbnail_url?: string | null;
    order_index?: number;
  }[];
}

// Batch - Group enrollment with scheduled sessions
export interface Batch {
  id: string;
  diploma_id: string;
  name: string;
  name_ar?: string | null;
  description: string | null;
  description_ar?: string | null;
  start_date: string;
  end_date: string | null;
  max_students: number | null;
  current_students: number;
  status: "upcoming" | "active" | "completed" | "cancelled";
  instructor_id: string | null;
  whatsapp_group_link: string | null;
  created_at: string;
  diploma?: Diploma;
  instructor?: Profile;
}

// Live Session - Scheduled live classes for batches
export interface LiveSession {
  id: string;
  batch_id: string;
  course_id: string | null;
  title: string;
  title_ar?: string | null;
  description: string | null;
  description_ar?: string | null;
  scheduled_at: string;
  duration_minutes: number;
  meeting_url: string | null;
  meeting_platform: "zoom" | "google_meet" | "teams" | "other";
  recording_url: string | null;
  status: "scheduled" | "live" | "completed" | "cancelled";
  instructor_id: string | null;
  created_at: string;
  batch?: Batch;
}

// Profile - User profile
export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  role: "student" | "admin" | "instructor" | "support";
  status: "pending" | "active" | "suspended" | "inactive";
  whatsapp_number: string | null;
  created_at: string;
  updated_at: string;
}

// Certificate
export interface Certificate {
  id: string;
  user_id: string;
  diploma_id: string;
  enrollment_id: string;
  certificate_number: string;
  verification_code: string;
  issued_at: string;
  diploma?: Diploma;
  profile?: Profile;
}

// Support Ticket
export interface SupportTicket {
  id: string;
  user_id: string;
  assigned_to: string | null;
  subject: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
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

// WhatsApp Inquiry - For purchase flow
export interface WhatsAppInquiry {
  id: string;
  user_id: string | null;
  diploma_id: string;
  name: string;
  email: string;
  phone: string;
  whatsapp_number: string;
  message: string | null;
  status: "new" | "contacted" | "converted" | "closed";
  notes: string | null;
  created_at: string;
  diploma?: Diploma;
}

// Notification
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type:
    | "general"
    | "course"
    | "batch"
    | "certificate"
    | "reminder"
    | "live_session";
  data: any;
  read_at: string | null;
  created_at: string;
}

// Lesson Progress - Track individual lesson completion
export interface LessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  enrollment_id: string;
  completed: boolean;
  completed_at: string | null;
  time_spent: number; // seconds
  last_position: number; // for video progress
  created_at: string;
  updated_at: string;
}

// Module type for CourseDetail chapter grouping
export interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
  order_index: number;
}

// CourseDetail - Extended course with chapters
export interface CourseDetail {
  id: string;
  title: string;
  title_ar?: string | null;
  description: string | null;
  description_ar?: string | null;
  thumbnail_url: string | null;
  slug: string;
  diploma_id?: string | null;
  status?: "draft" | "published" | "archived";
  is_public?: boolean;
  order_index?: number;
  created_at: string;
  updated_at?: string;
  chapters?: Chapter[];
}

// DiplomaDetail - Extended diploma with courses
export interface DiplomaDetail extends Diploma {
  courses: CourseDetail[];
}

// Catalog Item - For browsing locked content
export interface CatalogDiploma extends Diploma {
  courses: {
    id: string;
    title: string;
    title_ar?: string | null;
    description: string | null;
    description_ar?: string | null;
    thumbnail_url: string | null;
    order_index: number;
    chapters: {
      id: string;
      title: string;
      title_ar?: string | null;
      lessons_count: number;
    }[];
  }[];
}
