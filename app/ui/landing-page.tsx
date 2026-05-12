"use client";

import Image from "next/image";
import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const steps = [
  {
    number: "01",
    title: "Enter a phone number",
    description:
      "Type any registered number. OTPay resolves it to the linked user identity and wallet instantly, so nobody has to deal with raw wallet addresses.",
    code: "phone number -> linked user -> linked wallet",
  },
  {
    number: "02",
    title: "Send or request value",
    description:
      "Choose an amount, add a note, and create a payment intent. OTPay handles the product logic while the wallet stays behind the scenes.",
    code: "createPaymentIntent(amount, note)",
  },
  {
    number: "03",
    title: "Approve and settle",
    description:
      "The other user confirms with OTP or a lightweight app flow. Then the stablecoin settlement happens on Solana while the experience still feels like normal mobile money.",
    code: "approve -> settle on Solana",
  },
];

const reasons = [
  {
    label: "User experience",
    title: "No wallet-address friction",
    description:
      "The user-facing abstraction is the phone number. That means fewer mistakes, less fear, and a product normal people can understand on first contact.",
    accent: "Simple",
    featured: true,
  },
  {
    label: "Identity model",
    title: "Your number, your linked wallet",
    description:
      "The number is the lookup key. The Solana wallet is still the real account behind the scenes. That makes the product technically coherent and easy to explain.",
  },
  {
    label: "Product wedge",
    title: "Send and request by contact",
    description:
      "OTPay is not just about sending money. It is about turning contact-based payment behavior into a stablecoin-native product flow.",
  },
  {
    label: "Settlement layer",
    title: "Solana underneath",
    description:
      "OTPay uses Solana where it matters most: fast, low-cost stablecoin settlement. The blockchain is the rail, not the user interface.",
    accent: "Global payment foundation",
    gradient: true,
  },
];

