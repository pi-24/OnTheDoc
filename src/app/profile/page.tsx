
"use client";

import React, { useEffect } from 'react';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserCircle, Mail, LogOut, Briefcase, Landmark, Save, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { UserProfileData, UserGrade, UKRegion } from '@/types';
import { useToast } from "@/hooks/use-toast";

const userGradeOptions: UserGrade[] = ['F1', 'F2', 'CT1', 'CT2', 'CT3+', 'ST1', 'ST2', 'ST3+', 'SpecialtyDoctor', 'Consultant', 'Other'];
const ukRegionOptions: UKRegion[] = ['London', 'SouthEast', 'SouthWest', 'EastOfEngland', 'Midlands', 'NorthEastAndYorkshire', 'NorthWest', 'Scotland', 'Wales', 'NorthernIreland', 'Other'];

const profileEditSchema = z.object({
  grade: z.enum(userGradeOptions).optional().or(z.literal('')),
  region: z.enum(ukRegionOptions).optional().or(z.literal('')),
  taxCode: z.string().optional(),
  hasStudentLoan: z.boolean().optional(),
  hasPostgraduateLoan: z.boolean().optional(),
  nhsPensionOptIn: z.boolean().optional(),
});

type ProfileEditFormValues = z.infer<typeof profileEditSchema>;

export default function ProfilePage() {
  const { user, logout, updateUserProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const { control, handleSubmit, register, formState: { errors, isSubmitting, isDirty }, reset } = useForm<ProfileEditFormValues>({
    resolver: zodResolver(profileEditSchema),
    defaultValues: {
      grade: '', 
      region: '', 
      taxCode: '',
      hasStudentLoan: false,
      hasPostgraduateLoan: false,
      nhsPensionOptIn: true,
    },
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (user) {
      reset({
        grade: user.grade || '',
        region: user.region || '',
        taxCode: user.taxCode || '',
        hasStudentLoan: user.hasStudentLoan || false,
        hasPostgraduateLoan: user.hasPostgraduateLoan || false,
        nhsPensionOptIn: user.nhsPensionOptIn === undefined ? true : user.nhsPensionOptIn,
      });
    }
  }, [user, authLoading, router, reset]);
  

  const onSubmit: SubmitHandler<ProfileEditFormValues> = async (data) => {
    if (user) {
      const profileUpdateData: Partial<UserProfileData> = {
        ...data, 
        grade: data.grade === '' ? undefined : data.grade,
        region: data.region === '' ? undefined : data.region,
      };
      try {
        await updateUserProfile(profileUpdateData);
        toast({ title: "Profile Updated", description: "Your personal details have been saved." });
        reset(data); 
      } catch (error) {
        toast({ title: "Error", description: "Failed to update profile. Please try again.", variant: "destructive" });
      }
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex justify-center py-12">
        <Card className="w-full max-w-2xl shadow-xl">
          <CardHeader className="items-center text-center">
            <Skeleton className="h-24 w-24 rounded-full" />
            <Skeleton className="h-8 w-48 mt-4" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent className="space-y-6"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></CardContent>
        </Card>
      </div>
    );
  }

  const userInitial = user.email ? user.email.charAt(0).toUpperCase() : '?';

  return (
    <div className="flex justify-center py-8">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="items-center text-center">
          <Avatar className="w-24 h-24 text-3xl mb-4">
            <AvatarImage src={`https://placehold.co/100x100.png?text=${userInitial}`} alt={user.email || 'User'} data-ai-hint="abstract letter" />
            <AvatarFallback>{userInitial}</AvatarFallback>
          </Avatar>
          <CardTitle className="text-3xl font-headline flex items-center gap-2"><UserCircle className="text-primary h-8 w-8"/>User Profile</CardTitle>
          <CardDescription>Manage your OnTheDoc account details and preferences.</CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-8 pt-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-muted-foreground flex items-center gap-2"><Mail className="h-4 w-4"/>Email</Label>
              <p id="email" className="text-lg p-3 border rounded-md bg-muted/30">{user.email}</p>
            </div>

            <section className="space-y-4 border-t pt-6">
              <h3 className="text-xl font-semibold text-primary flex items-center gap-2"><Briefcase />Professional Details</h3>
              <div>
                <Label htmlFor="grade">Grade</Label>
                <Controller name="grade" control={control} render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger id="grade"><SelectValue placeholder="Select grade" /></SelectTrigger>
                      <SelectContent>{userGradeOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select> )}
                />
                {errors.grade && <p className="text-sm text-destructive mt-1">{errors.grade.message}</p>}
              </div>
              <div>
                <Label htmlFor="region">Region of Work (UK)</Label>
                <Controller name="region" control={control} render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger id="region"><SelectValue placeholder="Select region" /></SelectTrigger>
                      <SelectContent>{ukRegionOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select> )}
                />
                 {errors.region && <p className="text-sm text-destructive mt-1">{errors.region.message}</p>}
              </div>
            </section>

            <section className="space-y-4 border-t pt-6">
              <h3 className="text-xl font-semibold text-primary flex items-center gap-2"><Landmark />Financial Details</h3>
              <div>
                <Label htmlFor="taxCode">Tax Code (Optional)</Label>
                <Input id="taxCode" {...register('taxCode')} placeholder="e.g., 1257L" />
                {errors.taxCode && <p className="text-sm text-destructive mt-1">{errors.taxCode.message}</p>}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Controller name="hasStudentLoan" control={control} render={({ field }) => (<Checkbox id="hasStudentLoan" checked={field.value} onCheckedChange={field.onChange} />)} />
                  <Label htmlFor="hasStudentLoan">Paying Student Loan?</Label>
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
            </section>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row justify-between items-center pt-6 border-t mt-8">
            <Button onClick={logout} variant="destructive" className="w-full sm:w-auto mb-4 sm:mb-0">
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
            <Button type="submit" disabled={isSubmitting || !isDirty} className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
