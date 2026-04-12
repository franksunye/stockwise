import { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/admin-session';

export default async function AdminProtectedLayout({ children }: { children: ReactNode }) {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value ?? null;

    if (!verifyAdminSessionToken(sessionToken)) {
        redirect('/admin/login');
    }

    return <>{children}</>;
}

