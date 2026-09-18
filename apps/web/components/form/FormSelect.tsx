// import { useFieldContext } from "./hooks"
// import { FormBase, FormControlProps } from "./FormBase"
// import { ReactNode } from "react"
// import { Select, SelectContent, SelectTrigger, SelectValue } from "../ui/select"

// export function FormSelect({
//   children,
//   ...props
// }: FormControlProps & { children: ReactNode }) {
//   const field = useFieldContext<string>()
//   const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid

//   return (
//     <FormBase {...props}>
//       <Select
//         onValueChange={e => field.handleChange(e)}
//         value={field.state.value}
//       >
//         <SelectTrigger
//           aria-invalid={isInvalid}
//           id={field.name}
//           onBlur={field.handleBlur}
//         >
//           <SelectValue />
//         </SelectTrigger>
//         <SelectContent>{children}</SelectContent>
//       </Select>
//     </FormBase>
//   )
// }

import { useFieldContext } from "./hooks";
import { FormBase, FormControlProps } from "./FormBase";
import { ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

// 1. Explicitly extend your Form Control properties with optional Select interceptors
interface FormSelectProps extends FormControlProps {
  children: ReactNode;
  onValueChange?: (value: string) => void;
}

export function FormSelect({
  children,
  onValueChange, // 2. Pluck this out so it doesn't leak into FormBase via ...props
  ...props
}: FormSelectProps) {
  // Specifying the context value type explicitly
  const field = useFieldContext<string>();
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

  return (
    <FormBase {...props}>
      <Select
        // 3. Cast the parameter to string to satisfy strict type rules,
        // and safely chain your parent callback if provided.
        onValueChange={(val: string) => {
          field.handleChange(val);
          if (onValueChange) {
            onValueChange(val);
          }
        }}
        value={field.state.value ?? ""} // Fallback to empty string if state is initially undefined
      >
        <SelectTrigger
          aria-invalid={isInvalid}
          id={field.name}
          onBlur={field.handleBlur}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </FormBase>
  );
}
