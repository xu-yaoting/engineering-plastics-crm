import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  followUps,
  team,
  type ActivityOutcome,
  type DevelopmentStage,
  type RecordFollowUpResult,
  type TeamMember,
} from '../../lib/api';
import SidePanel from '../shared/SidePanel';

type FollowUpCompany = {
  id: string;
  name: string;
  development_stage: DevelopmentStage;
};

type FollowUpContact = {
  id: string;
  first_name?: string;
  last_name?: string;
  name?: string;
};

type CurrentFollowUpTask = {
  id: string;
  subject: string;
  contact_id?: string | null;
};

const DEVELOPMENT_STAGES: DevelopmentStage[] = [
  'uncontacted',
  'contacted',
  'replied',
  'qualified',
  'converted',
  'nurturing',
  'stopped',
];

const ACTIVITY_OUTCOMES: ActivityOutcome[] = [
  'no_response',
  'replied',
  'interested',
  'no_current_need',
  'not_interested',
];

function dateAfterDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function FollowUpPanel({
  open,
  company,
  contacts = [],
  currentTask,
  suggestedSubject,
  onClose,
  onSaved,
}: {
  open: boolean;
  company: FollowUpCompany | null;
  contacts?: FollowUpContact[];
  currentTask?: CurrentFollowUpTask | null;
  suggestedSubject?: string;
  onClose: () => void;
  onSaved: (result: RecordFollowUpResult) => void;
}) {
  const { t } = useTranslation();
  const [contactId, setContactId] = useState('');
  const [activityType, setActivityType] = useState<'email' | 'call' | 'meeting' | 'note'>('email');
  const [direction, setDirection] = useState<'inbound' | 'outbound' | 'internal'>('outbound');
  const [outcome, setOutcome] = useState<ActivityOutcome | ''>('no_response');
  const [developmentStage, setDevelopmentStage] = useState<DevelopmentStage>('uncontacted');
  const [subject, setSubject] = useState('');
  const [notes, setNotes] = useState('');
  const [completeCurrentTask, setCompleteCurrentTask] = useState(false);
  const [scheduleNext, setScheduleNext] = useState(true);
  const [nextSubject, setNextSubject] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [assigneeId, setAssigneeId] = useState('');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !company) return;
    setContactId(currentTask?.contact_id || contacts[0]?.id || '');
    setActivityType('email');
    setDirection('outbound');
    setOutcome('no_response');
    setDevelopmentStage(company.development_stage);
    setSubject(currentTask?.subject || suggestedSubject || '');
    setNotes('');
    setCompleteCurrentTask(!!currentTask);
    setScheduleNext(true);
    setNextSubject(
      currentTask
        ? t('page.activityTimeline.followUpSubject', { subject: currentTask.subject })
        : '',
    );
    setDueDate(dateAfterDays(7));
    setDueTime('');
    setPriority('medium');
    setAssigneeId('');
  }, [company, contacts, currentTask, open, t]);

  useEffect(() => {
    if (!open) return;
    team.list().then(setMembers).catch(() => setMembers([]));
  }, [open]);

  const changeActivityType = (value: 'email' | 'call' | 'meeting' | 'note') => {
    setActivityType(value);
    if (value === 'note') setDirection('internal');
    else if (direction === 'internal') setDirection('outbound');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    if (!company) return;
    setSaving(true);
    try {
      const result = await followUps.record({
        company_id: company.id,
        contact_id: contactId || undefined,
        activity_type: activityType,
        subject: subject.trim(),
        description: notes.trim() || undefined,
        direction,
        outcome: outcome || undefined,
        development_stage: developmentStage,
        current_task_id: completeCurrentTask ? currentTask?.id : undefined,
        next_task: scheduleNext
          ? {
              subject: nextSubject.trim(),
              due_date: dueDate,
              due_time: dueTime || undefined,
              priority,
              contact_id: contactId || undefined,
              assigned_to_user_id: assigneeId || undefined,
            }
          : undefined,
      });
      toast.success(t('page.customerDevelopment.recorded'));
      onSaved(result);
      onClose();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t('page.customerDevelopment.saveFailed'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SidePanel
      open={open && !!company}
      onClose={() => { if (!saving) onClose(); }}
      title={t('page.customerDevelopment.logFollowUp')}
      subtitle={company?.name}
      width="w-[min(480px,calc(100vw-1rem))]"
    >
      <form onSubmit={submit} className="space-y-5">
        <fieldset className="space-y-3">
          <legend className="section-label mb-3">
            {t('page.customerDevelopment.recordInteraction')}
          </legend>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="follow-up-contact">
                {t('page.customerDevelopment.contact')}
              </label>
              <select
                id="follow-up-contact"
                className="input"
                value={contactId}
                onChange={(event) => setContactId(event.target.value)}
              >
                <option value="">{t('select.contact')}</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name || [contact.first_name, contact.last_name].filter(Boolean).join(' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="follow-up-activity-type">
                {t('page.customerDevelopment.activityType')}
              </label>
              <select
                id="follow-up-activity-type"
                className="input"
                value={activityType}
                onChange={(event) => changeActivityType(
                  event.target.value as 'email' | 'call' | 'meeting' | 'note',
                )}
              >
                {(['email', 'call', 'meeting', 'note'] as const).map((type) => (
                  <option key={type} value={type}>
                    {t(`page.customerDevelopment.${type}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="follow-up-direction">
                {t('page.customerDevelopment.direction')}
              </label>
              <select
                id="follow-up-direction"
                className="input"
                value={direction}
                onChange={(event) => setDirection(
                  event.target.value as 'inbound' | 'outbound' | 'internal',
                )}
              >
                {(['outbound', 'inbound', 'internal'] as const).map((value) => (
                  <option key={value} value={value}>
                    {t(`page.customerDevelopment.${value}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="follow-up-outcome">
                {t('page.customerDevelopment.outcome')}
              </label>
              <select
                id="follow-up-outcome"
                className="input"
                value={outcome}
                onChange={(event) => setOutcome(event.target.value as ActivityOutcome | '')}
              >
                <option value="">{t('common.na')}</option>
                {ACTIVITY_OUTCOMES.map((value) => (
                  <option key={value} value={value}>
                    {t(`page.customerDevelopment.outcomes.${value}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="follow-up-stage">
              {t('page.customerDevelopment.developmentStage')}
            </label>
            <select
              id="follow-up-stage"
              className="input"
              value={developmentStage}
              onChange={(event) => setDevelopmentStage(event.target.value as DevelopmentStage)}
            >
              {DEVELOPMENT_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {t(`page.customerDevelopment.stages.${stage}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="follow-up-subject">
              {t('page.customerDevelopment.subject')}
            </label>
            <input
              id="follow-up-subject"
              className="input"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="label" htmlFor="follow-up-notes">
              {t('page.customerDevelopment.notes')}
            </label>
            <textarea
              id="follow-up-notes"
              className="input min-h-[88px] resize-y"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </fieldset>

        {currentTask && (
          <label
            className="flex items-start gap-2 border-t border-gray-100 pt-4 text-sm text-gray-700"
            htmlFor="follow-up-complete-current"
          >
            <input
              id="follow-up-complete-current"
              type="checkbox"
              checked={completeCurrentTask}
              onChange={(event) => setCompleteCurrentTask(event.target.checked)}
              className="mt-0.5 size-4 rounded border-gray-300 text-blue-600"
            />
            <span>
              {t('page.customerDevelopment.completeCurrentTask')}
              <span className="mt-0.5 block text-xs text-gray-500">{currentTask.subject}</span>
            </span>
          </label>
        )}

        <fieldset className="space-y-3 border-t border-gray-100 pt-4">
          <legend className="sr-only">{t('page.customerDevelopment.nextFollowUp')}</legend>
          <label
            className="flex items-center gap-2 text-sm font-medium text-gray-800"
            htmlFor="follow-up-schedule-next"
          >
            <input
              id="follow-up-schedule-next"
              type="checkbox"
              checked={scheduleNext}
              onChange={(event) => setScheduleNext(event.target.checked)}
              className="size-4 rounded border-gray-300 text-blue-600"
            />
            {t('page.customerDevelopment.nextFollowUp')}
          </label>

          {scheduleNext && (
            <div className="space-y-3">
              <div>
                <label className="label" htmlFor="follow-up-next-subject">
                  {t('page.customerDevelopment.nextTaskSubject')}
                </label>
                <input
                  id="follow-up-next-subject"
                  className="input"
                  value={nextSubject}
                  onChange={(event) => setNextSubject(event.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="follow-up-due-date">
                    {t('page.customerDevelopment.dueDate')}
                  </label>
                  <input
                    id="follow-up-due-date"
                    type="date"
                    className="input"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label" htmlFor="follow-up-due-time">
                    {t('page.customerDevelopment.dueTime')}
                  </label>
                  <input
                    id="follow-up-due-time"
                    type="time"
                    className="input"
                    value={dueTime}
                    onChange={(event) => setDueTime(event.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="follow-up-priority">
                    {t('page.customerDevelopment.priority')}
                  </label>
                  <select
                    id="follow-up-priority"
                    className="input"
                    value={priority}
                    onChange={(event) => setPriority(
                      event.target.value as 'low' | 'medium' | 'high' | 'urgent',
                    )}
                  >
                    {(['low', 'medium', 'high', 'urgent'] as const).map((value) => (
                      <option key={value} value={value}>{t(`status.${value}`)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="follow-up-assignee">
                    {t('page.customerDevelopment.assignee')}
                  </label>
                  <select
                    id="follow-up-assignee"
                    className="input"
                    value={assigneeId}
                    onChange={(event) => setAssigneeId(event.target.value)}
                  >
                    <option value="">{t('accountability.defaultToMe')}</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>{member.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </fieldset>

        <div className="sticky bottom-0 z-10 -mx-5 flex gap-2 border-t border-gray-200 bg-white px-5 py-4">
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving
              ? t('page.customerDevelopment.saving')
              : t('page.customerDevelopment.save')}
          </button>
          <button type="button" onClick={onClose} disabled={saving} className="btn-secondary">
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </SidePanel>
  );
}
