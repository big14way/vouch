import Link from "next/link";
import { Shell } from "@/components/layout/nav";
import { EmptyState } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <Shell narrow>
      <EmptyState title="That page does not exist." body="Check the link, or go back home." action={<Link href="/"><Button variant="secondary">Home</Button></Link>} />
    </Shell>
  );
}
