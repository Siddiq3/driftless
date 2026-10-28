import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BrainCharacter } from '@/ui/BrainCharacter';
import { Icon } from '@/ui/Icon';
import { T } from '@/ui/kit';
import { AnimatedCharacter } from '@/ui/onboarding-motion/AnimatedCharacter';
import { ONBOARDING_MOTION as M } from '@/ui/onboarding-motion/constants';
import { SelectionFeedback } from '@/ui/onboarding-motion/SelectionFeedback';
import { StaggeredFadeIn } from '@/ui/onboarding-motion/StaggeredFadeIn';
import { TypewriterText } from '@/ui/onboarding-motion/TypewriterText';
import { SETUP_COLORS as C } from './Visuals';

export type QuestionContentHandle = { fadeOut: () => Promise<void> };
type Phase = 'pause' | 'typing' | 'ready' | 'exiting' | 'clear';

export const QuestionContent = forwardRef<
  QuestionContentHandle,
  {
    questionKey: string;
    title: string;
    multi?: boolean;
    options: { value: string; label: string; selected: boolean }[];
    busy: boolean;
    reducedMotion: boolean | null;
    onSelect: (value: string) => void;
    onReady: () => void;
  }
>(function QuestionContent(
  { questionKey, title, multi, options, busy, reducedMotion, onSelect, onReady },
  ref,
) {
  const [state, setState] = useState<{ key: string; phase: Phase }>({
    key: questionKey,
    phase: 'pause',
  });
  const phase = state.key === questionKey ? state.phase : 'pause';
  const exit = useRef<{ timer: ReturnType<typeof setTimeout>; resolve: () => void } | null>(null);
  const pause = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setState({ key: questionKey, phase: 'pause' });
    if (reducedMotion === null) return;
    const timer = setTimeout(
      () => setState({ key: questionKey, phase: 'typing' }),
      reducedMotion ? 0 : M.questionPause,
    );
    pause.current = timer;
    return () => clearTimeout(timer);
  }, [questionKey, reducedMotion]);
  useEffect(
    () => () => {
      if (exit.current) {
        clearTimeout(exit.current.timer);
        exit.current.resolve();
        exit.current = null;
      }
    },
    [],
  );
  useImperativeHandle(
    ref,
    () => ({
      fadeOut: () =>
        new Promise<void>((resolve) => {
          if (pause.current) clearTimeout(pause.current);
          setState({ key: questionKey, phase: 'exiting' });
          exit.current = {
            resolve,
            timer: setTimeout(
              () => {
                setState({ key: questionKey, phase: 'clear' });
                exit.current = null;
                resolve();
              },
              reducedMotion ? M.reducedFade : M.exitFade,
            ),
          };
        }),
    }),
    [questionKey, reducedMotion],
  );
  const ready = phase === 'ready';
  const typing = phase === 'typing';
  return (
    <>
      <View style={styles.questionHeader}>
        <AnimatedCharacter talking={typing} reducedMotion={reducedMotion !== false}>
          <BrainCharacter size={64} still />
        </AnimatedCharacter>
        <View style={{ flex: 1, borderRadius: 20, backgroundColor: '#F9F9ED', padding: 16 }}>
          <TypewriterText
            key={questionKey}
            text={title}
            active={typing || ready || phase === 'exiting'}
            paused={phase === 'exiting'}
            mutedColor={C.muted}
            reducedMotion={reducedMotion !== false}
            onDone={() => {
              if (!typing) return;
              setState({ key: questionKey, phase: 'ready' });
              onReady();
            }}
            style={{ color: '#191915', fontWeight: '700', fontSize: 17, lineHeight: 23 }}
          />
        </View>
      </View>
      <StaggeredFadeIn
        key={`${questionKey}-hint`}
        visible={ready}
        reducedMotion={reducedMotion !== false}
      >
        <T v="caption" style={{ textAlign: 'center', color: C.muted }}>
          {multi ? 'Pick all that apply' : 'Optional · choose one'}
        </T>
      </StaggeredFadeIn>
      <View style={{ gap: 10 }}>
        {options.map((option, index) => (
          <StaggeredFadeIn
            key={`${questionKey}-${option.value}`}
            visible={ready}
            index={index}
            reducedMotion={reducedMotion !== false}
          >
            <SelectionFeedback
              label={option.label}
              selected={option.selected}
              disabled={busy || !ready}
              multi={multi}
              onPress={() => onSelect(option.value)}
              reducedMotion={reducedMotion !== false}
              accent={C.accent}
              indicatorColor="#88897F"
              indicator={<Icon name="check" size={13} color={C.accent} />}
              style={{
                ...styles.choice,
                backgroundColor: option.selected ? '#3C2C19' : '#171713',
                borderColor: option.selected ? C.accent : '#24241E',
              }}
            >
              <T style={{ flex: 1, color: C.text, fontSize: 16 }}>{option.label}</T>
            </SelectionFeedback>
          </StaggeredFadeIn>
        ))}
      </View>
      {questionKey === 'apps' && (
        <StaggeredFadeIn
          key={`${questionKey}-note`}
          visible={ready}
          reducedMotion={reducedMotion !== false}
        >
          <T v="caption" style={styles.small}>
            App minutes: Instagram, YouTube, Facebook, Snapchat, Moj &amp; ShareChat.
          </T>
        </StaggeredFadeIn>
      )}
      {questionKey === 'usage' && (
        <StaggeredFadeIn
          key={`${questionKey}-note`}
          visible={ready}
          reducedMotion={reducedMotion !== false}
        >
          <T v="caption" style={styles.small}>
            Your estimate, not measured activity.
          </T>
        </StaggeredFadeIn>
      )}
    </>
  );
});

const styles = StyleSheet.create({
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
  small: { color: C.muted, textAlign: 'center', fontSize: 13, lineHeight: 19 },
});
