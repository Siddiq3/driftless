import { useEffect, useState } from 'react';
import {
  BackHandler,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useFonts } from 'expo-font';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tracking } from 'tracking-android';
import { Icon } from '@/ui/Icon';
import { Notice, T } from '@/ui/kit';
import { SetupButton, SETUP_COLORS as C } from '@/onboarding/Visuals';
import { SUPPORT_EMAIL } from '@/config/website';

export const HELP_KINDS = ['Report an issue', 'Share an idea', 'Appreciate the team'] as const;
/** ScrollSnooze's own features only. */
export const ISSUES = [
  'Reels or Shorts not counted',
  'Pause or daily limit not working',
  'Permission issue',
  'Friends or invitations',
  'Sign-in or backup',
  'App crashing',
  'Other',
] as const;
export const MAX_MESSAGE = 2000;

type Kind = (typeof HELP_KINDS)[number];
type Step = 'kind' | 'issue' | 'message';

/** Shown in the email so the user sees exactly what is shared. Never screen content. */
export function appDetails(): string {
  let counting = 'unknown';
  try {
    const h = Tracking.health();
    counting = h.serviceEnabled && h.serviceRunning ? 'on' : 'off';
  } catch {
    /* unknown */
  }
  return [
    `App version: ${Constants.expoConfig?.version ?? 'unknown'}`,
    `${Platform.OS === 'android' ? 'Android' : 'iOS'} version: ${String(Platform.Version)}`,
    `Counting permission: ${counting}`,
  ].join('\n');
}

export function supportEmailUrl(
  kind: Kind,
  issue: string | null,
  message: string,
  details: boolean,
) {
  const subject = `ScrollSnooze: ${kind}${issue ? ` – ${issue}` : ''}`;
  const body = details ? `${message}\n\n---\n${appDetails()}` : message;
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function Choice({
  label,
  selected,
  onPress,
  children,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.choice}>
      <Pressable
        accessibilityRole="radio"
        accessibilityLabel={label}
        accessibilityState={{ checked: selected }}
        onPress={onPress}
        style={({ pressed }) => [styles.choiceRow, { opacity: pressed ? 0.7 : 1 }]}
      >
        <View style={[styles.radio, selected && styles.radioOn]}>
          {selected && <View style={styles.radioDot} />}
        </View>
        <T style={styles.choiceText}>{label}</T>
      </Pressable>
      {selected && children}
    </View>
  );
}

export default function Help() {
  const [fontsLoaded] = useFonts({
    LilitaOne: require('../assets/fonts/LilitaOne-Regular.ttf'),
  });
  const [step, setStep] = useState<Step>('kind');
  const [kind, setKind] = useState<Kind | null>(null);
  const [issue, setIssue] = useState<string | null>(null);
  const [details, setDetails] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const back = () => {
    if (step === 'message') setStep(kind === 'Report an issue' ? 'issue' : 'kind');
    else if (step === 'issue') setStep('kind');
    else if (router.canGoBack()) router.back();
    else router.replace('/');
    return true;
  };
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', back);
    return () => sub.remove();
  });

  const next = async () => {
    if (step === 'kind') setStep(kind === 'Report an issue' ? 'issue' : 'message');
    else if (step === 'issue') setStep('message');
    else {
      const url = supportEmailUrl(
        kind!,
        issue,
        message.trim(),
        kind === 'Report an issue' && details,
      );
      try {
        await Linking.openURL(url);
        router.back();
      } catch {
        setError(`No email app found. Email us at ${SUPPORT_EMAIL}.`);
      }
    }
  };
  const ready = step === 'kind' ? !!kind : step === 'issue' ? !!issue : message.trim().length > 0;
  const title =
    step === 'kind'
      ? 'Hey,\nHow can we help you?'
      : step === 'issue'
        ? 'What issue are you facing?'
        : kind === 'Report an issue'
          ? 'Tell us more about the issue'
          : kind === 'Share an idea'
            ? 'What’s your idea?'
            : 'What did you enjoy?';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={back}
          style={({ pressed }) => [styles.back, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Icon name="back" size={22} color={C.text} />
        </Pressable>
        <T
          accessibilityRole="header"
          style={{
            ...styles.title,
            fontFamily: fontsLoaded ? 'LilitaOne' : undefined,
            fontWeight: fontsLoaded ? '400' : '900',
          }}
        >
          {title}
        </T>
        {step === 'kind' &&
          HELP_KINDS.map((k) => (
            <Choice key={k} label={k} selected={kind === k} onPress={() => setKind(k)}>
              {k === 'Report an issue' && (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel="Include app version, Android version and counting status"
                  accessibilityState={{ checked: details }}
                  onPress={() => setDetails((d) => !d)}
                  style={styles.checkRow}
                >
                  <View style={[styles.check, details && styles.checkOn]}>
                    {details && <Icon name="check" size={16} color={C.brown} />}
                  </View>
                  <T style={{ ...styles.choiceText, fontSize: 15, flex: 1 }}>
                    Include app version, Android version and counting status
                  </T>
                </Pressable>
              )}
            </Choice>
          ))}
        {step === 'issue' &&
          ISSUES.map((i) => (
            <Choice key={i} label={i} selected={issue === i} onPress={() => setIssue(i)} />
          ))}
        {step === 'message' && (
          <View style={{ gap: 8 }}>
            <TextInput
              accessibilityLabel="Message"
              value={message}
              onChangeText={(v) => setMessage(v.slice(0, MAX_MESSAGE))}
              placeholder="Describe it…"
              placeholderTextColor={C.muted}
              multiline
              textAlignVertical="top"
              maxLength={MAX_MESSAGE}
              style={styles.input}
            />
            <T style={{ color: C.muted, fontSize: 13, paddingHorizontal: 4 }}>
              {`${message.length}/${MAX_MESSAGE} characters · Opens your email app to send`}
            </T>
          </View>
        )}
        {error && <Notice tone="warn" title="Email not sent" body={error} />}
      </ScrollView>
      <View style={styles.footer}>
        <SetupButton
          label={step === 'message' ? 'Send' : 'Continue'}
          disabled={!ready}
          onPress={next}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14, maxWidth: 560, width: '100%', alignSelf: 'center' },
  back: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
    marginBottom: 12,
  },
  title: { color: C.text, fontSize: 32, lineHeight: 40, marginBottom: 10 },
  choice: {
    borderRadius: 18,
    backgroundColor: '#17160F',
    paddingHorizontal: 18,
    paddingVertical: 4,
  },
  choiceRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60 },
  choiceText: { color: C.text, fontSize: 17, lineHeight: 23 },
  radio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: C.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: C.accent },
  radioDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: C.accent },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingBottom: 8,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: C.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: C.accent, borderColor: C.accent },
  input: {
    minHeight: 220,
    padding: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFE8AE',
    color: C.text,
    fontSize: 16,
    backgroundColor: '#17160F',
  },
  footer: { padding: 20, maxWidth: 560, width: '100%', alignSelf: 'center' },
});
