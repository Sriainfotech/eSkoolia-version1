'use client';

import React, { useEffect, useMemo, useState } from 'react';
import ChatSidebar from '@/components/utilities/chat/ChatSidebar';
import ChatWindow from '@/components/utilities/chat/ChatWindow';
import UserSearchModal from '@/components/utilities/chat/UserSearchModal';
import styles from './page.module.css';
import { chatRequest } from '@/lib/chatApi';
import { getAccessToken } from '@/lib/auth';
import { useSearchParams } from 'next/navigation';
import { API_BASE_URL } from '@/lib/api';

interface User {
  id: number;
  first_name: string;
  last_name: string;
  email?: string;
  username?: string;
}

interface Conversation {
  id: number;
  user_id: number;
  user: User;
  last_message?: string;
  last_message_at?: string;
  is_read?: boolean;
  unread_count?: number;
}

interface Group {
  id: number;
  name: string;
  description?: string;
  user_count?: number;
  member_count?: number;
  members?: Array<{ id?: number }>;
  created_at?: string;
}

type InvitationRow = {
  id: number;
  status: number;
  from_user?: { id: number; first_name: string; last_name: string; email?: string };
  to_user?: { id: number; first_name: string; last_name: string; email?: string };
  created_at?: string;
};

type SearchUser = {
  id: number;
  first_name: string;
  last_name: string;
  email?: string;
  user_type?: 'student' | 'staff' | string;
};

type ClassRow = {
  id: number;
  name?: string;
  class_name?: string;
  title?: string;
};

type BlockedRow = {
  id: number;
  blocked_user?: User;
  created_at?: string;
};

