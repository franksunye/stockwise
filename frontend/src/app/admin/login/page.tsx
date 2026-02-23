'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Lock, User, LogIn } from 'lucide-react';

export default function AdminLoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setSubmitting(true);

        try {
            const response = await fetch('/api/admin/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            if (!response.ok) {
                setError(data?.error || 'Login failed');
                return;
            }

            router.replace('/admin');
        } catch {
            setError('Network error');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="min-h-screen bg-[#050508] text-white flex items-center justify-center p-6">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8">
                <div className="mb-8">
                    <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-400/10 px-3 py-1 text-xs font-black tracking-widest uppercase text-indigo-300">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Admin Access
                    </div>
                    <h1 className="mt-4 text-3xl font-black tracking-tight">Sign In</h1>
                    <p className="mt-2 text-sm text-slate-400">Use administrator credentials to access system controls.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <label className="block">
                        <span className="mb-2 block text-xs font-bold tracking-widest uppercase text-slate-500">Username</span>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                autoComplete="username"
                                className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-3 text-sm text-white outline-none focus:border-indigo-400"
                                required
                            />
                        </div>
                    </label>

                    <label className="block">
                        <span className="mb-2 block text-xs font-bold tracking-widest uppercase text-slate-500">Password</span>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="current-password"
                                className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-3 text-sm text-white outline-none focus:border-indigo-400"
                                required
                            />
                        </div>
                    </label>

                    {error && (
                        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full rounded-xl bg-indigo-500 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <span className="inline-flex items-center gap-2">
                            <LogIn className="w-4 h-4" />
                            {submitting ? 'Signing in...' : 'Sign in'}
                        </span>
                    </button>
                </form>
            </div>
        </div>
    );
}

