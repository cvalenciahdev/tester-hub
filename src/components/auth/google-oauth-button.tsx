"use client";

import { useState } from "react";
import { PendingButtonContent } from "@/components/loading-state";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

export function GoogleOAuthButton() {
  const { t } = useI18n();
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);

  async function signInWithGoogle() {
    setError(false);
    setPending(true);

    const supabase = createClient();
    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });

    if (oauthError || !data.url) {
      console.error("Could not start Google OAuth:", oauthError);
      setError(true);
      setPending(false);
      return;
    }

    window.location.assign(data.url);
  }

  return (
    <>
      <button
        className="google-button"
        disabled={pending}
        onClick={signInWithGoogle}
        type="button"
      >
        <PendingButtonContent pending={pending} label="auth.startingGoogle"><span className="google-g">G</span>{t("auth.continueGoogle")}</PendingButtonContent>
      </button>
      {error && <p className="auth-error" role="alert">{t("auth.googleError")}</p>}
    </>
  );
}
