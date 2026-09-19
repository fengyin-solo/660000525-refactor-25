import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useInterviewStore } from '../store/interview';
import type { InterviewRoom, User } from '../types';
import { resolveCredential, submitJoin, buildCandidateUser, assertRoomJoinable, toErrorMessage } from '../services/joinAdmission';

export const JoinRoomPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setCurrentUser, setCurrentRoom } = useInterviewStore();

  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [tokenFromUrl, setTokenFromUrl] = useState('');
  const [roomInfo, setRoomInfo] = useState<InterviewRoom | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [error, setError] = useState('');

  /**
   * 凭证加载：邀请链接（token）与房间码（code）共用 resolveCredential，
   * 保证无效凭证、已结束房间、网络失败在任意入口得到同样结论。
   */
  const loadCredential = async (params: { token?: string; code?: string }) => {
    setInitialLoading(true);
    setError('');
    try {
      const { room, invitation } = await resolveCredential(params);
      // 已结束 / 已取消房间在两个入口都直接拦下，不允许继续填写提交
      assertRoomJoinable(room);
      setRoomInfo(room);
      if (invitation) {
        setCandidateName(invitation.candidateName || '');
        setCandidateEmail(invitation.candidateEmail || '');
      }
    } catch (err) {
      setRoomInfo(null);
      setError(toErrorMessage(err, '获取房间信息失败'));
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    const token = searchParams.get('token');
    const code = searchParams.get('code');

    if (token) {
      setTokenFromUrl(token);
      loadCredential({ token });
    } else if (code) {
      setRoomCodeInput(code.toUpperCase());
      loadCredential({ code });
    }
  }, [searchParams]);

  const handleRoomCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().slice(0, 6);
    setRoomCodeInput(value);
    setError('');
    if (value.length === 6) {
      loadCredential({ code: value });
    } else {
      setRoomInfo(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

    setLoading(true);
    try {
      // 两条入口在此合并为同一次提交：服务端统一执行房间/凭证/状态/幂等校验
      const result = await submitJoin({
        room: roomInfo,
        candidateName: candidateName.trim(),
        inviteToken: tokenFromUrl,
      });

      const user: User = buildCandidateUser(result, candidateEmail.trim());

      setCurrentUser(user);
      setCurrentRoom(result.room);
      navigate(`/room/${result.room.id}/candidate`);
    } catch (err) {
      setError(toErrorMessage(err, '加入房间失败'));
    } finally {
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

          {tokenFromUrl ? (
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
                value={tokenFromUrl}
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

        {!tokenFromUrl && (
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
