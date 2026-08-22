import { cn } from '@/lib/utils';
import type { AutoFill, ReactNode } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

import { PasswordInput } from '../PasswordInput/PasswordInput';
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
  autoComplete?: AutoFill;
  register: UseFormRegisterReturn; // react-hook-form register
}

interface FormFieldPasswordProps extends FormFieldProps {
  autoComplete?: AutoFill;
  register: UseFormRegisterReturn;
}

interface FormFieldTextareaProps extends FormFieldProps {
  placeholder?: string;
  register: UseFormRegisterReturn;
}

interface FormFieldSwitchProps extends FormFieldProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function describedBy(id: string, error?: string, helpText?: string) {
  const ids = [helpText && `${id}-help`, error && `${id}-error`].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}

function controlProps(id: string, error?: string, helpText?: string) {
  return {
    id,
    'aria-invalid': !!error,
    'aria-describedby': describedBy(id, error, helpText),
    className: cn(error && 'border-destructive focus-visible:border-destructive'),
  };
}

function FieldMessages({ id, error, helpText }: Pick<FormFieldProps, 'id' | 'error' | 'helpText'>) {
  return (
    <>
      {helpText && (
        <p className="text-muted-foreground text-sm" id={`${id}-help`}>
          {helpText}
        </p>
      )}
      {error && (
        <p className="text-destructive text-sm font-medium" role="alert" id={`${id}-error`}>
          {error}
        </p>
      )}
    </>
  );
}

export function FormField({ label, id, error, helpText, required, children }: FormFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className={cn(required && "after:text-destructive after:content-['*']")}>
        {label}
      </Label>
      {children}
      <FieldMessages id={id} error={error} helpText={helpText} />
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
  autoComplete,
  register,
}: FormFieldInputProps) {
  return (
    <FormField label={label} id={id} error={error} helpText={helpText} required={required}>
      <Input
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        {...controlProps(id, error, helpText)}
        {...register}
      />
    </FormField>
  );
}

export function FormFieldPassword({
  label,
  id,
  error,
  helpText,
  required,
  autoComplete,
  register,
}: FormFieldPasswordProps) {
  return (
    <FormField label={label} id={id} error={error} helpText={helpText} required={required}>
      <PasswordInput
        autoComplete={autoComplete}
        {...controlProps(id, error, helpText)}
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
      <Textarea placeholder={placeholder} {...controlProps(id, error, helpText)} {...register} />
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
          aria-describedby={describedBy(id, error, helpText)}
        />
        <Label
          htmlFor={id}
          className={cn('cursor-pointer', required && "after:text-destructive after:content-['*']")}
        >
          {label}
        </Label>
      </div>
      <FieldMessages id={id} error={error} helpText={helpText} />
    </div>
  );
}
