# ANDO UI - Premium Messaging Interface

A production-ready, modern React + Tailwind CSS authentication and messaging interface with Apple-level design polish, dark/light mode support, and smooth animations.

## 🎨 Design System

### Colors
- **Primary**: Electric Blue (#2563EB)
- **Secondary**: Deep Purple (#7C3AED)
- **Accent**: Cyan (#06B6D4)
- **Dark Mode**: #0A0A0A, #111111, #18181B
- **Light Mode**: #FFFFFF, #F8FAFC, #F1F5F9

### Typography
- **Font**: Inter, SF Pro Display, system sans-serif
- **Sizes**: 12px - 36px (12px baseline grid)
- **Weights**: 400 (regular), 500 (medium), 600 (semibold), 700 (bold), 800 (extrabold)

### Spacing & Borders
- **Spacing Grid**: 4px increments (xs: 4px, sm: 8px, md: 12px, lg: 16px, xl: 24px, 2xl: 32px, 3xl: 48px)
- **Border Radius**: 8px, 12px, 16px, 20px, 24px (rounded-lg to rounded-2xl)
- **Shadows**: Soft, layered shadows from xs to 2xl

### Animations
- **Fade In**: 0.5s ease-in-out
- **Slide Up/Down**: 0.3s ease-out
- **Focus States**: Smooth ring + offset
- **Micro-interactions**: Button scale, input glow, hover states
- **Frame Rate**: 60fps smooth motion

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm

### Installation

```bash
cd ui
npm install
```

### Development

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

The dev server proxies API requests to `http://localhost:3000` (the Node.js backend).

### Build

```bash
npm run build
```

Creates optimized production build in `dist/`

## 📁 Project Structure

```
ui/
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   └── AuthCard.jsx          # Auth screen wrapper
│   │   └── common/
│   │       ├── Button.jsx             # Reusable button component
│   │       └── Input.jsx              # Text input with validation
│   ├── context/
│   │   └── ThemeContext.jsx          # Dark/Light mode management
│   ├── screens/
│   │   ├── Splash.jsx                # Loading screen
│   │   ├── Login.jsx                 # Login page
│   │   └── Register.jsx              # Registration page
│   ├── styles/
│   │   └── globals.css               # Tailwind + custom CSS
│   ├── App.jsx                       # Main app shell
│   └── main.jsx                      # React entry point
├── index.html                        # HTML template
├── tailwind.config.js                # Tailwind theme configuration
├── vite.config.js                    # Vite configuration
├── postcss.config.js                 # PostCSS configuration
└── package.json                      # Dependencies
```

## 🎭 Screens

### Splash Screen
- **Purpose**: Loading/intro screen
- **Features**: Animated ANDO logo, gradient glow, 2.5s duration
- **Mobile-First**: Centered logo with responsive sizing

### Login Screen
- **Email input** with validation
- **Password input** with show/hide toggle
- **Forgot Password** link
- **Social login buttons** (Google, Apple placeholders)
- **Dark/Light mode toggle**
- **Error handling** with visual feedback
- **Sign up link** to registration

### Registration Screen
- **Full Name** input
- **Username** input with validation (3-20 chars, alphanumeric + underscore)
- **Email** input with validation
- **Password** input with strength meter (weak/fair/strong)
- **Confirm Password** input with match validation
- **Terms & Privacy** checkbox
- **Error messages** for each field
- **Sign in link** to login

## 🔧 Components

### Button.jsx
```jsx
<Button
  variant="primary|secondary|ghost|danger"
  size="sm|md|lg"
  fullWidth={false}
  loading={false}
  disabled={false}
>
  Click me
</Button>
```

### Input.jsx
```jsx
<Input
  type="text|email|password"
  label="Label"
  placeholder="Placeholder"
  error="Error message"
  icon={<Icon />}
  showPasswordToggle={false}
  required={false}
/>
```

### AuthCard.jsx
Wrapper component for authentication screens with glassmorphism styling.

## 🌓 Dark Mode

- **Automatic detection**: System preference on first visit
- **Manual toggle**: Theme button in UI
- **Persistence**: Saved to localStorage
- **Smooth transition**: 200ms color transition

## 🔐 Authentication Integration

### Login Flow
```
1. User enters email/password
2. POST /api/auth/login
3. Receives JWT token
4. Stored in localStorage
5. Redirects to main app
```

### Registration Flow
```
1. User fills registration form
2. Form validation on client
3. POST /api/auth/register
4. Receives JWT token
5. Stored in localStorage
6. Redirects to main app
```

### API Endpoints
- `POST /api/auth/register` - Email/password registration
- `POST /api/auth/login` - Email/password login
- `POST /api/auth/register-phone` - Phone registration
- `POST /api/auth/login-phone` - Phone login
- `POST /api/auth/google` - Google OAuth callback

## 📱 Responsive Design

### Breakpoints
- **Mobile**: 320px - 640px
- **Tablet**: 640px - 1024px
- **Desktop**: 1024px+
- **Wide**: 1440px+
- **Ultrawide**: 1920px+

All screens are mobile-first and adapt seamlessly to larger screens.

## 🎯 Accessibility

- **Semantic HTML**: Proper form labels and structure
- **Focus Management**: Visible focus rings on all interactive elements
- **Keyboard Navigation**: Full keyboard support
- **Color Contrast**: WCAG AA compliant
- **ARIA Labels**: Where appropriate

## 🔄 State Management

Uses React hooks and Context API for:
- **Theme state**: Dark/Light mode
- **Form state**: Login/Register forms
- **Auth state**: Token management

## 🎬 Animations

All animations use CSS and Framer Motion for smooth 60fps performance:
- Logo glow pulse on splash screen
- Form fade-in on load
- Button hover/active states
- Input focus glow
- Page transitions (future)

## 🛠️ Development

### Component Pattern
```jsx
export default function ComponentName({ prop1, prop2 }) {
  const [state, setState] = useState(initialValue);
  
  return (
    <div className="tailwind-classes">
      Content
    </div>
  );
}
```

### Styling Pattern
- Use Tailwind CSS for responsive design
- Use custom CSS classes for complex animations
- Use CSS variables for theming
- Keep components small and focused

### Testing
Add unit tests for components and integration tests for auth flows.

## 📦 Dependencies

- **react**: UI framework
- **react-dom**: React DOM rendering
- **framer-motion**: Advanced animations
- **tailwindcss**: Utility-first CSS
- **vite**: Fast build tool
- **axios**: HTTP client (for future API calls)

## 🚀 Production Deployment

1. Build: `npm run build`
2. Output: `dist/` directory
3. Deploy to Vercel, Netlify, or static host
4. Set API proxy in production environment

## 📝 Future Features

- ✅ Auth screens (complete)
- ⏳ Main chat interface
- ⏳ Contact list screen
- ⏳ Profile & settings screens
- ⏳ Group chats
- ⏳ Media sharing
- ⏳ Status/stories
- ⏳ Voice/video calls
- ⏳ Push notifications

## 🔗 Integration

This UI connects to the ANDO backend:
- Runs on `http://localhost:5173` (dev)
- Proxies API calls to `http://localhost:3000`
- Uses JWT tokens for authentication
- Stores user data in localStorage

## 📄 License

Part of ANDO secure messaging platform.

---

Built with ❤️ for secure, beautiful communication.
