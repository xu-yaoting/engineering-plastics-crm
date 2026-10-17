import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

type PaginationProps = {
  page: number;
  pageSize?: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
};

export default function Pagination({
  page,
  pageSize = 10,
  total,
  onPageChange,
  className = '',
}: PaginationProps) {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);
  const goToPage = (nextPage: number) => {
    onPageChange(Math.min(Math.max(nextPage, 1), totalPages));
  };

  return (
    <nav
      className={`flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-2 text-xs text-ink-muted ${className}`}
      aria-label={t('common.pagination')}
    >
      <span className="tabular-nums">
        {start}–{end} / {total} {t('common.records')}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="icon-btn h-7 w-7"
          onClick={() => goToPage(1)}
          disabled={currentPage === 1}
          aria-label={t('common.firstPage')}
          title={t('common.firstPage')}
        >
          <ChevronsLeft size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-btn h-7 w-7"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label={t('common.previousPage')}
          title={t('common.previousPage')}
        >
          <ChevronLeft size={15} aria-hidden="true" />
        </button>
        <span className="min-w-12 px-1 text-center tabular-nums text-2xs text-ink-muted">
          {currentPage} / {totalPages}
        </span>
        <button
          type="button"
          className="icon-btn h-7 w-7"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label={t('common.nextPage')}
          title={t('common.nextPage')}
        >
          <ChevronRight size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-btn h-7 w-7"
          onClick={() => goToPage(totalPages)}
          disabled={currentPage === totalPages}
          aria-label={t('common.lastPage')}
          title={t('common.lastPage')}
        >
          <ChevronsRight size={15} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
