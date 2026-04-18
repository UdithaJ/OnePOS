import axios from 'axios'

export interface LoginPayload {
  userName: string
  password: string
}

export interface LoginResponse {
  token: string
  user: {
    _id: string
    username: string
    [key: string]: any
  }
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  const response = await axios.post(`${baseUrl}/api/auth/login`, payload)
  return response.data
}
