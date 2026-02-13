import { apiDelete, apiGet, apiPost } from './client'

export type FollowType = 'SYMBOL' | 'TAG' | 'STRATEGY'

export type Follow = {
  id: string
  followType: FollowType
  value: string
  createdAt: string
}

export type CreateFollowPayload = {
  followType: FollowType
  value: string
}

export async function listFollows() {
  return apiGet<Follow[]>('/follows')
}

export async function createFollow(payload: CreateFollowPayload) {
  return apiPost<Follow>('/follows', payload)
}

export async function deleteFollow(id: string) {
  return apiDelete(`/follows/${id}`)
}
