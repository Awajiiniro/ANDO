import { useState, useCallback } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import Splash from './screens/Splash';
import Login from './screens/Login';
import Register from './screens/Register';
import AddFriendsChoice from './screens/AddFriendsChoice';
import UsernameSearch from './screens/UsernameSearch';
import './styles/globals.css';

function AppContent() {
  const [screen, setScreen] = useState('splash');

  const handleSplashComplete = useCallback(() => {
    const token = localStorage.getItem('ando.auth_token');
    if (token) {
      setScreen('add-friends');
    } else {
      setScreen('login');
    }
  }, []);

  const handleSwitchToRegister = () => setScreen('register');
  const handleSwitchToLogin = () => setScreen('login');
  const handleLoginSuccess = () => setScreen('add-friends');
  const handleRegisterSuccess = () => setScreen('add-friends');
  const handleAddFriendsContinue = (method) => {
    if (method === 'username') {
      setScreen('username-search');
    } else {
      setScreen('home');
    }
  };

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
          onContinue={handleAddFriendsContinue}
          onSkip={() => setScreen('home')}
        />
      )}
      {screen === 'username-search' && (
        <UsernameSearch onBack={() => setScreen('add-friends')} />
      )}
      {screen === 'home' && (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-6">
          <div className="text-center space-y-3">
            <h1 className="text-3xl font-bold">Welcome to ANDO</h1>
            <p className="text-slate-600 dark:text-slate-400">You have entered the app successfully.</p>
          </div>
        </div>
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
