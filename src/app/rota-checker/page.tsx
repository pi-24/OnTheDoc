"use client";

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';

import RotaInputForm from '@/components/rota/RotaInputForm';
import ComplianceReport from '@/components/rota/ComplianceReport';
import type { ProcessedRotaResult, RotaProcessingInput, RotaDocument } from '@/types';
import { processRota } from '@/app/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2, Info, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

function RotaCheckerContent() {
  const { user, loading: authLoading, updateRotaDocument } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [rotaToDisplay, setRotaToDisplay] = useState<RotaDocument | null>(null);
  const [rotaResult, setRotaResult] = useState<ProcessedRotaResult | { error: string; fieldErrors?: any[] } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const performRotaProcessingAndUpdateState = useCallback(async (currentRotaDoc: RotaDocument) => {
    setIsProcessing(true);
    const processingInput: RotaProcessingInput = {
        scheduleMeta: currentRotaDoc.scheduleMeta,
        shiftDefinitions: currentRotaDoc.shiftDefinitions,
        rotaGrid: currentRotaDoc.rotaGrid
    };
    const result = await processRota(processingInput);
    setRotaResult(result);
    setIsProcessing(false);

    if ('error' in result) {
        toast({ title: "Processing Error", description: result.error, variant: "destructive" });
        setRotaToDisplay(currentRotaDoc);
    } else {
        if (currentRotaDoc.complianceSummary !== result.complianceSummary) {
            const updatedDocWithStatus: RotaDocument = {
                ...currentRotaDoc,
                complianceSummary: result.complianceSummary,
            };
            updateRotaDocument(updatedDocWithStatus);
            setRotaToDisplay(updatedDocWithStatus); 
        } else {
            setRotaToDisplay(currentRotaDoc);
        }
    }
  }, [toast, updateRotaDocument]);


  useEffect(() => {
    if (authLoading || !user) return;

    const rotaId = searchParams.get('rotaId');
    if (!rotaId) {
      if (user.rotas && user.rotas.length > 0) {
         setRotaToDisplay(null);
         setRotaResult({error: "No rota selected. Please select a rota from the dashboard."});
      } else {
        setRotaToDisplay(null);
        setRotaResult({error: "No rotas available. Please upload a rota first."});
      }
      return;
    }

    const foundRota = user.rotas?.find(r => r.id === rotaId);
    if (foundRota) {
      if (rotaToDisplay?.id !== foundRota.id || !rotaResult) { 
        setRotaToDisplay(foundRota);
        performRotaProcessingAndUpdateState(foundRota);
      }
    } else {
      setRotaToDisplay(null);
      setRotaResult({error: `Rota with ID "${rotaId}" not found.`});
      toast({ title: "Error", description: `Rota with ID "${rotaId}" not found.`, variant: "destructive"});
    }
  }, [user, authLoading, searchParams, toast, performRotaProcessingAndUpdateState, rotaToDisplay, rotaResult]); 


  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">Loading Rota Checker...</p>
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return <p>Redirecting to login...</p>; 
  }

  if (!user.isProfileComplete) {
    router.push('/profile/setup');
    return <p>Redirecting to profile setup...</p>; 
  }
  
  if (!rotaToDisplay) {
    return (
         <Card className="w-full max-w-2xl mx-auto mt-10 shadow-lg">
            <CardHeader>
                <CardTitle className="text-2xl text-destructive flex items-center gap-2">
                    <AlertCircle /> 
                    {rotaResult && 'error' in rotaResult ? 'Error Loading Rota' : 'Rota Not Found or Not Selected'}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p>{rotaResult && 'error' in rotaResult ? rotaResult.error : "Please select a rota from your dashboard or upload a new one."}</p>
                <Button asChild>
                    <Link href="/">
                        <Info className="mr-2 h-4 w-4" /> Go to Dashboard
                    </Link>
                </Button>
            </CardContent>
        </Card>
    );
  }
  
  return (
    <div className="space-y-8">
      <Card className="w-full shadow-lg my-6">
        <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <CardTitle className="text-2xl font-headline text-primary flex items-center gap-2">
                        <Settings2 className="h-6 w-6" /> Rota Review: {rotaToDisplay.name}
                    </CardTitle>
                    <CardDescription>
                        Viewing the configuration, grid, and compliance for this rota.
                    </CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent>
            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                    <AccordionTrigger className="text-lg font-medium hover:no-underline">
                        View Rota Configuration & Grid
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-6">
                        <div>
                            <h3 className="text-xl font-semibold text-muted-foreground mb-3 border-b pb-2">Rota Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                                <p><strong className="font-medium text-card-foreground/80">Site:</strong> {rotaToDisplay.scheduleMeta.site}</p>
                                <p><strong className="font-medium text-card-foreground/80">Specialty:</strong> {rotaToDisplay.scheduleMeta.specialty}</p>
                                <p><strong className="font-medium text-card-foreground/80">Rota Start Date:</strong> {new Date(rotaToDisplay.scheduleMeta.scheduleStartDate).toLocaleDateString()}</p>
                                <p><strong className="font-medium text-card-foreground/80">Rota End Date:</strong> {new Date(rotaToDisplay.scheduleMeta.endDate).toLocaleDateString()}</p>
                                <p><strong className="font-medium text-card-foreground/80">Weeks in Cycle:</strong> {rotaToDisplay.scheduleMeta.scheduleTotalWeeks}</p>
                                <p><strong className="font-medium text-card-foreground/80">Annual Leave (days):</strong> {rotaToDisplay.scheduleMeta.annualLeaveEntitlement}</p>
                                <p><strong className="font-medium text-card-foreground/80">Hours/Normal Day (for leave):</strong> {rotaToDisplay.scheduleMeta.hoursInNormalDay}</p>
                                <p><strong className="font-medium text-card-foreground/80">WTR 48hr Opt-Out:</strong> {rotaToDisplay.scheduleMeta.wtrOptOut ? 'Yes' : 'No'}</p>
                            </div>
                        </div>

                        <Separator />

                        <div>
                             <h3 className="text-xl font-semibold text-muted-foreground mb-3 border-b pb-2">Rota Grid</h3>
                            <RotaInputForm
                              key={`${rotaToDisplay.id}-${rotaToDisplay.scheduleMeta.scheduleTotalWeeks}-${rotaToDisplay.scheduleMeta.scheduleStartDate}`} 
                              scheduleMetaConfig={{
                                scheduleTotalWeeks: rotaToDisplay.scheduleMeta.scheduleTotalWeeks,
                                scheduleStartDate: rotaToDisplay.scheduleMeta.scheduleStartDate,
                              }}
                              shiftDefinitions={rotaToDisplay.shiftDefinitions}
                              initialRotaGrid={rotaToDisplay.rotaGrid || {}}
                              onProcessRota={async () => { /* No-op in view-only mode from here */ }} 
                              isProcessing={isProcessing} 
                              isEditing={false} // Always false for view-only
                            />
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </CardContent>
      </Card>
      
      <ComplianceReport result={rotaResult} isProcessing={isProcessing} />
    </div>
  );
}

// This is now the default export for the page. It's a Server Component.
export default function RotaCheckerPage() {
  // It wraps the client component in a Suspense boundary.
  return (
    <Suspense fallback={
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-lg text-muted-foreground">Loading Rota...</p>
        </div>
    }>
      <RotaCheckerContent />
    </Suspense>
  );
}
