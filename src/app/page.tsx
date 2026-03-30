import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  return (
    <div className="relative min-h-screen">
      {/* Layered background: mesh + soft glows */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[length:24px_24px] bg-[linear-gradient(to_right,rgb(148_163_184/0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgb(148_163_184/0.08)_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,rgb(255_255_255/0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.04)_1px,transparent_1px)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgb(16_185_129/0.18),transparent_55%),radial-gradient(ellipse_60%_40%_at_100%_0%,rgb(56_189_248/0.12),transparent_45%),linear-gradient(to_bottom,rgb(241_245_249),rgb(241_245_249))] dark:bg-[radial-gradient(ellipse_80%_45%_at_50%_-15%,rgb(16_185_129/0.22),transparent_55%),radial-gradient(ellipse_50%_35%_at_100%_10%,rgb(6_182_212/0.12),transparent_45%),linear-gradient(to_bottom,rgb(9_9_11),rgb(9_9_11))]"
        aria-hidden
      />
      <main id="main-content">
        <Dashboard />
      </main>
    </div>
  );
}
