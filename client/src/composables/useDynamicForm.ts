import { ref, computed } from 'vue'

export interface FormField {
  name: string
  label: string
  type: string
  options?: { label: string; value: any }[]
  required?: boolean
}

export interface FormSchema {
  fields: FormField[]
}

export function useDynamicForm(schema: FormSchema) {
  const form = ref<Record<string, any>>({})

  // Initialize form fields
  schema.fields.forEach(field => {
    form.value[field.name] = ''
  })

  const isValid = computed(() => {
    return schema.fields.every(field => {
      if (field.required) {
        return form.value[field.name] !== ''
      }
      return true
    })
  })

  return {
    form,
    schema,
    isValid,
  }
}
