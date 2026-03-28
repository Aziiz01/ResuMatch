import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_90%_60%_at_50%_-10%,rgb(209_250_229/0.85),transparent_55%),linear-gradient(to_bottom,rgb(240_253_244),rgb(241_245_249))] dark:bg-[radial-gradient(ellipse_90%_50%_at_50%_-10%,rgb(6_78_59/0.5),transparent_55%),linear-gradient(to_bottom,rgb(9_9_11),rgb(9_9_11))]">
      <Dashboard />
    </div>
  );
}
