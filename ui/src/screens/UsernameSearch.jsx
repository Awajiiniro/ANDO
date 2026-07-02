import { useState } from 'react';
import AuthCard from '../components/auth/AuthCard';
import Button from '../components/common/Button';
import Input from '../components/common/Input';

export default function UsernameSearch({ onBack }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const searchUsers = async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setError('');
    setLoading(true);

    try {
      const token = localStorage.getItem('ando.auth_token');
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(query.trim())}`, {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Search failed');
        setResults([]);
      } else {
        setResults(data.users || []);
      }
    } catch (err) {
      setError(err.message || 'Search request failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard>
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">Search users</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">Find other users by username</p>
      </div>

      <div className="mt-6 space-y-4">
        <Input
          type="text"
          label="Username"
          placeholder="john_doe"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="secondary" onClick={onBack}>
            Back
          </Button>
          <Button type="button" variant="primary" onClick={searchUsers} loading={loading}>
            Search
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
              No users found.
            </div>
          ) : (
            results.map((user) => (
              <div
                key={user.id}
                className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900"
              >
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
