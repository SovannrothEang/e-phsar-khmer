import { InputGroup } from "../ui/input-group"
import { Input } from "../ui/input" // Make sure to import your standard Input component
import { FormBase, FormControlProps } from "./FormBase"
import { useFieldContext } from "./hooks"

interface FormInputGroupProps extends FormControlProps {
  type?: string
  placeholder?: string
  children?: React.ReactNode // For buttons or trailing elements inside the group
}

export function FormInputGroup({ type = "text", placeholder, children, ...props }: FormInputGroupProps) {
  const field = useFieldContext<string>()
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid

  return (
    <FormBase {...props}>
      {/* 1. InputGroup manages the border, layout framework, and side-elements */}
      <InputGroup>
        
        {/* 2. The native/shadcn Input field maps the actual raw data values */}
        <Input
          id={field.name}
          type={type}
          name={field.name}
          placeholder={placeholder}
          value={field.state.value || ""} // Fallback cleanly to string
          onBlur={field.handleBlur}
          onChange={e => field.handleChange(e.target.value)}
          aria-invalid={isInvalid}
          className="border-0 focus-visible:ring-0" // Optional clean look inside groups
        />
        
        {/* 3. Render icons, clear buttons, or tags alongside your input */}
        {children}
      </InputGroup>
    </FormBase>
  )
}