import { supabase } from '../../lib/supabase';
import { Certificate } from '../../types';

export const fetchMyCertificates = async (): Promise<Certificate[]> => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('Auth error:', userError);
      throw new Error('Not authenticated. Please sign in again.');
    }

    const { data, error } = await supabase
      .from('certificates')
      .select(`
        *,
        course:courses (
          id,
          title,
          description,
          thumbnail_url,
          slug
        )
      `)
      .eq('user_id', user.id)
      .order('issued_at', { ascending: false });

    if (error) {
      console.error('Error fetching certificates:', error);
      // If table doesn't exist, return empty array
      if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
        console.warn('Certificates table may not exist');
        return [];
      }
      throw new Error(error.message || 'Failed to load certificates');
    }

    return (data || []) as Certificate[];
  } catch (error: any) {
    console.error('fetchMyCertificates error:', error);
    throw error;
  }
};

export const getCertificateByVerificationCode = async (code: string): Promise<Certificate | null> => {
  try {
    const { data, error } = await supabase
      .from('certificates')
      .select(`
        *,
        course:courses (
          id,
          title,
          description,
          thumbnail_url
        )
      `)
      .eq('verification_code', code.toUpperCase())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw error;
    }

    return data as Certificate;
  } catch (error) {
    console.error('getCertificateByVerificationCode error:', error);
    return null;
  }
};

export const generateCertificateHTML = (certificate: Certificate, userName: string): string => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Certificate - ${certificate.course?.title}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Times New Roman', serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            padding: 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .certificate {
            background: linear-gradient(180deg, #ffffff 0%, #f8f9fa 100%);
            padding: 40px;
            border: 12px solid #D4AF37;
            border-radius: 8px;
            text-align: center;
            max-width: 600px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.4);
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            color: #6366f1;
            margin-bottom: 10px;
            letter-spacing: 2px;
          }
          .header {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 15px;
            color: #1a1a2e;
            text-transform: uppercase;
            letter-spacing: 3px;
          }
          .subtitle {
            font-size: 16px;
            margin-bottom: 25px;
            color: #666;
          }
          .name {
            font-size: 26px;
            font-weight: bold;
            margin: 20px 0;
            color: #6366f1;
            border-bottom: 2px solid #D4AF37;
            display: inline-block;
            padding-bottom: 8px;
          }
          .course {
            font-size: 18px;
            margin: 15px 0;
            color: #333;
            font-style: italic;
          }
          .date {
            font-size: 14px;
            margin-top: 25px;
            color: #666;
          }
          .code {
            font-size: 11px;
            margin-top: 15px;
            color: #999;
            font-family: monospace;
          }
          .seal {
            margin-top: 20px;
            font-size: 40px;
          }
        </style>
      </head>
      <body>
        <div class="certificate">
          <div class="logo">BDI LEARNING</div>
          <div class="header">Certificate of Completion</div>
          <div class="subtitle">This is to certify that</div>
          <div class="name">${userName}</div>
          <div class="subtitle">has successfully completed the course</div>
          <div class="course">"${certificate.course?.title || 'Course'}"</div>
          <div class="seal">🏆</div>
          <div class="date">Issued on ${new Date(certificate.issued_at).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</div>
          <div class="code">Certificate: ${certificate.certificate_number}</div>
          <div class="code">Verification: ${certificate.verification_code}</div>
        </div>
      </body>
    </html>
  `;
};
