import React, { useEffect, useState } from "react";
import { ArrowLeft, BookOpen, Images, LockKeyhole, MapPinned } from "lucide-react";
import VirtualVisitsPage from "../VirtualVisitsPage";
import StoryManager from "./StoryManager";
import ChangePasswordModal from "./ChangePasswordModal";
import { api } from "./api";

export default function AdminPage() {
  const [session, setSession] = useState<{
    authenticated: boolean;
    configured: boolean;
  } | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [section, setSection] = useState<"home" | "visits" | "stories" | "culture">("home");
  const [changingPassword, setChangingPassword] = useState(false);
  const checkSession = () => {
    setError("");
    api<{ authenticated: boolean; configured: boolean }>("/api/admin/session")
      .then(setSession)
      .catch(() =>
        setError("Não foi possível conectar ao servidor. Tente novamente."),
      );
  };
  useEffect(checkSession, []);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setPassword("");
      setSession({ authenticated: true, configured: true });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Falha ao entrar.");
    } finally {
      setBusy(false);
    }
  };

  function endSession(message = "") {
    setNotice(message);
    setSection("home");
    setChangingPassword(false);
    setSession({ authenticated: false, configured: true });
  }

  async function logout() {
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/logout", { method: "POST" });
      endSession();
    } catch {
      setError("Não foi possível sair. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  if (session?.authenticated) {
    const goHome = () => setSection("home");
    if (section === "visits") {
      return <VirtualVisitsPage administrative onBackToAdmin={goHome} onSessionEnd={endSession} />;
    }
    if (section === "stories") return <StoryManager key="stories" onClose={goHome} />;
    if (section === "culture") return <StoryManager key="culture" culturalWeeks onClose={goHome} />;

    return (
      <main className="min-h-screen bg-neutral-950 px-5 py-8 text-white sm:px-8 sm:py-12">
        <div className="mx-auto max-w-5xl">
          <nav aria-label="Conta administrativa" className="mb-12 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
            <a href="/" className="mr-auto inline-flex items-center gap-2 underline underline-offset-4 transition-colors hover:text-red-300"><ArrowLeft size={16} aria-hidden="true" /> Voltar ao site</a>
            <button disabled={busy} onClick={() => setChangingPassword(true)} className="underline underline-offset-4 transition-colors enabled:hover:text-red-300 enabled:cursor-pointer disabled:opacity-50">Alterar senha</button>
            <button disabled={busy} onClick={logout} className="underline underline-offset-4 transition-colors enabled:hover:text-red-300 enabled:cursor-pointer disabled:opacity-50">{busy ? "Saindo…" : "Sair"}</button>
          </nav>
          {error && <p role="alert" className="mb-4 text-red-300">{error}</p>}
          <h1 className="mb-7 text-4xl font-semibold sm:text-5xl">Painel administrativo</h1>
          <div className="grid gap-4 sm:grid-cols-2">
            <button onClick={() => setSection("culture")} className="rounded-lg border border-white/15 bg-neutral-900 p-6 text-left cursor-pointer transition-colors hover:border-red-400/70 hover:bg-neutral-800 active:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-4">
              <Images aria-hidden="true" className="mb-4 text-red-300"/>
              <span className="font-display block text-2xl font-semibold">Memórias da Escola</span>
              <span className="mt-2 block text-neutral-300">Gerenciar fotos, vídeos e áudios dos eventos da escola por ano.</span>
            </button>
            <button onClick={() => setSection("visits")} className="rounded-lg border border-white/15 bg-neutral-900 p-6 text-left cursor-pointer transition-colors hover:border-red-400/70 hover:bg-neutral-800 active:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-4">
              <MapPinned aria-hidden="true" className="mb-4 text-red-300" />
              <span className="font-display block text-2xl font-semibold">Visitas virtuais</span>
              <span className="mt-2 block text-neutral-300">Editar a planta, os ambientes e os pontos da visita.</span>
            </button>
            <button onClick={() => setSection("stories")} className="rounded-lg border border-white/15 bg-neutral-900 p-6 text-left cursor-pointer transition-colors hover:border-red-400/70 hover:bg-neutral-800 active:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-4">
              <BookOpen aria-hidden="true" className="mb-4 text-red-300" />
              <span className="font-display block text-2xl font-semibold">Histórias contadas</span>
              <span className="mt-2 block text-neutral-300">Publicar fotos, vídeos e áudios e gerenciar o armazenamento.</span>
            </button>
          </div>
          {changingPassword && <ChangePasswordModal onClose={() => setChangingPassword(false)}
            onChanged={() => endSession("Senha alterada. Entre novamente com a nova senha.")} />}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#101812] text-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white mb-8"
        >
          <ArrowLeft size={16} /> Voltar ao site
        </a>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-9 shadow-2xl">
          <div className="inline-flex rounded-xl bg-[#8B0000] p-3 mb-6">
            <LockKeyhole size={24} />
          </div>
          <p className="text-xs tracking-widest uppercase text-white/50 mb-2">
            Memórias da Escola Indígena
          </p>
          <h1 className="text-2xl font-bold">Painel administrativo</h1>
          <p className="text-sm text-white/65 mt-3 mb-6">
            Entre para gerenciar as histórias do acervo e a visita virtual.
          </p>
          {!session ? (
            <div role="status" className="text-sm text-white/70">
              {error || "Verificando acesso…"}
              {error && (
                <button onClick={checkSession} className="block underline mt-3 transition-colors hover:text-red-300">
                  Tentar novamente
                </button>
              )}
            </div>
          ) : (
            <form onSubmit={login} className="space-y-5">
              {!session.configured && (
                <p role="alert" className="text-sm text-amber-200">
                  O acesso administrativo ainda não está disponível. Contate o
                  responsável pelo site.
                </p>
              )}
              {notice && (
                <p role="status" className="text-sm text-green-200">
                  {notice}
                </p>
              )}
              <div>
                <label htmlFor="admin-username" className="block text-sm mb-2">
                  Usuário
                </label>
                <input
                  id="admin-username"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-lg border border-white/20 bg-black/25 px-3 py-3 outline-none focus:ring-2 focus:ring-white/50"
                />
              </div>
              <div>
                <label htmlFor="admin-password" className="block text-sm mb-2">
                  Senha
                </label>
                <input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-white/20 bg-black/25 px-3 py-3 outline-none focus:ring-2 focus:ring-white/50"
                />
              </div>
              {error && (
                <p role="alert" className="text-sm text-red-300">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={busy || !session.configured}
                className="w-full flex justify-center items-center gap-2 rounded-lg bg-[#8B0000] enabled:hover:bg-[#a30000] px-4 py-3 font-semibold disabled:opacity-50"
              >
                <MapPinned size={18} />
                {busy ? "Entrando…" : "Entrar no painel"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
