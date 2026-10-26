import { withDeadline } from '@/api/deadline';

/** Only Google ID tokens identify a user to our API. Google API access tokens are not used. */
export type GoogleResponse = { type: string; data?: { idToken: string | null } | null };
export interface GoogleIdentityClient {
  hasPlayServices(options: { showPlayServicesUpdateDialog: boolean }): Promise<boolean>;
  signIn(): Promise<GoogleResponse>;
  signInSilently(): Promise<GoogleResponse>;
}

export async function googleIdentity(client: GoogleIdentityClient, interactive: boolean) {
  if (interactive && !(await client.hasPlayServices({ showPlayServicesUpdateDialog: true })))
    throw new Error('Google Play Services are unavailable.');
  const response = interactive
    ? await client.signIn()
    : await withDeadline(
        () => client.signInSilently(),
        10_000,
        () => new Error('Google session restoration timed out'),
      );
  if (response.type !== 'success') return null; // cancellation / no saved credential
  if (!response.data?.idToken) throw new Error('Google did not return an identity token.');
  return response.data.idToken;
}

/** Presentation only: account ownership always uses the opaque Google ID. */
export function googleDisplayName(
  user: { name?: string | null; email?: string | null } | null | undefined,
): string | null {
  const name = user?.name?.trim() || user?.email?.split('@')[0]?.trim();
  return name ? name.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 40) || null : null;
}
