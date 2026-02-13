'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ContentBrief } from '@/lib/content-schemas';

interface IdentityTabProps {
  propertyId: string;
  brief: ContentBrief | null;
}

export function IdentityTab({ propertyId, brief }: IdentityTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Owner Voice</CardTitle>
          <CardDescription>
            Define the tone, style, and personality used in generated content
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {brief?.ownerVoice
              ? `${brief.ownerVoice.toneDescriptors?.length || 0} tone descriptors configured`
              : 'No content brief configured yet. Fill in the identity details to get started.'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Property Story</CardTitle>
          <CardDescription>
            History, unique features, and guest experience narrative
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {brief?.propertyStory
              ? `${brief.propertyStory.uniqueFeatures?.length || 0} unique features defined`
              : 'Not configured yet.'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Area Context</CardTitle>
          <CardDescription>
            Local culture, hidden gems, and neighborhood info
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {brief?.areaContext
              ? `${brief.areaContext.neighborhoods?.length || 0} neighborhoods, ${brief.areaContext.hiddenGems?.length || 0} hidden gems`
              : 'Not configured yet.'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Production Specs</CardTitle>
          <CardDescription>
            Target audience, SEO keywords, and content length preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {brief?.productionSpecs
              ? `Target: ${brief.productionSpecs.targetAudience || 'Not set'}, ${brief.productionSpecs.seoKeywords?.primary?.length || 0} primary keywords`
              : 'Not configured yet.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
