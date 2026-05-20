'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TenantDetailPage({ params }: { params: { tenantId: string } }) {
  const router = useRouter();

  // Redirect back to schools list until a full detail page is built
  useEffect(() => {
    router.replace('/super-admin/schools');
  }, [router]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
      <p style={{ fontSize: 14, color: '#6b7280' }}>Loading tenant {params.tenantId}…</p>
    </div>
  );
}
