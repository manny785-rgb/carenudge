import { RequireRole } from "@/components/Session";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <RequireRole allow="clinic_ops">{children}</RequireRole>;
}
