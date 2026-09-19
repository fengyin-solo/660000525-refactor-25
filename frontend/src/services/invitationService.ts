import { request } from './api';
import { handleNetworkFailure } from './networkFallback';
import { isUsingMockData } from './mockMode';
import type { InviteCandidateRequest, CandidateInvitation } from '../types';
import {
  mockCreateInvitation,
  mockGetInvitationsByRoom,
  mockGetInvitationByToken,
  mockUpdateInvitationStatus,
  mockDeleteInvitation,
} from './mockInvitationService';

export function createInvitation(data: InviteCandidateRequest): Promise<CandidateInvitation> {
  if (isUsingMockData()) {
    return mockCreateInvitation(data);
  }
  return request<CandidateInvitation>('/invitations', {
    method: 'POST',
    body: data,
  }).catch((error) => {
    if (handleNetworkFailure(error)) {
      return mockCreateInvitation(data);
    }
    throw error;
  });
}

export function getInvitationsByRoom(roomId: string): Promise<CandidateInvitation[]> {
  if (isUsingMockData()) {
    return mockGetInvitationsByRoom(roomId);
  }
  return request<CandidateInvitation[]>(`/invitations/room/${roomId}`).catch((error) => {
    if (handleNetworkFailure(error)) {
      return mockGetInvitationsByRoom(roomId);
    }
    throw error;
  });
}

export function getInvitationByToken(token: string): Promise<CandidateInvitation> {
  if (isUsingMockData()) {
    return mockGetInvitationByToken(token);
  }
  return request<CandidateInvitation>(`/invitations/token/${token}`).catch((error) => {
    if (handleNetworkFailure(error)) {
      return mockGetInvitationByToken(token);
    }
    throw error;
  });
}

export function updateInvitationStatus(invitationId: string, status: string): Promise<CandidateInvitation> {
  if (isUsingMockData()) {
    return mockUpdateInvitationStatus(invitationId, status);
  }
  return request<CandidateInvitation>(`/invitations/${invitationId}/status`, {
    method: 'PUT',
    body: { status },
  }).catch((error) => {
    if (handleNetworkFailure(error)) {
      return mockUpdateInvitationStatus(invitationId, status);
    }
    throw error;
  });
}

export function deleteInvitation(invitationId: string): Promise<void> {
  if (isUsingMockData()) {
    return mockDeleteInvitation(invitationId);
  }
  return request<void>(`/invitations/${invitationId}`, {
    method: 'DELETE',
  }).catch((error) => {
    if (handleNetworkFailure(error)) {
      return mockDeleteInvitation(invitationId);
    }
    throw error;
  });
}
