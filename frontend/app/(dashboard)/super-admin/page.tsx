'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Super Admin Root Page
 * 
 * Redirects to dashboard on access to /super-admin
 */
export default function SuperAdminRoot() {
  const router = useRouter();

  useEffect(() => {
    router.push('/super-admin/dashboard');
  }, [router]);

  return null;
}
