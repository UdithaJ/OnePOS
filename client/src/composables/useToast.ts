import { ref } from 'vue'

export type ToastType = 'success' | 'warning' | 'error'

export interface Toast {
  message: string
  type: ToastType
  show: boolean
}

const toast = ref<Toast>({ message: '', type: 'success', show: false })

import { computed } from 'vue'

export const toastStyle = computed(() => ({
  position: 'fixed',
  top: '24px',
  right: '24px',
  zIndex: 9999,
  minWidth: '200px',
  padding: '16px',
  borderRadius: '8px',
  color: '#fff',
  fontWeight: 'bold',
  background: toast.value.type === 'success' ? '#43a047' : toast.value.type === 'warning' ? '#ffa000' : '#e53935',
  boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
}))

export function useToast() {
  function showToast(message: string, type: ToastType = 'success', duration = 3000) {
    toast.value = { message, type, show: true }
    setTimeout(() => {
      toast.value.show = false
    }, duration)
  }
  return {
    toast,
    showToast,
    toastStyle
  }
}
