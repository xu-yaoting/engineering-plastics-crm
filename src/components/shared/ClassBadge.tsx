import { useTranslation } from 'react-i18next';

type ClassBadgeProps = {
  classification?: string | null;
};

export default function ClassBadge({ classification }: ClassBadgeProps) {
  const { t } = useTranslation();
  if (!classification) return null;
  const badgeClass = classification === 'A' ? 'badge-blue' : classification === 'B' ? 'badge-yellow' : 'badge-gray';
  return (
    <span className={`${badgeClass} shrink-0`}>{t('page.companyDetail.classLabel', { class: classification })}</span>
  );
}
