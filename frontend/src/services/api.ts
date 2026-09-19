export const BASE_URL = 'http://localhost:8080/api';

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: any;
}

/**
 * 携带 HTTP 状态码与后端错误码的异常，使各入口能够对
 * 无效凭证 / 已结束房间 / 网络失败给出一致结论。
 */
export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const e = error as any;
  return (
    e.status === 0 ||
    error.message.includes('Failed to fetch') ||
    error.message.includes('NetworkError') ||
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('Load failed')
  );
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
  } catch (err) {
    // fetch 仅在网络层失败时 reject（无响应），统一标记为 status 0
    throw new ApiError(err instanceof Error ? err.message : '网络请求失败', 0);
  }

  if (!response.ok) {
    let code: string | undefined;
    let message = `HTTP error! status: ${response.status}`;
    try {
      const text = await response.text();
      if (text) {
        const data = JSON.parse(text);
        code = data.code;
        if (typeof data.message === 'string' && data.message) {
          message = data.message;
        }
      }
    } catch {
      // 响应体不是 JSON，使用默认消息
    }
    throw new ApiError(message, response.status, code);
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}
