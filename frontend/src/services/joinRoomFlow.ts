import type { InterviewRoom, JoinRoomResponse, User, CandidateInvitation } from '../types';
import { ApiError, isNetworkError } from './api';
import { getInvitationByToken } from './invitationService';
import { getRoomByCode, getRoomById, joinRoom } from './interviewRoomService';

/**
 * 加入房间的准入错误码。两条入口（邀请链接 / 房间码）共用同一套，
 * 后端 join 接口也返回相同的 code，保证任意入口结论一致。
 */
export type JoinErrorCode =
  | 'INVALID_CREDENTIAL'
  | 'INVITATION_MISMATCH'
  | 'ROOM_FINISHED'
  | 'ROOM_NOT_JOINABLE'
  | 'NETWORK_ERROR';

export class JoinError extends Error {
  code: JoinErrorCode;

  constructor(code: JoinErrorCode, message?: string) {
    super(message || JOIN_ERROR_MESSAGES[code]);
    this.name = 'JoinError';
    this.code = code;
  }
}

export const JOIN_ERROR_MESSAGES: Record<JoinErrorCode, string> = {
  INVALID_CREDENTIAL: '无效的邀请链接或房间码',
  INVITATION_MISMATCH: '邀请链接与房间不匹配',
  ROOM_FINISHED: '房间已结束，无法加入',
  ROOM_NOT_JOINABLE: '房间当前不可加入',
  NETWORK_ERROR: '网络连接失败，请稍后重试',
};

/** 允许候选人加入的房间状态；WAITING / ACTIVE 可加入，其余视为已结束 */
const JOINABLE_STATUSES: InterviewRoom['status'][] = ['WAITING', 'ACTIVE'];

export const isRoomJoinable = (room: InterviewRoom): boolean =>
  JOINABLE_STATUSES.includes(room.status);

export interface ResolvedCredential {
  /** 加入时提交给后端的邀请 token，房间码入口为空字符串 */
  inviteToken: string;
  room: InterviewRoom;
  /** 邀请入口携带的候选人预填信息（房间码入口为 null） */
  invitation: CandidateInvitation | null;
}

/** 把任意异常归一为 JoinError，两条入口 / 预览与提交阶段共用 */
const toJoinError = (err: unknown): JoinError => {
  if (err instanceof JoinError) return err;
  if (isNetworkError(err)) return new JoinError('NETWORK_ERROR');
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'INVALID_CREDENTIAL':
      case 'INVITATION_MISMATCH':
      case 'ROOM_FINISHED':
      case 'ROOM_NOT_JOINABLE':
        return new JoinError(err.code);
      default:
        break;
    }
    if (err.status === 401 || err.status === 404) {
      return new JoinError('INVALID_CREDENTIAL');
    }
    if (err.status === 409) {
      return new JoinError('ROOM_NOT_JOINABLE');
    }
    return new JoinError('NETWORK_ERROR');
  }
  // mock 数据等抛出的中文 Error：按消息关键字归类，保持入口间一致
  if (err instanceof Error) {
    if (err.message.includes('结束') || err.message.includes('取消')) {
      return new JoinError('ROOM_FINISHED');
    }
    if (err.message.includes('不存在') || err.message.includes('无效')) {
      return new JoinError('INVALID_CREDENTIAL');
    }
  }
  return new JoinError('NETWORK_ERROR');
};

/**
 * 凭证解析（预览阶段）。无论从哪种入口进入，校验顺序统一为：
 * 凭证有效性 -> 房间存在性 -> 房间可加入状态。
 */
export async function resolveJoinCredential(params: {
  inviteToken?: string;
  roomCode?: string;
}): Promise<ResolvedCredential> {
  const { inviteToken, roomCode } = params;
  try {
    if (inviteToken) {
      const invitation = await getInvitationByToken(inviteToken);
      const room = await getRoomById(invitation.roomId);
      if (!isRoomJoinable(room)) throw new JoinError('ROOM_FINISHED');
      return { inviteToken, room, invitation };
    }

    const code = (roomCode || '').trim().toUpperCase();
    if (code.length !== 6) throw new JoinError('INVALID_CREDENTIAL');
    const room = await getRoomByCode(code);
    if (!isRoomJoinable(room)) throw new JoinError('ROOM_FINISHED');
    return { inviteToken: '', room, invitation: null };
  } catch (err) {
    throw toJoinError(err);
  }
}

/**
 * 提交加入。后端是唯一权威：在此再次校验房间状态与凭证，
 * 防止预览后房间被结束 / 邀请被撤销的竞态。
 */
export async function submitJoin(params: {
  roomId: string;
  candidateName: string;
  inviteToken: string;
}): Promise<JoinRoomResponse> {
  try {
    return await joinRoom(params.roomId, {
      candidateName: params.candidateName,
      inviteToken: params.inviteToken,
    });
  } catch (err) {
    throw toJoinError(err);
  }
}

/**
 * 由服务端返回结果构造候选人身份，保证两条入口成功后的身份一致：
 * id / name / role 全部以服务端 participant 为准，邮箱取本地输入（后端不落库）。
 */
export const buildCandidateUser = (
  result: JoinRoomResponse,
  fallbackName: string,
  email: string,
): User => ({
  id: result.participant.userId || result.participant.id,
  name: result.participant.userName || fallbackName,
  email,
  role: 'CANDIDATE',
  createdAt: result.participant.joinedAt || new Date().toISOString(),
});
