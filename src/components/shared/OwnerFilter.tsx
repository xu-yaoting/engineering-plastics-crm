import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { auth, team, type TeamMember } from '../../lib/api';

export default function OwnerFilter({
  value,
  onChange,
  onCurrentUserId,
}: {
  value: string;
  onChange: (value: string) => void;
  onCurrentUserId: (userId: string) => void;
}) {
  const { t } = useTranslation();
  const [members, setMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    team.list().then(setMembers).catch(() => setMembers([]));
    auth.me().then(({ user }) => onCurrentUserId(user.id)).catch(() => onCurrentUserId(''));
  }, [onCurrentUserId]);

  return (
    <select className="input w-auto min-w-[130px]" value={value} onChange={event => onChange(event.target.value)} aria-label={t('accountability.owner')}>
      <option value="all">{t('accountability.allOwners')}</option>
      <option value="mine">{t('accountability.myCustomers')}</option>
      <option value="unassigned">{t('accountability.unassigned')}</option>
      {members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
    </select>
  );
}
