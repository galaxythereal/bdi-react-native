# BDI LMS - React Native Mobile App

A beautiful, modern mobile learning management system for iOS and Android with a burgundy theme.

## Features

- 🎨 Beautiful burgundy-themed UI/UX
- 📱 Native iOS and Android support
- 📚 Course browsing and enrollment
- 🎥 Video lesson playback
- 📖 Text-based lessons
- 📥 Offline video downloads
- 🔐 Secure authentication with Supabase
- 📊 Progress tracking

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (for iOS) or Android Emulator (for Android)
- Supabase account and project

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
Create a `.env` file in the root directory:
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. Start the development server:
```bash
npm start
```

4. Run on your platform:
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app on your device

## Project Structure

```
bdi-react-native/
├── app/                    # Expo Router pages
│   ├── (auth)/            # Authentication screens
│   ├── (student)/         # Student dashboard and screens
│   └── course/            # Course detail and player
├── src/
│   ├── components/        # Reusable UI components
│   ├── features/          # Feature modules
│   │   ├── auth/          # Authentication context
│   │   ├── courses/       # Course services
│   │   └── offline/       # Offline download manager
│   ├── lib/               # Utilities and constants
│   └── types/             # TypeScript types
└── assets/                # Images and fonts
```

## Key Features

### Authentication
- Magic link email authentication
- Session persistence
- Automatic token refresh

### Course Management
- Browse enrolled courses
- View course progress
- Access course content (videos, text, quizzes)

### Offline Support
- Download video lessons for offline viewing
- Cache course content
- Track download progress

## Design System

### Colors
- **Primary (Burgundy)**: `#800020`
- **Secondary (Gold)**: `#C5A059`
- **Background**: `#F5F5F7`
- **Surface**: `#FFFFFF`

### Typography
- System fonts with fallbacks
- Responsive font sizes
- Clear hierarchy

## Building for Production

### iOS
```bash
eas build --platform ios
```

### Android
```bash
eas build --platform android
```

## Integration with Admin Dashboard

This mobile app connects to the same Supabase backend as the web admin dashboard (`bdi-lms`). Both share:
- Same authentication system
- Same database schema
- Same API endpoints

Changes made in the admin dashboard (courses, users) are immediately reflected in the mobile app.

## Troubleshooting

### Common Issues

1. **Supabase connection errors**: Verify your environment variables
2. **Build errors**: Clear cache with `expo start -c`
3. **Video playback issues**: Ensure video URLs are accessible

## License

Private - BDI LMS
