import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';

type CompanyFilterChipProps = {
  name: string;
  icon: 'building' | 'filter';
  className?: string;
};

export default function CompanyFilterChip({ name, icon, className }: CompanyFilterChipProps) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const clear = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('company');
    setSearchParams(next, { replace: true });
  };

  return (
    <span className={[className, 'inline-flex max-w-[240px] items-center gap-1 rounded-md bg-brand-soft px-2 py-1 text-xs font-450 text-brand'].filter(Boolean).join(' ')}>
      <Icon name={icon} size={12} />
      <span className="truncate">{name || '…'}</span>
      <button
        type="button"
        onClick={clear}
        className="rounded p-0.5 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        aria-label={t('common.clearFilter')}
        title={t('common.clearFilter')}
      >
        <Icon name="close" size={12} />
      </button>
    </span>
  );
}
