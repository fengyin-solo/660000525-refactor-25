import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useInterviewStore } from '../store/interview';
import type { InterviewRoom, User } from '../types';
import {
  resolveJoinCredential,
  submitJoin,
  buildCandidateUser,
  JoinError,
} from '../services/joinRoomFlow';

export const JoinRoomPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setCurrentUser, setCurrentRoom } = useInterviewStore();

  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [roomInfo, setRoomInfo] = useState<InterviewRoom | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [error, setError] = useState('');

  // 预览阶段的在途请求标识，避免输入抖动触发的并发解析互相覆盖
  const previewSeqRef = useRef(0);
  // 提交阶段的在途锁，防止重复点击 / 回车产生多次加入
  const submittingRef = useRef(false);

  useEffect(() => {
    const token = searchParams.get('token');
    const code = searchParams.get('code');

    if (token) {
      setInviteToken(token);
      void resolvePreview({ inviteToken: token });
    } else if (code) {
      setRoomCodeInput(code.toUpperCase());
      void resolvePreview({ roomCode: code });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  /** 凭证预览：两条入口共用 resolveJoinCredential，结论与提示完全一致 */
  const resolvePreview = async (params: { inviteToken?: string; roomCode?: string }) => {
    const seq = ++previewSeqRef.current;
    setInitialLoading(true);
    setError('');
    try {
      const resolved = await resolveJoinCredential(params);
      if (seq !== previewSeqRef.current) return; // 已有更新的请求，丢弃过期结果
      setRoomInfo(resolved.room);
      if (resolved.invitation) {
        setCandidateName(resolved.invitation.candidateName || '');
        setCandidateEmail(resolved.invitation.candidateEmail || '');
      }
    } catch (err) {
      if (seq !== previewSeqRef.current) return;
      setRoomInfo(null);
      setError(err instanceof JoinError ? err.message : '获取房间信息失败');
    } finally {
      if (seq === previewSeqRef.current) setInitialLoading(false);
    }
  };

  const handleRoomCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().slice(0, 6);
    setRoomCodeInput(value);
    setError('');
    if (value.length === 6) {
      void resolvePreview({ roomCode: value });
    } else {
      previewSeqRef.current++; // 使进行中的解析结果作废
      setRoomInfo(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return; // 重复提交直接忽略

    setError('');

    if (!candidateName.trim()) {
      setError('请输入候选人姓名');
      return;
    }
    if (!candidateEmail.trim()) {
      setError('请输入邮箱');
      return;
    }
    if (!roomInfo) {
      setError('请先输入有效的房间码或通过邀请链接进入');
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      const result = await submitJoin({
        roomId: roomInfo.id,
        candidateName: candidateName.trim(),
        inviteToken,
      });

      // 身份与房间信息一律取自服务端响应，两个入口保持一致
      const user: User = buildCandidateUser(result, candidateName.trim(), candidateEmail.trim());

      setCurrentUser(user);
      setCurrentRoom(result.room);
      navigate(`/room/${result.room.id}/candidate`);
    } catch (err) {
      setError(err instanceof JoinError ? err.message : '加入房间失败');
      // 加入被拒绝（如房间刚结束）时刷新房间快照，使按钮状态与结论同步
      if (err instanceof JoinError && err.code === 'ROOM_FINISHED') {
        setRoomInfo(null);
      }
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0d0d0d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ color: '#fff', fontSize: '16px' }}>加载中...</div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d0d0d',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: '#1e1e1e',
        borderRadius: '8px',
        padding: '32px',
        width: '100%',
        maxWidth: '480px',
        border: '1px solid #333',
      }}>
        <h1 style={{
          color: '#fff',
          margin: '0 0 8px 0',
          fontSize: '24px',
          fontWeight: 600,
          textAlign: 'center',
        }}>
          加入面试
        </h1>
        <p style={{
          color: '#888',
          margin: '0 0 24px 0',
          fontSize: '14px',
          textAlign: 'center',
        }}>
          请填写以下信息以加入面试房间
        </p>

        {roomInfo && (
          <div style={{
            background: '#2a2a2a',
            borderRadius: '6px',
            padding: '16px',
            marginBottom: '20px',
            border: '1px solid #444',
          }}>
            <div style={{ color: '#888', fontSize: '12px', marginBottom: '4px' }}>房间信息</div>
            <div style={{ color: '#fff', fontSize: '16px', fontWeight: 500, marginBottom: '4px' }}>
              {roomInfo.title}
            </div>
            <div style={{ color: '#666', fontSize: '13px' }}>
              房间码: {roomInfo.roomCode}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              color: '#ccc',
              marginBottom: '6px',
              fontSize: '14px',
            }}>
              候选人姓名 *
            </label>
            <input
              type="text"
              value={candidateName}
              onChange={e => setCandidateName(e.target.value)}
              placeholder="请输入您的姓名"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '4px',
                border: '1px solid #444',
                background: '#2a2a2a',
                color: '#fff',
                fontSize: '14px',
                boxSizing: 'border-box',
                outline: 'none',
              }}
              onFocus={e => e.target.style.borderColor = '#2196f3'}
              onBlur={e => e.target.style.borderColor = '#444'}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              color: '#ccc',
              marginBottom: '6px',
              fontSize: '14px',
            }}>
              邮箱 *
            </label>
            <input
              type="email"
              value={candidateEmail}
              onChange={e => setCandidateEmail(e.target.value)}
              placeholder="请输入您的邮箱"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '4px',
                border: '1px solid #444',
                background: '#2a2a2a',
                color: '#fff',
                fontSize: '14px',
                boxSizing: 'border-box',
                outline: 'none',
              }}
              onFocus={e => e.target.style.borderColor = '#2196f3'}
              onBlur={e => e.target.style.borderColor = '#444'}
            />
          </div>

          {inviteToken ? (
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                color: '#ccc',
                marginBottom: '6px',
                fontSize: '14px',
              }}>
                邀请Token
              </label>
              <input
                type="text"
                value={inviteToken}
                readOnly
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '4px',
                  border: '1px solid #444',
                  background: '#252525',
                  color: '#888',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  cursor: 'not-allowed',
                }}
              />
            </div>
          ) : (
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                color: '#ccc',
                marginBottom: '6px',
                fontSize: '14px',
              }}>
                房间码
              </label>
              <input
                type="text"
                value={roomCodeInput}
                onChange={handleRoomCodeChange}
                placeholder="请输入6位房间码"
                maxLength={6}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '4px',
                  border: '1px solid #444',
                  background: '#2a2a2a',
                  color: '#fff',
                  fontSize: '18px',
                  letterSpacing: '4px',
                  textAlign: 'center',
                  boxSizing: 'border-box',
                  outline: 'none',
                  textTransform: 'uppercase',
                }}
                onFocus={e => e.target.style.borderColor = '#2196f3'}
                onBlur={e => e.target.style.borderColor = '#444'}
              />
            </div>
          )}

          {error && (
            <div style={{
              color: '#f44336',
              marginBottom: '16px',
              fontSize: '14px',
              padding: '10px 12px',
              background: 'rgba(244,67,54,0.1)',
              borderRadius: '4px',
              border: '1px solid rgba(244,67,54,0.3)',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !roomInfo}
            style={{
              width: '100%',
              padding: '12px 24px',
              borderRadius: '4px',
              border: 'none',
              background: '#2196f3',
              color: '#fff',
              cursor: loading || !roomInfo ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 500,
              opacity: loading || !roomInfo ? 0.6 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {loading ? '加入中...' : '加入面试'}
          </button>
        </form>

        {!inviteToken && (
          <p style={{
            color: '#666',
            margin: '16px 0 0 0',
            fontSize: '13px',
            textAlign: 'center',
          }}>
            已有邀请链接？点击链接可自动填写信息
          </p>
        )}
      </div>
    </div>
  );
};
