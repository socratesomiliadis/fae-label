import {
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  type ReactNode,
} from "react";

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const generatedId = useId();
  const control = isValidElement<{ id?: string }>(children) ? children : null;
  const id = control?.props.id ?? generatedId;
  return (
    <div className="mb-4 flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {control
        ? cloneElement(control as ReactElement<{ id?: string }>, { id })
        : children}
    </div>
  );
}
