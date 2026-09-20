import { ref, computed } from 'vue'

export interface FormField {
  name: string
  label: string
  type: string
  // An option's `props` is passed through to the rendered list item, so an
  // option can disable itself and carry a subtitle explaining why. Vuetify
  // reads this key by default; it must not be flattened into the option.
  options?: { label: string; value: any; props?: Record<string, any> }[]
  required?: boolean
  disabled?: boolean
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
