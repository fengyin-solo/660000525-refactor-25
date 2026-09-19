import { request } from './api';
import { handleNetworkFailure } from './networkFallback';
import { isUsingMockData } from './mockMode';
import type { Problem, CreateProblemRequest, UpdateProblemRequest } from '../types';
import {
  mockGetProblems,
  mockGetProblemById,
  mockCreateProblem,
  mockUpdateProblem,
  mockDeleteProblem,
} from './mockProblemService';

export interface ProblemListParams {
  difficulty?: string;
  tag?: string;
}

// 向后兼容：历史调用方从 problemService 引入该开关，实际状态统一存放在 mockMode
export { isUsingMockData };

export async function getProblems(params?: ProblemListParams): Promise<Problem[]> {
  if (isUsingMockData()) {
    return mockGetProblems(params);
  }
  try {
    const queryParams = new URLSearchParams();
    if (params?.difficulty) {
      queryParams.append('difficulty', params.difficulty);
    }
    if (params?.tag) {
      queryParams.append('tag', params.tag);
    }
    const queryString = queryParams.toString();
    const response = await request<any[]>(`/problems${queryString ? `?${queryString}` : ''}`);
    return parseProblemListResponse(response);
  } catch (error: any) {
    if (handleNetworkFailure(error)) {
      return mockGetProblems(params);
    }
    throw error;
  }
}

export async function getProblemById(id: string): Promise<Problem> {
  if (isUsingMockData()) {
    return mockGetProblemById(id);
  }
  try {
    const response = await request<any>(`/problems/${id}`);
    return parseProblemResponse(response);
  } catch (error: any) {
    if (handleNetworkFailure(error)) {
      return mockGetProblemById(id);
    }
    throw error;
  }
}

export async function createProblem(data: CreateProblemRequest): Promise<Problem> {
  if (isUsingMockData()) {
    return mockCreateProblem(data);
  }
  try {
    const payload = {
      ...data,
      examples: JSON.stringify(data.examples),
      testCases: JSON.stringify(data.testCases),
      tags: JSON.stringify(data.tags),
    };
    const response = await request<any>('/problems', {
      method: 'POST',
      body: payload,
    });
    return parseProblemResponse(response);
  } catch (error: any) {
    if (handleNetworkFailure(error)) {
      return mockCreateProblem(data);
    }
    throw error;
  }
}

export async function updateProblem(id: string, data: UpdateProblemRequest): Promise<Problem> {
  if (isUsingMockData()) {
    return mockUpdateProblem(id, data);
  }
  try {
    const payload: Record<string, any> = { ...data };
    if (data.examples) {
      payload.examples = JSON.stringify(data.examples);
    }
    if (data.testCases) {
      payload.testCases = JSON.stringify(data.testCases);
    }
    if (data.tags) {
      payload.tags = JSON.stringify(data.tags);
    }
    delete payload.id;
    const response = await request<any>(`/problems/${id}`, {
      method: 'PUT',
      body: payload,
    });
    return parseProblemResponse(response);
  } catch (error: any) {
    if (handleNetworkFailure(error)) {
      return mockUpdateProblem(id, data);
    }
    throw error;
  }
}

export async function deleteProblem(id: string): Promise<void> {
  if (isUsingMockData()) {
    return mockDeleteProblem(id);
  }
  try {
    return await request<void>(`/problems/${id}`, {
      method: 'DELETE',
    });
  } catch (error: any) {
    if (handleNetworkFailure(error)) {
      return mockDeleteProblem(id);
    }
    throw error;
  }
}

export function parseProblemResponse(problem: any): Problem {
  return {
    ...problem,
    examples: problem.examples ? JSON.parse(problem.examples) : [],
    testCases: problem.testCases ? JSON.parse(problem.testCases) : [],
    tags: problem.tags ? JSON.parse(problem.tags) : [],
  };
}

export function parseProblemListResponse(problems: any[]): Problem[] {
  return problems.map(parseProblemResponse);
}
