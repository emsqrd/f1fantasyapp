import type { League } from '@/contracts/League';
import { useLiveRegion } from '@/hooks/useLiveRegion';
import { createLeague } from '@/services/leagueService';
import {
  type CreateLeagueFormData,
  createLeagueFormSchema,
} from '@/validations/createLeagueFormSchema';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { FormFieldInput, FormFieldSwitch, FormFieldTextarea } from '../FormField/FormField';
import { InlineError } from '../InlineError/InlineError';
import { LiveRegion } from '../LiveRegion/LiveRegion';
import { LoadingButton } from '../LoadingButton/LoadingButton';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';

interface CreateLeagueProps {
  onLeagueCreated?: (league: League) => void;
}

export function CreateLeague({ onLeagueCreated }: CreateLeagueProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { message, announce } = useLiveRegion();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateLeagueFormData>({
    resolver: zodResolver(createLeagueFormSchema),
    mode: 'onBlur',
    defaultValues: {
      leagueName: '',
      leagueDescription: '',
      leagueIsPrivate: true,
    },
  });

  const onSubmit = async (formData: CreateLeagueFormData) => {
    setError(null);
    try {
      const createdLeague = await createLeague({
        name: formData.leagueName,
        description: formData.leagueDescription,
        isPrivate: formData.leagueIsPrivate,
      });

      setIsOpen(false);
      reset();

      onLeagueCreated?.(createdLeague);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create league';
      setError(errorMessage);
      announce(errorMessage);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      reset();
      setError(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>Create League</Button>
      </DialogTrigger>
      <DialogContent>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Create League</DialogTitle>
            <DialogDescription>Enter your league details below</DialogDescription>
          </DialogHeader>
          <LiveRegion message={message} />
          {error && <InlineError message={error} />}
          <FormFieldInput
            label="League Name"
            id="leagueName"
            required
            error={errors.leagueName?.message}
            register={register('leagueName')}
            placeholder="Name your league"
          />
          <FormFieldTextarea
            label="Description"
            id="leagueDescription"
            error={errors.leagueDescription?.message}
            register={register('leagueDescription')}
            placeholder="Your league description"
          />
          <Controller
            name="leagueIsPrivate"
            control={control}
            render={({ field }) => (
              <FormFieldSwitch
                label="Private"
                id="leagueIsPrivate"
                error={errors.leagueIsPrivate?.message}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Close</Button>
            </DialogClose>
            <LoadingButton isLoading={isSubmitting} type="submit" loadingText="Creating...">
              Submit
            </LoadingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
