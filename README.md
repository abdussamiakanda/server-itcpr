# ITCPR Server Portal - React Application

A modern React-based web application for managing ITCPR server access, monitoring, and statistics.

## Features

- **Modern React Architecture**: Built with React 18, Vite, and React Router
- **Firebase Integration**: Authentication and Firestore database
- **Real-time Monitoring**: Server status, active connections, and WSL command logs
- **Statistics Dashboard**: Usage analytics, session timelines, and storage tracking
- **Access Management**: Server access requests, approvals, and user management
- **Responsive Design**: Modern, professional UI with preserved color theme

## Prerequisites

- Node.js 16+ and npm/yarn
- Firebase project with Firestore and Realtime Database enabled
- Access to ITCPR API endpoints

## Installation

1. Clone the repository:
```bash
cd server-itcpr
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory (copy from `.env.example`):
```bash
cp .env.example .env
```

4. Update `.env` with your Firebase configuration and API URLs:
```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
VITE_FIREBASE_DATABASE_URL=your_firebase_database_url
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_firebase_measurement_id

VITE_API_BASE_URL=your_api_base_url
VITE_SSO_URL=your_sso_url
VITE_ZEROTIER_AUTHENTICATE_URL=your_zerotier_authenticate_url
VITE_ZEROTIER_DEAUTHENTICATE_URL=your_zerotier_deauthenticate_url
VITE_EMAIL_API_URL=your_email_api_url
VITE_PORTAL_GUIDE_URL=your_portal_guide_url
```

## Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Building for Production

Build the production bundle:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## Project Structure

```
src/
├── components/          # Reusable React components
│   ├── Navbar.jsx      # Navigation bar component
│   ├── Modal.jsx       # Modal dialog component
│   └── ProtectedRoute.jsx  # Route protection
├── contexts/           # React contexts
│   └── AuthContext.jsx # Authentication context
├── pages/              # Page components
│   ├── Home.jsx        # Landing page
│   ├── Dashboard.jsx   # Main dashboard
│   ├── Monitor.jsx     # WSL command monitoring
│   ├── Statistics.jsx  # Usage statistics
│   ├── Changelog.jsx   # Software changelog
│   └── Others.jsx      # Additional server info
├── services/           # API services
│   ├── email.js        # Email service
│   └── zerotier.js     # ZeroTier API service
├── config/             # Configuration files
│   ├── firebase.js     # Firebase configuration
│   └── api.js          # API endpoints
├── App.jsx             # Main app component
├── main.jsx            # Entry point
└── index.css           # Global styles
```

## Color Theme

The application uses the following color scheme:
- **Primary**: `rgb(157, 157, 189)` - Lavender/purple
- **Background**: `#f8fafc` - Light gray
- **Cards**: `#ffffff` - White
- **Text**: `#4b5563` - Dark gray
- **Borders**: `#e0e0e0` - Light gray

## Key Features

### Authentication
- SSO integration with ITCPR authentication system
- Firebase custom token authentication
- Protected routes for authenticated users

### Dashboard
- Real-time server status (Alpha server)
- Server access management
- Active connections monitoring
- Resilio Sync integration
- Admin access request management

### Monitor
- WSL command log viewing
- Filtering by user, command ID, and date
- Search functionality
- Real-time updates

### Statistics
- User usage summaries
- Session timelines
- Storage usage tracking
- Most active days analysis

### Changelog
- Windows software listings
- WSL/Linux package listings
- Search functionality
- Installation date tracking

## Environment Variables

All sensitive configuration is stored in `.env` file:
- Firebase credentials
- API endpoints
- SSO configuration

**Important**: Never commit `.env` file to version control. The `.env.example` file is provided as a template.

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

© ITCPR. All Rights Reserved.

