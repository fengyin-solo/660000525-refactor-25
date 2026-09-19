import { request } from './api';
import type { InviteCandidateRequest, CandidateInvitation } from '../types';
import { isUsingMockData, setUseMockFallback } from './problemService';
import {
  mockCreateInvitation,
  mockGetInvitationsByRoom,
  mockGetInvitationByToken,
  mockUpdateInvitationStatus,
  mockDeleteInvitation,
} from './mockInvitationService';

const handleApiError = (error: any): boolean => {
  if (error.message.includes('Failed to fetch') ||
      error.message.includes('NetworkError') ||
      error.message.includes('ECONNREFUSED') ||
      error.status === 0) {
    setUseMockFallback(true);
    return true;
  }
  return false;
};

export async function createInvitation(data: InviteCandidateRequest): Promise<CandidateInvitation> {
  if (isUsingMockData()) {
    return mockCreateInvitation(data);
  }
  try {
    return await request<CandidateInvitation>('/invitations', {
      method: 'POST',
      body: data,
    });
  } catch (error: any) {
    if (handleApiError(error)) {
      return mockCreateInvitation(data);
    }
    throw error;
  }
}

export async function getInvitationsByRoom(roomId: string): Promise<CandidateInvitation[]> {
  if (isUsingMockData()) {
    return mockGetInvitationsByRoom(roomId);
  }
  try {
    return await request<CandidateInvitation[]>(`/invitations/room/${roomId}`);
  } catch (error: any) {
    if (handleApiError(error)) {
      return mockGetInvitationsByRoom(roomId);
    }
    throw error;
  }
}

export async function getInvitationByToken(token: string): Promise<CandidateInvitation> {
  if (isUsingMockData()) {
    return mockGetInvitationByToken(token);
  }
  try {
    return await request<CandidateInvitation>(`/invitations/token/${token}`);
  } catch (error: any) {
    if (handleApiError(error)) {
      return mockGetInvitationByToken(token);
    }
    throw error;
  }
}

export async function updateInvitationStatus(invitationId: string, status: string): Promise<CandidateInvitation> {
  if (isUsingMockData()) {
    return mockUpdateInvitationStatus(invitationId, status);
  }
  try {
    return await request<CandidateInvitation>(`/invitations/${invitationId}/status`, {
      method: 'PUT',
      body: { status },
    });
  } catch (error: any) {
    if (handleApiError(error)) {
      return mockUpdateInvitationStatus(invitationId, status);
    }
    throw error;
  }
}

export async function deleteInvitation(invitationId: string): Promise<void> {
  if (isUsingMockData()) {
    return mockDeleteInvitation(invitationId);
  }
  try {
    return await request<void>(`/invitations/${invitationId}`, {
      method: 'DELETE',
    });
  } catch (error: any) {
    if (handleApiError(error)) {
      return mockDeleteInvitation(invitationId);
    }
    throw error;
  }
}
