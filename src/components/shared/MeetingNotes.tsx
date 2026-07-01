import { useState } from 'react';
import SidePanel from './SidePanel';
import { activities as activitiesApi, tasks as tasksApi } from '../../lib/api';
import Icon from './Icon';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface MeetingNote {
  id?: string;
  purpose: string;
  attendees: string;
  discussion: string;
  decisions: string;
  actionItems: string;
  nextFollowUp: string;
  nextFollowUpDate: string;
}

const emptyNote: MeetingNote = {
  purpose: '', attendees: '', discussion: '',
  decisions: '', actionItems: '', nextFollowUp: '', nextFollowUpDate: '',
};

export default function MeetingNotes({
  open, onClose, entityType, entityId, companyName, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  entityType: string;
  entityId: string;
  companyName?: string;
  onSaved?: () => void;
}) {
  const [form, setForm] = useState<MeetingNote>(emptyNote);
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [viewingNotes, setViewingNotes] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const set = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const save = async () => {
    if (!form.purpose) return;
    setSaving(true);
    try {
      // Build structured description
      const description = [
        `## ${t('page.meetingNotes.descriptionTitle', { purpose: form.purpose })}`,
        '',
        `**${t('page.meetingNotes.descriptionAttendees')}:** ${form.attendees || '—'}`,
        '',
        `**${t('page.meetingNotes.descriptionDiscussion')}:**`,
        form.discussion,
        '',
        `**${t('page.meetingNotes.descriptionDecisions')}:**`,
        form.decisions || '—',
        '',
        `**${t('page.meetingNotes.descriptionActionItems')}:**`,
        form.actionItems || '—',
        '',
        form.nextFollowUp ? `**${t('page.meetingNotes.descriptionNextFollowUp')}:** ${form.nextFollowUp} (${form.nextFollowUpDate || t('page.meetingNotes.tbd')})` : '',
      ].filter(Boolean).join('\n');

      // Save as activity
      await activitiesApi.create({
        entity_type: entityType,
        entity_id: entityId,
        activity_type: 'meeting',
        subject: t('page.meetingNotes.meetingSubject', { purpose: form.purpose }),
        description,
        direction: 'internal',
        channel: 'in_person',
      });

      // Create follow-up task if date set
      if (form.nextFollowUp && form.nextFollowUpDate) {
        await tasksApi.create({
          subject: t('page.meetingNotes.followUpSubject', { subject: form.nextFollowUp }),
          task_type: 'follow_up',
          priority: 'medium',
          status: 'pending',
          due_date: form.nextFollowUpDate,
          entity_type: entityType,
          entity_id: entityId,
        });
      }

      setForm(emptyNote);
      onSaved?.();
      onClose();
    } catch (e) {
      toast.error(t('page.meetingNotes.meetingSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const loadHistory = async () => {
    try {
      const acts = await activitiesApi.list(entityType, entityId);
      setViewingNotes(acts.filter((a: any) => a.activity_type === 'meeting'));
      setShowHistory(true);
    } catch (e) {
      
    }
  };

  // New note form
  if (!showHistory) {
    return (
      <SidePanel open={open} onClose={onClose} title={t('page.meetingNotes.meetingNotes')} subtitle={companyName}>
        <div className="space-y-4">
          {/* Quick toggle to history */}
          <button onClick={loadHistory} className="text-xs text-blue-600 hover:underline mb-2 inline-block">
            <Icon name="calendar" size={14} className="text-gray-400 mr-1.5" />{t('page.meetingNotes.viewPastMeetings')}
          </button>

          <div>
            <label className="label">{t('page.meetingNotes.meetingPurpose')}</label>
            <input className="input" value={form.purpose} onChange={e => set('purpose', e.target.value)}
              placeholder={t('page.meetingNotes.purposePlaceholder')} autoFocus />
          </div>

          <div>
            <label className="label">{t('page.meetingNotes.attendees')}</label>
            <input className="input" value={form.attendees} onChange={e => set('attendees', e.target.value)}
              placeholder={t('page.meetingNotes.attendeesPlaceholder')} />
          </div>

          <div>
            <label className="label">{t('page.meetingNotes.discussionPoints')}</label>
            <textarea className="input min-h-[100px] resize-y" value={form.discussion}
              onChange={e => set('discussion', e.target.value)}
              placeholder={t('page.meetingNotes.discussionPlaceholder')} />
          </div>

          <div>
            <label className="label">{t('page.meetingNotes.decisionsMade')}</label>
            <textarea className="input min-h-[60px] resize-y" value={form.decisions}
              onChange={e => set('decisions', e.target.value)}
              placeholder={t('page.meetingNotes.decisionsPlaceholder')} />
          </div>

          <div>
            <label className="label">{t('page.meetingNotes.actionItems')}</label>
            <textarea className="input min-h-[60px] resize-y" value={form.actionItems}
              onChange={e => set('actionItems', e.target.value)}
              placeholder={t('page.meetingNotes.actionItemsPlaceholder')} />
          </div>

          <div className="border-t border-gray-100 pt-4">
            <label className="label">{t('page.meetingNotes.scheduleFollowUp')}</label>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <input className="input" value={form.nextFollowUp}
                  onChange={e => set('nextFollowUp', e.target.value)}
                  placeholder={t('page.meetingNotes.followUpPlaceholder')} />
              </div>
              <div>
                <label className="text-2xs text-gray-400">{t('page.meetingNotes.followUpDate')}</label>
                <input className="input mt-0.5" type="date" value={form.nextFollowUpDate}
                  onChange={e => set('nextFollowUpDate', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={save} disabled={saving || !form.purpose} className="btn-primary flex-1">
              {saving ? t('page.meetingNotes.saving') : t('page.meetingNotes.saveMeetingNotes')}
            </button>
            <button onClick={onClose} className="btn-secondary">{t('common.cancel')}</button>
          </div>
        </div>
      </SidePanel>
    );
  }

  // Past meetings view
  return (
    <SidePanel open={open} onClose={onClose} title={t('page.meetingNotes.pastMeetings')} subtitle={companyName}>
      <button onClick={() => setShowHistory(false)} className="text-xs text-blue-600 hover:underline mb-4 inline-block">
        {t('page.meetingNotes.newMeetingNotes')}
      </button>
      <div className="space-y-3">
        {viewingNotes.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">{t('page.meetingNotes.noPastMeetings')}</p>
        ) : (
          viewingNotes.map((note: any) => (
            <div key={note.id} className="card p-3">
              <div className="text-xs font-medium text-gray-900">{note.subject}</div>
              <div className="text-2xs text-gray-400 mt-1">{new Date(note.created_at).toLocaleDateString()}</div>
              {note.description && (
                <div className="text-xs text-gray-600 mt-2 whitespace-pre-line line-clamp-4">{note.description}</div>
              )}
            </div>
          ))
        )}
      </div>
    </SidePanel>
  );
}
