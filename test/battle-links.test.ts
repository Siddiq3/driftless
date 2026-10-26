import { parseBattleInvite, referralCode, battleShareMessage } from '@/social/inviteLinks';
import { rankBattle } from '@/social/ranking';
test('invitation links accept only our configured HTTPS origins and valid codes', () => {
  const code = 'ABCDEFGHJK';
  expect(
    parseBattleInvite(`https://join.example/join/${code}?utm_content=duel`, [
      'https://join.example',
    ]),
  ).toBe(code);
  expect(parseBattleInvite(`driftless://battle-invite?code=${code}`)).toBe(code);
  expect(
    parseBattleInvite(`https://evil.example/join/${code}`, ['https://join.example']),
  ).toBeNull();
  expect(parseBattleInvite('driftless://friends?invite=ABCDEFGHJK')).toBeNull();
  expect(parseBattleInvite('abc')).toBeNull();
  expect(referralCode('utm_content=duel&battle_invite=ABCDEFGHJK')).toBe(code);
  expect(referralCode('battle_invite=bad')).toBeNull();
  expect(battleShareMessage('https://join.example')).toContain('ScrollSnooze');
});
test('ranks smaller real counts first, ties equally and missing observations last', () => {
  const rows = rankBattle([
    { id: 'a', name: 'You', handle: 'you', views: 6, self: true },
    { id: 'b', name: 'Friend', handle: 'friend', views: 0, self: false },
    { id: 'c', name: 'Tie', handle: 'tie', views: 6, self: false },
    { id: 'd', name: 'Missing', handle: 'missing', views: null, self: false },
  ]);
  expect(rows.map((r) => [r.id, r.rank])).toEqual([
    ['b', 1],
    ['a', 2],
    ['c', 2],
    ['d', null],
  ]);
});
