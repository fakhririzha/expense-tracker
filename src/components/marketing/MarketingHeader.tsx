import Link from "next/link";
import { Menu } from "lucide-react";

const overviewLinks = [
  { href: "/#overview", label: "Overview" },
  { href: "/#features", label: "Features" },
];

const utilityLinks = [{ href: "/#security", label: "Security" }];

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-xs font-black uppercase tracking-[0.12em] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black"
    >
      {label}
    </Link>
  );
}

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b-2 border-black bg-[#fcfcf8]">
      <div className="mx-auto hidden max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-6 lg:grid lg:h-16">
        <nav aria-label="Primary" className="flex items-center gap-9">
          {overviewLinks.map((link) => (
            <NavLink key={link.href} {...link} />
          ))}
        </nav>

        <Link
          href="/"
          className="font-heading text-3xl font-black tracking-[-0.08em] text-black focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black"
        >
          FINHEALTH
        </Link>

        <nav aria-label="Account" className="flex items-center justify-end gap-7">
          {utilityLinks.map((link) => (
            <NavLink key={link.href} {...link} />
          ))}
          <NavLink href="/login" label="Login" />
          <Link
            href="/register"
            className="border-2 border-black bg-[#f6ce30] px-4 py-2 text-xs font-black uppercase tracking-[0.08em] shadow-[3px_3px_0_#000] transition-transform hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_#000] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black"
          >
            Get started
          </Link>
        </nav>
      </div>

      <div className="mx-auto flex h-15 max-w-7xl items-center justify-between px-4 lg:hidden">
        <details className="group relative">
          <summary className="flex size-10 cursor-pointer list-none items-center justify-center border-2 border-black bg-white text-black [&::-webkit-details-marker]:hidden">
            <Menu className="size-5" strokeWidth={2.5} />
            <span className="sr-only">Open navigation</span>
          </summary>
          <nav
            aria-label="Mobile navigation"
            className="absolute left-0 top-12 z-10 grid w-52 border-2 border-black bg-[#fcfcf8] p-2 shadow-[4px_4px_0_#000]"
          >
            {[...overviewLinks, ...utilityLinks, { href: "/login", label: "Login" }].map(
              (link) => (
                <NavLink key={link.href} {...link} />
              ),
            )}
          </nav>
        </details>
        <Link
          href="/"
          className="font-heading text-2xl font-black tracking-[-0.08em] text-black"
        >
          FINHEALTH
        </Link>
        <Link
          href="/register"
          className="border-2 border-black bg-[#f6ce30] px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] shadow-[2px_2px_0_#000]"
        >
          Start
        </Link>
      </div>
    </header>
  );
}
