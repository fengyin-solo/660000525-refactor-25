import { isNetworkError } from './api';
import { setUseMockFallback } from './mockMode';

/**
 * 统一的网络失败处理：所有业务服务共用同一判定与 Mock 降级开关，
 * 避免邀请链接与房间码两条链路各自判断、结论不一致。
 *
 * 返回 true 表示属于后端不可达的传输层失败（已开启全局 Mock 降级），
 * 调用方应转用本地 Mock 数据；返回 false 表示是正常的业务拒绝，需继续抛出。
 */
export function handleNetworkFailure(error: unknown): boolean {
  if (isNetworkError(error)) {
    setUseMockFallback(true);
    return true;
  }
  return false;
}