function LiveDevnetPanel() {
  return (
    <div className="live-panel">
      <div className="payment-preview">
        <div className="payment-preview-card is-metric">
          <p>Status</p>
          <strong>Live</strong>
          <span>OTPay is running on Solana devnet now</span>
        </div>
      </div>

      <div className="waitlist-success live-card">
        <p className="waitlist-success-kicker">Devnet access open</p>
        <h3>Use OTPay today.</h3>
        <p>
          Create a phone-linked wallet, load demo USDC, and send payment requests on devnet.
          Devnet users will be considered for early benefits when OTPay goes live on mainnet.
        </p>
        <div className="live-actions">
          <Link className="waitlist-button" href="/link-phone">
            Start on devnet
          </Link>
          <Link className="hero-secondary-link" href="/login">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  const rootRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) return;

    gsap.registerPlugin(ScrollTrigger);

    const context = gsap.context(() => {
      const heroTimeline = gsap.timeline({
        defaults: {
          duration: 0.45,
          ease: "power2.out",
        },
      });

      heroTimeline
        .from(".js-nav", { y: -18, autoAlpha: 0 })
        .from(".js-hero-copy", { y: 28, autoAlpha: 0, stagger: 0.1 }, "-=0.15")
        .from(".js-hero-panel", { y: 30, autoAlpha: 0, scale: 0.97 }, "-=0.2")
        .from(".js-hero-stats", { y: 18, autoAlpha: 0, stagger: 0.08 }, "-=0.2");

      gsap.to(".js-orbit", {
        yPercent: -6,
        xPercent: 4,
        scale: 1.02,
        duration: 3.6,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });

      const revealElements = gsap.utils.toArray<HTMLElement>(".js-reveal");

      revealElements.forEach((element) => {
        gsap.from(element, {
          y: 28,
          autoAlpha: 0,
          duration: 0.42,
          ease: "power2.out",
          scrollTrigger: {
            trigger: element,
            start: "top 84%",
            once: true,
          },
        });
      });
    }, rootRef);

    return () => {
      context.revert();
    };
  }, []);

  return (
    <main ref={rootRef} className="landing-shell">
      <header className="landing-nav js-nav">
        <a href="#top" className="brand-mark" aria-label="OTPay home">
          <Image src="/otpay.png" alt="OTPay logo" width={32} height={32} className="brand-logo" />
          <span>OTPay</span>
        </a>
        <div className="nav-meta">
          <span className="nav-pill">Built on Solana</span>
          <a className="nav-link" href="#devnet">
            Live on devnet
          </a>
          <Link
            className="nav-link nav-social"
            href="/link-phone"
          >
            Start
          </Link>
        </div>
      </header>

      <section id="top" className="hero-section">
        <div className="hero-copy">
          <p className="hero-kicker js-hero-copy">Walletless payments, on-chain</p>
          <h1 className="hero-title js-hero-copy">
            Your phone number
            <br />
            is your wallet
          </h1>
          <p className="hero-description js-hero-copy">
            Send, request, and approve stablecoin payments on Solana with a phone number
            instead of a wallet address. No seed phrase confusion. No copy-paste mistakes.
            Just a contact-based payment flow that feels natural.
          </p>
          <div className="hero-callouts js-hero-copy">
            <span className="hero-chip">Phone-first identity</span>
            <span className="hero-chip">Stablecoin settlement</span>
            <span className="hero-chip">Fast, low-cost rails</span>
          </div>
          <div className="hero-actions js-hero-copy">
            <Link className="hero-primary-link" href="/link-phone">
              Register phone number
            </Link>
            <a className="hero-secondary-link" href="#devnet">
              Try devnet
            </a>
          </div>
        </div>

        <div id="devnet" className="hero-panel js-hero-panel">
          <div className="hero-orb js-orbit" aria-hidden="true" />
          <div className="panel-topline">
            <span className="panel-badge">Live on devnet</span>
            <span className="panel-mono">Solana rail.</span>
          </div>

          <LiveDevnetPanel />

          <div className="hero-stat-row" aria-label="OTPay product model">
            <div className="hero-stat js-hero-stats">
              <span className="hero-stat-value">Phone</span>
              <span className="hero-stat-label">Identity layer</span>
            </div>
            <div className="hero-stat js-hero-stats">
              <span className="hero-stat-value">Wallet</span>
              <span className="hero-stat-label">Settlement account</span>
            </div>
            <div className="hero-stat js-hero-stats">
              <span className="hero-stat-value">Solana</span>
              <span className="hero-stat-label">Stablecoin rail</span>
            </div>
          </div>
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading js-reveal">
          <p className="section-kicker">How it works</p>
          <h2>Three steps. One clear flow.</h2>
        </div>
        <div className="workflow-grid">
          {steps.map((step) => (
            <article key={step.number} className="workflow-card js-reveal">
              <span className="workflow-number">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
              <code>{step.code}</code>
            </article>
          ))}
        </div>
      </section>

      <section className="content-section content-section-tight">
        <div className="section-heading js-reveal">
          <p className="section-kicker">Why OTPay</p>
          <h2>Built for humans, powered by rails.</h2>
        </div>
        <div className="reasons-grid">
          {reasons.map((reason) => (
            <article
              key={reason.title}
              className={[
                "reason-card",
                reason.featured ? "is-featured" : "",
                reason.gradient ? "is-gradient" : "",
                "js-reveal",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <p className="reason-label">{reason.label}</p>
              <h3>{reason.title}</h3>
              <p>{reason.description}</p>
              {reason.accent ? <strong>{reason.accent}</strong> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="quote-band js-reveal" aria-label="OTPay thesis">
        <p>
          “We don&apos;t want people to learn wallet addresses. We want them to move
          value the way they already move trust, through a phone number.”
        </p>
        <span>OTPay</span>
      </section>

      <section className="bottom-cta js-reveal">
        <div className="bottom-cta-copy">
          <p className="section-kicker">Live now</p>
          <h2>Start using OTPay on devnet.</h2>
          <p>
            Create your phone-linked wallet, load demo funds, and run the full OTP flow today.
            Devnet users will be considered for early benefits when OTPay launches on mainnet.
          </p>
        </div>
        <div className="bottom-cta-panel">
          <div className="waitlist-success live-card">
            <p className="waitlist-success-kicker">Devnet is open</p>
            <h3>OTPay is open for devnet testing.</h3>
            <p>
              Try the payment flow now. Mainnet benefits will prioritize people who helped test early.
            </p>
            <div className="live-actions">
              <Link className="waitlist-button" href="/link-phone">
                Start on devnet
              </Link>
              <Link className="hero-secondary-link" href="/login">
                Log in
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="footer-brand-wrap">
          <Image src="/otpay.png" alt="OTPay logo" width={24} height={24} className="footer-logo" />
          <span className="footer-brand">OTPay</span>
        </div>
        <span className="footer-note">
          Your phone number is your wallet · Built on Solana
        </span>
        <a
          className="footer-x-link"
          href="https://x.com/otpay1"
          target="_blank"
          rel="noreferrer"
        >
          Follow @otpay1 on X
        </a>
      </footer>
    </main>
  );
}
