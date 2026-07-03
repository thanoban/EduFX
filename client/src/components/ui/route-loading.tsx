import { PageState } from "@/components/ui/page-state";

export function AuthRouteLoading({
  title,
  message,
  eyebrow,
}: {
  title: string;
  message: string;
  eyebrow?: string;
}) {
  return <PageState layout="auth" title={title} message={message} eyebrow={eyebrow} />;
}

export function WorkspaceRouteLoading({
  title,
  message,
  eyebrow,
}: {
  title: string;
  message: string;
  eyebrow?: string;
}) {
  return <PageState layout="workspace" title={title} message={message} eyebrow={eyebrow} />;
}
