import React, { createRef } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { QuestionContent, type QuestionContentHandle } from '../src/onboarding/QuestionContent';
import { useTypewriter } from '../src/ui/onboarding-motion/TypewriterText';
import { ONBOARDING_MOTION as M } from '../src/ui/onboarding-motion/constants';
import { SetupButton } from '../src/onboarding/Visuals';
import * as Haptics from 'expo-haptics';

// Native animation frames are covered by emulator checks; fake only the animation clock here.
jest.mock('react-native-reanimated', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  const native = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: { View: native.View, Text: native.Text },
    useSharedValue: (initial: number) =>
      react.useState(() => ({
        value: initial,
        set(value: number) {
          this.value = value;
        },
      }))[0],
    useAnimatedStyle: (fn: () => object) => fn(),
    withTiming: (value: number) => value,
    withDelay: (_delay: number, value: number) => value,
    withRepeat: (value: number) => value,
    withSequence: (...values: number[]) => values.at(-1),
    cancelAnimation: jest.fn(),
    Easing: { linear: (n: number) => n, sin: (n: number) => n, inOut: (fn: unknown) => fn },
  };
});
jest.mock('expo-router', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  return { useFocusEffect: (fn: () => void) => react.useEffect(fn, [fn]) };
});
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}));
jest.mock('../src/ui/BrainCharacter', () => ({ BrainCharacter: () => null }));
jest.mock('../src/ui/Icon', () => ({ Icon: () => null }));
jest.mock('../src/ui/kit', () => ({
  T: ({ children }: { children: React.ReactNode }) => {
    const native = jest.requireActual<typeof import('react-native')>('react-native');
    return <native.Text>{children}</native.Text>;
  },
}));

let tree: ReactTestRenderer | undefined;
beforeEach(() => jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] }));
afterEach(async () => {
  await act(async () => tree?.unmount());
  expect(jest.getTimerCount()).toBe(0);
  tree = undefined;
  jest.useRealTimers();
});
async function layoutText() {
  // Supply the native layout events that ReactTestRenderer cannot calculate.
  for (let pass = 0; pass < 2; pass++) {
    const measures =
      tree?.root.findAll((node) => typeof node.props.onTextLayout === 'function') ?? [];
    await act(async () => {
      for (const measure of measures) {
        const text = String(measure.props.children);
        measure.props.onTextLayout({
          nativeEvent: {
            lines: [
              {
                text,
                width: text.length * 8,
                height: 23,
                x: 0,
                y: 0,
                ascender: 17,
                descender: 6,
                capHeight: 17,
                xHeight: 12,
              },
            ],
          },
        });
      }
    });
  }
}
async function advance(ms: number) {
  await layoutText();
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}
const props = {
  questionKey: 'occupation',
  title: 'What do you do?',
  options: [{ value: 'school', label: 'School student', selected: false }],
  busy: false,
  reducedMotion: false,
  onSelect: jest.fn(),
  onReady: jest.fn(),
};

it('waits for the OS preference and the full question before allowing answers', async () => {
  const onReady = jest.fn();
  await act(async () => {
    tree = create(<QuestionContent {...props} reducedMotion={null} onReady={onReady} />);
  });
  await advance(2000);
  expect(onReady).not.toHaveBeenCalled();
  await act(async () => {
    tree!.update(<QuestionContent {...props} onReady={onReady} />);
  });
  expect(tree!.root.findAllByProps({ accessibilityRole: 'radio' })[0]!.props.disabled).toBe(true);
  await advance(M.questionPause);
  await advance(3 * M.wordDelay + M.wordFade - 1);
  expect(onReady).not.toHaveBeenCalled();
  await advance(1);
  expect(onReady).toHaveBeenCalledTimes(1);
  expect(tree!.root.findAllByProps({ accessibilityRole: 'radio' })[0]!.props.disabled).toBe(false);
});

