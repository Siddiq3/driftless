import { useEffect, useRef, useState } from 'react';
import { Clipboard, Modal, Share, StyleSheet, View } from 'react-native';
import type { ApiClient } from '@/api/client';
import { ModalContent, Button, Notice, T } from '@/ui/kit';
import { ensureSocialProfile } from './profile';
import { friendInviteMessage, inviteLink } from './invite';

export function FriendInviteSheet({
  visible,
  api,
  displayName,
  onClose,
}: {
  visible: boolean;
  api: ApiClient;
  displayName: string | null;
  onClose: () => void;
}) {
  const [invite, setInvite] = useState<{ api: ApiClient; code: string } | null>(null);
  const code = invite?.api === api && visible ? invite.code : null;
  const [busyApi, setBusyApi] = useState<ApiClient | null>(null);
  const busy = busyApi === api;
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const live = useRef(true);
  const epoch = useRef(0);
  const action = useRef(false);
  useEffect(() => {
    live.current = true;
    const lifetime = ++epoch.current;
    action.current = false;
    return () => {
      live.current = false;
      epoch.current = lifetime + 1;
    };
  }, [api, visible]);
  const create = async () => {
    if (action.current) return;
    action.current = true;
    const ticket = epoch.current;
    const allowed = () => live.current && ticket === epoch.current;
    setBusyApi(api);
    setError(null);
    try {
      await ensureSocialProfile(api, displayName, allowed);
      if (!allowed()) return;
      const invite = await api.createBattleInvite(allowed);
      if (allowed()) {
        inviteLink(invite.code);
        setInvite({ api, code: invite.code });
      }
    } catch (e) {
      if (allowed()) setError(e instanceof Error ? e.message : 'Could not create your invitation.');
    } finally {
      if (allowed()) {
        action.current = false;
        setBusyApi(null);
      }
    }
  };
  const share = async () => {
    if (!code || action.current) return;
    action.current = true;
    setError(null);
    try {
      await Share.share({ message: friendInviteMessage(code) });
    } catch {
      if (live.current) setError('Sharing could not be opened. Try copying the link.');
    } finally {
      action.current = false;
    }
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <ModalContent dismissLabel="Close invite" style={styles.sheet} onClose={onClose}>
        <View style={styles.handle} />
        <T v="title" style={{ color: '#FFE4AB' }}>
          A little friendly competition
        </T>
        <T muted>Invite someone to ScrollSnooze and find out who scrolls less.</T>
        <T v="caption" muted>
          Creating this link lets people who accept it become your friends and see your daily video
          totals from the day they join. You can stop sharing with someone by removing them. Your
          other history stays private.
        </T>
        {error && <Notice title="Invite needs attention" body={error} tone="warn" />}
        {note && <T>{note}</T>}
        {!code ? (
          <Button label="Create battle invite" busy={busy} onPress={() => void create()} />
        ) : (
          <>
            <Button label="Share invitation" onPress={() => void share()} />
            <Button
              kind="secondary"
              label="Copy invite link"
              onPress={() => {
                Clipboard.setString(friendInviteMessage(code));
                setNote('Invite link copied');
              }}
            />
            <T v="caption" muted>
              Invitation valid for 7 days. Download buttons will become available when ScrollSnooze
              is released.
            </T>
          </>
        )}
        <Button kind="secondary" label="Done" onPress={onClose} />
      </ModalContent>
    </Modal>
  );
}
const styles = StyleSheet.create({
  sheet: {
    backgroundColor: '#17140F',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    gap: 18,
  },
  handle: {
    height: 4,
    width: 44,
    alignSelf: 'center',
    borderRadius: 4,
    backgroundColor: '#625E51',
    marginBottom: 8,
  },
});
