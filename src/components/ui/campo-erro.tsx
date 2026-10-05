export function CampoErro({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive mt-0.5">{msg}</p>;
}
