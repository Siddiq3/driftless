import { useResponsiveLayout } from '@/ui/responsive';
import { router, useFocusEffect } from 'expo-router';
import { useFonts } from 'expo-font';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  BackHandler,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tracking, type TrackingHealth } from 'tracking-android';
import { useSession } from '@/auth/session';
import { getDb } from '@/db';
import { loadGoals } from '@/goals/store';
import { Details, Notice, T } from '@/ui/kit';
import { BrainCharacter } from '@/ui/BrainCharacter';
import { AppIcon, Icon } from '@/ui/Icon';
import { useDataMotion } from '@/ui/motion';
import { appInviteMessage } from '@/social/invite';
import { useOnboarding } from '@/onboarding/context';
import { GetStartedScreen } from './GetStartedScreen';
import { PermissionChecklist, PermissionHelpButton } from '@/permissions/PermissionChecklist';
import {
  SetupButton,
  WidgetPreview,
  ChallengeArtwork,
  PrivacyArtwork,
  SETUP_COLORS as C,
} from './Visuals';
import {
  EMPTY_ANSWERS,
  LAST_STEP,
  PRIORITY_LABELS,
  REEL_LIMITS,
  reelsSetupPlan,
  estimateTime,
  activeSetupStep,
  type SetupAnswers,
  type SetupPlan,
  type SetupRecord,
} from './model';
type Question = {
  key: keyof SetupAnswers;
  title: string;
  multi?: boolean;
  options: { value: string; label: string }[];
  help?: string;
};
const QUESTIONS: Question[] = [
  {
    key: 'occupation',
    title: 'What do you do?',
    options: [
      { value: 'school', label: 'School student' },
      { value: 'college', label: 'College student' },
      { value: 'work', label: 'Working' },
      { value: 'other', label: 'Something else' },
    ],
  },
  {
    key: 'apps',
    title: 'Where do you scroll?',
    multi: true,
    help: 'App minutes are supported for these apps. Short-video counts are still experimental for Instagram and YouTube, and are not set up for the other apps yet.',
    options: [
      { value: 'instagram', label: 'Instagram Reels' },
      { value: 'youtube', label: 'YouTube Shorts' },
      { value: 'facebook', label: 'Facebook Reels' },
      { value: 'snapchat', label: 'Snapchat Spotlight' },
      { value: 'moj', label: 'Moj' },
      { value: 'sharechat', label: 'ShareChat' },
      { value: 'other', label: 'Other apps' },
    ],
  },
  {
    key: 'priorities',
    title: 'What matters to you?',
    multi: true,
    options: [
      { value: 'study', label: 'Learning & study' },
      { value: 'work', label: 'Focused work' },
      { value: 'sleep', label: 'Better rest' },
      { value: 'movement', label: 'Moving my body' },
      { value: 'relationships', label: 'Time with my people' },
      { value: 'creativity', label: 'Making things' },
    ],
  },
  {
    key: 'when',
    title: 'When do you scroll most?',
    options: [
      { value: 'morning', label: 'First thing in the morning' },
      { value: 'breaks', label: 'During breaks' },
      { value: 'evening', label: 'In the evening' },
      { value: 'night', label: 'Before bed' },
    ],
  },
  {
    key: 'feelings',
    title: 'How does scrolling feel?',
    multi: true,
    options: [
      { value: 'tired', label: 'A little drained' },
      { value: 'distracted', label: 'Harder to focus' },
      { value: 'regretful', label: 'Wishing I had stopped sooner' },
      { value: 'fine', label: 'Usually fine' },
    ],
  },
  {
    key: 'usage',
    title: 'How long do you scroll?',
    help: 'Your estimate — we haven’t measured your activity yet.',
    options: [
      { value: 'under1', label: 'Less than an hour a day' },
      { value: '1to3', label: '1–3 hours a day' },
      { value: '3to5', label: '3–5 hours a day' },
      { value: '5to7', label: '5–7 hours a day' },
      { value: 'over7', label: 'More than 7 hours a day' },
    ],
  },
];

