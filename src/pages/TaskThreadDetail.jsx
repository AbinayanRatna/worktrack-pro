import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { db } from '../firebase';
import {
  collection, addDoc, getDocs, getDoc,
  doc, serverTimestamp, query, orderBy, updateDoc, increment,
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Send } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

function fmt(ts) {
  if (!ts) return '—';
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleString('en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#ef4444', '#06b6d4', '#f97316', '#ec4899',
];

function avatarColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function TaskThreadDetail() {
  const { id, threadId } = useParams();
  const navigate = useNavigate();
  const { userProfile } = useAuth();

  const [task, setTask] = useState(null);
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [taskDoc, threadDoc, msgsSnap] = await Promise.all([
        getDoc(doc(db, 'tasks', id)),
        getDoc(doc(db, 'tasks', id, 'threads', threadId)),
        getDocs(query(
          collection(db, 'tasks', id, 'threads', threadId, 'messages'),
          orderBy('createdAt', 'asc')
        )),
      ]);

      if (!taskDoc.exists() || !threadDoc.exists()) {
        toast.error('Thread not found');
        navigate(`/task/${id}/threads`);
        return;
      }

      setTask({ id: taskDoc.id, ...taskDoc.data() });
      setThread({ id: threadDoc.id, ...threadDoc.data() });
      setMessages(msgsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      toast.error('Failed to load messages');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [id, threadId, navigate]);

  useEffect(() => {
    if (userProfile) fetchData();
  }, [fetchData, userProfile]);

  // Scroll to bottom when messages load
  useEffect(() => {
    if (!isLoading) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  async function handleSendMessage(e) {
    e?.preventDefault();
    if (!newMessage.trim()) return;
    try {
      setIsSending(true);
      const msgData = {
        text: newMessage.trim(),
        senderId: userProfile.id,
        senderName: userProfile.name,
        senderRole: userProfile.role,
        createdAt: serverTimestamp(),
      };
      await addDoc(
        collection(db, 'tasks', id, 'threads', threadId, 'messages'),
        msgData
      );
      // Update message count on thread
      await updateDoc(doc(db, 'tasks', id, 'threads', threadId), {
        messageCount: increment(1),
        lastMessageAt: serverTimestamp(),
        lastMessageBy: userProfile.name,
      });
      setNewMessage('');
      fetchData();
    } catch (err) {
      toast.error('Failed to send message');
      console.error(err);
    } finally {
      setIsSending(false);
    }
  }

  // Send on Ctrl+Enter or Cmd+Enter
  function handleKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  }

  if (isLoading) return <Layout><LoadingSpinner /></Layout>;

  return (
    <Layout>
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => navigate(`/task/${id}/threads`)}
          className="btn flex items-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-[var(--text-secondary)]"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[0.8rem] text-[var(--text-secondary)] uppercase tracking-wide mb-0.5 truncate">
            {task?.title} · Discussions
          </p>
          <h1 className="m-0 text-[1.5rem] font-bold leading-tight truncate">{thread?.title}</h1>
          {thread?.description && (
            <p className="mt-1 text-[0.85rem] text-[var(--text-secondary)]">{thread.description}</p>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="glass-panel mb-4 flex flex-col" style={{ minHeight: '420px' }}>

        {/* Messages list */}
        <div className="flex flex-col gap-0 p-5" style={{ flex: 1 }}>
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 text-[2rem]">💬</div>
              <p className="text-[var(--text-secondary)] text-[0.9rem]">
                No messages yet. Be the first to say something!
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMe = msg.senderId === userProfile?.id;
              const prevMsg = messages[idx - 1];
              const isSameSender = prevMsg?.senderId === msg.senderId;
              const showAvatar = !isSameSender;

              return (
                <div
                  key={msg.id}
                  className="flex gap-3"
                  style={{
                    marginTop: isSameSender ? '0.25rem' : '1rem',
                    flexDirection: isMe ? 'row-reverse' : 'row',
                  }}
                >
                  {/* Avatar */}
                  <div style={{ width: 36, flexShrink: 0 }}>
                    {showAvatar && (
                      <div
                        style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: avatarColor(msg.senderName),
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.75rem', fontWeight: '700', color: 'white',
                        }}
                      >
                        {getInitials(msg.senderName)}
                      </div>
                    )}
                  </div>

                  {/* Bubble */}
                  <div style={{ maxWidth: '70%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                    {showAvatar && (
                      <div
                        style={{
                          marginBottom: '0.3rem',
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)',
                          display: 'flex', gap: '0.5rem', alignItems: 'center',
                          flexDirection: isMe ? 'row-reverse' : 'row',
                        }}
                      >
                        <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{msg.senderName}</span>
                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem' }}>{msg.senderRole}</span>
                      </div>
                    )}
                    <div
                      style={{
                        padding: '0.6rem 0.9rem',
                        borderRadius: isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                        background: isMe
                          ? 'var(--accent-primary)'
                          : 'var(--bg-tertiary)',
                        color: isMe ? 'white' : 'var(--text-primary)',
                        fontSize: '0.9rem',
                        lineHeight: '1.55',
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap',
                        border: isMe ? 'none' : '1px solid var(--border-color)',
                      }}
                    >
                      {msg.text}
                    </div>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                      {fmt(msg.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Message Input */}
      <div
        className="glass-panel p-4"
        style={{ borderTop: '1px solid var(--border-color)' }}
      >
        <form onSubmit={handleSendMessage} className="flex gap-3 items-end">
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write a message… (Ctrl+Enter to send)"
              rows={2}
              style={{
                width: '100%',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                outline: 'none',
                resize: 'none',
                fontFamily: 'inherit',
                lineHeight: '1.5',
              }}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSending || !newMessage.trim()}
            style={{
              padding: '0.75rem 1.25rem',
              opacity: !newMessage.trim() ? 0.5 : 1,
              flexShrink: 0,
            }}
          >
            <Send size={16} />
            <span className="desktop-only">{isSending ? 'Sending…' : 'Send'}</span>
          </button>
        </form>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '0.4rem' }}>
          Press Ctrl+Enter to send
        </p>
      </div>
    </Layout>
  );
}