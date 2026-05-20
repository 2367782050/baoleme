"use client";

import { AuthShell } from "@/components/auth/AuthShell";
import { LoginFormContent, RegisterFormContent } from "@/components/auth/AuthForms";

export default function LoginPage() {
  return (
    <AuthShell
      initialMode="login"
      loginForm={(onSuccess) => <LoginFormContent onSuccess={onSuccess} />}
      registerForm={(onSuccess) => <RegisterFormContent onSuccess={onSuccess} />}
    />
  );
}