export function SetupFlow({ initial }: { initial: SetupRecord | null }) {
  const [fontsLoaded] = useFonts({
    LilitaOne: require('../../assets/fonts/LilitaOne-Regular.ttf'),
  });
  const session = useSession();
  const setup = useOnboarding();
  const layout = useResponsiveLayout();
  const [step, setStep] = useState(initial?.completed ? 0 : activeSetupStep(initial?.step ?? 0));
  const [answers, setAnswers] = useState<SetupAnswers>(initial?.answers ?? EMPTY_ANSWERS);
  const [plan, setPlan] = useState<SetupPlan>(reelsSetupPlan(initial?.plan));
  const [health, setHealth] = useState<TrackingHealth | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [widgetRequested, setWidgetRequested] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const hadInitial = useRef(initial !== null);
  const transition = useDataMotion(step);
  const estimate = estimateTime(answers, plan);
  const question = QUESTIONS[step - 1];
  const size = Math.min(layout.width - 48, layout.compact ? 140 : 240);
  const priority = answers.priorities[0];
  const app =
    health?.apps.find((a) => a.installed && /instagram/i.test(a.label)) ??
    health?.apps.find((a) => a.installed);
  const readHealth = useCallback(() => {
    try {
      setHealth(Tracking.health());
    } catch {
      setHealth(null);
    }
  }, []);
  useFocusEffect(readHealth);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') readHealth();
    });
    return () => sub.remove();
  }, [readHealth]);
  useEffect(() => {
    if (hadInitial.current) return;
    let active = true;
    getDb()
      .then(loadGoals)
      .then((goals) => {
        const current = goals.find((g) => g.enabled && g.metric === 'views');
        if (active && current) setPlan({ metric: current.metric, dailyLimit: current.dailyLimit });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [step]);
  const record = useCallback(
    (next: number): SetupRecord => ({
      version: 1,
      completed: initial?.completed ?? false,
      step: next,
      answers,
      plan,
    }),
    [initial?.completed, answers, plan],
  );
  const move = useCallback(
    async (next: number) => {
      if (busy) return;
      setBusy(true);
      setError(null);
      let target = activeSetupStep(next, next < step ? 'back' : 'next');
      if (target === 10 && session.status === 'signedIn') target = next < step ? 9 : 11;
      try {
        await setup.save(record(target));
        setStep(target);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save. Try again.');
      } finally {
        setBusy(false);
      }
    },
    [busy, step, session.status, setup, record],
  );
  useEffect(() => {
    if (step !== 10 || session.status !== 'signedIn' || busy || error) return;
    let active = true;
    setup
      .save(record(11))
      .then(() => {
        if (active) setStep(11);
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : 'Could not save. Try again.');
      });
    return () => {
      active = false;
    };
  }, [step, session.status, busy, error, setup, record]);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step > 0 && !busy) void move(step - 1);
      return step > 0 || busy;
    });
    return () => sub.remove();
  });
  const finish = async (openApp = false) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await setup.finish(record(LAST_STEP));
      if (openApp && app) {
        try {
          Tracking.openSupportedApp(app.package);
        } catch {
          setError(`${app.label} could not be opened. Continue to Today.`);
          setBusy(false);
          return;
        }
      }
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  };
  const share = async () => {
    if (session.status !== 'signedIn') {
      await signIn();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await Share.share({ title: 'Try ScrollSnooze', message: appInviteMessage() });
      setBusy(false);
      await move(15);
    } catch {
      setError('Sharing could not be opened. Try again or continue.');
      setBusy(false);
    }
  };
  const pin = () => {
    try {
      if (!Tracking.widgetSupported()) {
        setError('Long-press your home screen → Widgets → ScrollSnooze.');
        return;
      }
      if (!Tracking.requestCountWidget()) {
        setError('Open your launcher’s widget picker to add ScrollSnooze.');
        return;
      }
      setWidgetRequested(true);
    } catch {
      setError('The widget is unavailable on this device. You can continue.');
    }
  };
  const signIn = async () => {
    if (session.status === 'signedIn') {
      await move(11);
      return;
    }
    if (session.status !== 'signedOut' || !session.googleSupported) {
      setError('Google sign-in is not configured in this build. Skip to continue.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await session.signIn();
    } catch {
      setError('Sign-in did not complete. Try again or skip.');
    } finally {
      setBusy(false);
    }
  };
  const select = (q: Question, value: string) =>
    setAnswers((current) => {
      if (q.multi) {
        const values = current[q.key] as string[];
        return {
          ...current,
          [q.key]: values.includes(value) ? values.filter((v) => v !== value) : [...values, value],
        };
      }
      return { ...current, [q.key]: current[q.key] === value ? undefined : value };
    });
  const choice = (label: string, selected: boolean, action: () => void, multi = false) => (
    <Pressable
      key={label}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled: busy }}
      disabled={busy}
      onPress={action}
      style={({ pressed }) => [
        styles.choice,
        {
          backgroundColor: selected ? '#3C2C19' : '#171713',
          borderColor: selected ? C.accent : '#24241E',
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: multi ? 4 : 9,
          borderWidth: 1.5,
          borderColor: selected ? C.accent : '#88897F',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {selected && <Icon name="check" size={13} color={C.accent} />}
      </View>
      <T style={{ flex: 1, color: C.text, fontSize: 16 }}>{label}</T>
    </Pressable>
  );
  const title = (text: string) => (
    <T
      v="display"
      style={{
        ...styles.title,
        fontFamily: fontsLoaded ? 'LilitaOne' : undefined,
        fontWeight: fontsLoaded ? '400' : '900',
      }}
    >
      {text}
    </T>
  );
  const plain = (label: string, action: () => void) => (
    <Pressable accessibilityRole="button" disabled={busy} onPress={action} style={styles.plain}>
      <T style={{ textAlign: 'center', color: C.accent, fontWeight: '700' }}>{label}</T>
    </Pressable>
  );

  if (step === 0) {
    return (
      <GetStartedScreen
        fontsLoaded={!!fontsLoaded}
        busy={busy}
        error={error}
        onStart={() => void move(1)}
      />
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: step === 14 ? '#281500' : C.bg }}>
      <View style={styles.header}>
        {step > 0 && step < 10 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous step"
            onPress={() => void move(step - 1)}
            style={styles.back}
          >
            <Icon name="back" color={C.muted} />
          </Pressable>
        ) : (
          <View style={{ width: 20 }} />
        )}
        <T v="caption" style={{ color: C.muted, flex: 1 }}>
          {step > 0 && step <= 6 ? `${step} of 6` : step === 0 ? 'SCROLLSNOOZE' : ''}
        </T>
        {step >= 10
          ? plain('Need help?', () => router.push('/privacy'))
          : step > 0 && step <= 6
            ? plain('Skip', () => void move(9))
            : null}
      </View>
      <ScrollView
        ref={scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            justifyContent:
              (step > 0 && step <= 6) || [11, 12, 13, 14].includes(step) ? 'flex-start' : 'center',
          },
        ]}
      >
        <Animated.View
          style={[
            {
              gap: 22,
              alignItems: 'stretch',
              paddingTop: step === 12 && !layout.compact ? 24 : 0,
            },
            transition,
          ]}
        >
          {step > 0 && step <= 6 && question && (
            <>
              <View style={styles.questionHeader}>
                <BrainCharacter size={64} />
                <View
                  style={{ flex: 1, borderRadius: 20, backgroundColor: '#F9F9ED', padding: 16 }}
                >
                  <T
                    v="heading"
                    style={{ color: '#191915', fontWeight: '700', fontSize: 17, lineHeight: 23 }}
                  >
                    {question.title}
                  </T>
                </View>
              </View>
              <T v="caption" style={{ textAlign: 'center', color: C.muted }}>
                {question.multi ? 'Pick all that apply' : 'Optional · choose one'}
              </T>
              <View style={{ gap: 10 }}>
                {question.options.map((o) =>
                  choice(
                    o.label,
                    question.multi
                      ? (answers[question.key] as string[]).includes(o.value)
                      : answers[question.key] === o.value,
                    () => select(question, o.value),
                    question.multi,
                  ),
                )}
              </View>
              {question.key === 'apps' && (
                <T v="caption" style={styles.small}>
                  App minutes: Instagram, YouTube, Facebook, Snapchat, Moj &amp; ShareChat.
                </T>
              )}
              {question.key === 'usage' && (
                <T v="caption" style={styles.small}>
                  Your estimate, not measured activity.
                </T>
              )}
            </>
          )}
          {step === 8 && (
            <>
              <BrainCharacter size={size} />
              {title(`More room for\n${priority ? PRIORITY_LABELS[priority] : 'you'}.`)}
              {estimate && (
                <>
                  <T style={styles.bigNumber}>{estimate.hoursPerWeek}h</T>
                  <T style={styles.small}>Estimated scrolling each week</T>
                  <Details title="How this is estimated">
                    <T v="caption" muted>
                      Based on your range’s midpoint (8h for 7+). Not tracked activity.
                    </T>
                  </Details>
                </>
              )}
            </>
          )}
          {step === 9 && (
            <>
              <BrainCharacter size={140} />
              {title('Your limit\nfrom today.')}
              <View
                style={{
                  flexDirection: 'row',
                  gap: 10,
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                }}
              >
                {Array.from(new Set([...REEL_LIMITS, plan.dailyLimit])).map((n) => (
                  <Pressable
                    key={n}
                    accessibilityRole="radio"
                    accessibilityLabel={`${n} reels a day`}
                    accessibilityState={{ checked: plan.dailyLimit === n }}
                    onPress={() => setPlan({ ...plan, dailyLimit: n })}
                    style={{
                      borderRadius: 32,
                      borderWidth: 2,
                      borderColor: plan.dailyLimit === n ? C.accent : C.surface,
                      minHeight: 64,
                      minWidth: 56,
                      padding: 12,
                      backgroundColor: C.surface,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <T v="heading" style={{ color: plan.dailyLimit === n ? C.accent : C.text }}>
                      {n}
                    </T>
                  </Pressable>
                ))}
              </View>
              <T style={styles.small}>reels a day</T>
            </>
          )}
          {step === 10 && (
            <>
              <BrainCharacter size={size} />
              {title(
                session.status === 'signedIn'
                  ? 'Your account\nis connected.'
                  : 'Create an account\nto save your progress',
              )}
              <T v="caption" style={styles.small}>
                Sign in to save your goals and daily history to your account automatically. Skip to
                keep progress on this phone.
              </T>
              {session.status === 'signedOut' && session.error && (
                <Notice title="Sign-in didn’t complete" body={session.error} tone="warn" />
              )}
            </>
          )}
          {step === 11 && (
            <>
              {title('Your scroll count.\nYour privacy.')}
              <T v="heading" style={{ ...styles.title, fontSize: 24, lineHeight: 32 }}>
                No chats. No passwords.
              </T>
              <PrivacyArtwork />
            </>
          )}
          {step === 12 && (
            <>
              {title('Enable permissions\nto start counting reels')}
              <PermissionChecklist health={health} />
            </>
          )}
          {step === 13 && (
            <>
              {title('Your daily count.\nOn your home screen.')}
              <WidgetPreview />
              {widgetRequested && (
                <T v="caption" style={styles.small}>
                  Confirm the widget in your launcher.
                </T>
              )}
            </>
          )}
          {step === 14 && (
            <>
              <T v="label" style={styles.small}>
                A little friendly competition
              </T>
              {title('CHALLENGE\nFRIENDS')}
              <ChallengeArtwork />
            </>
          )}
          {step === 15 && (
            <>
              {title(
                app
                  ? `Open ${app.label}.\nSee your scroll.`
                  : 'You’re ready.\nMake a little space.',
              )}
              <View>
                <View style={{ zIndex: 1 }}>
                  <BrainCharacter size={130} />
                </View>
                {app && (
                  <View
                    style={{
                      alignItems: 'center',
                      marginTop: -35,
                      paddingTop: 60,
                      paddingBottom: 34,
                      borderRadius: 30,
                      backgroundColor: '#151511',
                    }}
                  >
                    <AppIcon name={app.label} size={72} />
                  </View>
                )}
              </View>
              <T v="caption" style={styles.small}>
                {health?.serviceRunning
                  ? 'Your count updates on Today.'
                  : 'Counting is off. Enable it later in Counter.'}
              </T>
            </>
          )}
          {error && <Notice tone="warn" title="Please check" body={error} />}
        </Animated.View>
        <View
          style={[
            styles.footer,
            { paddingHorizontal: 0, paddingBottom: 0, paddingTop: layout.gap, marginTop: 'auto' },
          ]}
        >
          {step < 10 && (
            <SetupButton
              label={step === 9 ? 'Start my plan' : 'Continue'}
              busy={busy}
              onPress={() => void move(step + 1)}
            />
          )}
          {step === 10 && (
            <>
              <SetupButton
                label={session.status === 'signedIn' ? 'Continue' : 'Continue with Google'}
                google={session.status !== 'signedIn'}
                busy={busy}
                onPress={() => void signIn()}
              />
              <SetupButton
                secondary
                label="Skip and continue"
                busy={busy}
                onPress={() => void move(11)}
              />
              {plain('Privacy policy', () => router.push('/privacy'))}
            </>
          )}
          {step === 11 && (
            <SetupButton label="Continue" busy={busy} onPress={() => void move(12)} />
          )}
          {step === 12 && (
            <>
              <PermissionHelpButton />
              {plain(health?.serviceRunning ? 'Continue' : 'Not now', () => void move(13))}
            </>
          )}
          {step === 13 && (
            <>
              <SetupButton
                label={widgetRequested ? 'Continue' : 'Add widget'}
                busy={busy}
                onPress={() => (widgetRequested ? void move(14) : pin())}
              />
              {plain('Not now', () => void move(14))}
            </>
          )}
          {step === 14 && (
            <>
              <SetupButton label="Challenge your friend" busy={busy} onPress={() => void share()} />
              {plain('I’ll do it later', () => void move(15))}
            </>
          )}
          {step === 15 && (
            <>
              <SetupButton
                label={app ? `Open ${app.label}` : 'Go to Today'}
                busy={busy}
                onPress={() => void finish(!!app)}
              />
              {app && plain('Go to Today', () => void finish())}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  header: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    minHeight: 52,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  footer: { width: '100%', maxWidth: 560, alignSelf: 'center', padding: 20, gap: 12 },
  title: {
    fontSize: 30,
    lineHeight: 39,
    fontWeight: '900',
    letterSpacing: -0.7,
    textAlign: 'center',
    color: C.text,
  },
  bigNumber: {
    fontSize: 48,
    lineHeight: 58,
    fontWeight: '900',
    textAlign: 'center',
    color: C.accent,
  },
  small: { color: C.muted, textAlign: 'center', fontSize: 13, lineHeight: 19 },
  questionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 58,
    borderRadius: 13,
    padding: 14,
    gap: 12,
  },
  plain: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 },
  back: { minWidth: 48, minHeight: 48, justifyContent: 'center' },
  permissionRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  rowTitle: { color: C.text, fontSize: 19, lineHeight: 26, fontWeight: '800' },
  rowDetail: { color: C.muted, fontSize: 14, lineHeight: 20 },
});
