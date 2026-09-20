import { ref } from 'vue'
import { getUserById } from '@/services/userApiService'

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

  // The signed-in user is kept in localStorage and there is no token or server
  // session, so nothing otherwise notices when the account behind it is deleted
  // or its role changed — it would stay signed in indefinitely, with whatever
  // role was cached at login. Checking once at startup closes that.
  //
  // Returns false when the session is no longer valid. A network or server
  // error leaves the session alone: being unable to reach the API is not
  // evidence that the account is gone, and signing people out when the backend
  // hiccups would be worse than the problem.
  async function revalidate(): Promise<boolean> {
    const cached = currentUser.value
    if (!cached?._id) return true

    try {
      const fresh = await getUserById(cached._id)
      if (!fresh?._id) {
        logout()
        return false
      }
      // Pick up a rename or a role change made since this session started.
      setUser({
        _id: fresh._id,
        userName: fresh.userName,
        firstName: fresh.firstName,
        lastName: fresh.lastName,
        userRole: fresh.userRole,
      })
      return true
    } catch (err: any) {
      if (err?.response?.status === 404) {
        logout()
        return false
      }
      return true
    }
  }

  return {
    currentUser,
    setUser,
    getUser,
    isLoggedIn,
    logout,
    revalidate,
  }
}
