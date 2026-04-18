import { ref } from 'vue'

const USER_KEY = 'onepos_user'

const currentUser = ref<Record<string, any> | null>(loadUserFromCache())

function loadUserFromCache() {
  try {
    const stored = localStorage.getItem(USER_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

export function useAuth() {
  function setUser(user: Record<string, any>) {
    currentUser.value = user
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  }

  function getUser() {
    return currentUser.value
  }

  function isLoggedIn() {
    return !!currentUser.value
  }

  function logout() {
    currentUser.value = null
    localStorage.removeItem(USER_KEY)
  }

  return {
    currentUser,
    setUser,
    getUser,
    isLoggedIn,
    logout,
  }
}
