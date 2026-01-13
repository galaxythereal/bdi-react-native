import { supabase } from '../../lib/supabase';
import { Certificate } from '../../types';
import { CERTIFICATE_CONFIG } from '../../lib/certificateConfig';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';

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

export const generateCertificateHTML = (certificate: Certificate, userName: string, templateBase64?: string): string => {
  const config = CERTIFICATE_CONFIG;
  const issueDateFormatted = new Date(certificate.issued_at).toLocaleDateString('en-US', config.issueDate.dateFormat);
  
  // Use base64 image if provided, otherwise use a placeholder background
  const backgroundStyle = templateBase64 
    ? `background-image: url('data:image/png;base64,${templateBase64}');`
    : `background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);`;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Certificate - ${certificate.course?.title}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: ${config.textStyle.fontFamily};
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #1a1a2e;
          }
          .certificate-container {
            position: relative;
            width: ${config.width}px;
            height: ${config.height}px;
            max-width: 100%;
            ${backgroundStyle}
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            box-shadow: 0 20px 60px rgba(0,0,0,0.4);
          }
          .text-overlay {
            position: absolute;
            color: ${config.textStyle.color};
            text-shadow: ${config.textStyle.textShadow};
          }
          .ref-number {
            left: ${config.refNumber.left}%;
            top: ${config.refNumber.top}%;
            font-size: ${config.refNumber.fontSize}px;
            font-weight: ${config.refNumber.fontWeight};
            text-align: ${config.refNumber.textAlign};
            transform: translateX(-100%);
          }
          .name {
            left: ${config.name.left}%;
            top: ${config.name.top}%;
            font-size: ${config.name.fontSize}px;
            font-weight: ${config.name.fontWeight};
            text-align: ${config.name.textAlign};
          }
          .course-name {
            left: ${config.courseName.left}%;
            top: ${config.courseName.top}%;
            font-size: ${config.courseName.fontSize}px;
            font-weight: ${config.courseName.fontWeight};
            text-align: ${config.courseName.textAlign};
          }
          .issue-date {
            left: ${config.issueDate.left}%;
            top: ${config.issueDate.top}%;
            font-size: ${config.issueDate.fontSize}px;
            font-weight: ${config.issueDate.fontWeight};
            text-align: ${config.issueDate.textAlign};
          }
        </style>
      </head>
      <body>
        <div class="certificate-container">
          <div class="text-overlay ref-number">${certificate.certificate_number}</div>
          <div class="text-overlay name">${userName}</div>
          <div class="text-overlay course-name">${certificate.course?.title || 'Course'} Certificate</div>
          <div class="text-overlay issue-date">${issueDateFormatted}</div>
        </div>
      </body>
    </html>
  `;
};

// Helper function to load the certificate template as base64
export const loadCertificateTemplate = async (): Promise<string | undefined> => {
  try {
    // Load the asset
    const asset = Asset.fromModule(require('../../../assets/images/certificate-template.png'));
    await asset.downloadAsync();
    
    if (asset.localUri) {
      const base64 = await FileSystem.readAsStringAsync(asset.localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return base64;
    }
  } catch (error) {
    console.error('Error loading certificate template:', error);
  }
  return undefined;
};
