import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StartupScreen } from '@/ui/StartupScreen';
import { STARTUP_HELP_DELAY_MS } from '@/startup/timing';

let root: ReactTestRenderer;
beforeEach(() => jest.useFakeTimers());
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  jest.useRealTimers();
});
it('shows a compact truthful stage without decorative copy or an immediate sign-out action', async () => {
  await act(async () => {
    root = create(<StartupScreen message="Checking your account…" onSignOut={jest.fn()} />);
  });
  const visible = JSON.stringify(root.toJSON());
  expect(visible).toContain('Checking your account');
  expect(visible).not.toContain('A little pause');
  expect(root.root.findAllByProps({ accessibilityLabel: 'Sign out' })).toHaveLength(0);
});
it('offers sign-out recovery only after the slow-start threshold and never signs out automatically', async () => {
  const signOut = jest.fn();
  await act(async () => {
    root = create(<StartupScreen onSignOut={signOut} />);
  });
  await act(async () => jest.advanceTimersByTime(STARTUP_HELP_DELAY_MS));
  expect(JSON.stringify(root.toJSON())).toContain('Taking longer than usual');
  expect(signOut).not.toHaveBeenCalled();
  await act(async () =>
    root.root
      .findAll((node) => node.props.accessibilityLabel === 'Sign out' && node.props.onPress)[0]!
      .props.onPress(),
  );
  expect(signOut).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
});
