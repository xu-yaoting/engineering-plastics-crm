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
        `## Meeting Notes — ${form.purpose}`,
        '',
        `**Attendees:** ${form.attendees || '—'}`,
        '',
        `**Discussion:**`,
        form.discussion,
        '',
        `**Decisions:**`,
        form.decisions || '—',
        '',
        `**Action Items:**`,
        form.actionItems || '—',
        '',
        form.nextFollowUp ? `**Next Follow-up:** ${form.nextFollowUp} (${form.nextFollowUpDate || 'TBD'})` : '',
      ].filter(Boolean).join('\n');

      // Save as activity
      await activitiesApi.create({
        entity_type: entityType,
        entity_id: entityId,
        activity_type: 'meeting',
        subject: `Meeting: ${form.purpose}`,
        description,
        direction: 'internal',
        channel: 'in_person',
      });

      // Create follow-up task if date set
      if (form.nextFollowUp && form.nextFollowUpDate) {
        await tasksApi.create({
          subject: `Follow-up: ${form.nextFollowUp}`,
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
      toast.error('Failed to save meeting notes');
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
      <SidePanel open={open} onClose={onClose} title="Meeting Notes" subtitle={companyName}>
        <div className="space-y-4">
          {/* Quick toggle to history */}
          <button onClick={loadHistory} className="text-xs text-blue-600 hover:underline mb-2 inline-block">
            <Icon name="calendar" size={14} className="text-gray-400 mr-1.5" />View past meetings
          </button>

          <div>
            <label className="label">Meeting Purpose *</label>
            <input className="input" value={form.purpose} onChange={e => set('purpose', e.target.value)}
              placeholder="e.g. Quarterly review, Technical discussion" autoFocus />
          </div>

          <div>
            <label className="label">Attendees</label>
            <input className="input" value={form.attendees} onChange={e => set('attendees', e.target.value)}
              placeholder="John Chen, Dr. Lisa Park (Acme)" />
          </div>

          <div>
            <label className="label">Discussion Points</label>
            <textarea className="input min-h-[100px] resize-y" value={form.discussion}
              onChange={e => set('discussion', e.target.value)}
              placeholder="• PEEK 450G test results — passed mechanical tests&#10;• Customer requested UL94 certification&#10;• Discussed pricing for 500 sheets/year" />
          </div>

          <div>
            <label className="label">Decisions Made</label>
            <textarea className="input min-h-[60px] resize-y" value={form.decisions}
              onChange={e => set('decisions', e.target.value)}
              placeholder="• Proceed with sample order&#10;• Need to provide COA before shipment" />
          </div>

          <div>
            <label className="label">Action Items</label>
            <textarea className="input min-h-[60px] resize-y" value={form.actionItems}
              onChange={e => set('actionItems', e.target.value)}
              placeholder="• Sarah: Send UL94 cert by Friday&#10;• John: Confirm sample quantity" />
          </div>

          <div className="border-t border-gray-100 pt-4">
            <label className="label">Schedule Follow-up</label>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <input className="input" value={form.nextFollowUp}
                  onChange={e => set('nextFollowUp', e.target.value)}
                  placeholder="e.g. Check test progress" />
              </div>
              <div>
                <label className="text-2xs text-gray-400">Follow-up Date</label>
                <input className="input mt-0.5" type="date" value={form.nextFollowUpDate}
                  onChange={e => set('nextFollowUpDate', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={save} disabled={saving || !form.purpose} className="btn-primary flex-1">
              {saving ? 'Saving...' : 'Save Meeting Notes'}
            </button>
            <button onClick={onClose} className="btn-secondary">{t('common.cancel')}</button>
          </div>
        </div>
      </SidePanel>
    );
  }

  // Past meetings view
  return (
    <SidePanel open={open} onClose={onClose} title="Past Meetings" subtitle={companyName}>
      <button onClick={() => setShowHistory(false)} className="text-xs text-blue-600 hover:underline mb-4 inline-block">
        New Meeting Notes
      </button>
      <div className="space-y-3">
        {viewingNotes.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No past meetings recorded</p>
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
