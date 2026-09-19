package com.codeinterview.exception;

import org.springframework.http.HttpStatus;

/**
 * 业务准入异常：携带稳定的错误码与 HTTP 状态，
 * 供两条加入链路（邀请链接 / 房间码）返回完全一致的结论。
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public ApiException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }
}
