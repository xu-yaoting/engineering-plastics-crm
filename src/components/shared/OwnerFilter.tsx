import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { auth, team, type TeamMember } from '../../lib/api';
import Icon from './Icon';

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
  const [loadError, setLoadError] = useState(false);

  const load = () => {
    setLoadError(false);
    Promise.all([
      team.list(),
      auth.me(),
    ])
      .then(([teamMembers, { user }]) => {
        setMembers(teamMembers);
        onCurrentUserId(user.id);
      })
      .catch(() => {
        setMembers([]);
        onCurrentUserId('');
        setLoadError(true);
      });
  };
  useEffect(() => {
    load();
  }, [onCurrentUserId]);

  return (
    <div className="flex items-center gap-1.5">
      <select className="input w-auto min-w-[130px]" value={value} onChange={event => onChange(event.target.value)} aria-label={t('accountability.owner')}>
        <option value="all">{t('accountability.allOwners')}</option>
        <option value="mine">{t('accountability.myCustomers')}</option>
        <option value="unassigned">{t('accountability.unassigned')}</option>
        {members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
      </select>
      {loadError && (
        <button
          type="button"
          onClick={load}
          className="icon-btn text-danger"
          aria-label={t('common.refresh')}
          title={t('page.error.loadFailed')}
        >
          <Icon name="refresh" size={14} />
        </button>
      )}
    </div>
  );
}
