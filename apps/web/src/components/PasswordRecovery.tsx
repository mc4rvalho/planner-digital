import { useState, type FormEvent } from "react";
import { ApiError, request } from "../api";
import { messages, type Locale, type MessageKey } from "../i18n";
export default function PasswordRecovery({
  token,
  locale,
  onBack,
}: {
  token: string;
  locale: Locale;
  onBack: () => void;
}) {
  const t = (k: MessageKey) => messages[locale][k];
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [done, setDone] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setError("");
    setNotice("");
    const password = String(data.get("newPassword") ?? "");
    if (token && password !== data.get("confirm")) {
      setError(t("passwordMismatch"));
      return;
    }
    if (token && new TextEncoder().encode(password).length > 72) {
      setError(t("passwordLong"));
      return;
    }
    setBusy(true);
    try {
      await request(
        token ? "account/reset-password" : "account/forgot-password",
        "",
        "POST",
        token ? { token, newPassword: password } : { email: data.get("email") },
      );
      setNotice(t(token ? "resetDone" : "resetSent"));
      setDone(true);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 503
          ? t("emailUnavailable")
          : e instanceof ApiError && e.status === 400
            ? t("resetInvalid")
            : t("error"),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="auth-form" onSubmit={submit}>
      <span className="eyebrow">TEMPO / {t("resetPassword")}</span>
      <h2>{t(token ? "resetPassword" : "forgotPassword")}</h2>
      {!token && <p>{t("resetIntro")}</p>}
      {!done &&
        (token ? (
          <>
            <label>
              {t("newPassword")}
              <input
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
                maxLength={72}
              />
            </label>
            <label>
              {t("confirmPassword")}
              <input
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
                maxLength={72}
              />
            </label>
            <small>{t("passwordHint")}</small>
          </>
        ) : (
          <label>
            {t("email")}
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
            />
          </label>
        ))}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      {!done && (
        <button className="primary" disabled={busy}>
          {busy ? t("loading") : t(token ? "resetPassword" : "sendReset")}
        </button>
      )}
      <button className="text-button" type="button" onClick={onBack}>
        {t("backLogin")}
      </button>
    </form>
  );
}
