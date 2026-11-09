import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { PageHeader } from "@/components/amphis/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/amphis/States";
import { WalletAddress } from "@/components/amphis/WalletAddress";
import { getProtocol } from "@/lib/protocols/protocols.functions";

export const Route = createFileRoute("/protocols/$slug")({
  head: ({ params }) => ({
    meta: [{ title: `${params.slug} — Protocols — Amphis` }],
  }),
  component: ProtocolDetailPage,
});

function ProtocolDetailPage() {
  const { slug } = Route.useParams();
  const getFn = useServerFn(getProtocol);
  const q = useQuery({
    queryKey: ["protocol", slug],
    queryFn: () => getFn({ data: { slug } }),
  });

  if (q.isLoading) {
    return (
      <div className="container-page py-16">
        <LoadingState label="Loading protocol" />
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className="container-page py-16">
        <ErrorState
          title="Could not load protocol"
          description={(q.error as Error).message}
          onRetry={() => void q.refetch()}
        />
      </div>
    );
  }
  if (!q.data?.found) {
    return (
      <div className="container-page py-16">
        <EmptyState
          title="Unknown protocol"
          description={
            q.data && "reason" in q.data ? q.data.reason : "Not in the verified registry."
          }
        />
        <Link to="/protocols" className="mt-4 inline-block text-sm text-accent">
          ← Protocols
        </Link>
      </div>
    );
  }

  const p = q.data.protocol;
  return (
    <div className="container-page py-12 sm:py-16">
      <Link to="/protocols" className="text-sm text-accent">
        ← Protocols
      </Link>
      <PageHeader
        title={p.name}
        description={`${p.category} · verification: ${p.verification_status}`}
      />
      <p className="mt-2 text-sm text-muted-foreground">{p.notes}</p>
      <p className="mt-2 text-xs">
        Source:{" "}
        <a href={p.source_url} className="text-accent underline" target="_blank" rel="noreferrer">
          {p.source}
        </a>
      </p>
      <ul className="mt-8 space-y-3">
        {(p.protocol_contracts ?? []).map(
          (c: { id: string; role: string; address: string; source_url: string }) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm"
            >
              <span className="font-mono text-xs text-muted-foreground">{c.role}</span>
              <WalletAddress address={c.address} />
              <a
                href={c.source_url}
                className="text-xs text-accent underline"
                target="_blank"
                rel="noreferrer"
              >
                cite
              </a>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
