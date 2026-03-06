"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/context/WalletContext";
import { HeaderBar } from "@/components/HeaderBar";

export const dynamic = 'force-dynamic';

const navigation = ["Features", "Approach", "Work", "Contact"];

const features = [
  {
    title: "Wallet-first onboarding",
    description:
      "MetaMask prompt plus server signer means job seekers and employers join Arkiv in seconds.",
  },
  {
    title: "Decentralized job listings",
    description:
      "Use Arkiv queries to browse jobs, companies, and opportunities without middlemen.",
  },
  {
    title: "On-chain credentials",
    description:
      "Profile updates, applications, and hiring records run through verifiable Arkiv entity history.",
  },
];

const platformStats = [
  { label: "Profiles created", value: "2.3k" },
  { label: "Avg. job posting", value: "<4s" },
  { label: "Platform uptime", value: "99.8%" },
];

const testimonials = [
  {
    quote:
      "Workiv gave us a LinkedIn-style job board that's truly decentralized and transparent.",
    author: "Mara Jensen · HR Lead, Northwind",
  },
  {
    quote:
      "Their Arkiv workflow let us post jobs, review applicants, and hire talent without centralized platforms.",
    author: "Devon Ray · Product, Fieldbook",
  },
];

export default function Home() {
  const router = useRouter();
  const { account, shortAccount, connectError } = useWallet();
  const [showTransition, setShowTransition] = useState(false);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasRedirectedRef = useRef(false);
  const [stats, setStats] = useState({
    profilesCount: 0,
    postsCount: 0,
    feedLatency: "0s",
  });
  const [statsLoading, setStatsLoading] = useState(true);

  const startProfileTransition = useCallback(() => {
    if (hasRedirectedRef.current) return;
    hasRedirectedRef.current = true;
    setShowTransition(true);
    redirectTimeoutRef.current = setTimeout(() => {
      router.push("/profile");
    }, 4000);
  }, [router]);

  const handleConnectSuccess = useCallback(() => {
    startProfileTransition();
  }, [startProfileTransition]);

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
      // Reset redirect flag on unmount so reconnections can redirect properly
      hasRedirectedRef.current = false;
    };
  }, []);

  // Fetch stats on mount
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setStatsLoading(true);
        const response = await fetch("/api/stats");
        const data = await response.json();
        if (data.success && data.stats) {
          setStats(data.stats);
        }
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Removed auto-redirect when account is connected
  // Users can now stay on the home page even when wallet is connected
  // Redirect only happens when they explicitly click the connect button

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--page-bg)] text-[var(--ink)]">
      {showTransition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--page-bg)]/80 backdrop-blur-md">
          <div className="neo-card flex flex-col items-center gap-4 p-8 text-center">
            <div className="h-14 w-14 animate-spin rounded-full border-4 border-[var(--ink)] border-t-transparent" />
            <p className="text-lg font-semibold text-[var(--ink)]">
              Preparing your professional dashboard...
            </p>
            <p className="text-sm text-[var(--muted-ink)]">
              Syncing Arkiv wallet session. Hang tight for a few seconds.
            </p>
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 faint-grid opacity-70" />
      <div className="absolute -top-32 right-6 h-72 w-72 rounded-[40px] border-2 border-[var(--ink)] bg-[var(--accent)] opacity-70 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col gap-12 px-6 py-10 sm:px-10 md:py-16">
        <HeaderBar
          connectedLabel="Wallet connected"
          disconnectedLabel="Connect wallet"
          connectingLabel="Connecting..."
          onConnectSuccess={handleConnectSuccess}
          showButton={true}
          showButtonWhenConnected={false}
        />

        <main className="space-y-16 pb-16">
          <section className="neo-card relative overflow-hidden p-8 sm:p-12">
            <div className="absolute inset-y-0 right-8 hidden w-1 rounded-full bg-[var(--ink)]/40 sm:block" />
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center">
              <div className="flex-1 space-y-6">
                <p className="neo-pill inline-flex bg-[var(--accent)] text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ink)]">
                  Arkiv-native job board
                </p>
                <h1 className="text-balance text-4xl font-black leading-tight text-[var(--ink)] sm:text-5xl lg:text-6xl">
                  Workiv, hire talent, your way.
                </h1>
                <p className="max-w-2xl text-lg text-[var(--muted-ink)]">
                  Workiv brings the LinkedIn experience to the decentralized web. 
                  Post jobs, find opportunities, and build your career—all while 
                  you truly own your professional identity on Arkiv. No middlemen, 
                  no lock-in, just pure hiring freedom.
                </p>
                <p className="text-sm text-[var(--muted-ink)]">
                  Connect your MetaMask wallet to get started. We'll take you to 
                  your profile workspace where you can begin your decentralized 
                  career journey.
                </p>
                {shortAccount && (
                  <p className="text-sm font-semibold text-[var(--ink)]">
                    Connected: {shortAccount}
                  </p>
                )}
                {connectError && (
                  <p className="text-sm font-semibold text-red-600">
                    {connectError}
                  </p>
                )}
              </div>
              <div className="neo-card flex max-w-sm flex-col gap-4 border-dashed border-[var(--ink)] bg-[var(--page-bg)] p-6 text-sm text-[var(--muted-ink)]">
                <span className="text-xs font-semibold uppercase tracking-widest text-[var(--ink)]">
                  Arkiv snapshot
                </span>
                {statsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--ink)] border-t-transparent" />
                  </div>
                ) : (
                  <ul className="space-y-3">
                    <li className="flex justify-between border-b border-dashed border-[var(--ink)] pb-2">
                      <span>Professional profiles</span>
                      <span className="font-semibold text-[var(--ink)]">
                        {stats.profilesCount}
                      </span>
                    </li>
                    <li className="flex justify-between border-b border-dashed border-[var(--ink)] pb-2">
                      <span>Jobs posted on Arkiv</span>
                      <span className="font-semibold text-[var(--ink)]">
                        {stats.postsCount}
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span>Board refresh latency</span>
                      <span className="font-semibold text-[var(--ink)]">
                        {stats.feedLatency}
                      </span>
                    </li>
                  </ul>
                )}
              </div>
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            <article className="neo-card flex flex-col gap-6 p-8">
              <div>
                <p className="neo-pill inline-flex bg-[var(--surface)] text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ink)]">
                  Arkiv workflow
                </p>
              </div>
              <h2 className="text-3xl font-black">
                Wallet connect → profile create → job post.
              </h2>
              <p className="text-[var(--muted-ink)]">
                Every screen is tuned for Arkiv: MetaMask handshake, server-side
                signer, profile creation endpoint, and query-ready job board that
                mirrors LinkedIn flows without central custody.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {platformStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="neo-card bg-[var(--accent)]/60 p-4 text-center"
                  >
                    <div className="text-3xl font-black">{stat.value}</div>
                    <p className="text-sm uppercase tracking-wide text-[var(--muted-ink)]">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </article>
            <article className="neo-card flex flex-col gap-6 p-8">
              <h3 className="text-2xl font-black">Why it works</h3>
              <div className="space-y-5">
                {features.map((feature) => (
                  <div
                    key={feature.title}
                    className="rounded-3xl border-2 border-[var(--ink)] bg-[var(--surface)] p-5 shadow-[6px_6px_0_rgba(0,0,0,0.18)]"
                  >
                    <h4 className="text-lg font-semibold">{feature.title}</h4>
                    <p className="text-sm text-[var(--muted-ink)]">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section
            id="work"
            className="neo-card grid gap-10 bg-[var(--surface)] p-8 md:grid-cols-[1.2fr_0.8fr]"
          >
            <div className="space-y-4">
              <p className="neo-pill inline-flex bg-[var(--accent)] text-xs font-semibold uppercase tracking-[0.25em] text-[var(--ink)]">
                Job board strategy
              </p>
              <h3 className="text-3xl font-black text-[var(--ink)]">
                Arkiv queries let you browse jobs, profiles, and applications just like a
                familiar job platform—minus the centralized lock-in.
              </h3>
              <p className="text-[var(--muted-ink)]">
                We layer Arkiv's `buildQuery`, `watchEntities`, and server
                webhooks so employers and job seekers can search, apply, and hire with the same
                ease they expect from LinkedIn.
              </p>
              <div className="flex flex-wrap gap-3">
                {["Tech Startups", "Remote Teams", "Web3 Companies", "DAOs"].map(
                  (tag) => (
                    <span key={tag} className="neo-pill bg-[var(--surface)]">
                      {tag}
                    </span>
                  )
                )}
              </div>
            </div>
            <div className="space-y-6">
              {testimonials.map((testimonial) => (
                <blockquote
                  key={testimonial.author}
                  className="neo-card border-dashed border-[var(--ink)] bg-[var(--page-bg)] p-6"
                >
                  <p className="text-lg font-medium text-[var(--ink)]">
                    “{testimonial.quote}”
                  </p>
                  <footer className="mt-4 text-sm font-semibold uppercase tracking-wide text-[var(--muted-ink)]">
                    {testimonial.author}
                  </footer>
                </blockquote>
              ))}
        </div>
          </section>
      </main>

        
      </div>
    </div>
  );
}
