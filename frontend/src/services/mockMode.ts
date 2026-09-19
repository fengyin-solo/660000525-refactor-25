/**
 * 全局 Mock 降级开关：后端不可达时所有业务服务统一切换到本地 Mock 数据。
 * 独立成模块以避免 networkFallback 与各 service 之间出现循环依赖。
 */
let useMockFallback = false;

export const setUseMockFallback = (value: boolean) => {
  useMockFallback = value;
  if (value) {
    console.warn('⚠️ 后端服务不可用，已切换到 Mock 数据模式。数据将保存在浏览器本地存储中。');
  }
};

export const isUsingMockData = () => useMockFallback;
