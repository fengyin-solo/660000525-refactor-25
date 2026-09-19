package com.codeinterview.controller;

import com.codeinterview.dto.InviteCandidateRequest;
import com.codeinterview.exception.ApiException;
import com.codeinterview.model.CandidateInvitation;
import com.codeinterview.model.InterviewRoom;
import com.codeinterview.repository.CandidateInvitationRepository;
import com.codeinterview.repository.InterviewRoomRepository;
import com.codeinterview.service.RoomAdmissionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/invitations")
@CrossOrigin(origins = "*")
public class CandidateInvitationController {

    @Autowired
    private CandidateInvitationRepository invitationRepository;

    @Autowired
    private InterviewRoomRepository roomRepository;

    @Autowired
    private RoomAdmissionService roomAdmissionService;

    @PostMapping
    public Map<String, Object> createInvitation(@RequestBody InviteCandidateRequest request) {
        InterviewRoom room = roomRepository.findById(request.getRoomId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ROOM_NOT_FOUND", "房间不存在或已关闭"));

        if (!"WAITING".equals(room.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "ROOM_NOT_WAITING", "房间状态不是 WAITING，无法发送邀请");
        }

        String inviteToken = UUID.randomUUID().toString();

        CandidateInvitation invitation = new CandidateInvitation();
        invitation.setRoomId(request.getRoomId());
        invitation.setCandidateName(request.getCandidateName());
        invitation.setCandidateEmail(request.getCandidateEmail());
        invitation.setInviteToken(inviteToken);
        invitation.setStatus("PENDING");
        invitation.setCreatedAt(LocalDateTime.now());

        invitation = invitationRepository.save(invitation);

        Map<String, Object> response = new HashMap<>();
        response.put("id", invitation.getId());
        response.put("roomId", invitation.getRoomId());
        response.put("candidateName", invitation.getCandidateName());
        response.put("candidateEmail", invitation.getCandidateEmail());
        response.put("inviteToken", invitation.getInviteToken());
        response.put("status", invitation.getStatus());
        response.put("createdAt", invitation.getCreatedAt());
        response.put("inviteLink", "/join?token=" + inviteToken);

        return response;
    }

    @GetMapping("/room/{roomId}")
    public List<CandidateInvitation> getInvitationsByRoomId(@PathVariable String roomId) {
        return invitationRepository.findByRoomIdOrderByCreatedAtDesc(roomId);
    }

    @GetMapping("/{invitationId}")
    public CandidateInvitation getInvitationById(@PathVariable String invitationId) {
        return invitationRepository.findById(invitationId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                        "INVITATION_NOT_FOUND", "邀请不存在"));
    }

    @PutMapping("/{invitationId}/status")
    public CandidateInvitation updateInvitationStatus(
            @PathVariable String invitationId,
            @RequestParam String status) {

        CandidateInvitation invitation = invitationRepository.findById(invitationId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                        "INVITATION_NOT_FOUND", "邀请不存在"));

        if (!List.of("PENDING", "ACCEPTED", "DECLINED", "JOINED", "LEFT").contains(status)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_STATUS", "无效的状态值");
        }

        invitation.setStatus(status);

        if ("JOINED".equals(status)) {
            invitation.setJoinedAt(LocalDateTime.now());
        }

        return invitationRepository.save(invitation);
    }

    @GetMapping("/token/{inviteToken}")
    public CandidateInvitation getInvitationByToken(@PathVariable String inviteToken) {
        // 与加入接口的 token 校验共用同一结论：无效凭证 -> 401 INVALID_INVITATION
        return roomAdmissionService.requireInvitationByToken(inviteToken);
    }

    @DeleteMapping("/{invitationId}")
    public void deleteInvitation(@PathVariable String invitationId) {
        CandidateInvitation invitation = invitationRepository.findById(invitationId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                        "INVITATION_NOT_FOUND", "邀请不存在"));

        if (!"PENDING".equals(invitation.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT,
                    "INVITATION_NOT_REVOKABLE", "只有 PENDING 状态的邀请可以撤销");
        }

        invitationRepository.delete(invitation);
    }
}
