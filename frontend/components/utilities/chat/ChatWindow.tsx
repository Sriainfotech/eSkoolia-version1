'use client';

import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import styles from './ChatWindow.module.css';
import { getAccessToken } from '@/lib/auth';
import { chatRequest } from '@/lib/chatApi';

interface Message {
  id: number;
  conversation_id: number;
  message: string;
  sender: {
    id: number;
    first_name: string;
    last_name: string;
  };
  created_at: string;
  is_read: boolean;
  message_type?: number;
  original_file_name?: string;
  reply_message?: Message;
  forward_message?: Message;
  file_attach?: string;
}

const DEFAULT_SENDER = { id: 0, first_name: 'Unknown', last_name: '' };

const normalizeNestedMessage = (raw: any): Message | undefined => {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const sender = raw?.sender || raw?.from_user || DEFAULT_SENDER;
  return {
    id: Number(raw?.id || 0),
    conversation_id: Number(raw?.conversation_id || 0),
    message: raw?.message || '',
    sender,
    created_at: raw?.created_at || new Date().toISOString(),
    is_read: raw?.status === 1 || raw?.is_read || false,
    message_type: raw?.message_type,
    original_file_name: raw?.original_file_name,
    file_attach: raw?.file_attach || raw?.file_name,
  };
};

interface Conversation {
  id: number;
  user_id: number;
  user: {
    id: number;
    first_name: string;
    last_name: string;
    email?: string;
  };
  last_message?: string;
  last_message_at?: string;
  is_read?: boolean;
}

