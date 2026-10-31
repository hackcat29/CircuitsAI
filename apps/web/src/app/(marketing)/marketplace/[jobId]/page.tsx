import { redirect } from "next/navigation";

export default async function MarketingJobRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { jobId } = await params;
  const resolvedSearchParams = await searchParams;
  const queryString = new URLSearchParams();

  for (const [key, val] of Object.entries(resolvedSearchParams)) {
    if (typeof val === "string") queryString.set(key, val);
    else if (Array.isArray(val)) val.forEach((v) => queryString.append(key, v));
  }

  const query = queryString.toString();
  redirect(`/app/marketplace/${jobId}${query ? `?${query}` : ""}`);
}
