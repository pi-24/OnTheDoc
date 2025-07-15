
"use client";

import React, { useState, useEffect } from 'react';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { UserProfileData, UserGrade, UKRegion } from '@/types';
import { Save, User, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

const userGradeOptions: UserGrade[] = ['F1', 'F2', 'CT1', 'CT2', 'CT3+', 'ST1', 'ST2', 'ST3+', 'SpecialtyDoctor', 'Consultant', 'Other'];
const ukRegionOptions: UKRegion[] = ['London', 'SouthEast', 'SouthWest', 'EastOfEngland', 'Midlands', 'NorthEastAndYorkshire', 'NorthWest', 'Scotland', 'Wales', 'NorthernIreland', 'Other'];

const profileSetupSchema = z.object({
  grade: z.enum(userGradeOptions, { required_error: "Grade is required" }),
  region: z.enum(ukRegionOptions, { required_error: "Region is required" }),
  taxCode: z.string().optional(),
  hasStudentLoan: z.boolean().optional(),
  hasPostgraduateLoan: z.boolean().optional(),
  nhsPensionOptIn: z.boolean().optional(),
});

type ProfileSetupFormValues = z.infer<typeof profileSetupSchema>;

export default function ProfileSetupPage() {
  const { user, updateUserProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const { control, handleSubmit, register, formState: { errors, isSubmitting }, reset } = useForm<ProfileSetupFormValues>({
    resolver: zodResolver(profileSetupSchema),
    defaultValues: {
      grade: undefined,
      region: undefined,
      taxCode: '',
      hasStudentLoan: false,
      hasPostgraduateLoan: false,
      nhsPensionOptIn: true,
    },
  });

  useEffect(() => {
    if (user && !authLoading) {
      if (user.isProfileComplete) {
        router.push('/');
        return;
      }
      reset({
        grade: user.grade || undefined,
        region: user.region || undefined,
        taxCode: user.taxCode || '',
        hasStudentLoan: user.hasStudentLoan || false,
        hasPostgraduateLoan: user.hasPostgraduateLoan || false,
        nhsPensionOptIn: user.nhsPensionOptIn === undefined ? true : user.nhsPensionOptIn,
      });
    }
  }, [user, authLoading, reset, router]);

  const onSubmit: SubmitHandler<ProfileSetupFormValues> = async (data) => {
    const profileData: Partial<UserProfileData> = {
      ...data,
      isProfileComplete: true,
    };
    try {
      await updateUserProfile(profileData);
      toast({ title: "Profile Setup Complete!", description: "You will now be redirected to the dashboard." });
      router.push('/'); 
    } catch(error) {
       toast({ title: "Error", description: "Could not save your profile. Please try again.", variant: "destructive" });
    }
  };
  
  if (authLoading || !user) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card className="max-w-xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl font-headline text-primary flex items-center gap-2"><User className="h-7 w-7"/>Complete Your Profile</CardTitle>
          <CardDescription>Please provide some details about yourself to get started with OnTheDoc.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-6 pt-6">
              <div>
                <Label htmlFor="grade">Grade</Label>
                <Controller
                  name="grade"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value || ''} >
                      <SelectTrigger id="grade"><SelectValue placeholder="Select your grade" /></SelectTrigger>
                      <SelectContent>
                        {userGradeOptions.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.grade && <p className="text-sm text-destructive mt-1">{errors.grade.message}</p>}
              </div>
              <div>
                <Label htmlFor="region">Region of Work (UK)</Label>
                  <Controller
                  name="region"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <SelectTrigger id="region"><SelectValue placeholder="Select your region" /></SelectTrigger>
                      <SelectContent>
                        {ukRegionOptions.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.region && <p className="text-sm text-destructive mt-1">{errors.region.message}</p>}
              </div>
              <div>
                <Label htmlFor="taxCode">Tax Code (Optional)</Label>
                <Input id="taxCode" {...register('taxCode')} placeholder="e.g., 1257L" />
                {errors.taxCode && <p className="text-sm text-destructive mt-1">{errors.taxCode.message}</p>}
              </div>
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2">
                  <Controller name="hasStudentLoan" control={control} render={({ field }) => (<Checkbox id="hasStudentLoan" checked={field.value} onCheckedChange={field.onChange} />)} />
                  <Label htmlFor="hasStudentLoan">Paying Student Loan (Plan 1, 2, 4, or 5)?</Label>
                </div>
                <div className="flex items-center gap-2">
                    <Controller name="hasPostgraduateLoan" control={control} render={({ field }) => (<Checkbox id="hasPostgraduateLoan" checked={field.value} onCheckedChange={field.onChange} />)} />
                  <Label htmlFor="hasPostgraduateLoan">Paying Postgraduate Loan?</Label>
                </div>
                  <div className="flex items-center gap-2">
                    <Controller name="nhsPensionOptIn" control={control} render={({ field }) => (<Checkbox id="nhsPensionOptIn" checked={field.value} onCheckedChange={field.onChange} />)} />
                  <Label htmlFor="nhsPensionOptIn">Opted-in to NHS Pension?</Label>
                </div>
              </div>
          </CardContent>
          <CardFooter className="flex justify-end pt-6 border-t">
            <Button type="submit" disabled={isSubmitting} className="bg-accent hover:bg-accent/90 text-accent-foreground">
             {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
             {isSubmitting ? 'Saving...' : 'Save and Continue'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
