'use client';

import { useEffect, useMemo, useState } from 'react';
import { chatRequest } from '@/lib/chatApi';
import styles from './page.module.css';
import { API_BASE_URL } from '@/lib/api';
const COMMUNICATION_URL = `${API_BASE_URL}/api/v1/utilities/communication`;
const ACCESS_CONTROL_URL = `${API_BASE_URL}/api/v1/access-control/login-access-control/`;

type RoleRow = { id: number; name: string };
type ClassRow = { id: number; name: string };
type SectionRow = { id: number; name: string; class_id?: number | null };
type UserRow = { user_id: number; username: string; name: string; email?: string };

type NoticeRow = {
  id: number;
  notice_title: string;
  notice_message: string;
  notice_date: string;
  publish_on: string;
  inform_to: number[];
  inform_to_labels?: string[];
  is_published: boolean;
  created_by?: { id: number; first_name: string; last_name: string } | null;
};

type EmailLogRow = {
  id: number;
  title: string;
  description: string;
  send_through: string;
  send_to: 'G' | 'I' | 'C';
  send_date: string;
  target_data?: Record<string, any>;
};

type HolidayRow = {
  id: number;
  holiday_title: string;
  holiday_date: string;
  end_date?: string | null;
  description?: string;
  is_active: boolean;
};

type NoticeFormState = {
  id?: number;
  notice_title: string;
  notice_message: string;
  notice_date: string;
  publish_on: string;
  inform_to: number[];
  is_published: boolean;
};

type EmailFormState = {
  title: string;
  description: string;
  send_through: 'E';
  select_tab: 'G' | 'I' | 'C';
  role_ids: number[];
  role_id: string;
  message_to_individual: number[];
  class_id: string;
  message_to_section: number[];
  message_to_student_parent: Array<'2' | '3'>;
};

type HolidayFormState = {
  id?: number;
  holiday_title: string;
  holiday_date: string;
  end_date: string;
  description: string;
  is_active: boolean;
};

const emptyNoticeForm = (): NoticeFormState => ({
  notice_title: '',
  notice_message: '',
  notice_date: '',
  publish_on: '',
  inform_to: [],
  is_published: true,
});

const emptyEmailForm = (): EmailFormState => ({
  title: '',
  description: '',
  send_through: 'E',
  select_tab: 'G',
  role_ids: [],
  role_id: '',
  message_to_individual: [],
  class_id: '',
  message_to_section: [],
  message_to_student_parent: ['2', '3'],
});

const emptyHolidayForm = (): HolidayFormState => ({
  holiday_title: '',
  holiday_date: '',
  end_date: '',
  description: '',
  is_active: true,
});

const fullName = (row: UserRow) => row.name || row.username;

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseIsoDate = (value: string) => new Date(`${value}T00:00:00`);

const monthTitle = (monthDate: Date) =>
  monthDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOLIDAYS_PER_PAGE = 6;
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const cleanedHolidayDescription = (value?: string) => {
  const normalized = (value || '').trim();
  if (!normalized) {
    return '';
  }
  if (normalized.toLowerCase() === 'national holiday (private schools).') {
    return '';
  }
  return normalized;
};

