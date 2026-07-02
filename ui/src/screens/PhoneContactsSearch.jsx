import { useState } from 'react';
import AuthCard from '../components/auth/AuthCard';
import Button from '../components/common/Button';
import Input from '../components/common/Input';

export default function PhoneContactsSearch({ onBack, onDone }) {
  const [manualPhone, setManualPhone] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const requestToken = () => localStorage.getItem('ando.auth_token');

  const searchByPhone = async (phoneNumbers) => {
    const token = requestToken();
    if (!token) {
      setError('Please sign in again to continue.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/users/contacts', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phoneNumbers }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Contact lookup failed');
        setResults([]);
        return;
      }

      setResults(data.users || []);
    } catch (err) {
      setError(err.message || 'Contact lookup failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUseContacts = async () => {
    if (!('contacts' in navigator) || !navigator.contacts?.select) {
      setError('Contacts access is not supported in this browser.');
      return;
    }

    try {
      const contacts = await navigator.contacts.select(['tel', 'name']);
      const phoneNumbers = contacts
        .flatMap((contact) => contact.tel || [])
        .map((entry) => entry.value)
        .filter(Boolean);

      if (!phoneNumbers.length) {
        setError('No phone numbers were shared from your contacts.');
        return;
      }

      await searchByPhone(phoneNumbers);
    } catch (err) {
      setError(err.message || 'Unable to access contacts');
    }
  };

  const handleManualSearch = async () => {
    const value = manualPhone.trim();
    if (!value) {
      setResults([]);
      return;
    }

    await searchByPhone([value]);
  };

  return (
    <AuthCard>
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">Find by phone</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          We only use your contacts to find matching ANDO users. Phone numbers are never shared publicly.
        </p>
      </div>

      <div className="mt-6 space-y-4">
        <Button type="button" variant="primary" onClick={handleUseContacts} loading={loading} fullWidth>
          Allow access to contacts
        </Button>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
          <Input
            type="tel"
            label="Phone number"
            placeholder="+1 555 123 4567"
            value={manualPhone}
            onChange={(e) => setManualPhone(e.target.value)}
          />
          <Button type="button" variant="secondary" onClick={handleManualSearch} loading={loading} fullWidth>
            Search this phone number
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="secondary" onClick={onBack}>
            Back
          </Button>
          <Button type="button" variant="primary" onClick={onDone}>
            Done
          </Button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {results.length === 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-sm text-slate-500 dark:text-slate-400">
              No matching users yet.
            </div>
          ) : (
            results.map((user) => (
              <div key={user.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold">{user.username || user.email}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{user.full_name || 'No name provided'}</p>
                  </div>
                  <Button type="button" variant="ghost">
                    View
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AuthCard>
  );
}
