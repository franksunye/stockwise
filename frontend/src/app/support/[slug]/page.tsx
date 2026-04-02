import { permanentRedirect } from 'next/navigation';

export default async function SupportDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  permanentRedirect(`/cn/support/${slug}`);
}
