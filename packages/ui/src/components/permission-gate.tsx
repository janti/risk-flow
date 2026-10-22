import type { ReactNode } from "react";

type PermissionGateProps = {
  allowed: boolean;
  children: ReactNode;
  fallback?: ReactNode;
};

function PermissionGate({ allowed, children, fallback = null }: PermissionGateProps) {
  return allowed ? children : fallback;
}

export { PermissionGate };
