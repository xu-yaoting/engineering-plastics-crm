import { useState } from 'react';
import { activities as activitiesApi, tasks as tasksApi } from '../../lib/api';
import Icon from './Icon';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

const activityIcons: Record<string, string> = {
  call: 'phone', email: 'mail', note: 'edit', meeting: 'calendar',
  status_change: 'refresh', document_upload: 'link', system_event: 'settings',
};

interface Activity {
  id: string;
  activity_type: string;
  subject: string;
  description?: string;
  direction?: string;
  created_at: string;
  duration_minutes?: number;
}

export default function ActivityTimeline({
  entityType,
  entityId,
  activities: initialActivities,
  onActivityAdded,
  compact,
}: {
  entityType: string;
  entityId: string;
  activities: Activity[];
  onActivityAdded?: () => void;
  compact?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [list, setList] = useState(initialActivities);
  const [noteText, setNoteText] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [logging, setLogging] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [lastActivityType, setLastActivityType] = useState('');

  // Sync when prop changes
  if (initialActivities !== list && !logging) {
    // eslint-disable-next-line
    setTimeout(() => setList(initialActivities), 0);
  }

  const logActivity = async (type: string) => {
    if (!entityId) return;
    setLogging(true);
    try {
      const subject = noteText || (
        type === 'call' ? t('page.activityTimeline.calledEntity', { entity: entityType }) :
        type === 'email' ? t('page.activityTimeline.emailEntity', { entity: entityType }) :
        type === 'note' ? t('page.activityTimeline.note') : t('page.activityTimeline.activityOnEntity', { type: activityTypeLabel(type), entity: entityType })
      );
      await activitiesApi.create({
        entity_type: entityType,
        entity_id: entityId,
        activity_type: type,
        subject,
        description: type === 'call' && noteText ? noteText : undefined,
        direction: type === 'call' || type === 'email' ? 'outbound' : 'internal',
      });
      setNoteText('');
      setShowInput(false);
      setLastActivityType(type);
      setShowFollowUp(true);
      // Default follow-up in 7 days
      const future = new Date();
      future.setDate(future.getDate() + 7);
      setFollowUpDate(future.toISOString().slice(0, 10));
      onActivityAdded?.();
    } catch (e) {
      toast.error(t('page.activityTimeline.activityLogFailed'));
    } finally {
      setLogging(false);
    }
  };

  const scheduleFollowUp = async () => {
    if (!followUpDate) return;
    const subject = lastActivityType === 'call' ? t('page.activityTimeline.followUpCall') :
                    lastActivityType === 'email' ? t('page.activityTimeline.followUpEmail') :
                    t('page.activityTimeline.followUp');
    await tasksApi.create({
      subject: `${subject} — ${entityType}`,
      task_type: 'follow_up',
      priority: 'medium',
      status: 'pending',
      due_date: followUpDate,
      entity_type: entityType,
      entity_id: entityId,
    });
    setShowFollowUp(false);
  };

  const getDateGroup = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return t('page.activityTimeline.today');
    if (d.toDateString() === yesterday.toDateString()) return t('page.activityTimeline.yesterday');
    return d.toLocaleDateString(i18n.language === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const todayLabel = t('page.activityTimeline.today');

  function activityTypeLabel(type: string) {
    if (type === 'call') return t('page.activityTimeline.call');
    if (type === 'email') return t('page.activityTimeline.email');
    if (type === 'note') return t('page.activityTimeline.note');
    if (type === 'meeting') return t('page.activityTimeline.meeting');
    return type.replaceAll('_', ' ');
  }

  // Group by date
  const groups: Record<string, Activity[]> = {};
  list.forEach(a => {
    const key = getDateGroup(a.created_at);
    if (!groups[key]) groups[key] = [];
    groups[key].push(a);
  });

  return (
    <div>
      {/* Quick action buttons */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <button onClick={() => { setShowInput(!showInput); }} className="btn-ghost btn-sm text-xs"><Icon name="edit" size={13} className="mr-1" />{t('page.activityTimeline.note')}</button>
        <button onClick={() => logActivity('call')} disabled={logging} className="btn-ghost btn-sm text-xs"><Icon name="phone" size={13} className="mr-1" />{t('page.activityTimeline.call')}</button>
        <button onClick={() => logActivity('email')} disabled={logging} className="btn-ghost btn-sm text-xs"><Icon name="mail" size={13} className="mr-1" />{t('page.activityTimeline.email')}</button>
        <button onClick={() => logActivity('meeting')} disabled={logging} className="btn-ghost btn-sm text-xs"><Icon name="calendar" size={13} className="mr-1" />{t('page.activityTimeline.meeting')}</button>
      </div>

      {/* Quick capture input */}
      {showInput && (
        <div className="flex flex-col gap-2 mb-4 sm:flex-row">
          <label className="sr-only" htmlFor="activity-timeline-note">{t('page.activityTimeline.typeNote')}</label>
          <input
            id="activity-timeline-note"
            className="input w-full flex-1 sm:w-auto"
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder={t('page.activityTimeline.typeNote')}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); logActivity('note'); } }}
          />
          <button onClick={() => logActivity('note')} disabled={!noteText.trim() || logging} className="btn-primary btn-sm w-full sm:w-auto">
            {t('common.save')}
          </button>
        </div>
      )}

      {/* Follow-up prompt */}
      {showFollowUp && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Icon name="calendar" size={14} className="text-gray-400" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-yellow-800">{t('page.activityTimeline.scheduleFollowUp')}</p>
              <p className="text-2xs text-yellow-600">{t('page.activityTimeline.followUpHelp')}</p>
            </div>
            <label className="sr-only" htmlFor="activity-timeline-follow-up-date">{t('page.activityTimeline.scheduleFollowUp')}</label>
            <input
              id="activity-timeline-follow-up-date"
              type="date"
              value={followUpDate}
              onChange={e => setFollowUpDate(e.target.value)}
              className="w-full sm:w-auto text-xs border border-yellow-300 rounded px-2 py-1 bg-white ml-0 sm:ml-2"
            />
          </div>
          <div className="flex items-center justify-end gap-1 self-end sm:self-auto">
            <button onClick={scheduleFollowUp} className="text-xs font-medium text-yellow-800 bg-yellow-100 px-2.5 py-1 rounded hover:bg-yellow-200">
              {t('page.activityTimeline.schedule')}
            </button>
            <button onClick={() => setShowFollowUp(false)} className="text-xs text-yellow-600 px-2 py-1 hover:text-yellow-800">
              <Icon name="close" size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Timeline */}
      {list.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-400 mb-2">{t('page.activityTimeline.noActivityYet')}</p>
          <p className="text-xs text-gray-400">{t('page.activityTimeline.logFirstInteraction')}</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-[7px] top-3 bottom-3 w-0.5 bg-gray-200" />
          <div className="space-y-0">
            {Object.entries(groups).map(([dateLabel, items]) => (
              <div key={dateLabel}>
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="section-label">{dateLabel}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                {items.map((a, idx) => (
                  <div key={a.id} className="relative pl-8 pb-4 group hover:bg-gray-50 rounded-lg px-2 py-2 -mx-2 cursor-default">
                    <div className={`absolute left-1 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                      idx === 0 && dateLabel === todayLabel ? 'bg-blue-600' : 'bg-gray-300'
                    }`} />
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-gray-500 mb-0.5">
                        <Icon name={(activityIcons[a.activity_type] || 'edit') as any} size={14} className="text-gray-400" />
                        <span className="font-medium text-gray-700 capitalize">{activityTypeLabel(a.activity_type)}</span>
                        <span>·</span>
                        <span>{new Date(a.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                        {a.duration_minutes && <span>· {a.duration_minutes} min</span>}
                      </div>
                      {a.direction && (
                        <span className={`shrink-0 text-2xs px-1 py-0.5 rounded ${
                          a.direction === 'inbound' ? 'bg-green-50 text-green-600' :
                          a.direction === 'outbound' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
                        }`}>{a.direction}</span>
                      )}
                    </div>
                    <p className={`${compact ? 'text-xs' : 'text-sm'} break-words text-gray-700 ml-6`}>{a.subject}</p>
                    {a.description && !compact && (
                      <p className="break-words text-xs text-gray-400 ml-6 mt-0.5">{a.description}</p>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
