/**
 * Certificate Template Configuration
 * =================================
 * Edit the values below to adjust text positions, sizes, and styles
 * on the certificate template.
 * 
 * All position values are in percentage of the image dimensions.
 * Font sizes are in pixels.
 */

export const CERTIFICATE_CONFIG = {
  // Template image path (relative to public folder)
  templateImage: '/images/certificate-template.png',
  
  // Certificate dimensions (aspect ratio should match your template)
  width: 2048,  // px - adjust to match your template
  height: 1448,  // px - adjust to match your template

  // Reference Number (top right corner)
  refNumber: {
    // Position from left edge (percentage)
    left: 85,
    // Position from top edge (percentage)
    top: 8,
    // Font size in pixels
    fontSize: 25,
    // Font weight
    fontWeight: '600',
    // Text alignment
    textAlign: 'left' as const,
  },

  // Student Name (left middle area)
  name: {
    // Position from left edge (percentage)
    left: 30,
    // Position from top edge (percentage)
    top: 45,
    // Font size in pixels
    fontSize: 48,
    // Font weight
    fontWeight: 'bold',
    // Text alignment
    textAlign: 'left' as const,
  },

  // Course Name + "Certificate" (below name)
  courseName: {
    // Position from left edge (percentage)
    left: 30,
    // Position from top edge (percentage)
    top: 55,
    // Font size in pixels
    fontSize: 35,
    // Font weight
    fontWeight: '600',
    // Text alignment
    textAlign: 'left' as const,
  },

  // Issue Date (below course name, slightly to the right)
  issueDate: {
    // Position from left edge (percentage)
    left: 39,
    // Position from top edge (percentage)
    top: 64,
    // Font size in pixels
    fontSize: 30,
    // Font weight
    fontWeight: 'normal',
    // Text alignment
    textAlign: 'left' as const,
    // Date format options
    dateFormat: {
      year: 'numeric' as const,
      month: 'long' as const,
      day: 'numeric' as const,
    },
  },

  // Text styling
  textStyle: {
    // Text color (white as requested)
    color: '#FFFFFF',
    // Font family
    fontFamily: "'Times New Roman', 'Georgia', serif",
    // Text shadow for better visibility on image
    textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)',
  },
};

export type CertificateConfigType = typeof CERTIFICATE_CONFIG;
