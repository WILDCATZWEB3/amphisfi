import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { PageHeader } from "@/components/amphis/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/amphis/States";
import { listProtocols } from "@/lib/protocols/protocols.functions";

export const Route = createFileRoute("/protocols/")({
  head: () => ({
    meta: [
      { title: "Protocols — Amphis" },
      {
        name: "description",
        content: "Verified Robinhood Chain protocol contracts only. Unknown stays unknown.",
      },
    ],
  }),
  component: ProtocolsPage,
});

function ProtocolsPage() {
  const listFn = useServerFn(listProtocols);
  const q = useQuery({ queryKey: ["protocols"], queryFn: () => listFn() });

  if (q.isLoading) {
    return (
      <div className="container-page py-16">
        <LoadingState label="Loading verified protocols" />
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className="container-page py-16">
        <ErrorState
          title="Could not load protocols"
          description={(q.error as Error).message}
          onRetry={() => void q.refetch()}
        />
      </div>
    );
  }

  const protocols = q.data?.protocols ?? [];
  return (
    <div className="container-page py-12 sm:py-16">
      <PageHeader
        title="Protocols"
        description="Robinhood Chain contracts verified from cited official sources. Nothing is invented."
      />
      <p className="mt-2 text-sm text-muted-foreground">{q.data?.methodology}</p>
      {!protocols.length ? (
        <div className="mt-8">
          <EmptyState
            title="No verified protocols yet"
            description="Apply migration 0012 or add only source-cited contracts. Unknown remains unknown."
          />
        </div>
      ) : (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {protocols.map(
            (p: {
              id: string;
              slug: string;
              name: string;
              category: string;
              source_url: string;
              protocol_contracts?: unknown[];
            }) => (
              <li key={p.id} className="rounded-lg border border-border p-4">
                <Link
                  to="/protocols/$slug"
                  params={{ slug: p.slug }}
                  className="text-lg font-medium text-accent"
                >
                  {p.name}
                </Link>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {p.category}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {p.protocol_contracts?.length ?? 0} verified contract
                  {(p.protocol_contracts?.length ?? 0) === 1 ? "" : "s"}
                </p>
                <a
                  href={p.source_url}
                  className="mt-2 inline-block text-xs text-accent underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Source
                </a>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
