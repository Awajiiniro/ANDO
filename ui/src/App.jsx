import { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import Splash from './screens/Splash';
import Login from './screens/Login';
import Register from './screens/Register';
import './styles/globals.css';

function AppContent() {
  const [screen, setScreen] = useState('splash');

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('ando.auth_token');
    if (token) {
      // Redirect to main app (for now, just go to login since we're still building auth screens)
      window.location.href = '/';
    }
  }, []);

  const handleSplashComplete = () => setScreen('login');
  const handleSwitchToRegister = () => setScreen('register');
  const handleSwitchToLogin = () => setScreen('login');
  const handleLoginSuccess = () => window.location.href = '/';
  const handleRegisterSuccess = () => window.location.href = '/';

  return (
    <>
      {screen === 'splash' && <Splash onComplete={handleSplashComplete} />}
      {screen === 'login' && (
        <Login
          onSwitchToRegister={handleSwitchToRegister}
          onLoginSuccess={handleLoginSuccess}
        />
      )}
      {screen === 'register' && (
        <Register
          onSwitchToLogin={handleSwitchToLogin}
          onRegisterSuccess={handleRegisterSuccess}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
