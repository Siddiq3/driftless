import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { BrainCompanion } from '../src/ui/BrainCompanion';

jest.mock('../src/ui/BrainCharacter', () => ({ BrainCharacter: () => null }));
jest.mock('../src/ui/kit', () => ({
  T: require('react-native').Text,
  useTheme: () => ({ accent: '#FFD09D', onAccent: '#201A14' }),
}));

it('changes quotes on every tap without repeats through the deck, including its boundary', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<BrainCompanion initialQuote="Ready when you are." />);
  });
  const bubble = () =>
    tree.root.findAll((n) => n.props.accessibilityLiveRegion === 'polite')[0]!.props
      .accessibilityLabel as string;
  try {
    expect(bubble()).toBe('Ready when you are.');
    const quotes: string[] = [];
    for (let i = 0; i < 48; i++) {
      const previous = bubble();
      await act(async () =>
        tree.root
          .findAll(
            (n) => n.props.accessibilityLabel === 'Chat with your brain' && n.props.onPress,
          )[0]!
          .props.onPress(),
      );
      expect(bubble()).not.toBe(previous);
      quotes.push(bubble());
    }
    expect(new Set(quotes.slice(0, 24)).size).toBe(24);
    expect(new Set(quotes.slice(24)).size).toBe(24);
    // Live tracking refreshes must not overwrite the quote the user just requested.
    await act(async () => {
      tree.update(<BrainCompanion initialQuote="Room to breathe." />);
    });
    expect(bubble()).toBe(quotes.at(-1));
  } finally {
    await act(async () => tree.unmount());
  }
});

it('replaces the previous mood quote immediately and cycles only drained quotes', async () => {
  let tree!: ReactTestRenderer;
  const bubble = () =>
    tree.root.findAll((n) => n.props.accessibilityLiveRegion === 'polite')[0]!.props
      .accessibilityLabel;
  const tap = async () =>
    act(async () =>
      tree.root
        .findAll(
          (n) => n.props.accessibilityLabel === 'Chat with your brain' && n.props.onPress,
        )[0]!
        .props.onPress(),
    );
  await act(async () => {
    tree = create(<BrainCompanion initialQuote="Feeling fresh." />);
  });
  try {
    await tap();
    const happyQuote = bubble();
    await act(async () => {
      tree.update(
        <BrainCompanion quoteMood="drained" pose="tired" initialQuote="Time to recharge." />,
      );
    });
    expect(bubble()).toBe('Time to recharge.');
    const seen = new Set<string>();
    for (let i = 0; i < 12; i++) {
      await tap();
      expect(bubble()).not.toBe(happyQuote);
      seen.add(bubble());
    }
    expect(seen.size).toBe(12);
    const last = bubble();
    await tap();
    expect(seen.has(bubble())).toBe(true);
    expect(bubble()).not.toBe(last);
    await act(async () => {
      tree.update(<BrainCompanion quoteMood="happy" initialQuote="Fresh start." />);
    });
    expect(bubble()).toBe('Fresh start.');
  } finally {
    await act(async () => tree.unmount());
  }
});
