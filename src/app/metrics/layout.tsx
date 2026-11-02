import { RequireRole } from "@/components/Session";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <RequireRole allow="any">{children}</RequireRole>;
}
