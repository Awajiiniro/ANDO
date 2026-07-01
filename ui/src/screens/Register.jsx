import { useState, useMemo } from 'react';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import AuthCard from '../components/auth/AuthCard';

const PASSWORD_STRENGTH = {
  weak: { label: 'Weak', color: 'bg-red-500', width: '33%' },
  fair: { label: 'Fair', color: 'bg-yellow-500', width: '66%' },
  strong: { label: 'Strong', color: 'bg-green-500', width: '100%' },
};

function calculatePasswordStrength(password) {
  if (!password) return null;
  let strength = 0;
  if (password.length >= 8) strength++;
  if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
  if (password.match(/[0-9]/)) strength++;
  if (password.match(/[^a-zA-Z0-9]/)) strength++;

  if (strength <= 1) return 'weak';
  if (strength <= 2) return 'fair';
  return 'strong';
}

export default function Register({ onSwitchToLogin, onRegisterSuccess }) {
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const passwordStrength = useMemo(
    () => calculatePasswordStrength(formData.password),
    [formData.password]
  );

  const validateForm = () => {
    const newErrors = {};

    if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!formData.username.trim()) newErrors.username = 'Username is required';
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(formData.username)) {
      newErrors.username = 'Username must be 3-20 characters (letters, numbers, underscore)';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    if (!termsAccepted) {
      newErrors.terms = 'You must accept the terms';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.fullName,
          username: formData.username,
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrors({ submit: data.error || 'Registration failed' });
        return;
      }

      localStorage.setItem('ando.auth_token', data.token);
      localStorage.setItem('ando.auth_user', JSON.stringify(data.user));
      onRegisterSuccess();
    } catch (err) {
      setErrors({ submit: err.message || 'An error occurred' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard>
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold gradient-text">Create account</h1>
        <p className="text-slate-600 dark:text-slate-400">Join ANDO for secure messaging</p>
      </div>

      {/* Error message */}
      {errors.submit && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {errors.submit}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Full Name"
          placeholder="John Doe"
          name="fullName"
          value={formData.fullName}
          onChange={handleChange}
          error={errors.fullName}
          required
        />

        <Input
          label="Username"
          placeholder="john_doe"
          name="username"
          value={formData.username}
          onChange={handleChange}
          error={errors.username}
          required
        />

        <Input
          type="email"
          label="Email address"
          placeholder="you@example.com"
          name="email"
          value={formData.email}
          onChange={handleChange}
          error={errors.email}
          required
        />

        <div>
          <Input
            type="password"
            label="Password"
            placeholder="••••••••"
            name="password"
            value={formData.password}
            onChange={handleChange}
            error={errors.password}
            showPasswordToggle
            required
          />

          {/* Password strength meter */}
          {formData.password && (
            <div className="mt-2 space-y-1">
              <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    PASSWORD_STRENGTH[passwordStrength].color
                  }`}
                  style={{ width: PASSWORD_STRENGTH[passwordStrength].width }}
                />
              </div>
              <p className={`text-xs font-medium ${
                passwordStrength === 'weak' ? 'text-red-500' :
                passwordStrength === 'fair' ? 'text-yellow-500' :
                'text-green-500'
              }`}>
                Password strength: {PASSWORD_STRENGTH[passwordStrength].label}
              </p>
            </div>
          )}
        </div>

        <Input
          type="password"
          label="Confirm password"
          placeholder="••••••••"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleChange}
          error={errors.confirmPassword}
          required
        />

        {/* Terms checkbox */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-1 w-4 h-4 accent-primary-600 rounded cursor-pointer"
          />
          <span className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
            I agree to the{' '}
            <a href="#" className="text-primary-600 dark:text-primary-400 font-semibold hover:underline">
              Terms of Service
            </a>
            {' '}and{' '}
            <a href="#" className="text-primary-600 dark:text-primary-400 font-semibold hover:underline">
              Privacy Policy
            </a>
          </span>
        </label>
        {errors.terms && <p className="text-sm text-red-500">{errors.terms}</p>}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={loading}
        >
          Create Account
        </Button>
      </form>

      {/* Login link */}
      <div className="text-center">
        <p className="text-slate-600 dark:text-slate-400 text-sm">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
          >
            Sign in
          </button>
        </p>
      </div>
    </AuthCard>
  );
}