it('reduced motion reveals the entire question in one short fade', async () => {
  const onReady = jest.fn();
  await act(async () => {
    tree = create(<QuestionContent {...props} reducedMotion onReady={onReady} />);
  });
  await advance(0);
  await advance(M.reducedFade);
  expect(onReady).toHaveBeenCalledTimes(1);
  expect(tree!.root.findAllByProps({ accessibilityRole: 'radio' })[0]!.props.disabled).toBe(false);
});

it('going back during the pause cancels typing and clears the bubble after the exit', async () => {
  const ref = createRef<QuestionContentHandle>();
  const onReady = jest.fn();
  await act(async () => {
    tree = create(<QuestionContent ref={ref} {...props} onReady={onReady} />);
  });
  let exit: Promise<void> | undefined;
  await act(async () => {
    exit = ref.current!.fadeOut();
  });
  await advance(M.exitFade);
  await exit;
  await advance(2000);
  expect(onReady).not.toHaveBeenCalled();
  expect(tree!.root.findAllByProps({ accessibilityRole: 'radio' })[0]!.props.disabled).toBe(true);
});

it('unmounting during an exit resolves navigation and cancels all pending timers', async () => {
  const ref = createRef<QuestionContentHandle>();
  await act(async () => {
    tree = create(<QuestionContent ref={ref} {...props} />);
  });
  await advance(M.questionPause);
  let exit: Promise<void> | undefined;
  await act(async () => {
    exit = ref.current!.fadeOut();
  });
  await act(async () => tree!.unmount());
  await expect(exit).resolves.toBeUndefined();
  tree = undefined;
});

it('resets question readiness while keeping saved selections when the step changes', async () => {
  const onReady = jest.fn();
  await act(async () => {
    tree = create(<QuestionContent {...props} onReady={onReady} />);
  });
  await advance(M.questionPause);
  await advance(3 * M.wordDelay + M.wordFade);
  await act(async () => {
    tree!.update(
      <QuestionContent
        {...props}
        questionKey="apps"
        title="Where do you scroll?"
        options={[{ value: 'instagram', label: 'Instagram Reels', selected: true }]}
        onReady={onReady}
      />,
    );
  });
  const choice = tree!.root.findAllByProps({ accessibilityRole: 'radio' })[0]!;
  expect(choice.props.disabled).toBe(true);
  expect(choice.props.accessibilityState.checked).toBe(true);
  await advance(M.questionPause);
  await advance(3 * M.wordDelay + M.wordFade);
  expect(onReady).toHaveBeenCalledTimes(2);
});

it('exposes word tokens and isTyping and cancels a stale onDone after text changes', async () => {
  const onDone = jest.fn();
  function Probe({ text }: { text: string }) {
    const { words, isTyping } = useTypewriter(text, M.wordDelay, { onDone });
    return <Text testID={isTyping ? 'typing' : 'done'}>{words.join('|')}</Text>;
  }
  await act(async () => {
    tree = create(<Probe text="What do you do?" />);
  });
  expect(tree!.root.findByType(Text).props.children).toBe('What |do |you |do?');
  await advance(100);
  await act(async () => {
    tree!.update(<Probe text="Where now?" />);
  });
  await advance(M.wordDelay + M.wordFade);
  expect(onDone).toHaveBeenCalledTimes(1);
  expect(tree!.root.findByType(Text).props.testID).toBe('done');
});

it('ignores double taps while Continue saves and emits one medium haptic', async () => {
  let finish: (() => void) | undefined;
  const onPress = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  jest.mocked(Haptics.impactAsync).mockClear();
  await act(async () => {
    tree = create(<SetupButton label="Continue" animate onPress={onPress} />);
  });
  const button = tree!.root.findAllByProps({ accessibilityRole: 'button' })[0]!;
  await act(async () => {
    button.props.onPress();
    button.props.onPress();
  });
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
  await act(async () => finish?.());
});

it('ignores disabled Continue taps', async () => {
  const onPress = jest.fn();
  await act(async () => {
    tree = create(<SetupButton label="Continue" animate disabled onPress={onPress} />);
  });
  const button = tree!.root.findAllByProps({ accessibilityRole: 'button' })[0]!;
  await act(async () => button.props.onPress());
  expect(onPress).not.toHaveBeenCalled();
});
