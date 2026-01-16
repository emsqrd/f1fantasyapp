import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';

interface FormFieldProps {
  label: string;
  id: string;
  error?: string;
  helpText?: string;
  required?: boolean;
  children?: ReactNode;
}

interface FormFieldInputProps extends FormFieldProps {
  type?: string;
  placeholder?: string;
  register: UseFormRegisterReturn; // react-hook-form register
}

interface FormFieldTextareaProps extends FormFieldProps {
  placeholder?: string;
  register: UseFormRegisterReturn;
}

interface FormFieldSwitchProps extends FormFieldProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function FormField({ label, id, error, helpText, required, children }: FormFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className={cn(required && "after:text-destructive after:content-['*']")}>
        {label}
      </Label>
      {children}
      {error && (
        <p
          className="text-destructive text-sm font-medium"
          role="alert"
          aria-describedby={`${id}-error`}
        >
          {error}
        </p>
      )}
      {helpText && !error && (
        <p className="text-muted-foreground text-sm" id={`${id}-help`}>
          {helpText}
        </p>
      )}
    </div>
  );
}

export function FormFieldInput({
  label,
  id,
  error,
  helpText,
  required,
  type = 'text',
  placeholder,
  register,
}: FormFieldInputProps) {
  return (
    <FormField label={label} id={id} error={error} helpText={helpText} required={required}>
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : helpText ? `${id}-help` : undefined}
        className={cn(error && 'border-destructive focus-visible:border-destructive')}
        {...register}
      />
    </FormField>
  );
}

export function FormFieldTextarea({
  label,
  id,
  error,
  helpText,
  required,
  placeholder,
  register,
}: FormFieldTextareaProps) {
  return (
    <FormField label={label} id={id} error={error} helpText={helpText} required={required}>
      <Textarea
        id={id}
        placeholder={placeholder}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : helpText ? `${id}-help` : undefined}
        className={cn(error && 'border-destructive focus-visible:border-destructive')}
        {...register}
      />
    </FormField>
  );
}

export function FormFieldSwitch({
  label,
  id,
  error,
  helpText,
  required,
  checked,
  onCheckedChange,
}: FormFieldSwitchProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <Switch
          className="cursor-pointer"
          id={id}
          checked={checked}
          onCheckedChange={onCheckedChange}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : helpText ? `${id}-help` : undefined}
        />
        <Label
          htmlFor={id}
          className={cn('cursor-pointer', required && "after:text-destructive after:content-['*']")}
        >
          {label}
        </Label>
      </div>
      {error && (
        <p
          className="text-destructive text-sm font-medium"
          role="alert"
          aria-describedby={`${id}-error`}
        >
          {error}
        </p>
      )}
      {helpText && !error && (
        <p className="text-muted-foreground text-sm" id={`${id}-help`}>
          {helpText}
        </p>
      )}
    </div>
  );
}
