package com.codeinterview.dto;

/**
 * 统一的错误响应体。code 与前端 JoinErrorCode 对齐，
 * 使邀请链接与房间码两个入口得到相同的结论与提示。
 */
public class ErrorResponse {
    private String code;
    private String message;

    public ErrorResponse() {
    }

    public ErrorResponse(String code, String message) {
        this.code = code;
        this.message = message;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
