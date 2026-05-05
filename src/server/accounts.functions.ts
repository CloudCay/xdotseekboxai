import { createServerFn } from '@tanstack/react-start';

export const upsertAccount = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    google_id: string;
    email: string;
    name: string;
  }) => data)
  .handler(async ({ data }) => {
    // Determine the backend URL.
    // The user explicitly requested using the variable EXPO_PUBLIC_BACKEND_URL
    const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

    if (!BACKEND_URL) {
      throw new Error('EXPO_PUBLIC_BACKEND_URL environment variable is not set');
    }

    const res = await fetch(`${BACKEND_URL}/api/accounts/upsert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        google_id: data.google_id,
        email: data.email,
        name: data.name,
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to upsert account: ${res.statusText}`);
    }

    const { data: account } = await res.json();
    const userId = account.id; // ← Supabase user ID (UUID)
    
    return { account, userId };
  });
