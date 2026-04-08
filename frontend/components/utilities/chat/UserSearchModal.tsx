'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import styles from './UserSearchModal.module.css';
import { getAccessToken } from '@/lib/auth';
import { chatRequest } from '@/lib/chatApi';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

interface User {
  id: number;
  first_name: string;
  last_name: string;
  email?: string;
  is_available?: boolean;
  user_type?: 'student' | 'staff';
}

interface UserSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser?: (user: User) => void;
  onCreateGroup?: (group: any) => void;
  mode?: 'single' | 'multiple';
}

const UserSearchModal: React.FC<UserSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectUser,
  onCreateGroup,
  mode = 'single',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [userType, setUserType] = useState<'all' | 'students' | 'staff'>('all');

  useEffect(() => {
    if (isOpen && searchQuery.trim().length === 0) {
      // When modal opens and search is empty, load all available users
      fetchAllUsers();
    } else if (searchQuery.trim().length >= 2) {
      // When user types, search for users
      searchUsers(searchQuery);
    } else {
      // Clear users if search is between 0-1 characters
      setUsers([]);
    }
  }, [searchQuery, isOpen, userType]);

  const fetchAllUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await chatRequest({
        method: 'get',
        url: `${API_BASE_URL}/api/chat/messages/search_users/`,
        params: { user_type: userType, query: searchQuery, q: searchQuery },
      });
      // Handle both response formats: {users: [...]} and [...]
      const userData = response?.users || response || [];
      setUsers(Array.isArray(userData) ? userData : []);
    } catch (err: any) {
      console.error('Failed to load users:', err.response || err);
      const errorMsg = err.response?.data?.detail || err.message || 'Failed to load users';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (query: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await chatRequest({
        method: 'get',
        url: `${API_BASE_URL}/api/chat/messages/search_users/`,
        params: { query, q: query, user_type: userType },
      });
      // Handle both response formats: {users: [...]} and [...]
      const usersData = response?.users || response;
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (err: any) {
      console.error('Failed to search users:', err);
      setError('Failed to search users');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = (user: User) => {
    if (mode === 'single') {
      if (onSelectUser) {
        onSelectUser(user);
        handleClose();
      }
    } else {
      const isSelected = selectedUsers.some((u) => u.id === user.id);
      if (isSelected) {
        setSelectedUsers(selectedUsers.filter((u) => u.id !== user.id));
      } else {
        setSelectedUsers([...selectedUsers, user]);
      }
    }
  };

  const handleCreateGroup = async () => {
    if (selectedUsers.length < 2) {
      setError('Please select at least 2 users to create a group');
      return;
    }
    if (!groupName.trim()) {
      setError('Please enter a group name');
      return;
    }

    try {
      setLoading(true);
      const token = getAccessToken();
      const userIds = selectedUsers.map((u) => u.id);

      const response: any = await chatRequest({
        method: 'post',
        url: `${API_BASE_URL}/api/chat/groups/`,
        data: {
          name: groupName,
          users: userIds,
        },
      });

      if (onCreateGroup) {
        onCreateGroup(response);
      }
      handleClose();
    } catch (err: any) {
      console.error('Failed to create group:', err);
      setError(err.response?.data?.detail || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setUserType('all');
    setUsers([]);
    setSelectedUsers([]);
    setGroupName('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {mode === 'single' ? 'Start New Chat' : 'Create Group'}
          </h2>
          <button className={styles.closeBtn} onClick={handleClose}>
            ✕
          </button>
        </div>

        <div className={styles.content}>
          {/* Search Box */}
          <div className={styles.searchBox}>
            <div className={styles.filterTabs}>
              <button
                type="button"
                className={`${styles.filterTab} ${userType === 'all' ? styles.filterTabActive : ''}`}
                onClick={() => setUserType('all')}
              >
                All
              </button>
              <button
                type="button"
                className={`${styles.filterTab} ${userType === 'students' ? styles.filterTabActive : ''}`}
                onClick={() => setUserType('students')}
              >
                Students
              </button>
              <button
                type="button"
                className={`${styles.filterTab} ${userType === 'staff' ? styles.filterTabActive : ''}`}
                onClick={() => setUserType('staff')}
              >
                Staff
              </button>
            </div>
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
              autoFocus
            />
          </div>

          {/* Group Name Input (for multiple mode) */}
          {mode === 'multiple' && (
            <div className={styles.groupNameBox}>
              <input
                type="text"
                placeholder="Group name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className={styles.groupNameInput}
              />
            </div>
          )}

          {/* Error Message */}
          {error && <div className={styles.errorMessage}>{error}</div>}

          {/* Users List */}
          <div className={styles.usersList}>
            {loading && (
              <div className={styles.loadingState}>
                <div className={styles.spinner}></div>
                <p>Searching...</p>
              </div>
            )}

            {!loading && users.length === 0 && searchQuery && (
              <div className={styles.emptyState}>
                <p>No users found matching &quot;{searchQuery}&quot;</p>
              </div>
            )}

            {!loading && users.length === 0 && !searchQuery && (
              <div className={styles.emptyState}>
                <p>Loading available users...</p>
              </div>
            )}

            {!loading &&
              users.map((user) => {
                const isSelected = selectedUsers.some((u) => u.id === user.id);
                return (
                  <div
                    key={user.id}
                    className={`${styles.userItem} ${isSelected ? styles.selectedUserItem : ''}`}
                    onClick={() => handleSelectUser(user)}
                  >
                    {mode === 'multiple' && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        aria-label={`Select ${user.first_name} ${user.last_name}`}
                        onChange={() => {}}
                        className={styles.checkbox}
                      />
                    )}
                    <div className={styles.userInfo}>
                      <div className={styles.userName}>
                        {user.first_name} {user.last_name}
                      </div>
                      {user.email && <div className={styles.userEmail}>{user.email}</div>}
                    </div>
                    {user.user_type && (
                      <div
                        className={`${styles.typeBadge} ${
                          user.user_type === 'student' ? styles.studentBadge : styles.staffBadge
                        }`}
                      >
                        {user.user_type === 'student' ? 'Student' : 'Staff'}
                      </div>
                    )}
                    {user.is_available && <div className={styles.onlineBadge}>Online</div>}
                  </div>
                );
              })}
          </div>

          {/* Selected Users (for multiple mode) */}
          {mode === 'multiple' && selectedUsers.length > 0 && (
            <div className={styles.selectedUsers}>
              <div className={styles.selectedLabel}>
                Selected ({selectedUsers.length})
              </div>
              <div className={styles.selectedList}>
                {selectedUsers.map((user) => (
                  <div key={user.id} className={styles.selectedTag}>
                    <span>{user.first_name} {user.last_name}</span>
                    <button
                      className={styles.removeBtn}
                      onClick={() =>
                        setSelectedUsers(selectedUsers.filter((u) => u.id !== user.id))
                      }
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={handleClose} disabled={loading}>
            Cancel
          </button>
          {mode === 'single' && (
            <button className={styles.submitBtn} disabled={loading || users.length === 0}>
              Start Chat
            </button>
          )}
          {mode === 'multiple' && (
            <button
              className={styles.submitBtn}
              onClick={handleCreateGroup}
              disabled={
                loading || selectedUsers.length < 2 || !groupName.trim()
              }
            >
              {loading ? 'Creating...' : 'Create Group'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserSearchModal;
