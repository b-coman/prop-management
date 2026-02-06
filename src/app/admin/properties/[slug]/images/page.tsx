import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdminPage } from '@/components/admin';
import { fetchPropertyImages } from './actions';
import { ImageManager } from './_components/image-manager';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PropertyImagesPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await fetchPropertyImages(slug);

  if (!data) {
    notFound();
  }

  return (
    <AdminPage
      title="Property Images"
      description={data.propertyName}
    >
      <div className="-mt-4">
        <Button variant="link" className="px-0 text-muted-foreground" asChild>
          <Link href={`/admin/properties/${slug}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Property
          </Link>
        </Button>
      </div>

      <ImageManager slug={slug} initialImages={data.images} />
    </AdminPage>
  );
}
