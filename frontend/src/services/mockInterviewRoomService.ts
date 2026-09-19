import type { InterviewRoom, ParticipantStatus, CreateRoomRequest, CreateRoomResponse, JoinRoomResponse } from '../types';
import { ApiError } from './api';
import { mockGetInvitationByToken } from './mockInvitationService';

const STORAGE_KEY = 'code_interview_rooms';
const PARTICIPANTS_STORAGE_KEY = 'code_interview_participants';

const JOINABLE_STATUSES: InterviewRoom['status'][] = ['WAITING', 'ACTIVE'];

const mockRooms: InterviewRoom[] = [];

const loadParticipantsFromStorage = (): ParticipantStatus[] => {
  try {
    const stored = localStorage.getItem(PARTICIPANTS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load participants from storage:', e);
  }
  return [];
};

let participantsCache: ParticipantStatus[] | null = null;

const getParticipantsCache = (): ParticipantStatus[] => {
  if (!participantsCache) {
    participantsCache = loadParticipantsFromStorage();
  }
  return participantsCache;
};

const saveParticipants = (participants: ParticipantStatus[]) => {
  participantsCache = participants;
  try {
    localStorage.setItem(PARTICIPANTS_STORAGE_KEY, JSON.stringify(participants));
  } catch (e) {
    console.warn('Failed to save participants to storage:', e);
  }
};

const loadFromStorage = (): InterviewRoom[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load rooms from storage:', e);
  }
  return [...mockRooms];
};

const saveToStorage = (rooms: InterviewRoom[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
  } catch (e) {
    console.warn('Failed to save rooms to storage:', e);
  }
};

let roomsCache: InterviewRoom[] | null = null;