const ChatPage = () => {
  const searchParams = useSearchParams();
  const [moduleTab, setModuleTab] = useState<'chat' | 'invitation' | 'blocked'>('chat');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeUser, setActiveUser] = useState<Conversation | null>(null);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchModalMode, setSearchModalMode] = useState<'single' | 'multiple'>('single');

  const [invRows, setInvRows] = useState<InvitationRow[]>([]);
  const [invSearch, setInvSearch] = useState('');
  const [invSearchRows, setInvSearchRows] = useState<SearchUser[]>([]);
  const [invLoading, setInvLoading] = useState(true);
  const [invMessage, setInvMessage] = useState('');
  const [invError, setInvError] = useState('');
  const [invActingId, setInvActingId] = useState<number | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [invUserType, setInvUserType] = useState<'all' | 'staff' | 'students'>('all');
  const [classId, setClassId] = useState<string>('');
  const [classes, setClasses] = useState<ClassRow[]>([]);

  const [blockedRows, setBlockedRows] = useState<BlockedRow[]>([]);
  const [blockedSearch, setBlockedSearch] = useState('');
  const [blockedSearchRows, setBlockedSearchRows] = useState<User[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(true);
  const [blockedWorkingId, setBlockedWorkingId] = useState<number | null>(null);
  const [blockedMessage, setBlockedMessage] = useState('');
  const [blockedError, setBlockedError] = useState('');

  const pendingInvRows = useMemo(() => invRows.filter((r) => Number(r.status) === 0), [invRows]);

  useEffect(() => {
    const tab = (searchParams.get('tab') || '').toLowerCase();
    if (tab === 'invitation') {
      setModuleTab('invitation');
      return;
    }
    if (tab === 'blocked' || tab === 'blocked-users') {
      setModuleTab('blocked');
      return;
    }
    setModuleTab('chat');
  }, [searchParams]);

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      try {
        const payload = token.split('.')[1];
        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        const json = JSON.parse(window.atob(normalized));
        const id = Number(json?.user_id || json?.id);
        setCurrentUserId(Number.isFinite(id) ? id : null);
      } catch {
        setCurrentUserId(null);
      }
    }

    fetchConnectedUsers();
    fetchGroups();
  }, []);

  useEffect(() => {
    if (moduleTab === 'invitation') {
      loadInvitations();
      loadClasses();
    }
    if (moduleTab === 'blocked') {
      loadBlockedUsers();
    }
  }, [moduleTab]);

  useEffect(() => {
    if (!invSearch.trim()) {
      setInvSearchRows([]);
      return;
    }

    const timer = setTimeout(() => {
      searchInvitationUsers();
    }, 300);

    return () => clearTimeout(timer);
  }, [invSearch, invUserType, classId, invRows, currentUserId]);

  useEffect(() => {
    if (!blockedSearch.trim()) {
      setBlockedSearchRows([]);
      return;
    }

    const timer = setTimeout(() => {
      searchBlockUsers();
    }, 300);

    return () => clearTimeout(timer);
  }, [blockedSearch, blockedRows]);

  const fetchConnectedUsers = async () => {
    try {
      const data: any = await chatRequest({
        method: 'get',
        url: `${API_BASE_URL}/api/chat/messages/connected_users/`,
      });
      const users = data?.users || data || [];
      const mappedConversations = (Array.isArray(users) ? users : []).map((user: User) => ({
        id: user.id,
        user_id: user.id,
        user,
        unread_count: 0,
      }));
      setConversations(mappedConversations);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const data: any = await chatRequest({
        method: 'get',
        url: `${API_BASE_URL}/api/chat/groups/`,
      });
      setGroups(data?.results || data || []);
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    }
  };

  const loadInvitations = async () => {
    setInvLoading(true);
    setInvError('');
    try {
      const data: any = await chatRequest({
        method: 'get',
        url: `${API_BASE_URL}/api/chat/invitations/`,
      });
      setInvRows(data?.results || data || []);
    } catch (e: any) {
      setInvError(e?.response?.data?.detail || 'Failed to load invitations');
    } finally {
      setInvLoading(false);
    }
  };

  const loadClasses = async () => {
    try {
      const data: any = await chatRequest({
        method: 'get',
        url: `${API_BASE_URL}/api/v1/core/classes/`,
      });
      setClasses(data?.results || data || []);
    } catch {
      setClasses([]);
    }
  };

  const searchInvitationUsers = async () => {
    setInvError('');
    try {
      const data: any = await chatRequest({
        method: 'get',
        url: `${API_BASE_URL}/api/chat/messages/search_users/`,
        params: {
          query: invSearch,
          q: invSearch,
          user_type: invUserType,
          ...(invUserType === 'students' && classId ? { class_id: classId } : {}),
        },
      });
      const users = data?.users || [];
      const invitedToIds = new Set(
        invRows
          .filter((r) => currentUserId !== null && r.from_user?.id === currentUserId)
          .map((r) => r.to_user?.id)
          .filter(Boolean)
      );
      setInvSearchRows(users.filter((u: SearchUser) => !invitedToIds.has(u.id)));
    } catch (e: any) {
      setInvError(e?.response?.data?.detail || 'Failed to search users');
    }
  };

  const sendInvitation = async (toUserId: number) => {
    setInvActingId(toUserId);
    setInvError('');
    setInvMessage('');
    try {
      await chatRequest({
        method: 'post',
        url: `${API_BASE_URL}/api/chat/invitations/`,
        data: { to_user_id: toUserId },
      });
      setInvMessage('Invitation sent.');
      await loadInvitations();
      setInvSearchRows((prev) => prev.filter((u) => u.id !== toUserId));
    } catch (e: any) {
      setInvError(e?.response?.data?.detail || 'Failed to send invitation');
    } finally {
      setInvActingId(null);
    }
  };

  const takeInvitationAction = async (id: number, action: 'accept' | 'decline') => {
    setInvActingId(id);
    setInvError('');
    setInvMessage('');
    try {
      await chatRequest({
        method: 'post',
        url: `${API_BASE_URL}/api/chat/invitations/${id}/${action}/`,
        data: {},
      });
      setInvMessage(action === 'accept' ? 'Invitation accepted.' : 'Invitation declined.');
      await loadInvitations();
    } catch (e: any) {
      setInvError(e?.response?.data?.detail || `Failed to ${action} invitation`);
    } finally {
      setInvActingId(null);
    }
  };

  const loadBlockedUsers = async () => {
    setBlockedLoading(true);
    setBlockedError('');
    try {
      const data: any = await chatRequest({
        method: 'get',
        url: `${API_BASE_URL}/api/chat/messages/blocked_users/`,
      });
      setBlockedRows(data?.blocked_users || []);
    } catch (e: any) {
      setBlockedError(e?.response?.data?.detail || 'Failed to load blocked users');
    } finally {
      setBlockedLoading(false);
    }
  };

  const searchBlockUsers = async () => {
    setBlockedError('');
    setBlockedSearchRows([]);
    try {
      const data: any = await chatRequest({
        method: 'get',
        url: `${API_BASE_URL}/api/chat/messages/search_users/?query=${encodeURIComponent(blockedSearch)}&q=${encodeURIComponent(blockedSearch)}`,
      });
      const users = data?.users || [];
      const ids = new Set(blockedRows.map((r) => r.blocked_user?.id));
      setBlockedSearchRows(users.filter((u: User) => !ids.has(u.id)));
    } catch (e: any) {
      setBlockedError(e?.response?.data?.detail || 'Failed to search users');
    }
  };

  const blockUser = async (userId: number) => {
    setBlockedWorkingId(userId);
    setBlockedMessage('');
    setBlockedError('');
    try {
      await chatRequest({
        method: 'post',
        url: `${API_BASE_URL}/api/chat/messages/block_user/`,
        data: { user_id: userId },
      });
      setBlockedMessage('User blocked successfully.');
      await loadBlockedUsers();
      setBlockedSearchRows((prev) => prev.filter((u) => u.id !== userId));
    } catch (e: any) {
      setBlockedError(e?.response?.data?.detail || 'Failed to block user');
    } finally {
      setBlockedWorkingId(null);
    }
  };

  const unblockUser = async (userId: number) => {
    setBlockedWorkingId(userId);
    setBlockedMessage('');
    setBlockedError('');
    try {
      await chatRequest({
        method: 'post',
        url: `${API_BASE_URL}/api/chat/messages/unblock_user/`,
        data: { user_id: userId },
      });
      setBlockedMessage('User unblocked successfully.');
      await loadBlockedUsers();
    } catch (e: any) {
      setBlockedError(e?.response?.data?.detail || 'Failed to unblock user');
    } finally {
      setBlockedWorkingId(null);
    }
  };

  const handleOpenNewChat = () => {
    setSearchModalMode('single');
    setIsSearchModalOpen(true);
  };

  const handleOpenCreateGroup = () => {
    setSearchModalMode('multiple');
    setIsSearchModalOpen(true);
  };

  const handleSelectUser = (user: User) => {
    // Find or create conversation with this user
    const existing = conversations.find((c) => c.user_id === user.id);
    if (existing) {
      setActiveUser({ ...existing, unread_count: 0 });
      setConversations((prev) =>
        prev.map((conv) => (conv.user_id === user.id ? { ...conv, unread_count: 0 } : conv))
      );
    } else {
      // Create new conversation object for display
      const newConversation: Conversation = {
        id: user.id,
        user_id: user.id,
        user: user,
        unread_count: 0,
      };
      setActiveUser(newConversation);
      setConversations([...conversations, newConversation]);
    }
  };

  const handleCreateGroup = (groupPayload: any) => {
    const group: Group = groupPayload?.group || groupPayload;
    const normalizedGroup: Group = {
      ...group,
      member_count:
        group?.member_count ??
        group?.user_count ??
        (Array.isArray(group?.members) ? group.members.length : undefined),
      user_count:
        group?.user_count ??
        group?.member_count ??
        (Array.isArray(group?.members) ? group.members.length : undefined),
    };

    setGroups((prev) => [...prev.filter((g) => g.id !== normalizedGroup.id), normalizedGroup]);
    setActiveGroup(normalizedGroup);
    setActiveUser(null);
    fetchGroups();
  };

  return (
    <div className={styles.container}>
      <div className={styles.moduleTabs}>
        <button
          className={`${styles.moduleTab} ${moduleTab === 'chat' ? styles.moduleTabActive : ''}`}
          onClick={() => setModuleTab('chat')}
        >
          Chat
        </button>
        <button
          className={`${styles.moduleTab} ${moduleTab === 'invitation' ? styles.moduleTabActive : ''}`}
          onClick={() => setModuleTab('invitation')}
        >
          Invitation
        </button>
        <button
          className={`${styles.moduleTab} ${moduleTab === 'blocked' ? styles.moduleTabActive : ''}`}
          onClick={() => setModuleTab('blocked')}
        >
          Blocked Users
        </button>
      </div>

      {moduleTab === 'chat' && (
        <div className={styles.layout}>
          <ChatSidebar
            conversations={conversations}
            groups={groups}
            activeUser={activeUser}
            activeGroup={activeGroup}
            onSelectUser={(conversation) => {
              setConversations((prev) =>
                prev.map((conv) =>
                  conv.user_id === conversation.user_id ? { ...conv, unread_count: 0 } : conv
                )
              );
              setActiveUser({ ...conversation, unread_count: 0 });
              setActiveGroup(null);
            }}
            onSelectGroup={(group) => {
              setActiveGroup(group);
              setActiveUser(null);
            }}
            onOpenNewChat={handleOpenNewChat}
            onOpenCreateGroup={handleOpenCreateGroup}
            onRefresh={() => {
              fetchConnectedUsers();
              fetchGroups();
            }}
          />
          <ChatWindow
            activeUser={activeUser || undefined}
            activeGroup={activeGroup || undefined}
            onIncomingMessage={({ fromUserId, sender, preview, createdAt }) => {
              const isVisibleActiveConversation =
                typeof document !== 'undefined' &&
                document.visibilityState === 'visible' &&
                activeUser?.user_id === fromUserId;

              setConversations((prev) => {
                const idx = prev.findIndex((conv) => conv.user_id === fromUserId);

                if (idx === -1) {
                  const created: Conversation = {
                    id: fromUserId,
                    user_id: fromUserId,
                    user: {
                      id: sender.id,
                      first_name: sender.first_name || 'Unknown',
                      last_name: sender.last_name || '',
                    },
                    last_message: preview,
                    last_message_at: createdAt,
                    unread_count: isVisibleActiveConversation ? 0 : 1,
                  };
                  return [created, ...prev];
                }

                const next = [...prev];
                const row = next[idx];
                const unreadCount = isVisibleActiveConversation ? 0 : (row.unread_count || 0) + 1;
                next[idx] = {
                  ...row,
                  last_message: preview,
                  last_message_at: createdAt,
                  unread_count: unreadCount,
                };

                if (idx > 0) {
                  const moved = next.splice(idx, 1)[0];
                  next.unshift(moved);
                }

                return next;
              });
            }}
          />
        </div>
      )}

      {moduleTab === 'invitation' && (
        <section className={styles.panel}>
          <div className={styles.panelToolbar}>
            <select value={invUserType} onChange={(e) => setInvUserType(e.target.value as 'all' | 'staff' | 'students')} className={styles.input}>
              <option value="all">All Users</option>
              <option value="staff">Staff</option>
              <option value="students">Students</option>
            </select>
            {invUserType === 'students' && (
              <select value={classId} onChange={(e) => setClassId(e.target.value)} className={styles.input}>
                <option value="">All Classes</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={String(cls.id)}>
                    {cls.name || cls.class_name || cls.title || `Class ${cls.id}`}
                  </option>
                ))}
              </select>
            )}
            <input value={invSearch} onChange={(e) => setInvSearch(e.target.value)} placeholder="Search user to invite" className={styles.inputWide} />
            <button className={styles.primaryBtn} onClick={() => searchInvitationUsers()}>Search</button>
          </div>

          {invSearchRows.length > 0 && (
            <div className={styles.card}>
              {invSearchRows.map((user) => (
                <div key={user.id} className={styles.rowBetween}>
                  <span>{`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || `User ${user.id}`}</span>
                  <button disabled={invActingId === user.id} className={styles.secondaryBtn} onClick={() => sendInvitation(user.id)}>Send Invitation</button>
                </div>
              ))}
            </div>
          )}

          {invError ? <div className={styles.errorText}>{invError}</div> : null}
          {invMessage ? <div className={styles.successText}>{invMessage}</div> : null}

          <div className={styles.card}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Type</th><th>From</th><th>To</th><th>Status</th><th>Created</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {invLoading ? (
                  <tr><td colSpan={6}>Loading...</td></tr>
                ) : pendingInvRows.length === 0 ? (
                  <tr><td colSpan={6}>No pending invitations.</td></tr>
                ) : (
                  pendingInvRows.map((row) => {
                    const fromName = `${row.from_user?.first_name || ''} ${row.from_user?.last_name || ''}`.trim() || '-';
                    const toName = `${row.to_user?.first_name || ''} ${row.to_user?.last_name || ''}`.trim() || '-';
                    const isIncoming = currentUserId !== null && row.to_user?.id === currentUserId;
                    return (
                      <tr key={row.id}>
                        <td>{isIncoming ? 'Received' : 'Sent'}</td>
                        <td>{fromName}</td>
                        <td>{toName}</td>
                        <td>Pending</td>
                        <td>{row.created_at || '-'}</td>
                        <td>
                          {isIncoming ? (
                            <div className={styles.inlineActions}>
                              <button disabled={invActingId === row.id} className={styles.acceptBtn} onClick={() => takeInvitationAction(row.id, 'accept')}>Accept</button>
                              <button disabled={invActingId === row.id} className={styles.declineBtn} onClick={() => takeInvitationAction(row.id, 'decline')}>Decline</button>
                            </div>
                          ) : (
                            <span>Waiting response</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {moduleTab === 'blocked' && (
        <section className={styles.panel}>
          <div className={styles.panelToolbar}>
            <input value={blockedSearch} onChange={(e) => setBlockedSearch(e.target.value)} placeholder="Search user to block" className={styles.inputWide} />
            <button className={styles.primaryBtn} onClick={() => searchBlockUsers()}>Search</button>
          </div>

          {blockedSearchRows.length > 0 && (
            <div className={styles.card}>
              {blockedSearchRows.map((user) => (
                <div key={user.id} className={styles.rowBetween}>
                  <span>{`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || `User ${user.id}`}</span>
                  <button disabled={blockedWorkingId === user.id} className={styles.declineBtn} onClick={() => blockUser(user.id)}>Block</button>
                </div>
              ))}
            </div>
          )}

          {blockedError ? <div className={styles.errorText}>{blockedError}</div> : null}
          {blockedMessage ? <div className={styles.successText}>{blockedMessage}</div> : null}

          <div className={styles.card}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Blocked User</th><th>Email</th><th>Blocked At</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {blockedLoading ? (
                  <tr><td colSpan={4}>Loading...</td></tr>
                ) : blockedRows.length === 0 ? (
                  <tr><td colSpan={4}>No blocked users.</td></tr>
                ) : (
                  blockedRows.map((row) => {
                    const user = row.blocked_user;
                    const name = `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || '-';
                    return (
                      <tr key={row.id}>
                        <td>{name}</td>
                        <td>{user?.email || '-'}</td>
                        <td>{row.created_at || '-'}</td>
                        <td>
                          <button
                            disabled={blockedWorkingId === user?.id}
                            className={styles.acceptBtn}
                            onClick={() => user?.id && unblockUser(user.id)}
                          >
                            Unblock
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <UserSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        mode={searchModalMode}
        onSelectUser={handleSelectUser}
        onCreateGroup={handleCreateGroup}
      />
    </div>
  );
};

export default ChatPage;
