import { useState } from 'react';
import AuthCard from '../components/auth/AuthCard';
import Button from '../components/common/Button';

export default function AddFriendsChoice({ onContinue, onSkip }) {
  const [method, setMethod] = useState(null);

  return (
    <AuthCard>
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">Add friends</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">Choose how you'd like to add friends</p>
      </div>

      <div className="mt-6 space-y-3">
        <button
          className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${method === 'email' ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/30' : 'border-slate-200 dark:border-slate-700'}`}
          onClick={() => setMethod('email')}
        >
          Add by Email
          <p className="text-xs text-slate-500">Send an invite via email</p>
        </button>

        <button
          className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${method === 'phone' ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/30' : 'border-slate-200 dark:border-slate-700'}`}
          onClick={() => setMethod('phone')}
        >
          Add by Phone / Contacts
          <p className="text-xs text-slate-500">Find contacts from your device</p>
        </button>

        <button
          className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${method === 'username' ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/30' : 'border-slate-200 dark:border-slate-700'}`}
          onClick={() => setMethod('username')}
        >
          Add by Username
          <p className="text-xs text-slate-500">Search friends by their username</p>
        </button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button type="button" variant="ghost" onClick={onSkip || (() => setMethod(null))}>
          Skip
        </Button>
        <Button type="button" variant="primary" onClick={() => onContinue(method)} disabled={!method}>
          Continue
        </Button>
      </div>
    </AuthCard>
  );
}