const getRoomsCache = (): InterviewRoom[] => {
  if (!roomsCache) {
    roomsCache = loadFromStorage();
  }
  return roomsCache;
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const generateRoomCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export async function mockCreateRoom(data: CreateRoomRequest): Promise<CreateRoomResponse> {
  await delay(500);
  const rooms = getRoomsCache();
  const roomId = 'room-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  const roomCode = generateRoomCode();
  const now = new Date().toISOString();

  const newRoom: InterviewRoom = {
    id: roomId,
    roomCode: roomCode,
    title: data.title,
    problemId: data.problemId,
    interviewerId: data.interviewerId,
    candidateId: '',
    status: 'WAITING',
    createdAt: now,
    code: '',
    language: 'javascript',
    chatMessages: [],
  };

  const participant: ParticipantStatus = {
    id: 'participant-' + Date.now(),
    roomId: roomId,
    userId: data.interviewerId,
    userName: data.interviewerName,
    userRole: 'INTERVIEWER',
    isOnline: true,
    lastHeartbeat: now,
    joinedAt: now,
  };

  roomsCache = [newRoom, ...rooms];
  saveToStorage(roomsCache);

  return {
    room: { ...newRoom },
    participant: { ...participant },
  };
}

export async function mockGetRoomById(roomId: string): Promise<InterviewRoom> {
  await delay(200);
  const rooms = getRoomsCache();
  const room = rooms.find(r => r.id === roomId);
  if (!room) {
    throw new ApiError(404, 'ROOM_NOT_FOUND', '房间不存在或已关闭');
  }
  return { ...room };
}

export async function mockGetRoomByCode(roomCode: string): Promise<InterviewRoom> {
  await delay(200);
  const rooms = getRoomsCache();
  const room = rooms.find(r => r.roomCode === roomCode);
  if (!room) {
    throw new ApiError(404, 'ROOM_NOT_FOUND', '房间不存在或已关闭');
  }
  return { ...room };
}

export async function mockGetRoomsByInterviewer(interviewerId: string): Promise<InterviewRoom[]> {
  await delay(300);
  const rooms = getRoomsCache();
  return rooms
    .filter(r => r.interviewerId === interviewerId)
    .map(r => ({ ...r }));
}

export async function mockUpdateRoomStatus(roomId: string, status: string): Promise<InterviewRoom> {
  await delay(300);
  const rooms = getRoomsCache();
  const index = rooms.findIndex(r => r.id === roomId);
  if (index === -1) {
    throw new Error('房间不存在');
  }

  const updatedRoom: InterviewRoom = {
    ...rooms[index],
    status: status as InterviewRoom['status'],
  };

  roomsCache = [...rooms];
  roomsCache[index] = updatedRoom;
  saveToStorage(roomsCache);
  return { ...updatedRoom };
}

export async function mockGetRoomParticipants(roomId: string): Promise<ParticipantStatus[]> {
  await delay(200);
  const rooms = getRoomsCache();
  const room = rooms.find(r => r.id === roomId);
  if (!room) {
    throw new Error('房间不存在');
  }

  const participants: ParticipantStatus[] = [];
  if (room.interviewerId) {
    participants.push({
      id: 'participant-interviewer-' + room.interviewerId,
      roomId: roomId,
      userId: room.interviewerId,
      userName: '面试官',
      userRole: 'INTERVIEWER',
      isOnline: true,
      lastHeartbeat: new Date().toISOString(),
      joinedAt: room.createdAt,
    });
  }
  if (room.candidateId) {
    participants.push({
      id: 'participant-candidate-' + room.candidateId,
      roomId: roomId,
      userId: room.candidateId,
      userName: '候选人',
      userRole: 'CANDIDATE',
      isOnline: false,
      lastHeartbeat: new Date().toISOString(),
      joinedAt: room.createdAt,
    });
  }

  return participants;
}

export async function mockJoinRoom(roomId: string, data: { candidateName: string; inviteToken: string }): Promise<JoinRoomResponse> {
  await delay(500);
  const rooms = getRoomsCache();
  const index = rooms.findIndex(r => r.id === roomId);
  if (index === -1) {
    throw new ApiError(404, 'ROOM_NOT_FOUND', '房间不存在或已关闭');
  }

  const room = rooms[index];

  // 邀请凭证校验：与后端 RoomAdmissionService 保持同一顺序与结论
  if (data.inviteToken && data.inviteToken.trim()) {
    const invitation = await mockGetInvitationByToken(data.inviteToken.trim());
    if (invitation.roomId !== roomId) {
      throw new ApiError(400, 'INVITATION_ROOM_MISMATCH', '邀请链接与房间不匹配');
    }
  }

  if (!data.candidateName || !data.candidateName.trim()) {
    throw new ApiError(400, 'INVALID_NAME', '请输入候选人姓名');
  }

  // 已结束 / 已取消的房间拒绝加入
  if (!JOINABLE_STATUSES.includes(room.status)) {
    throw new ApiError(409, 'ROOM_ENDED', '房间已结束或已取消，无法加入');
  }

  const candidateName = data.candidateName.trim();
  const now = new Date().toISOString();

  // 重复提交防护：复用同房间同名候选人的既有参与身份
  const existing = getParticipantsCache()
    .find(p => p.roomId === roomId && p.userRole === 'CANDIDATE' && p.userName === candidateName);

  const participant: ParticipantStatus = existing
    ? { ...existing, isOnline: true, lastHeartbeat: now }
    : {
        id: 'participant-' + Date.now(),
        roomId: roomId,
        userId: '',
        userName: candidateName,
        userRole: 'CANDIDATE',
        isOnline: true,
        lastHeartbeat: now,
        joinedAt: now,
      };
  participant.userId = participant.id;

  const allParticipants = getParticipantsCache().filter(p => p.id !== participant.id);
  saveParticipants([...allParticipants, participant]);

  const updatedRoom: InterviewRoom = {
    ...room,
    candidateId: participant.userId,
    status: 'ACTIVE',
    startedAt: room.startedAt ?? now,
  };

  roomsCache = [...rooms];
  roomsCache[index] = updatedRoom;
  saveToStorage(roomsCache);

  return {
    participant: { ...participant },
    room: { ...updatedRoom },
    message: data.inviteToken ? 'Joined via invitation token' : 'Joined via room code',
  };
}

export async function mockLeaveRoom(_roomId: string, _userId: string): Promise<void> {
  await delay(200);
}

export async function mockHeartbeat(roomId: string, userId: string): Promise<ParticipantStatus> {
  await delay(100);
  return {
    id: 'participant-' + userId,
    roomId: roomId,
    userId: userId,
    userName: '用户',
    userRole: 'INTERVIEWER',
    isOnline: true,
    lastHeartbeat: new Date().toISOString(),
    joinedAt: new Date().toISOString(),
  };
}

export const resetMockRoomData = () => {
  roomsCache = [...mockRooms];
  saveToStorage(roomsCache);
};
