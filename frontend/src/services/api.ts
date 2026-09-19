export const BASE_URL = 'http://localhost:8080/api';

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: any;
}

/**
 * 统一的接口错误：保留 HTTP status、后端返回的稳定 code 与提示语，
 * 让邀请链接 / 房间码两个入口可以基于同一字段给出同一结论。
 */
export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/** 后端故障 / 断网等传输层错误的统一 code。 */
export const NETWORK_ERROR_CODE = 'NETWORK_ERROR';

/** 判断是否为后端不可达的传输层错误（而非 4xx 业务拒绝）。 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.code === NETWORK_ERROR_CODE;
  }
  if (error instanceof Error) {
    const message = error.message || '';
    return message.includes('Failed to fetch')
      || message.includes('NetworkError')
      || message.includes('ECONNREFUSED');
  }
  return false;
}

function createNetworkError(): ApiError {
  return new ApiError(0, NETWORK_ERROR_CODE, '网络异常，请稍后重试');
}

export async function request<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  const config: RequestInit = {
    ...options,
    headers,
  };

  if (options.body !== undefined && options.body !== null) {
    config.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${url}`, config);
  } catch {
    throw createNetworkError();
  }

  const text = await response.text();

  if (!response.ok) {
    let code = `HTTP_${response.status}`;
    let message: string;
    if (text) {
      try {
        const body = JSON.parse(text);
        if (typeof body.code === 'string') {
          code = body.code;
        }
        message = typeof body.message === 'string' && body.message
          ? body.message
          : `HTTP error! status: ${response.status}`;
      } catch {
        message = `HTTP error! status: ${response.status}`;
      }
    } else {
      message = `HTTP error! status: ${response.status}`;
    }
    throw new ApiError(response.status, code, message);
  }

  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}