interface ChatWindowProps {
  activeUser?: Conversation;
  activeGroup?: any;
  onClose?: () => void;
  onIncomingMessage?: (payload: {
    fromUserId: number;
    sender: { id: number; first_name: string; last_name: string };
    preview: string;
    createdAt: string;
  }) => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ activeUser, activeGroup, onClose, onIncomingMessage }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [blockingAction, setBlockingAction] = useState<'block' | 'unblock' | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baseTitleRef = useRef<string>('Eskoolia');
  const unreadNotificationCountRef = useRef<number>(0);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');

  const emojiOptions = ['😀', '😂', '😍', '👍', '🙏', '🎉', '🔥', '❤️', '🤝', '😎', '😢', '👏'];

  const toFileUrl = (value?: string) => {
    if (!value) {
      return undefined;
    }
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    const path = value.startsWith('/') ? value : `/media/${value}`;
    return `${base}${path}`;
  };

  const normalizeMessage = (raw: any): Message => {
    const sender = raw?.sender || raw?.from_user || DEFAULT_SENDER;
    return {
      id: raw?.id,
      conversation_id: raw?.conversation_id || raw?.id || 0,
      message: raw?.message || '',
      sender,
      created_at: raw?.created_at || new Date().toISOString(),
      is_read: raw?.status === 1 || raw?.is_read || false,
      message_type: raw?.message_type,
      original_file_name: raw?.original_file_name,
      reply_message: normalizeNestedMessage(raw?.reply_message || raw?.reply),
      forward_message: normalizeNestedMessage(raw?.forward_message || raw?.forward),
      file_attach: toFileUrl(raw?.file_attach || raw?.file_name),
    };
  };

  const senderName = (message?: Message | null) => message?.sender?.first_name || 'Unknown';

  const isVoiceMessage = (message: Message) => {
    if (message.message_type === 4) {
      return true;
    }
    const file = (message.file_attach || '').toLowerCase();
    return file.endsWith('.mp3') || file.endsWith('.wav') || file.endsWith('.m4a') || file.endsWith('.webm') || file.endsWith('.ogg') || file.endsWith('.oga') || file.endsWith('.aac') || file.endsWith('.mp4');
  };

  const getTokenUserId = (): number | null => {
    const token = getAccessToken();
    if (!token) {
      return null;
    }

    try {
      const payload = token.split('.')[1];
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const json = JSON.parse(window.atob(normalized));
      const userId = Number(json?.user_id || json?.id);
      return Number.isFinite(userId) ? userId : null;
    } catch {
      return null;
    }
  };

  const updatePageTitle = (count: number) => {
    if (typeof document === 'undefined') {
      return;
    }

    if (count <= 0) {
      document.title = baseTitleRef.current;
      return;
    }

    document.title = `(${count}) New message${count > 1 ? 's' : ''} - ${baseTitleRef.current}`;
  };

  const notifyIncomingMessage = (incoming: Message, isCurrentConversation: boolean) => {
    if (typeof window === 'undefined') {
      return;
    }

    const visible = typeof document !== 'undefined' && document.visibilityState === 'visible';
    if (visible && isCurrentConversation) {
      return;
    }

    unreadNotificationCountRef.current += 1;
    updatePageTitle(unreadNotificationCountRef.current);

    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      return;
    }

    const sender = `${incoming.sender?.first_name || ''} ${incoming.sender?.last_name || ''}`.trim() || 'New message';
    const body = incoming.message?.trim() || 'Sent an attachment';
    const notification = new Notification(sender, {
      body,
      tag: `chat-${incoming.id}`,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  };

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    setCurrentUserId(getTokenUserId());
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      baseTitleRef.current = document.title || 'Eskoolia';
    }

    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => undefined);
    }

    const onVisibilityChange = () => {
      if (typeof document === 'undefined') {
        return;
      }
      if (document.visibilityState === 'visible') {
        unreadNotificationCountRef.current = 0;
        updatePageTitle(0);
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
        updatePageTitle(0);
      }
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch messages when active user changes
  useEffect(() => {
    if (activeUser) {
      fetchMessages(activeUser.user_id);
    } else if (activeGroup) {
      fetchGroupMessages(activeGroup.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUser, activeGroup]);

  useEffect(() => {
    const syncBlockedState = async () => {
      if (!activeUser) {
        setIsBlockedByMe(false);
        return;
      }

      try {
        const data: any = await chatRequest({
          method: 'get',
          url: `${process.env.NEXT_PUBLIC_API_URL}/api/chat/messages/blocked_users/`,
        });
        const blockedUsers = data?.blocked_users || [];
        const blocked = blockedUsers.some((row: any) => row?.blocked_user?.id === activeUser.user_id);
        setIsBlockedByMe(blocked);
      } catch {
        setIsBlockedByMe(false);
      }
    };

    syncBlockedState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUser?.user_id]);

  const fetchMessages = async (userId: number) => {
    try {
      setLoading(true);
      setError(null);
      const data: any = await chatRequest({
        method: 'get',
        url: `${process.env.NEXT_PUBLIC_API_URL}/api/chat/messages/conversation/`,
        params: { user_id: userId },
      });
      const items = data?.messages || data || [];
      setMessages((Array.isArray(items) ? items : []).map(normalizeMessage));
    } catch (err: any) {
      console.error('Failed to fetch messages:', err);
      setError(err.response?.data?.detail || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupMessages = async (groupId: number) => {
    try {
      setLoading(true);
      setError(null);
      const data: any = await chatRequest({
        method: 'get',
        url: `${process.env.NEXT_PUBLIC_API_URL}/api/chat/groups/${groupId}/`,
      });
      const items = data?.messages || [];
      const normalizedGroupMessages = (Array.isArray(items) ? items : []).map((item: any) => {
        const base = item?.conversation || item || {};
        return {
          ...base,
          sender: base?.from_user || base?.sender || item?.user,
          created_at: item?.created_at || base?.created_at,
          is_read: Boolean(item?.read_at) || base?.status === 1 || base?.is_read,
        };
      });
      setMessages(normalizedGroupMessages.map(normalizeMessage));
    } catch (err: any) {
      console.error('Failed to fetch group messages:', err);
      setError(err.response?.data?.detail || 'Failed to load group messages');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeUser && isBlockedByMe) {
      setError('You have blocked this user. Unblock to send messages.');
      return;
    }
    if (!messageInput.trim() && !forwardingMessage && !replyingTo && !selectedFile) return;

    try {
      setSending(true);

      const payload: any = selectedFile ? new FormData() : { message: messageInput };

      if (selectedFile) {
        payload.append('file_attach', selectedFile);
        payload.append('message', messageInput || selectedFile.name);
      }

      if (replyingTo) {
        selectedFile ? payload.append('reply', String(replyingTo.id)) : (payload.reply = replyingTo.id);
      }

      if (forwardingMessage) {
        selectedFile ? payload.append('forward', String(forwardingMessage.id)) : (payload.forward = forwardingMessage.id);
      }

      let url: string;
      let method: 'post' | 'put' = 'post';

      if (activeUser) {
        selectedFile ? payload.append('to_id', String(activeUser.user_id)) : (payload.to_id = activeUser.user_id);
        url = `${process.env.NEXT_PUBLIC_API_URL}/api/chat/messages/`;
      } else if (activeGroup) {
        url = `${process.env.NEXT_PUBLIC_API_URL}/api/chat/groups/${activeGroup.id}/send/`;
      } else {
        return;
      }

      const data: any = await chatRequest({
        method,
        url,
        data: payload,
      });

      const createdMessage = normalizeMessage(data?.message || data);
      setMessages([...messages, createdMessage]);
      setMessageInput('');
      setSelectedFile(null);
      setReplyingTo(null);
      setForwardingMessage(null);
      setShowEmojiPicker(false);
    } catch (err: any) {
      console.error('Failed to send message:', err);
      setError(err.response?.data?.detail || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleBlockToggle = async () => {
    if (!activeUser || blockingAction) {
      return;
    }

    try {
      setError(null);
      setBlockingAction(isBlockedByMe ? 'unblock' : 'block');

      await chatRequest({
        method: 'post',
        url: `${process.env.NEXT_PUBLIC_API_URL}/api/chat/messages/${isBlockedByMe ? 'unblock_user' : 'block_user'}/`,
        data: { user_id: activeUser.user_id },
      });

      setIsBlockedByMe((prev) => !prev);
      if (!isBlockedByMe) {
        setError('User blocked. Unblock to send direct messages.');
      } else {
        setError(null);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || `Failed to ${isBlockedByMe ? 'unblock' : 'block'} user`);
    } finally {
      setBlockingAction(null);
    }
  };

  const getUserName = (userId?: number) => {
    return activeUser
      ? `${activeUser.user.first_name} ${activeUser.user.last_name}`
      : activeGroup?.name || 'Unknown';
  };

  const handleForwardMessage = (message: Message) => {
    setForwardingMessage(message);
    setMessageInput('');
  };

  const handleReplyMessage = (message: Message) => {
    setReplyingTo(message);
  };

  const handlePickAttachment = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setSelectedFile(file);
    if (!messageInput.trim()) {
      setMessageInput(file.name);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const insertEmoji = (emoji: string) => {
    setMessageInput((prev) => `${prev}${emoji}`);
    setShowEmojiPicker(false);
  };

  const stopRecorderTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const startVoiceRecording = async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      setError('Audio recording is not supported in this browser.');
      return;
    }

    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      setRecordingSeconds(0);
      setIsRecording(true);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stopRecorderTimer();
        setIsRecording(false);

        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;

        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const fileExt = blob.type.includes('wav') ? 'wav' : blob.type.includes('mp4') ? 'm4a' : 'webm';
        const voiceFile = new File([blob], `voice-${Date.now()}.${fileExt}`, { type: blob.type || 'audio/webm' });
        setSelectedFile(voiceFile);
        setMessageInput('Voice message');
      };

      recorder.start();
    } catch (err) {
      setIsRecording(false);
      stopRecorderTimer();
      setError('Could not access microphone. Please allow mic permission.');
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopVoiceRecording();
      return;
    }
    startVoiceRecording();
  };

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (date.toDateString() === today.toDateString()) {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    } catch {
      return timestamp;
    }
  };

  useEffect(() => {
    const token = getAccessToken();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    if (!token || !apiUrl) {
      setWsStatus('disconnected');
      return;
    }

    let unmounted = false;

    const connect = () => {
      if (unmounted) {
        return;
      }

      setWsStatus('connecting');
      const wsUrl = `${apiUrl.replace('http://', 'ws://').replace('https://', 'wss://')}/ws/chat/?token=${token}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus('connected');
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type !== 'chat_message' || !payload?.message) {
            return;
          }

          const incoming = normalizeMessage(payload.message);
          const fromId = payload.message?.from_user?.id;
          const toId = payload.message?.to_user?.id;
          const incomingSenderId = Number(incoming?.sender?.id || 0);
          const isOwnIncoming = currentUserId !== null && incomingSenderId === currentUserId;
          const isCurrentConversation = Boolean(activeUser && (fromId === activeUser.user_id || toId === activeUser.user_id));

          if (!isOwnIncoming) {
            notifyIncomingMessage(incoming, isCurrentConversation);
            if (incomingSenderId > 0) {
              onIncomingMessage?.({
                fromUserId: incomingSenderId,
                sender: incoming.sender || DEFAULT_SENDER,
                preview: incoming.message || '',
                createdAt: incoming.created_at || new Date().toISOString(),
              });
            }
          }

          if (isCurrentConversation) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === incoming.id)) {
                return prev;
              }
              return [...prev, incoming];
            });
          }
        } catch (err) {
          console.error('WebSocket parse error:', err);
        }
      };

      ws.onclose = () => {
        if (unmounted) {
          return;
        }
        setWsStatus('disconnected');
        reconnectTimerRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        setWsStatus('disconnected');
      };
    };

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUser?.user_id, currentUserId, onIncomingMessage]);

  useEffect(() => {
    return () => {
      stopRecorderTimer();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  if (!activeUser && !activeGroup) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>💬</div>
          <p>Select a user or group to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <h2 className={styles.headerTitle}>{getUserName()}</h2>
          {activeUser && (
            <p className={styles.headerSubtitle}>{activeUser.user.email}</p>
          )}
          <div className={styles.wsStatusRow}>
            <span
              className={`${styles.wsDot} ${
                wsStatus === 'connected'
                  ? styles.wsConnected
                  : wsStatus === 'connecting'
                    ? styles.wsConnecting
                    : styles.wsDisconnected
              }`}
            />
            <span className={styles.wsLabel}>
              {wsStatus === 'connected'
                ? 'Realtime connected'
                : wsStatus === 'connecting'
                  ? 'Realtime connecting'
                  : 'Realtime disconnected'}
            </span>
          </div>
        </div>
        {activeUser && (
          <button
            className={`${styles.blockBtn} ${isBlockedByMe ? styles.unblockBtn : ''}`}
            onClick={handleBlockToggle}
            disabled={Boolean(blockingAction)}
          >
            {blockingAction
              ? (blockingAction === 'block' ? 'Blocking...' : 'Unblocking...')
              : (isBlockedByMe ? 'Unblock User' : 'Block User')}
          </button>
        )}
        {onClose && (
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div className={styles.messagesContainer}>
        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p>Loading messages...</p>
          </div>
        ) : error ? (
          <div className={styles.errorState}>
            <p>⚠️ {error}</p>
            <button
              onClick={() => {
                if (activeUser) fetchMessages(activeUser.user_id);
                else if (activeGroup) fetchGroupMessages(activeGroup.id);
              }}
              className={styles.retryBtn}
            >
              Retry
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className={styles.noMessages}>
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <div className={styles.messages}>
            {messages.map((msg) => {
              const isOwnMessage = currentUserId !== null && msg.sender.id === currentUserId;
              return (
              <div key={msg.id} className={`${styles.messageGroup} ${isOwnMessage ? styles.ownGroup : styles.otherGroup}`}>
                {/* Replied Message */}
                {msg.reply_message && (
                  <div className={styles.repliedMessage}>
                    <div className={styles.repliedLabel}>
                      ↳ Replied to {senderName(msg.reply_message)}
                    </div>
                    <div className={styles.repliedContent}>{msg.reply_message.message}</div>
                  </div>
                )}

                {/* Forwarded Message */}
                {msg.forward_message && (
                  <div className={styles.forwardedMessage}>
                    <div className={styles.forwardedLabel}>
                      ⤳ Forwarded from {senderName(msg.forward_message)}
                    </div>
                    <div className={styles.forwardedContent}>{msg.forward_message.message}</div>
                  </div>
                )}

                {/* Main Message */}
                <div className={`${styles.messageItem} ${isOwnMessage ? styles.ownMessage : styles.otherMessage}`}>
                  <div className={styles.messageSender}>
                    <strong>{msg.sender.first_name} {msg.sender.last_name}</strong>
                    <span className={styles.messageTime}>{formatTime(msg.created_at)}</span>
                  </div>

                  <div className={styles.messageContent}>
                    <p>{msg.message}</p>
                    {msg.file_attach && (
                      isVoiceMessage(msg) ? (
                        <audio controls preload="metadata" className={styles.voicePlayer}>
                          <source src={msg.file_attach} />
                          Your browser does not support audio playback.
                        </audio>
                      ) : (
                        <a
                          href={msg.file_attach}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.fileAttachment}
                        >
                          📎 Download Attachment
                        </a>
                      )
                    )}
                  </div>

                  <div className={styles.messageActions}>
                    <button
                      className={styles.actionBtn}
                      onClick={() => handleReplyMessage(msg)}
                      title="Reply"
                    >
                      ↩️ Reply
                    </button>
                    <button
                      className={styles.actionBtn}
                      onClick={() => handleForwardMessage(msg)}
                      title="Forward"
                    >
                      ↪️ Forward
                    </button>
                  </div>
                </div>
              </div>
            )})}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Reply/Forward Preview */}
      {(replyingTo || forwardingMessage) && (
        <div className={styles.contextPreview}>
          {replyingTo && (
            <div className={styles.contextItem}>
              <span className={styles.contextLabel}>Replying to: {senderName(replyingTo)}</span>
              <span className={styles.contextMessage}>{replyingTo.message}</span>
              <button
                className={styles.contextClear}
                onClick={() => setReplyingTo(null)}
              >
                ✕
              </button>
            </div>
          )}
          {forwardingMessage && (
            <div className={styles.contextItem}>
              <span className={styles.contextLabel}>Forwarding: {senderName(forwardingMessage)}</span>
              <span className={styles.contextMessage}>{forwardingMessage.message}</span>
              <button
                className={styles.contextClear}
                onClick={() => setForwardingMessage(null)}
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}

      {selectedFile && (
        <div className={styles.filePreview}>
          <span className={styles.filePreviewLabel}>Attachment:</span>
          <span className={styles.filePreviewName}>{selectedFile.name}</span>
          <button type="button" className={styles.contextClear} onClick={clearSelectedFile}>
            ✕
          </button>
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={handleSendMessage} className={styles.inputArea}>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          className={styles.hiddenFileInput}
          accept="image/*,.pdf,.doc,.docx,.txt,.mp3,.wav,.m4a,.webm,.ogg"
          title="Attach file"
          aria-label="Attach file"
        />
        <button
          type="button"
          className={styles.composerBtn}
          onClick={() => setShowEmojiPicker((prev) => !prev)}
          disabled={Boolean(activeUser && isBlockedByMe)}
          title="Add emoji"
        >
          😊
        </button>
        <button
          type="button"
          className={styles.composerBtn}
          onClick={handlePickAttachment}
          disabled={Boolean(activeUser && isBlockedByMe)}
          title="Attach file"
        >
          📎
        </button>
        <button
          type="button"
          className={`${styles.composerBtn} ${isRecording ? styles.recordingBtn : ''}`}
          onClick={toggleRecording}
          disabled={Boolean(activeUser && isBlockedByMe)}
          title={isRecording ? 'Stop recording' : 'Record voice'}
        >
          {isRecording ? '⏹️' : '🎤'}
        </button>
        {isRecording && (
          <span className={styles.recordingBadge}>Recording {recordingSeconds}s</span>
        )}
        {showEmojiPicker && (
          <div className={styles.emojiPicker}>
            {emojiOptions.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={styles.emojiBtn}
                onClick={() => insertEmoji(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        <input
          type="text"
          placeholder={activeUser && isBlockedByMe ? 'Unblock user to send message' : 'Type your message...'}
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          disabled={sending || Boolean(activeUser && isBlockedByMe)}
          className={styles.messageInput}
          autoFocus
        />
        <button
          type="submit"
          disabled={Boolean(activeUser && isBlockedByMe) || sending || (!messageInput.trim() && !replyingTo && !forwardingMessage && !selectedFile)}
          className={styles.sendBtn}
        >
          {sending ? '⏳' : '📤'}
        </button>
      </form>
    </div>
  );
};

export default ChatWindow;
