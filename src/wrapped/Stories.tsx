import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  ImageBackground,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TurboModuleRegistry,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as Sharing from 'expo-sharing';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { router, useFocusEffect } from 'expo-router';
import { BrainCharacter } from '@/ui/BrainCharacter';
import { AppIcon, Icon } from '@/ui/Icon';
import { useReducedMotion, useDataMotion } from '@/ui/motion';
import { SetupButton } from '@/onboarding/Visuals';
import { clock, peakWindow, personality, type Recap } from './model';

const cream = '#FFE9AD';
type Story = { id: string; colors: [string, string]; label: string; content: ReactNode };
export function WrapStories({ recap, initialIndex = 0 }: { recap: Recap; initialIndex?: number }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [fonts] = useFonts({ LilitaOne: require('../../assets/fonts/LilitaOne-Regular.ttf') });
  const [index, setIndex] = useState(initialIndex);
  const [paused, setPaused] = useState(false);
  const [reader, setReader] = useState(true);
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const [holding, setHolding] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [sharing, setSharing] = useState(false);
  const [note, setNote] = useState('');
  const [progress] = useState(() => new Animated.Value(0));
  const capture = useRef<View>(null);
  const shareLock = useRef(false);
  const artSize = Math.min(width - 100, height < 750 ? 180 : 240);
  const big = (value: string | number, size = 88, color = cream) => (
    <Text
      style={[styles.big, { fontFamily: fonts ? 'LilitaOne' : undefined, fontSize: size, color }]}
    >
      {value}
    </Text>
  );
  const body = (value: string) => <Text style={styles.body}>{value}</Text>;
  const label = (value: string) => <Text style={styles.label}>{value}</Text>;
  const periodWord = recap.period === 'daily' ? 'day' : 'week';
  const peak = peakWindow(recap.hours);
  const longest = [...recap.sessions].sort(
    (a, b) => b.endMs - b.startMs - (a.endMs - a.startMs),
  )[0];
  const persona = personality(recap);
  const appSum = recap.apps.reduce((n, a) => n + a.views, 0);
  const hasViews = recap.views.value !== null;
  const hasData = hasViews || recap.minutes.value !== null;
  const trackedDays = hasViews ? recap.views.trackedDays : recap.minutes.trackedDays;
  const stories: Story[] = [
    {
      id: 'total',
      colors: ['#92501B', '#261207'],
      label: `Your ${periodWord} in short videos`,
      content: (
        <>
          <BrainCharacter pose="wrapped" size={artSize + 15} />
          {big(
            hasViews
              ? recap.views.value!.toLocaleString()
              : recap.minutes.value === null
                ? '—'
                : `${recap.minutes.value}`,
          )}
          {body(
            hasViews
              ? 'short videos counted'
              : recap.minutes.value === null
                ? 'No activity recorded for these dates'
                : 'minutes in supported apps',
          )}
          {!hasData && (
            <>
              <Text style={styles.caption}>
                {recap.period === 'daily'
                  ? 'Daily Wrapped covers yesterday. Today’s activity is in Progress.'
                  : 'Weekly Wrapped covers the last completed Monday–Sunday week. This week’s activity is in Progress.'}
              </Text>
              <SetupButton label="View current activity" onPress={() => router.push('/progress')} />
            </>
          )}
        </>
      ),
    },
  ];
  if (peak)
    stories.push({
      id: 'peak',
      colors: ['#0C1237', '#202F69'],
      label: 'YOUR PEAK',
      content: (
        <>
          <View style={{ height: height < 750 ? 35 : 90 }} />
          {big(`${clock(peak.start * 60)}–${clock(peak.end * 60)}`, 52, '#FFFFF8')}
          {body(`${peak.percent}% of your counted videos fell in these two hours.`)}
        </>
      ),
    });
  if (recap.sessions.length)
    stories.push({
      id: 'sessions',
      colors: ['#138174', '#052B24'],
      label: 'HOW YOU GOT PULLED BACK',
      content: (
        <>
          {big(recap.sessions.length, 112)}
          {body('recorded sessions')}
          <View style={styles.timeline}>
            {recap.sessions.map((s, i) => (
              <View
                key={i}
                style={[styles.tick, { left: `${Math.min(99, (s.startMinute / 1440) * 100)}%` }]}
              />
            ))}
          </View>
          <View style={styles.axis}>
            {['☾\n12am', '🌅\n6am', '☀\n12pm', '🌆\n6pm', '☾\n12am'].map((t, i) => (
              <Text key={i} style={styles.axisText}>
                {t}
              </Text>
            ))}
          </View>
          {recap.period === 'weekly' && body('All tracked days, by time of day')}
        </>
      ),
    });
  if (hasViews && recap.views.value! > 0 && appSum === recap.views.value && recap.apps.length)
    stories.push({
      id: 'apps',
      colors: ['#4A3EC5', '#151039'],
      label: 'WHERE YOU SCROLLED',
      content: (
        <>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <AppIcon name={recap.apps[0]!.label} size={68} />
            {big(`${Math.round((recap.apps[0]!.views / appSum) * 100)}%`, 88)}
            {body(recap.apps[0]!.label)}
          </View>
          <View
            style={{ flexDirection: 'row', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}
          >
            {recap.apps.slice(1).map((a) => (
              <View key={a.package} style={{ alignItems: 'center', gap: 6 }}>
                <AppIcon name={a.label} size={38} />
                <Text style={styles.body}>
                  {Math.round((a.views / appSum) * 100)}% {a.label}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.split}>
            {recap.apps.map((a, i) => (
              <View
                key={a.package}
                style={{ flex: a.views, backgroundColor: ['#FF498D', '#FF675D', '#FFE9AD'][i % 3] }}
              />
            ))}
          </View>
        </>
      ),
    });
  if (longest)
    stories.push({
      id: 'longest',
      colors: ['#A12F61', '#2B0D1D'],
      label: 'YOUR LONGEST RECORDED STREAK',
      content: (
        <>
          <AppIcon
            name={recap.apps.find((a) => a.package === longest.package)?.label ?? longest.package}
            size={80}
          />
          {big(
            longest.endMs - longest.startMs < 60000
              ? '<1 min'
              : `${Math.floor((longest.endMs - longest.startMs) / 60000)} mins`,
            76,
          )}
          {body(
            `${longest.views} counted videos, ${clock(longest.startMinute)}–${clock(longest.endMinute)}.`,
          )}
          <Text style={styles.caption}>Measured from the first video to the last count.</Text>
        </>
      ),
    });
  if (recap.sessions.length)
    stories.push({
      id: 'personality',
      colors: ['#A12F61', '#2B0D1D'],
      label: 'YOUR SCROLLING PERSONALITY',
      content: (
        <View style={styles.persona}>
          <BrainCharacter pose="wave" size={artSize * 0.7} />
          {big(persona.title, 36, '#2D1907')}
          <Text style={[styles.body, { color: '#5B4932', fontSize: 18, lineHeight: 26 }]}>
            {persona.detail}
          </Text>
          <Text style={styles.badge}>{persona.fact}</Text>
        </View>
      ),
    });
  if (recap.changePercent !== null)
    stories.push({
      id: 'comparison',
      colors: ['#292830', '#0D0D10'],
      label: `YOU VS YOUR PREVIOUS ${periodWord.toUpperCase()}`,
      content: (
        <>
          <View style={styles.bubble}>
            <Text style={{ fontSize: 18, textAlign: 'center', color: '#171715' }}>
              {recap.changePercent <= 0
                ? 'A little room to breathe.'
                : 'Tomorrow is a fresh start.'}
            </Text>
          </View>
          <BrainCharacter pose={recap.changePercent > 0 ? 'tired' : 'wave'} size={artSize} />
          {big(`${Math.abs(recap.changePercent)}%`, 100)}
          {body(
            `${recap.changePercent > 0 ? 'more' : recap.changePercent < 0 ? 'fewer' : 'change in'} videos than the previous ${periodWord}`,
          )}
        </>
      ),
    });
  stories.push({
    id: 'action',
    colors: ['#392917', '#0B0B08'],
    label: 'A LITTLE MORE ROOM FOR YOU',
    content: (
      <>
        <View style={styles.bubble}>
          <Text style={{ fontSize: 18, color: '#171715', textAlign: 'center' }}>
            Let’s take a breather.
          </Text>
        </View>
        <BrainCharacter size={artSize} />
        {big('MAKE SPACE\nFOR YOUR DAY', 44)}
        <View style={{ width: '100%', gap: 12 }}>
          <SetupButton label="Set a daily goal" onPress={() => router.push('/goals')} />
          <SetupButton secondary label="Set app pauses" onPress={() => router.push('/blocking')} />
        </View>
      </>
    ),
  });
  // Keep the six core chapters stable, including on new phones and partial weeks.
  // Missing measurements get illustrated unavailable states, never invented statistics.
  const missing: { id: string; colors: [string, string]; label: string; message: string }[] = [
    {
      id: 'peak',
      colors: ['#0C1237', '#202F69'],
      label: 'YOUR PEAK',
      message:
        recap.views.value === 0
          ? 'No peak to report.'
          : recap.source === 'synced'
            ? 'Hourly detail stays on the phone that recorded it.'
            : !hasViews
              ? 'No video counts recorded for these dates.'
              : 'Saved hourly events do not cover this whole count.',
    },
    {
      id: 'sessions',
      colors: ['#138174', '#052B24'],
      label: 'YOUR RECORDED SESSIONS',
      message: 'Session details aren’t available yet.',
    },
    {
      id: 'apps',
      colors: ['#4A3EC5', '#151039'],
      label: 'WHERE YOU SCROLLED',
      message:
        recap.views.value === 0
          ? 'No app split to report.'
          : 'Your app breakdown isn’t available yet.',
    },
    {
      id: 'longest',
      colors: ['#A12F61', '#2B0D1D'],
      label: 'YOUR LONGEST RECORDED STREAK',
      message: 'No measured streak to show yet.',
    },
  ];
  for (const chapter of missing) {
    if (!stories.some((s) => s.id === chapter.id))
      stories.push({
        id: chapter.id,
        colors: chapter.colors,
        label: chapter.label,
        content: (
          <>
            <BrainCharacter pose={chapter.id === 'longest' ? 'tired' : 'wave'} size={artSize} />
            {big('—', 76)}
            {body(chapter.message)}
          </>
        ),
      });
  }
  const chapterOrder = [
    'total',
    'peak',
    'sessions',
    'apps',
    'longest',
    'personality',
    'comparison',
    'action',
  ];
  stories.sort((a, b) => chapterOrder.indexOf(a.id) - chapterOrder.indexOf(b.id));
  const current = Math.max(0, Math.min(index, stories.length - 1));
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [current]);
  const story = stories[current]!;
  const transition = useDataMotion(story.id);
  const next = () => setIndex((i) => Math.min(stories.length - 1, i + 1));
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((value) => {
        if (mounted) setReader(value);
      })
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setReader);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    progress.setValue(0);
  }, [current, progress]);
  useEffect(() => {
    if (
      paused ||
      holding ||
      sharing ||
      reduced ||
      reader ||
      !active ||
      !focused ||
      current === stories.length - 1
    )
      return;
    let cancelled = false;
    let animation: Animated.CompositeAnimation | undefined;
    progress.stopAnimation((value) => {
      if (cancelled) return;
      animation = Animated.timing(progress, {
        toValue: 1,
        duration: (1 - value) * 8000,
        useNativeDriver: false,
      });
      animation.start(({ finished }) => {
        if (finished) setIndex((i) => Math.min(stories.length - 1, i + 1));
      });
    });
    return () => {
      cancelled = true;
      animation?.stop();
    };
  }, [
    current,
    paused,
    holding,
    sharing,
    reduced,
    reader,
    active,
    focused,
    progress,
    stories.length,
  ]);
  async function share() {
    if (shareLock.current) return;
    shareLock.current = true;
    setSharing(true);
    setNote('');
    let uri: string | undefined;
    let release: ((uri: string) => void) | undefined;
    try {
      if (!TurboModuleRegistry.get('RNViewShot') || !(await Sharing.isAvailableAsync())) {
        await Share.share({
          message: `ScrollSnooze · ${recap.period === 'daily' ? 'Daily' : 'Weekly'} Wrapped\n${recap.from} – ${recap.to}\n${hasViews ? `${recap.views.value} short videos counted (${recap.views.trackedDays}/${recap.expectedDays} tracked days)` : recap.minutes.value !== null ? `${recap.minutes.value} minutes in supported apps` : 'No confirmed counts yet'}`,
        });
        return;
      }
      // Lazy loading keeps recaps usable in development clients built before view-shot was added.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const shot = require('react-native-view-shot') as typeof import('react-native-view-shot');
      release = shot.releaseCapture;
      uri = await shot.captureRef(capture, { format: 'png', result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your Wrapped' });
    } catch {
      setNote('Sharing failed. Please try again.');
    } finally {
      if (uri) release?.(uri);
      shareLock.current = false;
      setSharing(false);
    }
  }
  const dateLabel =
    recap.period === 'daily'
      ? new Date(`${recap.to}T12:00:00Z`).toLocaleDateString(undefined, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          timeZone: 'UTC',
        })
      : `${recap.from} – ${recap.to}`;
  return (
    <View style={{ flex: 1, backgroundColor: story.colors[1] }}>
      <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: story.colors[1] }}>
        <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="wrap" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={story.colors[0]} />
              <Stop offset="1" stopColor={story.colors[1]} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#wrap)" />
        </Svg>
        {story.id === 'peak' && (
          <ImageBackground
            source={require('../../assets/illustrations/wrapped-night.png')}
            style={[StyleSheet.absoluteFill, { top: 120 }]}
            resizeMode="cover"
          />
        )}
        <View style={styles.progress}>
          {stories.map((s, i) => (
            <View key={s.id} style={styles.track}>
              <Animated.View
                style={{
                  height: 3,
                  backgroundColor: '#FFFFF8',
                  width:
                    i < current
                      ? '100%'
                      : i > current
                        ? '0%'
                        : progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                }}
              />
            </View>
          ))}
        </View>
        <View style={styles.header}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.brand}>
              ScrollSnooze · {recap.period === 'daily' ? 'Reels' : 'Weekly'} Wrapped
            </Text>
            <Text style={styles.caption}>
              {dateLabel} · {recap.source === 'phone' ? 'This phone' : 'Synced totals'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close Wrapped"
            onPress={() => router.back()}
            style={styles.circle}
          >
            <Text style={styles.control}>×</Text>
          </Pressable>
        </View>
        <ScrollView
          ref={scroll}
          onTouchStart={() => setHolding(true)}
          onTouchEnd={() => setHolding(false)}
          onTouchCancel={() => setHolding(false)}
          contentContainerStyle={styles.scroll}
        >
          <Animated.View style={[styles.content, transition]} key={story.id}>
            {label(story.label)}
            {story.content}
          </Animated.View>
        </ScrollView>
        <View
          style={{
            alignItems: 'center',
            padding: 14,
            paddingBottom: Math.max(insets.bottom, 16),
            gap: 8,
          }}
        >
          <Text style={styles.caption}>
            {current + 1} / {stories.length}
            {recap.period === 'weekly' && trackedDays < 7 && hasData
              ? ` · ${trackedDays}/7 days tracked`
              : ''}
          </Text>
        </View>
      </View>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous story"
          disabled={current === 0 || sharing}
          onPress={() => setIndex((i) => Math.max(0, i - 1))}
          style={[styles.circle, { opacity: current === 0 ? 0.3 : 1 }]}
        >
          <Icon name="back" color="#FFFFFF" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={paused ? 'Play stories' : 'Pause stories'}
          onPress={() => setPaused((p) => !p)}
          style={styles.circle}
        >
          <Text style={styles.control}>{paused ? '▷' : 'Ⅱ'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={sharing}
          accessibilityLabel="Share this Wrapped card"
          onPress={share}
          style={styles.share}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 17 }}>
            {sharing ? 'Sharing…' : '↗  Share'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={current === stories.length - 1 ? 'Finish Wrapped' : 'Next story'}
          disabled={sharing}
          onPress={current === stories.length - 1 ? () => router.back() : next}
          style={styles.circle}
        >
          <Icon name={current === stories.length - 1 ? 'check' : 'chevron'} color="#FFFFFF" />
        </Pressable>
      </View>
      <View
        pointerEvents="none"
        aria-hidden={true}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ position: 'absolute', left: -10000, top: 0, width }}
      >
        <View
          ref={capture}
          collapsable={false}
          style={{ padding: 28, gap: 24, backgroundColor: story.colors[1], alignItems: 'center' }}
        >
          <Text style={styles.brand}>
            ScrollSnooze · {recap.period === 'daily' ? 'Daily' : 'Weekly'} Wrapped
          </Text>
          <Text style={styles.caption}>
            {dateLabel} · {recap.source === 'phone' ? 'This phone' : 'Synced totals'}
          </Text>
          <View style={styles.content}>
            {label(story.label)}
            {story.content}
          </View>
          <Text style={styles.caption}>
            {current + 1} / {stories.length}
            {trackedDays < recap.expectedDays
              ? ` · ${trackedDays}/${recap.expectedDays} days tracked`
              : ''}
          </Text>
        </View>
      </View>
      {!!note && (
        <Text
          accessibilityRole="alert"
          style={[styles.caption, { textAlign: 'center', padding: 8 }]}
        >
          {note}
        </Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  progress: { flexDirection: 'row', gap: 4, paddingHorizontal: 18, paddingTop: 12 },
  track: { height: 3, flex: 1, backgroundColor: '#FFFFFF40', borderRadius: 4, overflow: 'hidden' },
  header: { padding: 20, flexDirection: 'row', gap: 8, alignItems: 'center' },
  brand: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
  caption: { fontSize: 12, color: '#FFFFFFBD', lineHeight: 18 },
  circle: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 24,
    backgroundColor: '#FFFFFF10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  control: { fontSize: 25, color: '#FFFFFF' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 20 },
  content: { alignItems: 'center', gap: 22 },
  label: {
    fontSize: 14,
    color: '#FFFFFFCC',
    letterSpacing: 1.4,
    textAlign: 'center',
    lineHeight: 22,
  },
  big: { textAlign: 'center', fontWeight: '900', letterSpacing: -1, flexShrink: 1 },
  body: { fontSize: 22, color: '#FFFFFF', textAlign: 'center', lineHeight: 32 },
  timeline: {
    width: '100%',
    height: 44,
    borderRadius: 9,
    backgroundColor: '#FFFFFF18',
    position: 'relative',
    overflow: 'hidden',
    marginTop: 12,
  },
  tick: { width: 3, height: '100%', backgroundColor: cream, position: 'absolute', borderRadius: 2 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  axisText: { fontSize: 12, lineHeight: 22, color: '#FFFFFFA0', textAlign: 'center' },
  split: {
    flexDirection: 'row',
    height: 18,
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
    marginTop: 12,
  },
  persona: {
    backgroundColor: '#FFF4D2',
    borderRadius: 30,
    padding: 20,
    gap: 12,
    alignItems: 'center',
    width: '100%',
  },
  badge: {
    backgroundColor: '#A52E60',
    borderRadius: 25,
    padding: 12,
    fontSize: 12,
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '700',
  },
  bubble: { backgroundColor: '#FFFFF8', padding: 18, borderRadius: 30 },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 8, padding: 12 },
  share: {
    borderWidth: 1,
    borderColor: '#FFFFFF50',
    borderRadius: 28,
    paddingHorizontal: 22,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
