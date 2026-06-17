import { AdminProtectedPage } from "@/components/layout/AdminProtectedPage";
import { MailModuleShell } from "@/components/admin/mail/MailModuleShell";

export default function MailLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProtectedPage>
      <MailModuleShell>{children}</MailModuleShell>
    </AdminProtectedPage>
  );
}
