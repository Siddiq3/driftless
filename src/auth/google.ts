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
  const response = await (interactive ? client.signIn() : client.signInSilently());
  if (response.type !== 'success') return null; // cancellation / no saved credential
  if (!response.data?.idToken) throw new Error('Google did not return an identity token.');
  return response.data.idToken;
}
