import type { CandidateInvitation } from '../types';

const STORAGE_KEY = 'code_interview_invitations';

let invitationsCache: CandidateInvitation[] | null = null;

const loadFromStorage = (): CandidateInvitation[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.warn('Failed to load invitations from storage:', e);
  }
  return [];
};

const saveToStorage = (invitations: CandidateInvitation[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(invitations));
  } catch (e) {
    console.warn('Failed to save invitations to storage:', e);
  }
};

const getCache = (): CandidateInvitation[] => {
  if (!invitationsCache) invitationsCache = loadFromStorage();
  return invitationsCache;
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function mockCreateInvitation(data: {
  roomId: string;
  candidateName: string;
  candidateEmail: string;
}): Promise<CandidateInvitation> {
  await delay(300);
  const now = new Date().toISOString();
  const invitation: CandidateInvitation = {
    id: 'invitation-' + Date.now(),
    roomId: data.roomId,
    candidateName: data.candidateName,
    candidateEmail: data.candidateEmail,
    inviteToken: 'mock-token-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    status: 'PENDING',
    createdAt: now,
  };
  invitationsCache = [invitation, ...getCache()];
  saveToStorage(invitationsCache);
  return { ...invitation };
}

export async function mockGetInvitationsByRoom(roomId: string): Promise<CandidateInvitation[]> {
  await delay(200);
  return getCache()
    .filter(inv => inv.roomId === roomId)
    .map(inv => ({ ...inv }));
}

export async function mockGetInvitationByToken(token: string): Promise<CandidateInvitation> {
  await delay(200);
  const invitation = getCache().find(inv => inv.inviteToken === token);
  if (!invitation) {
    throw new Error('无效的邀请token');
  }
  return { ...invitation };
}

export async function mockUpdateInvitationStatus(
  invitationId: string,
  status: string,
): Promise<CandidateInvitation> {
  await delay(200);
  const list = getCache();
  const invitation = list.find(inv => inv.id === invitationId);
  if (!invitation) throw new Error('邀请不存在');
  invitation.status = status as CandidateInvitation['status'];
  if (status === 'JOINED') invitation.joinedAt = new Date().toISOString();
  saveToStorage(list);
  return { ...invitation };
}

export async function mockDeleteInvitation(invitationId: string): Promise<void> {
  await delay(200);
  invitationsCache = getCache().filter(inv => inv.id !== invitationId);
  saveToStorage(invitationsCache);
}

export async function mockMarkInvitationJoinedByToken(token: string): Promise<void> {
  const list = getCache();
  const invitation = list.find(inv => inv.inviteToken === token);
  if (invitation) {
    invitation.status = 'JOINED';
    invitation.joinedAt = new Date().toISOString();
    saveToStorage(list);
  }
}
