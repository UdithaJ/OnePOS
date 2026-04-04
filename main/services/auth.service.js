// auth.service.js
import Store from 'electron-store';

const store = new Store();

export const AuthService = {
  /**
   * Get the currently logged-in user from the store
   * @returns {object|null} user object or null if not logged in
   */
  getLoggedInUser() {
    return store.get('user') || null;
  },

  /**
   * Clear the logged-in user from the store
   */
  logout() {
    store.delete('user');
  }
};