export default function CommunicationPage() {
  const [activeTab, setActiveTab] = useState<'notices' | 'send' | 'logs' | 'holidays'>('notices');
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [targetUsers, setTargetUsers] = useState<UserRow[]>([]);

  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLogRow[]>([]);
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);

  const [noticeForm, setNoticeForm] = useState<NoticeFormState>(emptyNoticeForm());
  const [emailForm, setEmailForm] = useState<EmailFormState>(emptyEmailForm());
  const [holidayForm, setHolidayForm] = useState<HolidayFormState>(emptyHolidayForm());
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [holidaySearch, setHolidaySearch] = useState('');
  const [holidayStatusFilter, setHolidayStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [holidayMonthFilter, setHolidayMonthFilter] = useState('all');
  const [holidayPage, setHolidayPage] = useState(1);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(calendarMonth.getMonth());
  const [pickerYear, setPickerYear] = useState(calendarMonth.getFullYear());

  const currentRole = useMemo(() => roles.find((item) => String(item.id) === emailForm.role_id) || null, [roles, emailForm.role_id]);
  const selectedClass = useMemo(() => classes.find((item) => String(item.id) === emailForm.class_id) || null, [classes, emailForm.class_id]);

  const holidayMap = useMemo(() => {
    const map: Record<string, HolidayRow[]> = {};

    holidays
      .filter((holiday) => holiday.is_active)
      .forEach((holiday) => {
        const start = parseIsoDate(holiday.holiday_date);
        const end = holiday.end_date ? parseIsoDate(holiday.end_date) : start;
        const current = new Date(start);

        while (current <= end) {
          const key = formatDateKey(current);
          if (!map[key]) {
            map[key] = [];
          }
          map[key].push(holiday);
          current.setDate(current.getDate() + 1);
        }
      });

    return map;
  }, [holidays]);

  const calendarCells = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const cells: Array<Date | null> = [];
    for (let pad = 0; pad < firstDay.getDay(); pad += 1) {
      cells.push(null);
    }
    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      cells.push(new Date(year, month, day));
    }
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    return cells;
  }, [calendarMonth]);

  const holidayMonthOptions = useMemo(
    () => Array.from(new Set(holidays.map((holiday) => holiday.holiday_date.slice(0, 7)))).sort((a, b) => b.localeCompare(a)),
    [holidays],
  );

  const filteredHolidays = useMemo(() => {
    const query = holidaySearch.trim().toLowerCase();

    return holidays
      .filter((holiday) => {
        if (holidayStatusFilter === 'active' && !holiday.is_active) {
          return false;
        }
        if (holidayStatusFilter === 'inactive' && holiday.is_active) {
          return false;
        }
        if (holidayMonthFilter !== 'all' && holiday.holiday_date.slice(0, 7) !== holidayMonthFilter) {
          return false;
        }
        if (!query) {
          return true;
        }
        return [holiday.holiday_title, holiday.description || ''].some((value) => value.toLowerCase().includes(query));
      })
      .sort((a, b) => b.holiday_date.localeCompare(a.holiday_date) || b.id - a.id);
  }, [holidays, holidaySearch, holidayStatusFilter, holidayMonthFilter]);

  const totalHolidayPages = Math.max(1, Math.ceil(filteredHolidays.length / HOLIDAYS_PER_PAGE));

  const paginatedHolidays = useMemo(() => {
    const start = (holidayPage - 1) * HOLIDAYS_PER_PAGE;
    return filteredHolidays.slice(start, start + HOLIDAYS_PER_PAGE);
  }, [filteredHolidays, holidayPage]);

  const selectedDateHolidays = useMemo(() => {
    if (!selectedDateKey) {
      return [];
    }
    return holidayMap[selectedDateKey] || [];
  }, [holidayMap, selectedDateKey]);

  const selectedDateLabel = useMemo(() => {
    if (!selectedDateKey) {
      return '';
    }
    return parseIsoDate(selectedDateKey).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }, [selectedDateKey]);

  const monthYearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let year = currentYear - 8; year <= currentYear + 8; year += 1) {
      years.push(year);
    }
    return years;
  }, []);

  const loadLookups = async () => {
    const data: any = await chatRequest({ method: 'get', url: ACCESS_CONTROL_URL });
    setRoles(data?.roles || []);
    setClasses(data?.classes || []);
    setSections(data?.sections || []);
  };

  const loadNotices = async () => {
    const data: any = await chatRequest({ method: 'get', url: `${COMMUNICATION_URL}/notice-boards/` });
    setNotices(data?.results || data || []);
  };

  const loadEmailLogs = async () => {
    const data: any = await chatRequest({ method: 'get', url: `${COMMUNICATION_URL}/email-logs/` });
    setEmailLogs(data?.results || data || []);
  };

  const loadHolidays = async () => {
    const data: any = await chatRequest({ method: 'get', url: `${COMMUNICATION_URL}/holiday-calendars/` });
    setHolidays(data?.results || data || []);
  };

  const loadInitialData = async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadLookups(), loadNotices(), loadEmailLogs(), loadHolidays()]);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load communication data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    setHolidayPage(1);
  }, [holidaySearch, holidayStatusFilter, holidayMonthFilter]);

  useEffect(() => {
    if (holidayPage > totalHolidayPages) {
      setHolidayPage(totalHolidayPages);
    }
  }, [holidayPage, totalHolidayPages]);

  useEffect(() => {
    setPickerMonth(calendarMonth.getMonth());
    setPickerYear(calendarMonth.getFullYear());
  }, [calendarMonth]);

  useEffect(() => {
    if (!emailForm.role_id) {
      setTargetUsers([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const params: Record<string, string> = { role: emailForm.role_id };
        if (emailForm.class_id) {
          params.class_id = emailForm.class_id;
        }
        if (emailForm.message_to_section.length > 0) {
          params.section_id = String(emailForm.message_to_section[0]);
        }

        const data: any = await chatRequest({ method: 'get', url: `${ACCESS_CONTROL_URL}users/`, params });
        setTargetUsers(data?.users || []);
      } catch {
        setTargetUsers([]);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [emailForm.role_id, emailForm.class_id, emailForm.message_to_section]);

  const toggleNoticeRole = (roleId: number) => {
    setNoticeForm((current) => {
      const exists = current.inform_to.includes(roleId);
      return {
        ...current,
        inform_to: exists ? current.inform_to.filter((item) => item !== roleId) : [...current.inform_to, roleId],
      };
    });
  };

  const toggleEmailRole = (roleId: number) => {
    setEmailForm((current) => {
      const exists = current.role_ids.includes(roleId);
      return {
        ...current,
        role_ids: exists ? current.role_ids.filter((item) => item !== roleId) : [...current.role_ids, roleId],
      };
    });
  };

  const toggleTargetUser = (userId: number) => {
    setEmailForm((current) => {
      const exists = current.message_to_individual.includes(userId);
      return {
        ...current,
        message_to_individual: exists ? current.message_to_individual.filter((item) => item !== userId) : [...current.message_to_individual, userId],
      };
    });
  };

  const toggleSection = (sectionId: number) => {
    setEmailForm((current) => {
      const exists = current.message_to_section.includes(sectionId);
      return {
        ...current,
        message_to_section: exists ? current.message_to_section.filter((item) => item !== sectionId) : [...current.message_to_section, sectionId],
      };
    });
  };

  const toggleStudentParent = (value: '2' | '3') => {
    setEmailForm((current) => {
      const exists = current.message_to_student_parent.includes(value);
      return {
        ...current,
        message_to_student_parent: exists
          ? current.message_to_student_parent.filter((item) => item !== value)
          : [...current.message_to_student_parent, value],
      };
    });
  };

  const clearStatus = () => {
    setError('');
    setSuccess('');
  };

  const saveNotice = async () => {
    clearStatus();
    setLoading(true);
    try {
      const payload = {
        notice_title: noticeForm.notice_title,
        notice_message: noticeForm.notice_message,
        notice_date: noticeForm.notice_date,
        publish_on: noticeForm.publish_on,
        inform_to: noticeForm.inform_to,
        is_published: noticeForm.is_published,
      };

      if (noticeForm.id) {
        await chatRequest({ method: 'patch', url: `${COMMUNICATION_URL}/notice-boards/${noticeForm.id}/`, data: payload });
        setSuccess('Notice updated.');
      } else {
        await chatRequest({ method: 'post', url: `${COMMUNICATION_URL}/notice-boards/`, data: payload });
        setSuccess('Notice created.');
      }

      setNoticeForm(emptyNoticeForm());
      await loadNotices();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to save notice.');
    } finally {
      setLoading(false);
    }
  };

  const editNotice = (row: NoticeRow) => {
    setActiveTab('notices');
    setNoticeForm({
      id: row.id,
      notice_title: row.notice_title,
      notice_message: row.notice_message,
      notice_date: row.notice_date,
      publish_on: row.publish_on,
      inform_to: row.inform_to || [],
      is_published: row.is_published,
    });
  };

  const deleteNotice = async (noticeId: number) => {
    clearStatus();
    setLoading(true);
    try {
      await chatRequest({ method: 'delete', url: `${COMMUNICATION_URL}/notice-boards/${noticeId}/` });
      setSuccess('Notice deleted.');
      if (noticeForm.id === noticeId) {
        setNoticeForm(emptyNoticeForm());
      }
      await loadNotices();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to delete notice.');
    } finally {
      setLoading(false);
    }
  };

  const sendEmail = async () => {
    clearStatus();
    setLoading(true);
    try {
      await chatRequest({
        method: 'post',
        url: `${COMMUNICATION_URL}/email-logs/`,
        data: {
          title: emailForm.title,
          description: emailForm.description,
          send_through: emailForm.send_through,
          select_tab: emailForm.select_tab,
          role_ids: emailForm.role_ids,
          role_id: emailForm.role_id || null,
          message_to_individual: emailForm.message_to_individual,
          class_id: emailForm.class_id || null,
          message_to_section: emailForm.message_to_section,
          message_to_student_parent: emailForm.message_to_student_parent,
        },
      });
      setSuccess('Email record saved.');
      setEmailForm(emptyEmailForm());
      await loadEmailLogs();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to save email record.');
    } finally {
      setLoading(false);
    }
  };

  const saveHoliday = async () => {
    clearStatus();
    setLoading(true);
    try {
      const payload = {
        holiday_title: holidayForm.holiday_title,
        holiday_date: holidayForm.holiday_date,
        end_date: holidayForm.end_date || null,
        description: holidayForm.description,
        is_active: holidayForm.is_active,
      };

      if (holidayForm.id) {
        await chatRequest({ method: 'patch', url: `${COMMUNICATION_URL}/holiday-calendars/${holidayForm.id}/`, data: payload });
        setSuccess('Holiday updated.');
      } else {
        await chatRequest({ method: 'post', url: `${COMMUNICATION_URL}/holiday-calendars/`, data: payload });
        setSuccess('Holiday created.');
      }

      setHolidayForm(emptyHolidayForm());
      await loadHolidays();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to save holiday.');
    } finally {
      setLoading(false);
    }
  };

  const editHoliday = (row: HolidayRow) => {
    setActiveTab('holidays');
    setHolidayForm({
      id: row.id,
      holiday_title: row.holiday_title,
      holiday_date: row.holiday_date,
      end_date: row.end_date || '',
      description: row.description || '',
      is_active: row.is_active,
    });
  };

  const deleteHoliday = async (holidayId: number) => {
    clearStatus();
    setLoading(true);
    try {
      await chatRequest({ method: 'delete', url: `${COMMUNICATION_URL}/holiday-calendars/${holidayId}/` });
      setSuccess('Holiday deleted.');
      if (holidayForm.id === holidayId) {
        setHolidayForm(emptyHolidayForm());
      }
      await loadHolidays();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to delete holiday.');
    } finally {
      setLoading(false);
    }
  };

  const goToPreviousMonth = () => {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
  };

  const applyMonthYearSelection = () => {
    setCalendarMonth(new Date(pickerYear, pickerMonth, 1));
    setIsMonthPickerOpen(false);
  };

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div>
          <div className={styles.kicker}>Utilities</div>
          <h1 className={styles.title}>Communication</h1>
          <p className={styles.subtitle}>Notice board publishing, email targeting, and communication logs aligned to the PHP module.</p>
        </div>
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${activeTab === 'notices' ? styles.active : ''}`} onClick={() => setActiveTab('notices')}>Notice Board</button>
        <button className={`${styles.tab} ${activeTab === 'send' ? styles.active : ''}`} onClick={() => setActiveTab('send')}>Send Email</button>
        <button className={`${styles.tab} ${activeTab === 'logs' ? styles.active : ''}`} onClick={() => setActiveTab('logs')}>Email Logs</button>
        <button className={`${styles.tab} ${activeTab === 'holidays' ? styles.active : ''}`} onClick={() => setActiveTab('holidays')}>Calendar Holiday</button>
      </div>

      {error ? <div className={styles.alertError}>{error}</div> : null}
      {success ? <div className={styles.alertSuccess}>{success}</div> : null}
      {loading ? <div className={styles.loading}>Working...</div> : null}

      {activeTab === 'notices' && (
        <section className={styles.layout}>
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div>
                <div className={styles.cardTitle}>{noticeForm.id ? 'Edit Notice' : 'Add Notice'}</div>
                <p className={styles.cardMeta}>Matches the PHP notice board form and role targeting.</p>
              </div>
              {noticeForm.id ? (
                <button className={styles.secondaryButton} onClick={() => setNoticeForm(emptyNoticeForm())}>Cancel Edit</button>
              ) : null}
            </div>

            <div className={styles.grid2}>
              <label className={styles.field}>
                <span>Notice Title</span>
                <input value={noticeForm.notice_title} onChange={(event) => setNoticeForm((current) => ({ ...current, notice_title: event.target.value }))} />
              </label>
              <label className={styles.field}>
                <span>Notice Date</span>
                <input type="date" value={noticeForm.notice_date} onChange={(event) => setNoticeForm((current) => ({ ...current, notice_date: event.target.value }))} />
              </label>
              <label className={styles.field}>
                <span>Publish On</span>
                <input type="date" value={noticeForm.publish_on} onChange={(event) => setNoticeForm((current) => ({ ...current, publish_on: event.target.value }))} />
              </label>
              <label className={styles.fieldInline}>
                <span>Published</span>
                <input type="checkbox" checked={noticeForm.is_published} onChange={(event) => setNoticeForm((current) => ({ ...current, is_published: event.target.checked }))} />
              </label>
            </div>

            <label className={styles.field}>
              <span>Notice Message</span>
              <textarea rows={7} value={noticeForm.notice_message} onChange={(event) => setNoticeForm((current) => ({ ...current, notice_message: event.target.value }))} />
            </label>

            <div className={styles.segmentBox}>
              <div className={styles.sectionLabel}>Message To Roles</div>
              <div className={styles.chipGrid}>
                {roles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    className={`${styles.chip} ${noticeForm.inform_to.includes(role.id) ? styles.chipActive : ''}`}
                    onClick={() => toggleNoticeRole(role.id)}
                  >
                    {role.name}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.actions}>
              <button className={styles.primaryButton} onClick={saveNotice} disabled={loading}>
                {noticeForm.id ? 'Update Notice' : 'Save Notice'}
              </button>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div>
                <div className={styles.cardTitle}>All Notices</div>
                <p className={styles.cardMeta}>Equivalent to the PHP notice list screen.</p>
              </div>
            </div>

            <div className={styles.noticeList}>
              {notices.map((notice) => (
                <article key={notice.id} className={styles.noticeItem}>
                  <div className={styles.noticeTop}>
                    <div>
                      <h3>{notice.notice_title}</h3>
                      <div className={styles.metaLine}>
                        <span>{notice.is_published ? 'Published' : 'Draft'}</span>
                        <span>{notice.publish_on}</span>
                        <span>{notice.notice_date}</span>
                      </div>
                    </div>
                    <div className={styles.noticeActions}>
                      <button className={styles.smallButton} onClick={() => editNotice(notice)}>Edit</button>
                      <button className={styles.smallDangerButton} onClick={() => deleteNotice(notice.id)}>Delete</button>
                    </div>
                  </div>
                  <p className={styles.noticeBody}>{notice.notice_message}</p>
                  <div className={styles.noticeRoles}>
                    {(notice.inform_to_labels || []).map((label) => (
                      <span key={label} className={styles.rolePill}>{label}</span>
                    ))}
                  </div>
                </article>
              ))}
              {!notices.length ? <div className={styles.emptyState}>No notices yet.</div> : null}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'send' && (
        <section className={styles.layoutSingle}>
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div>
                <div className={styles.cardTitle}>Send Email</div>
                <p className={styles.cardMeta}>Mirrors the PHP send-email screen, without the SMS branch.</p>
              </div>
            </div>

            <div className={styles.grid2}>
              <label className={styles.field}>
                <span>Title</span>
                <input value={emailForm.title} onChange={(event) => setEmailForm((current) => ({ ...current, title: event.target.value }))} />
              </label>
              <label className={styles.fieldInline}>
                <span>Send Through</span>
                <input type="text" value="Email" readOnly />
              </label>
            </div>

            <label className={styles.field}>
              <span>Description</span>
              <textarea rows={6} value={emailForm.description} onChange={(event) => setEmailForm((current) => ({ ...current, description: event.target.value }))} />
            </label>

            <div className={styles.tabsInner}>
              <button className={`${styles.innerTab} ${emailForm.select_tab === 'G' ? styles.innerActive : ''}`} onClick={() => setEmailForm((current) => ({ ...current, select_tab: 'G' }))}>
                Group
              </button>
              <button className={`${styles.innerTab} ${emailForm.select_tab === 'I' ? styles.innerActive : ''}`} onClick={() => setEmailForm((current) => ({ ...current, select_tab: 'I' }))}>
                Individual
              </button>
              <button className={`${styles.innerTab} ${emailForm.select_tab === 'C' ? styles.innerActive : ''}`} onClick={() => setEmailForm((current) => ({ ...current, select_tab: 'C' }))}>
                Class / Section
              </button>
            </div>

            {emailForm.select_tab === 'G' && (
              <div className={styles.segmentBox}>
                <div className={styles.sectionLabel}>Message To Roles</div>
                <div className={styles.chipGrid}>
                  {roles.map((role) => (
                    <button
                      key={role.id}
                      type="button"
                      className={`${styles.chip} ${emailForm.role_ids.includes(role.id) ? styles.chipActive : ''}`}
                      onClick={() => toggleEmailRole(role.id)}
                    >
                      {role.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {emailForm.select_tab === 'I' && (
              <div className={styles.segmentBox}>
                <div className={styles.grid2}>
                  <label className={styles.field}>
                    <span>Role</span>
                    <select value={emailForm.role_id} onChange={(event) => setEmailForm((current) => ({ ...current, role_id: event.target.value, message_to_individual: [] }))}>
                      <option value="">Select role</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span>Search Result Role</span>
                    <input value={currentRole?.name || ''} readOnly placeholder="Choose a role to load people" />
                  </label>
                </div>

                <div className={styles.userList}>
                  {targetUsers.map((user) => {
                    const checked = emailForm.message_to_individual.includes(user.user_id);
                    return (
                      <button
                        key={user.user_id}
                        type="button"
                        className={`${styles.userRow} ${checked ? styles.userRowActive : ''}`}
                        onClick={() => toggleTargetUser(user.user_id)}
                      >
                        <strong>{fullName(user)}</strong>
                        <span>{user.email || 'No email'}</span>
                      </button>
                    );
                  })}
                  {!emailForm.role_id ? <div className={styles.emptyState}>Choose a role to load users.</div> : null}
                  {emailForm.role_id && !targetUsers.length ? <div className={styles.emptyState}>No users found for this role.</div> : null}
                </div>
              </div>
            )}

            {emailForm.select_tab === 'C' && (
              <div className={styles.segmentBox}>
                <div className={styles.grid2}>
                  <label className={styles.field}>
                    <span>Class</span>
                    <select value={emailForm.class_id} onChange={(event) => setEmailForm((current) => ({ ...current, class_id: event.target.value, message_to_section: [] }))}>
                      <option value="">Select class</option>
                      {classes.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span>Selected Class</span>
                    <input value={selectedClass?.name || ''} readOnly placeholder="Choose a class" />
                  </label>
                </div>

                <div className={styles.sectionLabel}>Sections</div>
                <div className={styles.chipGrid}>
                  {sections.filter((section) => !emailForm.class_id || String(section.class_id) === emailForm.class_id).map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      className={`${styles.chip} ${emailForm.message_to_section.includes(section.id) ? styles.chipActive : ''}`}
                      onClick={() => toggleSection(section.id)}
                    >
                      {section.name}
                    </button>
                  ))}
                </div>

                <div className={styles.sectionLabel}>Students / Parents</div>
                <div className={styles.chipGrid}>
                  <button type="button" className={`${styles.chip} ${emailForm.message_to_student_parent.includes('2') ? styles.chipActive : ''}`} onClick={() => toggleStudentParent('2')}>
                    Student
                  </button>
                  <button type="button" className={`${styles.chip} ${emailForm.message_to_student_parent.includes('3') ? styles.chipActive : ''}`} onClick={() => toggleStudentParent('3')}>
                    Parent
                  </button>
                </div>
              </div>
            )}

            <div className={styles.actions}>
              <button className={styles.primaryButton} onClick={sendEmail} disabled={loading}>
                Save Email Log
              </button>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'logs' && (
        <section className={styles.layoutSingle}>
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div>
                <div className={styles.cardTitle}>Email Logs</div>
                <p className={styles.cardMeta}>Matches the PHP email / SMS log screen, with SMS excluded.</p>
              </div>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Description</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Send To</th>
                  </tr>
                </thead>
                <tbody>
                  {emailLogs.map((row) => (
                    <tr key={row.id}>
                      <td>{row.title}</td>
                      <td>{row.description}</td>
                      <td>{row.send_date}</td>
                      <td>{row.send_through === 'E' ? 'Email' : row.send_through}</td>
                      <td>{row.send_to === 'G' ? 'Group' : row.send_to === 'I' ? 'Individual' : 'Class / Section'}</td>
                    </tr>
                  ))}
                  {!emailLogs.length ? (
                    <tr>
                      <td colSpan={5} className={styles.emptyCell}>No email logs yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'holidays' && (
        <section className={styles.layout}>
          {!isMounted ? (
            <div className={styles.card}>
              <div className={styles.loading}>Loading holiday calendar...</div>
            </div>
          ) : null}

          {isMounted ? (
            <>
          <div className={`${styles.card} ${styles.compactCard}`}>
            <div className={styles.cardHead}>
              <div>
                <div className={styles.cardTitle}>{holidayForm.id ? 'Edit Holiday' : 'Add Holiday'}</div>
                <p className={styles.cardMeta}>Manage holiday calendar entries inside communication with the existing module style.</p>
              </div>
              {holidayForm.id ? (
                <button className={styles.secondaryButton} onClick={() => setHolidayForm(emptyHolidayForm())}>Cancel Edit</button>
              ) : null}
            </div>

            <div className={styles.grid2}>
              <label className={styles.field}>
                <span>Holiday Title</span>
                <input value={holidayForm.holiday_title} onChange={(event) => setHolidayForm((current) => ({ ...current, holiday_title: event.target.value }))} />
              </label>
              <label className={styles.fieldInline}>
                <span>Active</span>
                <input type="checkbox" checked={holidayForm.is_active} onChange={(event) => setHolidayForm((current) => ({ ...current, is_active: event.target.checked }))} />
              </label>
              <label className={styles.field}>
                <span>Holiday Date</span>
                <input type="date" value={holidayForm.holiday_date} onChange={(event) => setHolidayForm((current) => ({ ...current, holiday_date: event.target.value }))} />
              </label>
              <label className={styles.field}>
                <span>End Date</span>
                <input type="date" value={holidayForm.end_date} onChange={(event) => setHolidayForm((current) => ({ ...current, end_date: event.target.value }))} />
              </label>
            </div>

            <label className={styles.field}>
              <span>Description</span>
              <textarea rows={4} value={holidayForm.description} onChange={(event) => setHolidayForm((current) => ({ ...current, description: event.target.value }))} />
            </label>

            <div className={styles.actions}>
              <button className={styles.primaryButton} onClick={saveHoliday} disabled={loading}>
                {holidayForm.id ? 'Update Holiday' : 'Save Holiday'}
              </button>
            </div>
          </div>

          <div className={`${styles.card} ${styles.compactCard}`}>
            <div className={styles.cardHead}>
              <div>
                <div className={styles.cardTitle}>Holiday Calendar</div>
                <p className={styles.cardMeta}>Monthly calendar with holiday symbols and holiday list.</p>
              </div>
            </div>

            <div className={styles.calendarShell}>
              <div className={styles.calendarHead}>
                <button type="button" className={styles.secondaryButton} onClick={goToPreviousMonth}>
                  Prev
                </button>
                <button
                  type="button"
                  className={styles.calendarMonthButton}
                  onClick={() => setIsMonthPickerOpen((current) => !current)}
                  aria-label="Select month and year"
                >
                  {monthTitle(calendarMonth)}
                </button>
                <button type="button" className={styles.secondaryButton} onClick={goToNextMonth}>
                  Next
                </button>
              </div>

              {isMonthPickerOpen ? (
                <div className={styles.monthPickerRow}>
                  <select value={pickerMonth} onChange={(event) => setPickerMonth(Number(event.target.value))}>
                    {monthNames.map((month, index) => (
                      <option key={month} value={index}>{month}</option>
                    ))}
                  </select>
                  <select value={pickerYear} onChange={(event) => setPickerYear(Number(event.target.value))}>
                    {monthYearOptions.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  <button type="button" className={styles.smallButton} onClick={applyMonthYearSelection}>Go</button>
                </div>
              ) : null}

              <div className={styles.calendarLegend}>
                <span className={styles.holidayBadge}>H</span>
                <span>Holiday</span>
              </div>

              <div className={styles.calendarGrid}>
                {weekdayLabels.map((label, weekdayIndex) => (
                  <div key={label} className={`${styles.weekdayCell} ${weekdayIndex === 0 ? styles.weekdaySunday : ''}`}>{label}</div>
                ))}

                {calendarCells.map((dayDate, index) => {
                  if (!dayDate) {
                    return <div key={`blank-${index}`} className={styles.calendarCellMuted} />;
                  }

                  const dateKey = formatDateKey(dayDate);
                  const dayHolidays = holidayMap[dateKey] || [];
                  const isHoliday = dayHolidays.length > 0;
                  const isSunday = dayDate.getDay() === 0;
                  const isSelected = selectedDateKey === dateKey;

                  return (
                    <div
                      key={dateKey}
                      role="button"
                      tabIndex={0}
                      className={`${styles.calendarCell} ${isHoliday ? styles.calendarHoliday : ''} ${isSunday ? styles.calendarSunday : ''} ${isSelected ? styles.calendarSelected : ''}`}
                      onClick={() => setSelectedDateKey(dateKey)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedDateKey(dateKey);
                        }
                      }}
                    >
                      <div className={styles.calendarDayTop}>
                        <span>{dayDate.getDate()}</span>
                        {isHoliday ? <span className={styles.holidayBadge}>H</span> : null}
                      </div>
                      {isHoliday ? <div className={styles.calendarHolidayTitle}>{dayHolidays[0].holiday_title}</div> : null}
                      {isHoliday && dayHolidays.length > 1 ? <div className={styles.calendarMore}>+{dayHolidays.length - 1} more</div> : null}
                    </div>
                  );
                })}
              </div>

              {selectedDateKey ? (
                <div className={styles.selectedDayPanel}>
                  <div className={styles.selectedDayTitle}>Holidays / Events on {selectedDateLabel}</div>
                  {selectedDateHolidays.length ? (
                    <div className={styles.selectedDayList}>
                      {selectedDateHolidays.map((holiday) => (
                        <article key={`${selectedDateKey}-${holiday.id}`} className={styles.selectedDayItem}>
                          <strong>{holiday.holiday_title}</strong>
                          <div className={styles.selectedDayMeta}>
                            <span>{holiday.holiday_date}</span>
                            {holiday.end_date ? <span>{holiday.end_date}</span> : null}
                            <span>{holiday.is_active ? 'Active' : 'Inactive'}</span>
                          </div>
                          {cleanedHolidayDescription(holiday.description) ? <p>{cleanedHolidayDescription(holiday.description)}</p> : null}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.emptyState}>No holiday or event on this date.</div>
                  )}
                </div>
              ) : (
                <div className={styles.selectedDayHint}>Click any calendar date number to view holidays/events for that day.</div>
              )}
            </div>

            <div className={styles.filterRow}>
              <label className={styles.filterField}>
                <span>Search</span>
                <input
                  value={holidaySearch}
                  onChange={(event) => setHolidaySearch(event.target.value)}
                  placeholder="Holiday title or description"
                />
              </label>
              <label className={styles.filterField}>
                <span>Status</span>
                <select value={holidayStatusFilter} onChange={(event) => setHolidayStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}>
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <label className={styles.filterField}>
                <span>Month</span>
                <select value={holidayMonthFilter} onChange={(event) => setHolidayMonthFilter(event.target.value)}>
                  <option value="all">All Months</option>
                  {holidayMonthOptions.map((monthKey) => (
                    <option key={monthKey} value={monthKey}>{monthKey}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className={styles.noticeList}>
              {paginatedHolidays.map((holiday) => (
                <article key={holiday.id} className={styles.noticeItem}>
                  <div className={styles.noticeTop}>
                    <div>
                      <h3>{holiday.holiday_title}</h3>
                      <div className={styles.metaLine}>
                        <span>{holiday.is_active ? 'Active' : 'Inactive'}</span>
                        <span>{holiday.holiday_date}</span>
                        {holiday.end_date ? <span>{holiday.end_date}</span> : null}
                      </div>
                    </div>
                    <div className={styles.noticeActions}>
                      <button className={styles.smallButton} onClick={() => editHoliday(holiday)}>Edit</button>
                      <button className={styles.smallDangerButton} onClick={() => deleteHoliday(holiday.id)}>Delete</button>
                    </div>
                  </div>
                  {cleanedHolidayDescription(holiday.description) ? <p className={styles.noticeBody}>{cleanedHolidayDescription(holiday.description)}</p> : null}
                </article>
              ))}
              {!filteredHolidays.length ? <div className={styles.emptyState}>No holidays found for selected filters.</div> : null}
            </div>

            {filteredHolidays.length ? (
              <div className={styles.paginationRow}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setHolidayPage((current) => Math.max(1, current - 1))}
                  disabled={holidayPage === 1}
                >
                  Previous
                </button>
                <div className={styles.pageInfo}>Page {holidayPage} of {totalHolidayPages}</div>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setHolidayPage((current) => Math.min(totalHolidayPages, current + 1))}
                  disabled={holidayPage === totalHolidayPages}
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>
            </>
          ) : null}
        </section>
      )}
    </div>
  );
}