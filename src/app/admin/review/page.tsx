import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import AdminReviewClient from "./AdminReviewClient";

export const dynamic = "force-dynamic";

export default async function AdminReviewPage() {
  const cookieStore = cookies();
  const adminCookie = cookieStore.get("miltonly_admin");
  const isAuth = adminCookie?.value === "1";

  if (!isAuth) {
    return <LoginGate />;
  }

  const drafts = await prisma.streetContent.findMany({
    where: { status: "draft", needsReview: true },
    orderBy: { generatedAt: "desc" },
  });

  const published = await prisma.streetContent.findMany({
    where: { status: "published" },
    orderBy: { publishedAt: "desc" },
    take: 10,
    select: {
      streetSlug: true,
      streetName: true,
      publishedAt: true,
    },
  });

  const queueStats = {
    pending: await prisma.streetQueue.count({ where: { status: "pending" } }),
    processing: await prisma.streetQueue.count({ where: { status: "processing" } }),
    failed: await prisma.streetQueue.count({ where: { status: "failed" } }),
    ineligible: await prisma.streetQueue.count({ where: { status: "ineligible" } }),
  };

  const serializedDrafts = drafts.map((d) => ({
    ...d,
    generatedAt: d.generatedAt.toISOString(),
    publishedAt: d.publishedAt?.toISOString() || null,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  }));

  const serializedPublished = published.map((p) => ({
    ...p,
    publishedAt: p.publishedAt?.toISOString() || null,
  }));

  return (
    <AdminReviewClient
      drafts={serializedDrafts}
      recentPublished={serializedPublished}
      queueStats={queueStats}
    />
  );
}

function LoginGate() {
  return (
    <div className="min-h-screen bg-[#07111f] flex items-center justify-center">
      <form
        className="bg-[#0c1e35] border border-[#1e3a5f] rounded-2xl p-8 w-full max-w-sm"
        action="/api/admin/auth"
        method="POST"
        // Client-side JS handles this via the AdminLoginForm below
      >
        <h1 className="text-[20px] font-extrabold text-[#f8f9fb] mb-1">Miltonly Admin</h1>
        <p className="text-[12px] text-[#64748b] mb-6">Enter your password to review drafts.</p>
        <AdminLoginForm />
      </form>
    </div>
  );
}

function AdminLoginForm() {
  // This is a server component fallback — the real interactivity is in the client
  return (
    <>
      <input
        name="password"
        type="password"
        placeholder="Admin password"
        className="w-full px-3 py-2.5 text-[13px] bg-[#07111f] border border-[#1e3a5f] rounded-lg text-[#f8f9fb] placeholder:text-[#334155] outline-none focus:border-[#f59e0b] mb-4"
      />
      <button
        type="submit"
        className="w-full bg-[#f59e0b] text-[#07111f] text-[13px] font-extrabold rounded-lg py-2.5 hover:bg-[#eab308] transition-colors"
      >
        Sign in
      </button>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.querySelector('form').addEventListener('submit', async function(e) {
              e.preventDefault();
              const pw = this.querySelector('input[name="password"]').value;
              const res = await fetch('/api/admin/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pw })
              });
              if (res.ok) window.location.reload();
              else {
                const btn = this.querySelector('button');
                btn.textContent = 'Wrong password';
                btn.classList.add('bg-red-500');
                setTimeout(() => { btn.textContent = 'Sign in'; btn.classList.remove('bg-red-500'); }, 2000);
              }
            });
          `,
        }}
      />
    </>
  );
}
