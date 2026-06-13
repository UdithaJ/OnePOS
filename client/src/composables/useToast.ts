import { ref } from 'vue'

export type ToastType = 'success' | 'warning' | 'error'

export interface Toast {
  message: string
  type: ToastType
  show: boolean
}

const toast = ref<Toast>({ message: '', type: 'success', show: false })

export function useToast() {
  function showToast(message: string, type: ToastType = 'success', duration = 4000) {
    toast.value = { message, type, show: true }
    setTimeout(() => {
      toast.value.show = false
    }, duration)
  }
  return {
    toast,
    showToast
  }
}

export { toast }
