import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui";

export function ComingSoon({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="p-6 md:p-10">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>Built out in {phase}.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-secondary">
            The layout shell and navigation are wired up. This page&apos;s real content comes next.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
