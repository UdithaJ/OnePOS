import { ref, computed } from 'vue'

export interface FormField {
  name: string
  label: string
  type: string
  options?: { label: string; value: any }[]
  required?: boolean
  rules?: Array<(v: any) => true | string>
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
      const val = form.value[field.name]
      if (field.required && !val) return false
      if (field.rules) {
        return field.rules.every(rule => rule(val) === true)
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
