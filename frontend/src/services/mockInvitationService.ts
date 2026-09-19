import { ApiError } from './api';
import type { CandidateInvitation, InviteCandidateRequest } from '../types';

const STORAGE_KEY = 'code_interview_invitations';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

let invitationsCache: CandidateInvitation[] | null = null;

const loadFromStorage = (): CandidateInvitation[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load invitations from storage:', e);
  }
  return [];
};

const getCache = (): CandidateInvitation[] => {
  if (!invitationsCache) {
    invitationsCache = loadFromStorage();
  }
  return invitationsCache;
};

const save = (invitations: CandidateInvitation[]) => {
  invitationsCache = invitations;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(invitations));
  } catch (e) {
    console.warn('Failed to save invitations to storage:', e);
  }
};

const generateToken = (): string => {
  // 与后端 UUID 形态保持一致，便于走同一条 token 解析链路
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export async function mockCreateInvitation(data: InviteCandidateRequest): Promise<CandidateInvitation> {
  await delay(200);
  const now = new Date().toISOString();
  const invitation: CandidateInvitation = {
    id: 'invitation-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    roomId: data.roomId,
    candidateName: data.candidateName,
    candidateEmail: data.candidateEmail,
    inviteToken: generateToken(),
    status: 'PENDING',
    createdAt: now,
  };
  save([invitation, ...getCache()]);
  return { ...invitation };
}

export async function mockGetInvitationsByRoom(roomId: string): Promise<CandidateInvitation[]> {
  await delay(200);
  return getCache()
    .filter(i => i.roomId === roomId)
    .map(i => ({ ...i }));
}

export async function mockGetInvitationByToken(token: string): Promise<CandidateInvitation> {
  await delay(200);
  const invitation = getCache().find(i => i.inviteToken === token);
  if (!invitation) {
    // 与后端 INVALID_INVITATION 结论一致
    throw new ApiError(401, 'INVALID_INVITATION', '邀请链接无效或已失效');
  }
  return { ...invitation };
}

export async function mockUpdateInvitationStatus(invitationId: string, status: string): Promise<CandidateInvitation> {
  await delay(200);
  const invitations = getCache();
  const index = invitations.findIndex(i => i.id === invitationId);
  if (index === -1) {
    throw new ApiError(404, 'INVITATION_NOT_FOUND', '邀请不存在');
  }
  const updated: CandidateInvitation = {
    ...invitations[index],
    status: status as CandidateInvitation['status'],
    joinedAt: status === 'JOINED' ? new Date().toISOString() : invitations[index].joinedAt,
  };
  const next = [...invitations];
  next[index] = updated;
  save(next);
  return { ...updated };
}

export async function mockDeleteInvitation(invitationId: string): Promise<void> {
  await delay(200);
  const invitations = getCache();
  const target = invitations.find(i => i.id === invitationId);
  if (!target) {
    throw new ApiError(404, 'INVITATION_NOT_FOUND', '邀请不存在');
  }
  if (target.status !== 'PENDING') {
    throw new ApiError(409, 'INVITATION_NOT_REVOKABLE', '只有 PENDING 状态的邀请可以撤销');
  }
  save(invitations.filter(i => i.id !== invitationId));
}
