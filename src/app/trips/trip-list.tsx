"use client";

import { Card } from "~/components/Card";
import { IDLinkList } from "~/components/List";
import type { Trip } from "~/lib/trips";

export default function BlogList({ trips }: { trips: Trip[] }) {
  return (
    <Card header="Trips">
      <IDLinkList
        items={trips}
        href={({ id }) => `/trips/${id}`}
        link={({ title }) => title ?? "Unknown"}
      />
    </Card>
  );
}
