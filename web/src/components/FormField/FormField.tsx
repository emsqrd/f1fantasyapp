import { cn } from '@/lib/utils';
import { Eye, EyeOff } from 'lucide-react';
import { type AutoFill, type ReactNode, useState } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';

interface FormFieldBaseProps {
  label: string;
  id: string;
  error?: string;
  helpText?: string;
  required?: boolean;
}

interface FormFieldProps extends FormFieldBaseProps {
  labelAction?: ReactNode;
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

interface FormFieldSwitchProps extends FormFieldBaseProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function describedBy(id: string, error?: string, helpText?: string) {
  const ids = [helpText && `${id}-help`, error && `${id}-error`].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}

function controlProps(id: string, error?: string, helpText?: string, className?: string) {
  return {
    id,
    'aria-invalid': !!error,
    'aria-describedby': describedBy(id, error, helpText),
    className: cn(className, error && 'border-destructive focus-visible:border-destructive'),
  };
}

function FieldMessages({
  id,
  error,
  helpText,
}: Pick<FormFieldBaseProps, 'id' | 'error' | 'helpText'>) {
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

export function FormField({
  label,
  id,
  error,
  helpText,
  required,
  labelAction,
  children,
}: FormFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label
          htmlFor={id}
          className={cn(required && "after:text-destructive after:content-['*']")}
        >
          {label}
        </Label>
        {labelAction}
      </div>
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
  labelAction,
  type = 'text',
  placeholder,
  autoComplete,
  register,
}: FormFieldInputProps) {
  return (
    <FormField
      label={label}
      id={id}
      error={error}
      helpText={helpText}
      required={required}
      labelAction={labelAction}
    >
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
  labelAction,
  autoComplete,
  register,
}: FormFieldPasswordProps) {
  const [visible, setVisible] = useState(false);
  const ToggleIcon = visible ? EyeOff : Eye;

  return (
    <FormField
      label={label}
      id={id}
      error={error}
      helpText={helpText}
      required={required}
      labelAction={labelAction}
    >
      <div className="relative">
        <Input
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          {...controlProps(id, error, helpText, 'pr-9')}
          {...register}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Show password"
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
          className="text-muted-foreground hover:text-foreground absolute top-0 right-0 hover:bg-transparent"
        >
          <ToggleIcon className="h-4 w-4" />
        </Button>
      </div>
    </FormField>
  );
}

export function FormFieldTextarea({
  label,
  id,
  error,
  helpText,
  required,
  labelAction,
  placeholder,
  register,
}: FormFieldTextareaProps) {
  return (
    <FormField
      label={label}
      id={id}
      error={error}
      helpText={helpText}
      required={required}
      labelAction={labelAction}
    >
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
