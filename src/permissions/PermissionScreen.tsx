import { useCallback, useEffect, useState } from 'react';
import {
  Animated,
  AppState,
  Easing,
  BackHandler,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type TextStyle,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFonts } from 'expo-font';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tracking } from 'tracking-android';
import { BrainCharacter } from '@/ui/BrainCharacter';
import { Icon } from '@/ui/Icon';
import { Notice, T } from '@/ui/kit';
import { useReducedMotion } from '@/ui/motion';
import { SetupButton, SETUP_COLORS as C } from '@/onboarding/Visuals';
import {
  ACCESSIBILITY_DISCLOSURE,
  ACCESSIBILITY_SHEET_POINTS,
  ACCESSIBILITY_SHEET_TITLE,
} from './accessibilityDisclosure';

const REELS = [
  require('../../assets/illustrations/demo-reel-forest.png'),
  require('../../assets/illustrations/demo-reel-coast.png'),
  require('../../assets/illustrations/demo-reel-waterfall.jpg'),
];

/** Three things the one Accessibility permission does. Keep true of the shipped service. */
export const SLIDES = [
  {
    title: 'Just a small reel count.',
    accent: 'Only on Reels and Shorts.',
    body: 'A small bubble shows your count while you watch Reels and Shorts.',
    scene: 'reel',
  },
  {
    title: 'Keeps running.',
    accent: 'So your count stays right.',
    body: 'Counting continues in the background, even when ScrollSnooze is closed.',
    scene: 'background',
  },
  {
    title: 'Not on chats.',
    accent: 'Only in Instagram and YouTube.',
    body: 'The bubble never shows in chats, and it doesn’t look inside bank, UPI or payment apps.',
    scene: 'chat',
  },
] as const;

/** Every line must stay true of the shipped service; see accessibilityDisclosure.ts. */
export const NOT_SURE_POINTS: { ok: boolean; text: string }[] = [
  { ok: true, text: 'Works only inside Instagram and YouTube' },
  { ok: true, text: 'Uses what’s on screen there only to spot and count Reels and Shorts' },
  { ok: false, text: 'Doesn’t look inside bank, UPI or payment apps' },
  { ok: false, text: 'Doesn’t save what you type or read' },
  { ok: true, text: 'Counts stay on your phone unless you sign in' },
];

type Sheet = 'none' | 'consent' | 'notSure';
const NOT_SAVED = 'Screen content never leaves your phone';

const WORD_STAGGER = 70;
const WORD_MS = 280;
const COUNT_MS = 1000;
const HOLD_MS = 2600;
const arrive = Easing.out(Easing.exp);

/** One slide at a time: words land, then the phone acts the sentence out, then it moves on.
 * Reduced motion shows the first slide complete and still; the dots switch slides. */
function useStory() {
  const reduced = useReducedMotion();
  const [slide, setSlide] = useState(0);
  const [live, setLive] = useState(reduced);
  const [count, setCount] = useState(1);
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!live || reduced || !active) return;
    if (count < 3) {
      const t = setTimeout(() => setCount((n) => n + 1), COUNT_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setLive(false);
      setCount(1);
      setSlide((n) => (n + 1) % SLIDES.length);
    }, HOLD_MS);
    return () => clearTimeout(t);
  }, [live, reduced, active, count]);
  const show = (next: number) => {
    setCount(1);
    setLive(reduced);
    setSlide(next);
  };
  return { slide, count, live, reduced, show, onWordsDone: () => setLive(true) };
}

