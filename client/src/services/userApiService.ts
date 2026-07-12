import axios from 'axios'

export interface UserPayload {
  firstName: string
  lastName: string
  userName: string
  password?: string
  userRole: string
}

export interface User {
  _id: string
  firstName: string
  lastName: string
  userName: string
  userRole: string
}

const baseUrl = () => import.meta.env.VITE_API_BASE_URL || ''

export async function getAllUsers(): Promise<User[]> {
  const response = await axios.get(`${baseUrl()}/api/users`)
  return response.data
}

export interface PaginationParams {
  page: number
  limit: number
  sort?: string
  order?: 'asc' | 'desc'
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export async function getUsersPaginated(params: PaginationParams): Promise<Paginated<User>> {
  const response = await axios.get(`${baseUrl()}/api/users/paginated`, { params })
  return response.data
}

export async function getUserById(id: string): Promise<User> {
  const response = await axios.get(`${baseUrl()}/api/users/${id}`)
  return response.data
}

export async function createUser(payload: UserPayload): Promise<User> {
  const response = await axios.post(`${baseUrl()}/api/users`, payload)
  return response.data
}

export async function updateUser(id: string, payload: Partial<UserPayload>): Promise<User> {
  const response = await axios.put(`${baseUrl()}/api/users/${id}`, payload)
  return response.data
}

export async function deleteUser(id: string): Promise<void> {
  await axios.delete(`${baseUrl()}/api/users/${id}`)
}
