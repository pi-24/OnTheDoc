
"use client";

import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray, Controller, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { RotaDocument, ShiftDefinition as ShiftDefinitionType, RotaSpecificScheduleMetadata, RotaGridInput } from '@/types';
import { PlusCircle, Trash2, Save, ArrowRight, Settings2, Briefcase, CalendarDays, FileText } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';

const calculateShiftDurationString = (startTimeStr: string, finishTimeStr: string): string => {
    if (!startTimeStr || !finishTimeStr) return "0h 0m";
    let [startH, startM] = startTimeStr.split(':').map(Number);
    let [finishH, finishM] = finishTimeStr.split(':').map(Number);
    if (isNaN(startH) || isNaN(startM) || isNaN(finishH) || isNaN(finishM)) return "Invalid";
    if (finishTimeStr === "24:00") { finishH = 24; finishM = 0; }
    let startTotalMinutes = startH * 60 + startM;
    let finishTotalMinutes = finishH * 60 + finishM;
    if (finishTotalMinutes < startTotalMinutes) { finishTotalMinutes += 24 * 60; }
    else if (finishTotalMinutes === startTotalMinutes && startTimeStr !== finishTimeStr) {
         if (startTimeStr !== "00:00" || finishTimeStr !== "00:00") { finishTotalMinutes += 24 * 60; }
    }
    let durationMinutes = finishTotalMinutes - startTotalMinutes;
    if (durationMinutes < 0) durationMinutes = 0;
    const durationH = Math.floor(durationMinutes / 60);
    const durationM = durationMinutes % 60;
    return `${durationH}h ${durationM}m`;
};

const shiftDefinitionSchema = z.object({
  id: z.string(),
  dutyCode: z.string().min(1, 'Duty Code required').regex(/^[a-zA-Z0-9]+$/, 'Alphanumeric only'),
  name: z.string().min(1, 'Name required'),
  type: z.enum(['normal', 'on-call']),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Start HH:MM'),
  finishTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$|^24:00$/, 'Finish HH:MM or 24:00'),
  durationStr: z.string(),
});

const rotaSpecificScheduleMetadataSchema = z.object({
  name: z.string().min(1, "Rota name is required"),
  site: z.string().min(1, "Site is required"),
  specialty: z.string().min(1, "Specialty is required"),
  scheduleStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date YYYY-MM-DD'),
  scheduleTotalWeeks: z.number().min(1, "Min 1 week").max(52, "Max 52 weeks"),
  wtrOptOut: z.boolean(),
  annualLeaveEntitlement: z.number().min(0, "Min 0 days"),
  hoursInNormalDay: z.number().min(1, "Min 1 hour").max(24, "Max 24 hours"),
}).refine(data => new Date(data.endDate) >= new Date(data.scheduleStartDate), {
    message: "End date must be after or the same as start date",
    path: ["endDate"],
});

const rotaGridSchema = z.record(z.string());

const uploadRotaSchema = z.object({
  scheduleMeta: rotaSpecificScheduleMetadataSchema,
  shiftDefinitions: z.array(shiftDefinitionSchema).min(1, 'At least one shift definition is required')
    .refine(items => new Set(items.map(item => item.dutyCode)).size === items.length, {
      message: 'Duty Codes must be unique',
      path: ['shiftDefinitions']
    }),
  rotaGrid: rotaGridSchema.optional(),
});

type UploadRotaFormValues = z.infer<typeof uploadRotaSchema>;