/** Words rise into place one after another. Screen readers get the whole sentence. */
function WordReveal({
  lines,
  styles: lineStyles,
  animate,
  delay = 0,
  stagger = WORD_STAGGER,
  onDone,
}: {
  lines: string[];
  styles: TextStyle[];
  animate: boolean;
  delay?: number;
  stagger?: number;
  onDone?: () => void;
}) {
  const words = lines.flatMap((line, l) => line.split(' ').map((w) => ({ w, l })));
  const [values] = useState(() => words.map(() => new Animated.Value(animate ? 0 : 1)));
  useEffect(() => {
    if (!animate) {
      onDone?.();
      return;
    }
    const run = Animated.sequence([
      Animated.delay(delay),
      Animated.stagger(
        stagger,
        values.map((v) =>
          Animated.timing(v, {
            toValue: 1,
            duration: WORD_MS,
            easing: arrive,
            useNativeDriver: true,
          }),
        ),
      ),
    ]);
    run.start(({ finished }) => finished && onDone?.());
    return () => run.stop();
    // Each slide remounts this component with a new key; values never change underneath.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View accessible accessibilityLabel={lines.join(' ')}>
      {lines.map((_, l) => (
        <View key={l} style={styles.wordLine}>
          {words.map(({ w, l: wl }, i) =>
            wl !== l ? null : (
              <Animated.Text
                key={i}
                allowFontScaling
                style={[
                  lineStyles[l],
                  {
                    opacity: values[i],
                    transform: [
                      {
                        translateY: values[i]!.interpolate({
                          inputRange: [0, 1],
                          outputRange: [10, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {w}
              </Animated.Text>
            ),
          )}
        </View>
      ))}
    </View>
  );
}

function usePop(on: boolean, reduced: boolean) {
  const [v] = useState(() => new Animated.Value(on ? 1 : 0));
  useEffect(() => {
    Animated.timing(v, {
      toValue: on ? 1 : 0,
      duration: reduced ? 0 : on ? 320 : 160,
      easing: arrive,
      useNativeDriver: true,
    }).start();
  }, [on, reduced, v]);
  return v;
}

function ReelStack({
  index,
  width,
  height,
  reduced,
}: {
  index: number;
  width: number;
  height: number;
  reduced: boolean;
}) {
  // All reels stay mounted, so a swipe never reveals an undecoded image.
  const [offset] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(offset, {
      toValue: -index * height,
      duration: reduced ? 0 : 420,
      easing: arrive,
      useNativeDriver: true,
    }).start();
  }, [index, height, reduced, offset]);
  return (
    <Animated.View style={{ transform: [{ translateY: offset }] }}>
      {REELS.map((src, i) => (
        <View key={i} style={{ width, height }}>
          <Image source={src} resizeMode="cover" style={StyleSheet.absoluteFill} />
          <View style={styles.reelActions}>
            {[0, 1, 2].map((n) => (
              <View key={n} style={styles.reelAction} />
            ))}
          </View>
          <View style={styles.reelCaption}>
            <View style={[styles.captionLine, { width: '55%' }]} />
            <View style={[styles.captionLine, { width: '35%', opacity: 0.6 }]} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

/** Local demonstration only. Its number never enters tracking or history.
 * Only the brain speaks; the phone shows the sentence happening. */
function Hero({
  slide,
  count,
  live,
  reduced,
  height,
}: {
  slide: number;
  count: number;
  live: boolean;
  reduced: boolean;
  height: number;
}) {
  const scene = SLIDES[slide]!.scene;
  const phoneWidth = height * (9 / 16);
  const side = Math.min(96, phoneWidth * 0.55);
  const said = usePop(live, reduced);
  const swiped = usePop(live && scene === 'background', reduced);
  const [screen] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduced) return;
    screen.setValue(0);
    Animated.timing(screen, {
      toValue: 1,
      duration: 360,
      easing: arrive,
      useNativeDriver: true,
    }).start();
  }, [slide, reduced, screen]);
  const label =
    scene === 'reel'
      ? `Counting… ${count}`
      : scene === 'background'
        ? `Still counting… ${count + 3}`
        : 'Not on chats';
  const inner = phoneWidth - 4;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Preview: ${SLIDES[slide]!.body}`}
      style={{ height, width: phoneWidth + side + 14, alignSelf: 'center' }}
    >
      <View
        style={{ position: 'absolute', left: 0, top: '30%', width: side, alignItems: 'center' }}
      >
        <Animated.View
          style={[
            styles.bubble,
            {
              opacity: said,
              transform: [
                { scale: said.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
              ],
            },
          ]}
        >
          <T allowFontScaling={false} style={styles.bubbleText}>
            {label}
          </T>
        </Animated.View>
        <BrainCharacter size={side} still />
      </View>
      <Animated.View style={[styles.phone, { width: phoneWidth, height, opacity: screen }]}>
        {scene === 'reel' && (
          <ReelStack
            index={(count - 1) % REELS.length}
            width={inner}
            height={height - 4}
            reduced={reduced}
          />
        )}
        {scene === 'background' && (
          <View style={styles.recents}>
            <View style={[styles.appCard, { height: height * 0.62 }]}>
              <T allowFontScaling={false} style={styles.cardTitle}>
                Instagram
              </T>
              <View style={{ flex: 1, borderRadius: 10, overflow: 'hidden' }}>
                <Image
                  source={REELS[(count + 1) % REELS.length]}
                  resizeMode="cover"
                  style={StyleSheet.absoluteFill}
                />
              </View>
            </View>
            <Animated.View
              style={[
                styles.appCard,
                styles.ourCard,
                {
                  height: height * 0.62,
                  opacity: swiped.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                  transform: [
                    {
                      translateY: swiped.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -height * 0.7],
                      }),
                    },
                  ],
                },
              ]}
            >
              <T allowFontScaling={false} style={styles.cardTitle}>
                ScrollSnooze
              </T>
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <BrainCharacter size={phoneWidth * 0.4} still />
              </View>
            </Animated.View>
          </View>
        )}
        {scene === 'chat' && (
          <View style={{ flex: 1 }}>
            <View style={styles.chatHeader}>
              <View style={styles.avatar} />
              <View style={[styles.line, { width: '50%' }]} />
            </View>
            <View style={{ padding: 12, gap: 14 }}>
              {[0.7, 0.55, 0.8, 0.45, 0.65].map((w, i) => (
                <View
                  key={i}
                  style={[
                    styles.message,
                    { width: `${w * 100}%` },
                    i % 2 ? { alignSelf: 'flex-end', backgroundColor: '#2C4A24' } : null,
                  ]}
                />
              ))}
            </View>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

function BottomSheet({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const [slide] = useState(() => new Animated.Value(reduced ? 1 : 0));
  useEffect(() => {
    Animated.timing(slide, {
      toValue: 1,
      duration: reduced ? 0 : 260,
      useNativeDriver: true,
    }).start();
  }, [slide, reduced]);
  return (
    // No outside-tap or swipe dismissal: the backdrop only blocks touches.
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: slide }]} />
      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.sheet,
          {
            transform: [
              { translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [700, 0] }) },
            ],
          },
        ]}
      >
        <View style={styles.grabber} />
        {children}
      </Animated.View>
    </View>
  );
}

function SheetButton({
  label,
  onPress,
  primary = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.sheetButton,
        { backgroundColor: primary ? C.accent : '#3A372D', opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <T
        style={{
          color: primary ? C.brown : C.text,
          fontSize: 16,
          fontWeight: '800',
          textAlign: 'center',
        }}
      >
        {label}
      </T>
    </Pressable>
  );
}

export function FullDisclosure() {
  return (
    <View style={{ gap: 12 }}>
      {ACCESSIBILITY_DISCLOSURE.map(({ title, body }) => (
        <View key={title} style={{ gap: 4 }}>
          <T accessibilityRole="header" style={{ color: C.text, fontSize: 15, fontWeight: '700' }}>
            {title}
          </T>
          <T style={{ color: C.muted, fontSize: 14, lineHeight: 20 }}>{body}</T>
        </View>
      ))}
    </View>
  );
}

/** One permission, one screen. Consent is saved before the Settings guide opens;
 * Back and Not now never agree to anything. */
export function PermissionScreen({ onDone }: { onDone: () => void }) {
  const { height } = useWindowDimensions();
  const [fontsLoaded] = useFonts({
    LilitaOne: require('../../assets/fonts/LilitaOne-Regular.ttf'),
  });
  const [sheet, setSheet] = useState<Sheet>('none');
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const back = useCallback(() => {
    if (sheet === 'notSure') onDone();
    else setSheet('notSure');
    return true;
  }, [sheet, onDone]);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', back);
    return () => sub.remove();
  }, [back]);

  const openGuide = () => {
    try {
      Tracking.openAccessibilityGuide();
      onDone();
    } catch {
      setError('Android settings could not be opened. Please try again.');
    }
  };
  const turnOn = () => {
    setError(null);
    let agreed = false;
    try {
      agreed = Tracking.health().disclosureAccepted;
    } catch {
      /* Unknown state is never treated as consent. */
    }
    if (agreed) openGuide();
    else setSheet('consent');
  };
  const agree = () => {
    try {
      Tracking.setDisclosureAccepted(true);
    } catch {
      setError('Your choice could not be saved. Please try again.');
      return;
    }
    setSheet('none');
    openGuide();
  };

  const { slide, count, live, reduced, show, onWordsDone } = useStory();
  const current = SLIDES[slide]!;
  const titleStyle: TextStyle = {
    ...styles.title,
    fontFamily: fontsLoaded ? 'LilitaOne' : undefined,
    fontWeight: fontsLoaded ? '400' : '900',
  };
  const heroHeight = Math.max(180, Math.min(420, height - 470));
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        importantForAccessibility={sheet === 'none' ? 'auto' : 'no-hide-descendants'}
        contentContainerStyle={styles.content}
      >
        <View accessibilityRole="header">
          <WordReveal
            key={`h${slide}`}
            animate={!reduced}
            lines={[current.title, current.accent]}
            styles={[titleStyle, { ...titleStyle, color: C.accent }]}
          />
        </View>
        <Hero slide={slide} count={count} live={live} reduced={reduced} height={heroHeight} />
        <WordReveal
          key={`b${slide}`}
          animate={!reduced}
          delay={(current.title + ' ' + current.accent).split(' ').length * WORD_STAGGER}
          stagger={40}
          lines={[current.body]}
          styles={[styles.body]}
          onDone={onWordsDone}
        />
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <Pressable
              key={s.scene}
              accessibilityRole="button"
              accessibilityLabel={`Show: ${s.title}`}
              accessibilityState={{ selected: i === slide }}
              onPress={() => show(i)}
              hitSlop={12}
              style={[styles.dot, i === slide && { width: 22, backgroundColor: C.accent }]}
            />
          ))}
        </View>
      </ScrollView>
      {sheet === 'none' && (
        <View style={styles.footer}>
          {error && <Notice tone="warn" title="Please try again" body={error} />}
          <View style={styles.trust}>
            <Icon name="lock" size={14} color="#7BD07B" />
            <T style={{ color: '#7BD07B', fontSize: 14, textAlign: 'center' }}>
              Screen text isn’t saved · Turn off anytime
            </T>
          </View>
          <SetupButton label="Turn on" onPress={turnOn} />
        </View>
      )}
      {sheet === 'consent' && (
        <BottomSheet>
          <ScrollView testID="consent-content" contentContainerStyle={{ gap: 12 }}>
            <T
              accessibilityRole="header"
              style={{
                ...styles.sheetTitle,
                fontFamily: fontsLoaded ? 'LilitaOne' : undefined,
                fontWeight: fontsLoaded ? '400' : '900',
                fontSize: 28,
                lineHeight: 34,
              }}
            >
              {ACCESSIBILITY_SHEET_TITLE}
            </T>
            {ACCESSIBILITY_SHEET_POINTS.filter((p) => p.title !== NOT_SAVED).map(
              ({ title, body }) => (
                <T key={title} style={{ color: C.muted, fontSize: 14, lineHeight: 20 }}>
                  <Text style={{ color: C.text, fontWeight: '800' }}>{title}: </Text>
                  {body}
                </T>
              ),
            )}
            {ACCESSIBILITY_SHEET_POINTS.filter((p) => p.title === NOT_SAVED).map(
              ({ title, body }) => (
                <View key={title} style={styles.lockCard}>
                  <Icon name="lock" size={18} color={C.accent} />
                  <T style={{ color: C.text, fontSize: 14, lineHeight: 20, flex: 1 }}>
                    <Text style={{ fontWeight: '800' }}>{title}: </Text>
                    {body}
                  </T>
                </View>
              ),
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Read full details"
              accessibilityState={{ expanded }}
              onPress={() => setExpanded((open) => !open)}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <T style={{ color: C.accent, fontSize: 14, fontWeight: '700' }}>
                {expanded ? 'Hide full details' : 'Read full details'}
              </T>
            </Pressable>
            {expanded && <FullDisclosure />}
          </ScrollView>
          {error && <Notice tone="warn" title="Please try again" body={error} />}
          <View style={styles.sheetButtons}>
            <SheetButton label="Deny" onPress={() => setSheet('notSure')} />
            <SheetButton primary label="Accept" onPress={agree} />
          </View>
        </BottomSheet>
      )}
      {sheet === 'notSure' && (
        <BottomSheet>
          <T
            accessibilityRole="header"
            style={{
              ...styles.sheetTitle,
              fontFamily: fontsLoaded ? 'LilitaOne' : undefined,
              fontWeight: fontsLoaded ? '400' : '900',
              fontSize: 28,
              lineHeight: 34,
            }}
          >
            Not sure about this permission?
          </T>
          <View style={styles.pointsCard}>
            {NOT_SURE_POINTS.map(({ ok, text }) => (
              <View key={text} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                {ok ? (
                  <View style={styles.okDot}>
                    <Icon name="check" size={14} color="#0B0B08" />
                  </View>
                ) : (
                  <View style={{ width: 24, alignItems: 'center' }}>
                    <Icon name="close" size={20} color="#E5484D" />
                  </View>
                )}
                <T style={{ color: C.text, fontSize: 16, lineHeight: 23, flex: 1 }}>{text}</T>
              </View>
            ))}
          </View>
          <View style={styles.sheetButtons}>
            <SheetButton label="Not now" onPress={onDone} />
            <SheetButton primary label="Okay, turn it on" onPress={() => setSheet('consent')} />
          </View>
        </BottomSheet>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 20,
  },
  title: { color: C.text, fontSize: 28, lineHeight: 35, textAlign: 'center', marginHorizontal: 4 },
  body: {
    color: C.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginHorizontal: 2.5,
  },
  wordLine: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#55524A' },
  footer: { width: '100%', maxWidth: 480, alignSelf: 'center', padding: 16, gap: 14 },
  trust: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
    backgroundColor: '#FFE8AE',
  },
  bubbleText: { fontSize: 12, fontWeight: '700', color: C.brown },
  phone: {
    position: 'absolute',
    right: 0,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#3A372D',
    backgroundColor: '#15140F',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: '#29271F',
  },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#8C887A' },
  line: { height: 8, borderRadius: 4, backgroundColor: '#8C887A' },
  message: { height: 32, borderRadius: 14, backgroundColor: '#29271F' },
  reelActions: { position: 'absolute', right: 8, bottom: '28%', gap: 12 },
  reelAction: { width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.85)' },
  reelCaption: { position: 'absolute', left: 10, right: 40, bottom: 16, gap: 6 },
  captionLine: { height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.85)' },
  recents: { flex: 1, justifyContent: 'center', padding: 12, backgroundColor: '#222019' },
  appCard: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: '18%',
    gap: 6,
    padding: 8,
    borderRadius: 14,
    backgroundColor: '#3A372D',
  },
  ourCard: { left: 22, right: 6, backgroundColor: '#4B2C0C' },
  cardTitle: { color: C.text, fontSize: 11, fontWeight: '800' },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '88%',
    padding: 20,
    paddingTop: 10,
    gap: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#1E1D17',
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#55524A',
  },
  sheetTitle: { color: C.text, fontSize: 24, lineHeight: 30, fontWeight: '900' },
  lockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#2A2820',
  },
  pointsCard: { borderRadius: 16, padding: 16, gap: 16, backgroundColor: '#2A2820' },
  okDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5FC35F',
  },
  sheetButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  sheetButton: {
    flexGrow: 1,
    flexBasis: 140,
    minHeight: 56,
    paddingHorizontal: 10,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
