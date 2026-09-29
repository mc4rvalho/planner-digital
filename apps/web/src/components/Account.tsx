import { useState, type FormEvent, type ChangeEvent } from "react";
import { Camera, LockKeyhole, Save } from "lucide-react";
import { ApiError, request } from "../api";
import { messages, type Locale, type MessageKey } from "../i18n";
import type { User } from "../types";
export default function Account({
  user,
  token,
  locale,
  onUser,
  onSession,
  onError,
}: {
  user: User;
  token: string;
  locale: Locale;
  onUser: (u: User) => void;
  onSession: (s: { user: User; accessToken: string }) => void;
  onError: (e: unknown) => void;
}) {
  const t = (k: MessageKey) => messages[locale][k];
  const [name, setName] = useState(user.name),
    [photo, setPhoto] = useState(user.photo),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setError("");
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 8 * 1024 * 1024
    ) {
      setError(t("invalidPhoto"));
      return;
    }
    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d")!;
      const side = Math.min(bitmap.width, bitmap.height);
      ctx.drawImage(
        bitmap,
        (bitmap.width - side) / 2,
        (bitmap.height - side) / 2,
        side,
        side,
        0,
        0,
        256,
        256,
      );
      bitmap.close();
      setPhoto(canvas.toDataURL("image/jpeg", 0.85));
    } catch {
      setError(t("invalidPhoto"));
    } finally {
      setBusy(false);
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await request<User>("account/profile", token, "PATCH", {
        name,
        photo,
      });
      onUser(next);
      setNotice(t("profileSaved"));
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }
  async function password(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const newPassword = String(data.get("newPassword"));
    setError("");
    setNotice("");
    if (newPassword !== data.get("confirm")) {
      setError(t("passwordMismatch"));
      return;
    }
    if (new TextEncoder().encode(newPassword).length > 72) {
      setError(t("passwordLong"));
      return;
    }
    setBusy(true);
    try {
      const session = await request<{ user: User; accessToken: string }>(
        "account/password",
        token,
        "POST",
        { currentPassword: data.get("currentPassword"), newPassword },
      );
      onSession(session);
      form.reset();
      setNotice(t("passwordChanged"));
    } catch (e) {
      if (e instanceof ApiError && e.message === "CURRENT_PASSWORD_INVALID")
        setError(t("wrongPassword"));
      else onError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">TEMPO / {t("profile")}</span>
          <h1>{t("profile")}</h1>
          <p>{t("profileSub")}</p>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="success feature-notice" role="status">
          {notice}
        </p>
      )}
      <div className="account-grid">
        <form className="card feature-card" onSubmit={save}>
          <h2>
            <Camera size={20} />
            {t("profile")}
          </h2>
          <div className="photo-editor">
            <div className="avatar large">
              {photo ? (
                <img src={photo} alt={t("photo")} />
              ) : (
                name.slice(0, 1).toUpperCase()
              )}
            </div>
            <label className="secondary photo-upload">
              {t("photo")}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={upload}
                disabled={busy}
              />
            </label>
            {photo && (
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() => setPhoto(null)}
              >
                {t("removePhoto")}
              </button>
            )}
          </div>
          <small className="muted">{t("photoHint")}</small>
          <label>
            {t("name")}
            <input
              value={name}
              minLength={2}
              maxLength={80}
              required
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            {t("email")}
            <input value={user.email} type="email" readOnly />
          </label>
          <button className="primary" disabled={busy}>
            {busy ? t("saving") : t("saveProfile")}
            <Save size={16} />
          </button>
        </form>
        <form className="card feature-card" onSubmit={password}>
          <h2>
            <LockKeyhole size={20} />
            {t("changePassword")}
          </h2>
          <label>
            {t("currentPassword")}
            <input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              maxLength={72}
            />
          </label>
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
          <small className="muted">{t("passwordHint")}</small>
          <button className="primary" disabled={busy}>
            {busy ? t("saving") : t("changePassword")}
          </button>
        </form>
      </div>
    </>
  );
}
