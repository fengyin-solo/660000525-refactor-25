import { request } from './api';
import { handleNetworkFailure } from './networkFallback';
import type { CreateRoomRequest, InterviewRoom, ParticipantStatus, JoinRoomResponse, CreateRoomResponse } from '../types';
import {
  mockCreateRoom,
  mockGetRoomById,
  mockGetRoomByCode,
  mockGetRoomsByInterviewer,
  mockUpdateRoomStatus,
  mockGetRoomParticipants,
  mockJoinRoom,
  mockLeaveRoom,
  mockHeartbeat,
} from './mockInterviewRoomService';
import { isUsingMockData } from './mockMode';

export async function createRoom(data: CreateRoomRequest): Promise<CreateRoomResponse> {
  if (isUsingMockData()) {
    return mockCreateRoom(data);
  }
  try {
    return await request<CreateRoomResponse>('/interview-rooms', {
      method: 'POST',
      body: data,
    });
  } catch (error) {
    if (handleNetworkFailure(error)) {
      return mockCreateRoom(data);
    }
    throw error;
  }
}

export async function getRoomById(roomId: string): Promise<InterviewRoom> {
  if (isUsingMockData()) {
    return mockGetRoomById(roomId);
  }
  try {
    return await request<InterviewRoom>(`/interview-rooms/${roomId}`);
  } catch (error) {
    if (handleNetworkFailure(error)) {
      return mockGetRoomById(roomId);
    }
    throw error;
  }
}

export async function getRoomByCode(roomCode: string): Promise<InterviewRoom> {
  if (isUsingMockData()) {
    return mockGetRoomByCode(roomCode);
  }
  try {
    return await request<InterviewRoom>(`/interview-rooms/code/${roomCode}`);
  } catch (error) {
    if (handleNetworkFailure(error)) {
      return mockGetRoomByCode(roomCode);
    }
    throw error;
  }
}

export async function getRoomsByInterviewer(interviewerId: string): Promise<InterviewRoom[]> {
  if (isUsingMockData()) {
    return mockGetRoomsByInterviewer(interviewerId);
  }
  try {
    return await request<InterviewRoom[]>(`/interview-rooms/interviewer/${interviewerId}`);
  } catch (error) {
    if (handleNetworkFailure(error)) {
      return mockGetRoomsByInterviewer(interviewerId);
    }
    throw error;
  }
}

export async function updateRoomStatus(roomId: string, status: string): Promise<InterviewRoom> {
  if (isUsingMockData()) {
    return mockUpdateRoomStatus(roomId, status);
  }
  try {
    return await request<InterviewRoom>(`/interview-rooms/${roomId}/status`, {
      method: 'PUT',
      body: { status },
    });
  } catch (error) {
    if (handleNetworkFailure(error)) {
      return mockUpdateRoomStatus(roomId, status);
    }
    throw error;
  }
}

export async function getRoomParticipants(roomId: string): Promise<ParticipantStatus[]> {
  if (isUsingMockData()) {
    return mockGetRoomParticipants(roomId);
  }
  try {
    return await request<ParticipantStatus[]>(`/interview-rooms/${roomId}/participants`);
  } catch (error) {
    if (handleNetworkFailure(error)) {
      return mockGetRoomParticipants(roomId);
    }
    throw error;
  }
}

export async function joinRoom(roomId: string, data: { candidateName: string; inviteToken: string }): Promise<JoinRoomResponse> {
  if (isUsingMockData()) {
    return mockJoinRoom(roomId, data);
  }
  try {
    return await request<JoinRoomResponse>(`/interview-rooms/${roomId}/join`, {
      method: 'POST',
      body: data,
    });
  } catch (error) {
    if (handleNetworkFailure(error)) {
      return mockJoinRoom(roomId, data);
    }
    throw error;
  }
}

export async function leaveRoom(roomId: string, userId: string): Promise<void> {
  if (isUsingMockData()) {
    return mockLeaveRoom(roomId, userId);
  }
  try {
    return await request<void>(`/interview-rooms/${roomId}/leave`, {
      method: 'POST',
      body: { userId },
    });
  } catch (error) {
    if (handleNetworkFailure(error)) {
      return mockLeaveRoom(roomId, userId);
    }
    throw error;
  }
}

export async function heartbeat(roomId: string, userId: string): Promise<ParticipantStatus> {
  if (isUsingMockData()) {
    return mockHeartbeat(roomId, userId);
  }
  try {
    return await request<ParticipantStatus>(`/interview-rooms/${roomId}/heartbeat`, {
      method: 'POST',
      body: { userId },
    });
  } catch (error) {
    if (handleNetworkFailure(error)) {
      return mockHeartbeat(roomId, userId);
    }
    throw error;
  }
}
