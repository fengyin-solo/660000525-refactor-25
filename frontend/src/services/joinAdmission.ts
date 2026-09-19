import { ApiError } from './api';
import { getInvitationByToken } from './invitationService';
import { getRoomByCode, getRoomById, joinRoom } from './interviewRoomService';
import type { CandidateInvitation, InterviewRoom, JoinRoomResponse, User } from '../types';

/** 可加入的房间状态，与后端 RoomAdmissionService 的 JOINABLE_STATUSES 对齐。 */
const JOINABLE_STATUSES: InterviewRoom['status'][] = ['WAITING', 'ACTIVE'];

export interface ResolvedCredential {
  room: InterviewRoom;
  invitation: CandidateInvitation | null;
}

/**
 * 凭证解析：邀请链接与房间码两个入口在此收拢为同一条逻辑，
 * 无效凭证 / 房间不存在都会得到同结构的 ApiError（ROOM_NOT_FOUND / INVALID_INVITATION）。
 */
export async function resolveCredential(params: { token?: string; code?: string }): Promise<ResolvedCredential> {
  const token = params.token?.trim();
  const code = params.code?.trim().toUpperCase();

  if (token) {
    const invitation = await getInvitationByToken(token);
    const room = await getRoomById(invitation.roomId);
    return { room, invitation };
  }

  if (code) {
    const room = await getRoomByCode(code);
    return { room, invitation: null };
  }

  // 尚未提供任何凭证，交由页面表现为“请输入房间码”，不视为请求失败
  throw new ApiError(400, 'NO_CREDENTIAL', '请先输入有效的房间码或通过邀请链接进入');
}

/** 已结束 / 已取消的房间不可加入，两个入口共用同一结论。 */
export function assertRoomJoinable(room: InterviewRoom): void {
  if (!JOINABLE_STATUSES.includes(room.status)) {
    throw new ApiError(409, 'ROOM_ENDED', '房间已结束或已取消，无法加入');
  }
}

/**
 * 由加入结果构造统一的候选人身份。两条入口成功后的身份字段保持一致：
 * id 取自服务端参与者记录（后端 mock 均保证 userId 与参与者 id 相同）。
 */
export function buildCandidateUser(result: JoinRoomResponse, email: string): User {
  return {
    id: result.participant.userId,
    name: result.participant.userName,
    email: email.trim(),
    role: 'CANDIDATE',
    createdAt: new Date().toISOString(),
  };
}

// 重复提交防护：同一房间 + 同一姓名的加入请求在途时直接复用同一个 Promise，
// 无论从哪个入口触发，快速连点都只会产生一次实际请求。
const inflightJoins = new Map<string, Promise<JoinRoomResponse>>();

function joinKey(roomId: string, candidateName: string): string {
  return `${roomId}::${candidateName.trim()}`;
}

/**
 * 提交加入：表单校验通过后两个入口统一调用。
 * 会先做一次本地的可加入状态判断，再走服务端的统一准入校验。
 */
export async function submitJoin(params: {
  room: InterviewRoom;
  candidateName: string;
  inviteToken: string;
}): Promise<JoinRoomResponse> {
  const name = params.candidateName.trim();
  if (!name) {
    throw new ApiError(400, 'INVALID_NAME', '请输入候选人姓名');
  }

  assertRoomJoinable(params.room);

  const key = joinKey(params.room.id, name);
  const existing = inflightJoins.get(key);
  if (existing) {
    return existing;
  }

  const promise = joinRoom(params.room.id, {
    candidateName: name,
    inviteToken: params.inviteToken,
  }).finally(() => {
    inflightJoins.delete(key);
  });

  inflightJoins.set(key, promise);
  return promise;
}

/** 从任意错误中提取可直接展示的提示语。 */
export function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
