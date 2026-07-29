import Link from "next/link";
import { Instagram, Linkedin, Twitter } from "lucide-react";

const footerGroups = [
  {
    title: "Product",
    links: [
      { href: "/#overview", label: "Overview" },
      { href: "/#features", label: "Features" },
      { href: "/whats-new", label: "What’s New" },
      { href: "/roadmap", label: "Roadmap" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/blog", label: "Blog" },
      { href: "/guides", label: "Guides" },
      { href: "/help", label: "Help Center" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About Us" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Service" },
      { href: "/security", label: "Security" },
      { href: "/data-policy", label: "Data Policy" },
      { href: "/disclosures", label: "Disclosures" },
    ],
  },
];

const socialLinks = [
  { label: "X", Icon: Twitter },
  { label: "Instagram", Icon: Instagram },
  { label: "LinkedIn", Icon: Linkedin },
];

export function MarketingFooter() {
  return (
    <footer className="border-t-2 border-black bg-black text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[1.4fr_repeat(4,1fr)_1.15fr]">
        <div>
          <Link href="/" className="font-heading text-3xl font-black tracking-[-0.08em]">
            FINHEALTH
          </Link>
          <p className="mt-4 max-w-52 text-sm font-semibold leading-6 text-white/75">
            The private money system that helps you track, understand, and grow your wealth.
          </p>
          <div className="mt-5 flex gap-2">
            {socialLinks.map(({ label, Icon }) => (
              <a
                key={label}
                href="#"
                aria-label={`${label} placeholder link`}
                className="flex size-7 items-center justify-center border border-white/60 text-white transition-colors hover:bg-white hover:text-black"
              >
                <Icon className="size-4" />
              </a>
            ))}
          </div>
        </div>

        {footerGroups.map((group) => (
          <div key={group.title}>
            <h2 className="text-xs font-black uppercase tracking-[0.12em] text-white/60">
              {group.title}
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm font-semibold">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link className="hover:underline" href={link.href}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="self-start border-2 border-white p-4">
          <p className="font-heading text-xl font-black uppercase leading-5">
            Ready to take control?
          </p>
          <Link
            href="/register"
            className="mt-5 inline-flex border-2 border-black bg-[#f6ce30] px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-black shadow-[3px_3px_0_#fff] transition-transform hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_#fff]"
          >
            Get started free
          </Link>
        </div>
      </div>
      <div className="border-t border-white/30 px-6 py-4 text-center text-xs font-semibold text-white/60">
        © {new Date().getFullYear()} FinHealth. All rights reserved.
      </div>
    </footer>
  );
}
