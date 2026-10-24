import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useSession } from '@/auth/session';
import { Notice, T } from '@/ui/kit';
import { Dashboard } from '@/ui/Focus';

export default function Welcome() {
  const session = useSession();
  const [busy, setBusy] = useState(false);
  return (
    <Dashboard
      guest
      account={
        session.status === 'signedOut' ? (
          <View style={{ gap: 12 }}>
            <View
              style={{
                backgroundColor: '#29281F',
                borderRadius: 28,
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <T style={{ flex: 1, color: '#FFFFF7', fontSize: 16, lineHeight: 22 }}>
                Create an account to save your progress, even on a new phone.
              </T>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign in"
                accessibilityHint="Opens Google sign-in to back up saved goals and daily history"
                accessibilityState={{ disabled: busy, busy }}
                disabled={busy}
                onPress={() => {
                  setBusy(true);
                  void session.signIn().finally(() => setBusy(false));
                }}
                style={({ pressed }) => ({
                  backgroundColor: '#FFFFF7',
                  borderRadius: 999,
                  minWidth: 92,
                  minHeight: 48,
                  paddingHorizontal: 18,
                  paddingVertical: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed || busy ? 0.7 : 1,
                })}
              >
                {busy ? (
                  <ActivityIndicator color="#0B0B08" />
                ) : (
                  <T style={{ color: '#0B0B08', fontSize: 16, fontWeight: '700' }}>Sign in</T>
                )}
              </Pressable>
            </View>
            {session.error && (
              <Notice tone="warn" title="Sign-in didn’t complete" body={session.error} />
            )}
          </View>
        ) : undefined
      }
    />
  );
}
