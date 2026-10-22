import { useRef, useState, type ComponentProps } from 'react';
import { Pressable, View } from 'react-native';
import { BrainCharacter } from './BrainCharacter';
import { T, useTheme } from './kit';

const QUOTES = [
  'Bestie, the feed can wait.',
  'Plot twist: you put the phone down.',
  'Main character. Offline episode.',
  'Less doomscroll. More side quests.',
  'Your next era needs a screen break.',
  'The algorithm misses you. Let it.',
  'One deep breath. For the plot.',
  'BRB, touching grass.',
  'Your group chat can survive a minute.',
  'Small break. Big brain energy.',
  'You can leave the feed on read.',
  'New side quest: get some water.',
  'We have snacks at home. And hobbies.',
  'No thoughts. Just a little stretch.',
  'Your attention is VIP. Act like it.',
  'The scroll has no finale. You do.',
  'A tiny pause is still a flex.',
  'Let’s make a memory off-screen.',
  'You’re allowed to be bored, bestie.',
  'Me 🤝 you: taking five.',
  'Another reel? How about a little walk?',
  'Romanticize looking out the window.',
  'Your offline lore is waiting.',
  'Brain buffering. Try a stretch.',
];

const DRAINED_QUOTES = [
  'Bestie, I’m running on 1%.',
  'Please have mercy. Tiny break?',
  'Brain buffering. Let’s log off a sec.',
  'Daily limit hit. Time for a side quest.',
  'Low battery vibes. Water break?',
  'The feed can wait. I need a breather.',
  'My last brain cell wants a stretch.',
  'We’ve scrolled enough lore for today.',
  'Can our next episode be offline?',
  'Plot twist: we actually take a break.',
  'BRB, recharging away from the feed.',
  'Less scrolling. More staring at clouds.',
];

type Props = ComponentProps<typeof BrainCharacter> & {
  initialQuote: string;
  quoteMood?: 'happy' | 'drained';
};

export function BrainCompanion({ quoteMood = 'happy', ...props }: Props) {
  // A mood change immediately replaces the old quote and its shuffled deck.
  return <BrainQuoteDeck key={quoteMood} quoteMood={quoteMood} {...props} />;
}

/** A shuffled deck keeps every tap fresh until all quotes have been shown. */
function BrainQuoteDeck({ initialQuote, quoteMood, ...character }: Props) {
  const t = useTheme();
  const [quote, setQuote] = useState<string | null>(null);
  const deck = useRef<string[]>([]);
  const previous = useRef<string | null>(initialQuote);
  const nextQuote = () => {
    if (!deck.current.length) {
      const shuffled = [...(quoteMood === 'drained' ? DRAINED_QUOTES : QUOTES)];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
      }
      // Also avoid a repeat where one deck ends and the next begins.
      if (shuffled.at(-1) === previous.current) {
        [shuffled[0], shuffled[shuffled.length - 1]] = [shuffled.at(-1)!, shuffled[0]!];
      }
      deck.current = shuffled;
    }
    const next = deck.current.pop()!;
    previous.current = next;
    setQuote(next);
  };

  return (
    <View style={{ alignItems: 'center', gap: 8, width: '100%' }}>
      <View style={{ maxWidth: '100%', width: 300, alignItems: 'center', paddingBottom: 10 }}>
        <View
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={quote ?? initialQuote}
          style={{
            backgroundColor: t.accent,
            borderRadius: 24,
            paddingHorizontal: 18,
            paddingVertical: 10,
            minHeight: 44,
            justifyContent: 'center',
          }}
        >
          <T
            v="label"
            style={{ color: t.onAccent, textAlign: 'center', fontWeight: '600', fontSize: 14 }}
          >
            {quote ?? initialQuote}
          </T>
        </View>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: 0,
            width: 0,
            height: 0,
            borderLeftWidth: 10,
            borderRightWidth: 10,
            borderTopWidth: 12,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderTopColor: t.accent,
          }}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Chat with your brain"
        accessibilityHint="Shows a different playful quote"
        onPress={nextQuote}
        style={({ pressed }) => ({
          alignItems: 'center',
          maxWidth: '100%',
          opacity: pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        })}
      >
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <BrainCharacter {...character} />
        </View>
        <T v="caption" muted>
          Tap me ✨
        </T>
      </Pressable>
    </View>
  );
}
