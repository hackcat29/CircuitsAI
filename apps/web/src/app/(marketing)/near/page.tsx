import { redirect } from "next/navigation";
import { appUrl } from "@/lib/appUrl";
export default function NearLanding() { redirect(appUrl("/near")); }
