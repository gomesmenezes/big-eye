import QueryPageClient from './query-page-client';

export default async function QueryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <QueryPageClient slug={slug} />;
}
