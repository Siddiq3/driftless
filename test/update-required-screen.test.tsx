import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { UpdateRequiredScreen } from '@/updates/UpdateRequiredScreen';

let mockReduced = false;
jest.mock('@/ui/motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('expo-font', () => ({ useFonts: () => [true] }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('@/updates/UpdatingMascot', () => ({ UpdatingMascot: () => null }));
jest.mock('@/onboarding/Visuals', () => {
  const { Pressable, Text } = require('react-native');
  const React = require('react');
  return {
    SetupButton: ({ label, onPress }: { label: string; onPress: () => void }) =>
      React.createElement(
        Pressable,
        { accessibilityLabel: label, onPress },
        React.createElement(Text, null, label),
      ),
  };
});

let tree: ReactTestRenderer;
afterEach(() => act(() => tree.unmount()));

it.each([false, true])(
  'shows the update promise and reassurance (reduced motion %s)',
  (reduced) => {
    mockReduced = reduced;
    const onUpdate = jest.fn();
    act(() => {
      tree = create(
        <UpdateRequiredScreen onUpdate={onUpdate} busy={false} message={null} inProgress={false} />,
      );
    });
    const text = JSON.stringify(tree.toJSON());
    for (const copy of [
      'A little refresh',
      '✨ New features',
      '🐞 Fixes',
      '⚡ Smoother',
      'Your streaks and settings stay safe.',
    ])
      expect(text).toContain(copy);
    act(() =>
      tree.root
        .findAll((n) => n.props.accessibilityLabel === 'Update on Google Play')[0]!
        .props.onPress(),
    );
    expect(onUpdate).toHaveBeenCalledTimes(1);
  },
);
