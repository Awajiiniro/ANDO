import { useState, useCallback } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import Splash from './screens/Splash';
import Login from './screens/Login';
import Register from './screens/Register';
import AddFriendsChoice from './screens/AddFriendsChoice';
import './styles/globals.css';

function AppContent() {
  const [screen, setScreen] = useState('splash');

  // Wait until the splash completes, then decide where to go.
  const handleSplashComplete = useCallback(() => {
    console.log('handleSplashComplete invoked');
    const token = localStorage.getItem('ando.auth_token');
    if (token) {
      console.log('token found, redirecting to /');
      window.location.href = '/';
    } else {
      console.log('no token, switching to login screen');
      setScreen('login');
    }
  }, [setScreen]);
  const handleSwitchToRegister = () => setScreen('register');
  const handleSwitchToLogin = () => setScreen('login');
  const handleLoginSuccess = () => setScreen('add-friends');
  const handleRegisterSuccess = () => setScreen('add-friends');

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
      {screen === 'add-friends' && (
        <AddFriendsChoice
          onComplete={() => (window.location.href = '/')}
          onSkip={() => (window.location.href = '/')}
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
