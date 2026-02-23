import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { TrendingUp, Wallet, ShieldAlert, ArrowRight } from "lucide-react";

export default async function Home() {
  const session = await auth();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background selection:bg-primary selection:text-primary-foreground">
      {/* Navigation */}
      <nav className="border-b-4 border-black bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1.5 neo-border shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <TrendingUp strokeWidth={3} className="h-6 w-6" />
            <span className="font-black text-xl tracking-tight uppercase font-heading">FinHealth</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="font-bold text-sm uppercase tracking-widest hover:underline underline-offset-4">
              Login
            </Link>
            <Link href="/register" className="bg-secondary text-secondary-foreground px-4 py-2 font-black uppercase tracking-wider text-sm neo-border shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-px hover:translate-x-px hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all">
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-24 md:py-32">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="bg-secondary inline-block px-4 py-2 neo-border shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-6 transform -rotate-2">
            <span className="font-black uppercase tracking-widest text-sm md:text-base">No sugar-coating. Just data.</span>
          </div>
          <h1 className="text-6xl md:text-8xl font-black font-heading uppercase leading-[1.1] tracking-tighter text-foreground">
            Take Brutal Control Of Your Finances.
          </h1>
          <p className="text-xl md:text-2xl font-bold opacity-80 max-w-2xl leading-relaxed">
            Stop hiding behind soft colors and rounded corners. FinHealth gives you the raw, unfiltered truth about your money so you can build real wealth.
          </p>
          <div className="pt-8">
            <Link href="/register" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 text-xl font-black uppercase tracking-wider neo-border shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all">
              Start Tracking <ArrowRight className="h-6 w-6" strokeWidth={3} />
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="border-t-4 border-black bg-white py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl md:text-5xl font-black font-heading uppercase mb-12 text-center">Why FinHealth?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-[#FFDD00] p-8 neo-border shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-black">
              <div className="bg-white h-14 w-14 flex items-center justify-center neo-border mb-6">
                <Wallet className="h-8 w-8 text-black" strokeWidth={2.5} />
              </div>
              <h3 className="text-2xl font-black font-heading uppercase mb-4">Total Clarity</h3>
              <p className="font-bold opacity-90 leading-relaxed text-black">
                See exactly where every cent goes. No confusing charts, just hard numbers that tell the truth about your spending.
              </p>
            </div>
            {/* Feature 2 */}
            <div className="bg-[#00DD66] p-8 neo-border shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-black transform md:-translate-y-4">
              <div className="bg-white h-14 w-14 flex items-center justify-center neo-border mb-6">
                <TrendingUp className="h-8 w-8 text-black" strokeWidth={2.5} />
              </div>
              <h3 className="text-2xl font-black font-heading uppercase mb-4">Grow Wealth</h3>
              <p className="font-bold opacity-100 leading-relaxed">
                Track your investments and watch your net worth climb. We highlight your gains using high-contrast, undeniable metrics.
              </p>
            </div>
            {/* Feature 3 */}
            <div className="bg-[#FF5555] p-8 neo-border shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-white">
              <div className="bg-black h-14 w-14 flex items-center justify-center neo-border border-white mb-6">
                <ShieldAlert className="h-8 w-8 text-white" strokeWidth={2.5} />
              </div>
              <h3 className="text-2xl font-black font-heading uppercase mb-4">Kill Debt</h3>
              <p className="font-bold opacity-100 leading-relaxed">
                Face your liabilities head-on. FinHealth gives you the stark reality of your debt-to-wealth ratio so you can crush it faster.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-4 border-black bg-black text-white py-12">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-white text-black px-3 py-1 neo-border border-white mb-6">
            <TrendingUp strokeWidth={3} className="h-5 w-5" />
            <span className="font-black text-lg tracking-tight uppercase font-heading">FinHealth</span>
          </div>
          <p className="font-bold uppercase tracking-widest text-sm opacity-60">
            © {new Date().getFullYear()} FinHealth. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
