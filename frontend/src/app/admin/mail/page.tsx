import { redirect } from "next/navigation";

export default function MailIndexPage() {
  redirect("/admin/mail/smtp");
}
