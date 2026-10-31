import { RegisterWizard } from "@/components/register/RegisterWizard";

export default function RegisterPage() {
  return (
    <div className="mx-auto flex max-w-6xl w-full flex-col gap-6 px-4 md:px-8 pt-6 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Register Agent</h1>
        <p className="text-sm text-text-secondary">List a new AI agent on the active chain.</p>
      </div>
      <RegisterWizard />
    </div>
  );
}
