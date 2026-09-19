package com.codeinterview.service;

import com.codeinterview.dto.JoinRoomResponse;
import com.codeinterview.dto.WebSocketMessage;
import com.codeinterview.exception.ApiException;
import com.codeinterview.model.CandidateInvitation;
import com.codeinterview.model.InterviewRoom;
import com.codeinterview.model.ParticipantStatus;
import com.codeinterview.repository.CandidateInvitationRepository;
import com.codeinterview.repository.InterviewRoomRepository;
import com.codeinterview.repository.ParticipantStatusRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 面试房间准入服务：邀请链接与房间码两条入口共用同一套校验顺序与结果构造。
 *
 * 校验顺序（任一步失败都会返回携带稳定 code 的 {@link ApiException}）：
 * 1. 房间存在
 * 2. 邀请凭证有效（token 存在、归属当前房间）
 * 3. 房间可加入（WAITING / ACTIVE）
 * 4. 幂等复用（重复提交直接返回既有参与身份，不再新建参与者）
 */
@Service
public class RoomAdmissionService {

    /** 可加入的房间状态。 */
    private static final List<String> JOINABLE_STATUSES = List.of("WAITING", "ACTIVE");

    @Autowired
    private InterviewRoomRepository interviewRoomRepository;

    @Autowired
    private CandidateInvitationRepository candidateInvitationRepository;

    @Autowired
    private ParticipantStatusRepository participantStatusRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    /**
     * 候选人加入房间。房间码入口 inviteToken 传 null/空字符串即可。
     */
    @Transactional
    public JoinRoomResponse join(String roomId, String candidateName, String inviteToken) {
        InterviewRoom room = requireRoom(roomId);

        String message = "Joined via room code";
        CandidateInvitation invitation = null;
        if (inviteToken != null && !inviteToken.trim().isEmpty()) {
            invitation = validateInvitation(inviteToken.trim(), roomId);
            message = "Joined via invitation token";
        }

        if (candidateName == null || candidateName.trim().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_NAME", "请输入候选人姓名");
        }

        assertRoomJoinable(room);

        ParticipantStatus status = findExistingCandidate(roomId, candidateName.trim())
                .orElseGet(() -> createCandidateStatus(roomId, candidateName.trim()));

        if (invitation != null) {
            invitation.setStatus("JOINED");
            invitation.setJoinedAt(LocalDateTime.now());
            candidateInvitationRepository.save(invitation);
        }

        broadcastParticipants(roomId);

        return new JoinRoomResponse(status, room, message);
    }

    /** 按 ID 取房间，不存在统一报 ROOM_NOT_FOUND（404）。 */
    public InterviewRoom requireRoom(String roomId) {
        return interviewRoomRepository.findById(roomId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ROOM_NOT_FOUND", "房间不存在或已关闭"));
    }

    /** 按房间码取房间，不存在同样报 ROOM_NOT_FOUND，保证两个入口结论一致。 */
    public InterviewRoom requireRoomByCode(String roomCode) {
        return interviewRoomRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ROOM_NOT_FOUND", "房间不存在或已关闭"));
    }

    /** 按 token 取邀请，无效 token 统一报 INVALID_INVITATION（401）。 */
    public CandidateInvitation requireInvitationByToken(String inviteToken) {
        return candidateInvitationRepository.findByInviteToken(inviteToken)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED,
                        "INVALID_INVITATION", "邀请链接无效或已失效"));
    }

    /** 已结束 / 已取消的房间拒绝加入。 */
    public void assertRoomJoinable(InterviewRoom room) {
        if (!JOINABLE_STATUSES.contains(room.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT,
                    "ROOM_ENDED", "房间已结束或已取消，无法加入");
        }
    }

    private CandidateInvitation validateInvitation(String inviteToken, String roomId) {
        CandidateInvitation invitation = requireInvitationByToken(inviteToken);
        if (!roomId.equals(invitation.getRoomId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "INVITATION_ROOM_MISMATCH", "邀请链接与房间不匹配");
        }
        return invitation;
    }

    /**
     * 重复提交防护：同一房间内同名候选人若已存在（含此前离线后重新加入），
     * 复用原有参与身份并刷新在线状态，避免每次点击都新增一条参与者记录。
     */
    private Optional<ParticipantStatus> findExistingCandidate(String roomId, String candidateName) {
        return participantStatusRepository.findByRoomId(roomId).stream()
                .filter(p -> "CANDIDATE".equals(p.getUserRole()))
                .filter(p -> candidateName.equals(p.getUserName()))
                .findFirst();
    }

    private ParticipantStatus createCandidateStatus(String roomId, String candidateName) {
        LocalDateTime now = LocalDateTime.now();
        ParticipantStatus status = new ParticipantStatus();
        status.setRoomId(roomId);
        status.setUserName(candidateName);
        status.setUserRole("CANDIDATE");
        status.setOnline(true);
        status.setLastHeartbeat(now);
        status.setJoinedAt(now);

        ParticipantStatus saved = participantStatusRepository.save(status);
        // 候选人无独立账号，userId 与参与者记录 id 保持一致，两条入口的身份一致
        saved.setUserId(saved.getId());
        return participantStatusRepository.save(saved);
    }

    private void broadcastParticipants(String roomId) {
        List<ParticipantStatus> participants = participantStatusRepository.findByRoomId(roomId);
        messagingTemplate.convertAndSend("/topic/room/" + roomId + "/participants",
                new WebSocketMessage<>("PARTICIPANTS_UPDATE", participants));
    }
}
