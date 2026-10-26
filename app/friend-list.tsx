import { FriendsList } from '@/social/FriendsList';
import { useApi } from '@/api/useApi';
export default function Friends() {
  const api = useApi();
  return <FriendsList key={api?.incarnation ?? 'guest'} api={api} />;
}