const daysOfWeekGrid = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function UploadRotaPage() {
  const { user, addRotaDocument, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);

  const { control, handleSubmit, register, formState: { errors, isSubmitting }, watch, setValue, trigger } = useForm<UploadRotaFormValues>({
    resolver: zodResolver(uploadRotaSchema),
    defaultValues: {
      scheduleMeta: {
        name: '',
        site: '',
        specialty: '',
        scheduleStartDate: new Date().toISOString().split('T')[0],
        endDate: new Date(new Date().setDate(new Date().getDate() + 28)).toISOString().split('T')[0], // Default to 4 weeks later
        scheduleTotalWeeks: 4, 
        wtrOptOut: false,
        annualLeaveEntitlement: 27,
        hoursInNormalDay: 8,
      },
      shiftDefinitions: [{ id: crypto.randomUUID(), dutyCode: 'S1', name: 'Standard Day', type: 'normal', startTime: '09:00', finishTime: '17:00', durationStr: '8h 0m' }],
      rotaGrid: {},
    },
  });

  const { fields: shiftDefFields, append: appendShiftDef, remove: removeShiftDef } = useFieldArray({
    control,
    name: 'shiftDefinitions',
  });

  const watchedShiftDefinitions = watch('shiftDefinitions');
  const watchedScheduleMeta = watch('scheduleMeta');

  useEffect(() => {
    watchedShiftDefinitions.forEach((def, index) => {
      if (def) { // Check if def is defined
        const newDuration = calculateShiftDurationString(def.startTime, def.finishTime);
        if (def.durationStr !== newDuration) {
          setValue(`shiftDefinitions.${index}.durationStr`, newDuration, { shouldValidate: false, shouldDirty: false });
        }
      }
    });
  }, [watchedShiftDefinitions, setValue]);

  useEffect(() => {
    if (watchedScheduleMeta?.scheduleStartDate && watchedScheduleMeta?.endDate) {
      const start = new Date(watchedScheduleMeta.scheduleStartDate);
      const end = new Date(watchedScheduleMeta.endDate);
      if (end >= start) {
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) +1; // +1 to include start day
        const diffWeeks = Math.ceil(diffDays / 7);
        if (watchedScheduleMeta.scheduleTotalWeeks !== diffWeeks) {
          setValue('scheduleMeta.scheduleTotalWeeks', diffWeeks > 0 ? diffWeeks : 1, { shouldValidate: true });
        }
      } else {
         setValue('scheduleMeta.scheduleTotalWeeks', 1, { shouldValidate: true });
      }
    }
  }, [watchedScheduleMeta?.scheduleStartDate, watchedScheduleMeta?.endDate, setValue, watchedScheduleMeta?.scheduleTotalWeeks]);


  const onSubmit: SubmitHandler<UploadRotaFormValues> = (data) => {
    if (!user) {
        toast({ title: "Error", description: "User not found. Please log in.", variant: "destructive"});
        router.push('/login');
        return;
    }
    const newRotaDocument: RotaDocument = {
      id: crypto.randomUUID(),
      name: data.scheduleMeta.name,
      scheduleMeta: data.scheduleMeta,
      shiftDefinitions: data.shiftDefinitions,
      rotaGrid: data.rotaGrid || {},
      createdAt: new Date().toISOString(),
    };
    addRotaDocument(newRotaDocument);
    toast({ title: "Rota Uploaded!", description: `${data.scheduleMeta.name} has been saved.` });
    router.push('/'); 
  };
  
  const addShiftDefinition = () => {
    appendShiftDef({ id: crypto.randomUUID(), dutyCode: `S${shiftDefFields.length + 1}`, name: '', type: 'normal', startTime: '09:00', finishTime: '17:00', durationStr: '8h 0m' });
  };

  const validateStep = async (step: number) => {
    let fieldsToValidate: (keyof UploadRotaFormValues | `scheduleMeta.${keyof RotaSpecificScheduleMetadata}` | `shiftDefinitions.${number}.${keyof ShiftDefinitionType}` )[] = [];
    if (step === 1) fieldsToValidate = ['scheduleMeta'];
    if (step === 2) fieldsToValidate = ['shiftDefinitions'];
    if (step === 3) fieldsToValidate = ['rotaGrid' as any]; // rotaGrid itself is optional, but individual cells can be considered
    
    const isValid = await trigger(fieldsToValidate as any); 
    return isValid;
  }

  const nextStep = async () => {
    const isValid = await validateStep(currentStep);
    if (isValid) {
        if (currentStep < 3) setCurrentStep(currentStep + 1);
    } else {
        toast({ variant: "destructive", title: "Validation Error", description: "Please correct the errors in the current step before proceeding."});
    }
  };
  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  if (authLoading || !user) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }
  if (!user.isProfileComplete) {
    toast({title: "Profile Incomplete", description: "Please complete your initial profile setup first.", variant: "destructive"});
    router.push('/profile/setup');
    return <div className="flex justify-center items-center min-h-screen">Redirecting to profile setup...</div>;
  }


  return (
    <div className="container mx-auto py-8 px-4">
      <Card className="max-w-3xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl font-headline text-primary flex items-center gap-2"><FileText className="h-7 w-7"/>Upload New Rota</CardTitle>
          <CardDescription>Fill in the details for your new rota. ({`Step ${currentStep} of 3`})</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-8">
            <Accordion type="single" collapsible value={`step-${currentStep}`} className="w-full">
              <AccordionItem value="step-1">
                <AccordionTrigger onClick={() => setCurrentStep(1)} className="text-xl font-medium">
                  <Settings2 className="mr-2"/> Rota Configuration
                </AccordionTrigger>
                <AccordionContent className="pt-4 space-y-4">
                  <div>
                    <Label htmlFor="scheduleMeta.name">Rota Name</Label>
                    <Input id="scheduleMeta.name" {...register('scheduleMeta.name')} placeholder="e.g., ST3 General Surgery Aug-Oct" />
                    {errors.scheduleMeta?.name && <p className="text-sm text-destructive mt-1">{errors.scheduleMeta.name.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="scheduleMeta.site">Hospital/Site</Label>
                    <Input id="scheduleMeta.site" {...register('scheduleMeta.site')} placeholder="e.g., City General Hospital" />
                    {errors.scheduleMeta?.site && <p className="text-sm text-destructive mt-1">{errors.scheduleMeta.site.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="scheduleMeta.specialty">Specialty</Label>
                    <Input id="scheduleMeta.specialty" {...register('scheduleMeta.specialty')} placeholder="e.g., General Surgery" />
                    {errors.scheduleMeta?.specialty && <p className="text-sm text-destructive mt-1">{errors.scheduleMeta.specialty.message}</p>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="scheduleMeta.scheduleStartDate">Rota Start Date</Label>
                      <Input type="date" id="scheduleMeta.scheduleStartDate" {...register('scheduleMeta.scheduleStartDate')} />
                      {errors.scheduleMeta?.scheduleStartDate && <p className="text-sm text-destructive mt-1">{errors.scheduleMeta.scheduleStartDate.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="scheduleMeta.endDate">Rota End Date</Label>
                      <Input type="date" id="scheduleMeta.endDate" {...register('scheduleMeta.endDate')} />
                      {errors.scheduleMeta?.endDate && <p className="text-sm text-destructive mt-1">{errors.scheduleMeta.endDate.message}</p>}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="scheduleMeta.scheduleTotalWeeks" className="text-muted-foreground">Number of Weeks in Rota Cycle (auto-calculated from dates)</Label>
                    <Input type="number" id="scheduleMeta.scheduleTotalWeeks" {...register('scheduleMeta.scheduleTotalWeeks', { valueAsNumber: true })} min="1" max="52" readOnly className="bg-muted/50"/>
                    {errors.scheduleMeta?.scheduleTotalWeeks && <p className="text-sm text-destructive mt-1">{errors.scheduleMeta.scheduleTotalWeeks.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="scheduleMeta.annualLeaveEntitlement">Annual Leave Entitlement (days per year)</Label>
                    <Input type="number" id="scheduleMeta.annualLeaveEntitlement" {...register('scheduleMeta.annualLeaveEntitlement', { valueAsNumber: true })} min="0"/>
                    {errors.scheduleMeta?.annualLeaveEntitlement && <p className="text-sm text-destructive mt-1">{errors.scheduleMeta.annualLeaveEntitlement.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="scheduleMeta.hoursInNormalDay">Hours in a Normal Working Day (for leave calc)</Label>
                    <Input type="number" id="scheduleMeta.hoursInNormalDay" {...register('scheduleMeta.hoursInNormalDay', { valueAsNumber: true })} min="1" max="24" step="0.1"/>
                    {errors.scheduleMeta?.hoursInNormalDay && <p className="text-sm text-destructive mt-1">{errors.scheduleMeta.hoursInNormalDay.message}</p>}
                  </div>
                  <div className="flex items-center space-x-2 pt-2">
                    <Controller name="scheduleMeta.wtrOptOut" control={control} render={({ field }) => (<Checkbox id="scheduleMeta.wtrOptOut" checked={!!field.value} onCheckedChange={field.onChange} />)} />
                    <Label htmlFor="scheduleMeta.wtrOptOut">WTR 48-hour average opt-out agreed for this rota?</Label>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="step-2">
                <AccordionTrigger onClick={() => setCurrentStep(2)} className="text-xl font-medium">
                    <Briefcase className="mr-2"/> Shift Definitions
                </AccordionTrigger>
                <AccordionContent className="pt-4 space-y-4">
                  {errors.shiftDefinitions && typeof errors.shiftDefinitions.message === 'string' && (
                      <p className="text-sm text-destructive mb-2">{errors.shiftDefinitions.message}</p>
                  )}
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="min-w-full">
                        <thead className="bg-muted/50">
                            <tr>{['Duty Code', 'Name', 'Type', 'Start Time', 'Finish Time', 'Duration', 'Actions'].map(h=><th key={h} className="px-3 py-2 text-left text-xs font-medium">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          {shiftDefFields.map((field, index) => (
                            <tr key={field.id}>
                              <td><Input {...register(`shiftDefinitions.${index}.dutyCode`)} placeholder="S1" className="w-20"/></td>
                              <td><Input {...register(`shiftDefinitions.${index}.name`)} placeholder="Day Shift" className="w-36"/></td>
                              <td>
                                <Controller name={`shiftDefinitions.${index}.type`} control={control} render={({ field: cf }) => (
                                  <Select onValueChange={cf.onChange} value={cf.value}>
                                    <SelectTrigger className="w-28"><SelectValue/></SelectTrigger>
                                    <SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="on-call">On-Call</SelectItem></SelectContent>
                                  </Select> )}
                                />
                              </td>
                              <td><Input type="time" {...register(`shiftDefinitions.${index}.startTime`)} className="w-28"/></td>
                              <td><Input type="text" {...register(`shiftDefinitions.${index}.finishTime`)} placeholder="HH:MM or 24:00" className="w-32"/></td>
                              <td className="text-sm pl-2">{watch(`shiftDefinitions.${index}.durationStr`)}</td>
                              <td>{shiftDefFields.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={()=>removeShiftDef(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button>}</td>
                            </tr>
                          ))}
                        </tbody>
                    </table>
                  </div>
                  {errors.shiftDefinitions?.root && <p className="text-sm text-destructive mt-1">{errors.shiftDefinitions.root.message}</p>}
                  {Array.isArray(errors.shiftDefinitions) && errors.shiftDefinitions.map((err, i) => (
                    Object.values(err || {}).map((fieldError: any) => fieldError && <p key={`${i}-${fieldError.message}`} className="text-sm text-destructive mt-1">{fieldError.message}</p>)
                  ))}
                  <Button type="button" variant="outline" onClick={addShiftDefinition}><PlusCircle className="mr-2 h-4 w-4" /> Add Shift Type</Button>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="step-3">
                <AccordionTrigger onClick={() => setCurrentStep(3)} className="text-xl font-medium">
                    <CalendarDays className="mr-2"/> Input Rota Schedule
                </AccordionTrigger>
                <AccordionContent className="pt-4 space-y-4">
                    {(watchedShiftDefinitions.length === 0 || watchedShiftDefinitions.every(d => !d.dutyCode)) ? (
                        <p className="text-amber-500">Please define shift types with Duty Codes in Step 2 before inputting the rota.</p>
                    ) : (
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="min-w-full divide-y divide-border border border-border">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="px-2 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Week</th>
                                        {daysOfWeekGrid.map(day => <th key={day} className="px-2 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">{day}</th>)}
                                    </tr>
                                </thead>
                                <tbody className="bg-card divide-y divide-border">
                                    {Array.from({ length: watchedScheduleMeta?.scheduleTotalWeeks || 0 }, (_, weekIndex) => (
                                        <tr key={weekIndex}>
                                            <td className="px-2 py-2 whitespace-nowrap text-sm font-medium text-foreground">Week {weekIndex + 1}</td>
                                            {daysOfWeekGrid.map((_, dayIndex) => (
                                                <td key={dayIndex} className="px-1 py-1 whitespace-nowrap text-center">
                                                    <Controller
                                                        name={`rotaGrid.week_${weekIndex}_day_${dayIndex}`}
                                                        control={control}
                                                        defaultValue=""
                                                        render={({ field }) => (
                                                            <Select onValueChange={field.onChange} value={field.value || ""}>
                                                                <SelectTrigger className="w-full min-w-[100px] sm:min-w-[120px] h-9 text-xs">
                                                                    <SelectValue placeholder="OFF" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="">OFF</SelectItem>
                                                                    {watchedShiftDefinitions.filter(d => d.dutyCode).map(def => (
                                                                        <SelectItem key={def.id} value={def.dutyCode}>
                                                                            {def.dutyCode} - {def.name.substring(0,12)}{def.name.length > 12 ? '...' : ''}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        )}
                                                    />
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {errors.rotaGrid && <p className="text-sm text-destructive mt-1">{typeof errors.rotaGrid.message === 'string' ? errors.rotaGrid.message : 'Error in rota grid.'}</p>}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
          <CardFooter className="flex justify-between pt-6 border-t">
            <Button type="button" variant="outline" onClick={() => router.push('/')}>Cancel</Button>
            {currentStep > 1 && <Button type="button" variant="outline" onClick={prevStep}>Previous</Button>}
            {currentStep < 3 && <Button type="button" onClick={nextStep} className="ml-auto">Next <ArrowRight className="ml-2 h-4 w-4"/></Button>}
            {currentStep === 3 && <Button type="submit" disabled={isSubmitting} className="ml-auto bg-accent hover:bg-accent/90 text-accent-foreground"><Save className="mr-2 h-4 w-4" /> Save Rota</Button>}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
