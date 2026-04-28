"use client";

import Image from "next/image";
import Link from "next/link";
import {
  FormEvent,
  startTransition,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

type WaitlistFormProps = {
  formId: string;
  note: string;
  submitLabel: string;
};

type FormErrors = {
  email?: string;
  phone?: string;
  form?: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const waitlistTable = process.env.NEXT_PUBLIC_SUPABASE_WAITLIST_TABLE ?? "waitlist";

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  }

  return supabaseClient;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string) {
  return /^\+?[0-9\s\-()]{7,20}$/.test(value);
}

function WaitlistForm({
  formId,
  note,
  submitLabel,
  onSuccess,
}: WaitlistFormProps & { onSuccess?: () => void }) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");

  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: FormErrors = {};
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedEmail) {
      nextErrors.email = "Email is required.";
    } else if (!isValidEmail(trimmedEmail)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!trimmedPhone) {
      nextErrors.phone = "Phone number is required.";
    } else if (!isValidPhone(trimmedPhone)) {
      nextErrors.phone = "Enter a valid phone number.";
    }

    setErrors(nextErrors);

    if (nextErrors.email) {
      emailRef.current?.focus();
      return;
    }

    if (nextErrors.phone) {
      phoneRef.current?.focus();
      return;
    }

    setStatus("submitting");
    setErrors({});

    const client = getSupabaseClient();

    if (!client) {
      setErrors({
        form: "Add Supabase env vars to enable the live waitlist.",
      });
      setStatus("idle");
      return;
    }

    void (async () => {
      const { error } = await client.from(waitlistTable).insert({
        email: trimmedEmail,
        phone: trimmedPhone,
      });

      if (error) {
        setErrors({
          form: "Could not join the waitlist right now. Please try again.",
        });
        setStatus("idle");
        return;
      }

      window.dispatchEvent(new CustomEvent("otpay:waitlist-joined"));
      onSuccess?.();

      startTransition(() => {
        setStatus("success");
      });
    })();
  }

  if (status === "success") {
    return (
      <div className="waitlist-success" role="status" aria-live="polite">
        <p className="waitlist-success-kicker">Waitlist confirmed</p>
        <h3>You&apos;re on the list.</h3>
        <p>We&apos;ll reach out when OTPay opens access for early users and builders.</p>
      </div>
    );
  }

  return (
    <form className="waitlist-form" onSubmit={handleSubmit} noValidate>
      <fieldset className="waitlist-fieldset">
        <legend className="sr-only">Join the OTPay waitlist</legend>
        <div className="waitlist-grid">
          <div className="waitlist-field">
            <label htmlFor={`${formId}-email`}>Email *</label>
            <input
              ref={emailRef}
              id={`${formId}-email`}
              type="email"
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              placeholder="you@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={errors.email ? "true" : "false"}
              aria-describedby={errors.email ? `${formId}-email-error` : `${formId}-note`}
            />
            <p id={`${formId}-email-error`} className="field-error" aria-live="polite">
              {errors.email ?? ""}
            </p>
          </div>
          <div className="waitlist-field">
            <label htmlFor={`${formId}-phone`}>Phone *</label>
            <input
              ref={phoneRef}
              id={`${formId}-phone`}
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              spellCheck={false}
              placeholder="+1 98XX-XXX-XXX"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              aria-invalid={errors.phone ? "true" : "false"}
              aria-describedby={errors.phone ? `${formId}-phone-error` : `${formId}-note`}
            />
            <p id={`${formId}-phone-error`} className="field-error" aria-live="polite">
              {errors.phone ?? ""}
            </p>
          </div>
        </div>
      </fieldset>
      <div className="waitlist-actions">
        {errors.form ? (
          <p className="field-error" aria-live="polite">
            {errors.form}
          </p>
        ) : null}
        <button
          type="submit"
          className="waitlist-button"
          disabled={status === "submitting"}
          aria-busy={status === "submitting"}
        >
          {status === "submitting" ? "Joining..." : submitLabel}
        </button>
        <p id={`${formId}-note`} className="waitlist-note">
          {note}
        </p>
      </div>
    </form>
  );
}

function WaitlistCount() {
  const [count, setCount] = useState<number | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");

  useLayoutEffect(() => {
    let isMounted = true;

    async function loadCount() {
      try {
        const response = await fetch("/api/waitlist/count", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load waitlist count");
        }

        const data = (await response.json()) as { count?: number };

        if (!isMounted) {
          return;
        }

        setCount(typeof data.count === "number" ? data.count : 0);
        setStatus("ready");
      } catch {
        if (!isMounted) {
          return;
        }

        setStatus("unavailable");
      }
    }

    void loadCount();

    const handleJoined = () => {
      setCount((current) => (typeof current === "number" ? current + 1 : current));
      setStatus("ready");
    };

    window.addEventListener("otpay:waitlist-joined", handleJoined);

    return () => {
      isMounted = false;
      window.removeEventListener("otpay:waitlist-joined", handleJoined);
    };
  }, []);

  return (
    <div className="payment-preview-card is-metric">
      <p>Waitlist</p>
      <strong>{status === "ready" ? count?.toLocaleString() : "Live soon"}</strong>
      <span>
        {status === "ready"
          ? "People already signed up"
          : "Connect Supabase to show the live count"}
      </span>
    </div>
  );
}

function CelebrationModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  useLayoutEffect(() => {
    if (!isOpen || !modalRef.current) {
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      return;
    }

    const context = gsap.context(() => {
      gsap.from(".js-celebration-backdrop", {
        autoAlpha: 0,
        duration: 0.18,
        ease: "power2.out",
      });

      gsap.from(".js-celebration-modal", {
        y: 24,
        scale: 0.96,
        autoAlpha: 0,
        duration: 0.28,
        ease: "power2.out",
      });

      gsap.from(".js-confetti", {
        y: -10,
        autoAlpha: 0,
        scale: 0.8,
        stagger: 0.04,
        duration: 0.24,
        ease: "back.out(1.6)",
      });
    }, modalRef);

    return () => {
      context.revert();
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const shareText = encodeURIComponent(
    "I just joined the @otpay1 waitlist for phone-number-native payments on Solana. Early believers might even catch the token if one ever drops.",
  );

  return (
    <div
      ref={modalRef}
      className="celebration-backdrop js-celebration-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="celebration-title"
      onClick={onClose}
    >
      <div className="celebration-modal js-celebration-modal" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="celebration-close"
          aria-label="Close celebration popup"
          onClick={onClose}
        >
          Close
        </button>
        <div className="celebration-burst" aria-hidden="true">
          <span className="confetti-chip js-confetti">+1</span>
          <span className="confetti-chip js-confetti">SOL</span>
          <span className="confetti-chip js-confetti">OTP</span>
          <span className="confetti-chip js-confetti">X</span>
        </div>
        <p className="celebration-kicker">You made the list</p>
        <h3 id="celebration-title">You might be early enough for the token story.</h3>
        <p className="celebration-copy">
          Thanks for joining OTPay. If we ever launch a community token, early believers
          like you should be closest to the front of the line.
        </p>
        <div className="celebration-actions">
          <a
            className="celebration-share"
            href={`https://x.com/intent/tweet?text=${shareText}`}
            target="_blank"
            rel="noreferrer"
          >
            Share on X
          </a>
          <a
            className="celebration-follow"
            href="https://x.com/otpay1"
            target="_blank"
            rel="noreferrer"
          >
            Follow @otpay1
          </a>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  const rootRef = useRef<HTMLElement>(null);
  const [celebrationOpen, setCelebrationOpen] = useState(false);

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
          <a className="nav-link" href="#waitlist">
            Join waitlist
          </a>
          <Link className="nav-link nav-social" href="/link-phone">
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
            <a className="hero-secondary-link" href="#waitlist">
              Join waitlist
            </a>
          </div>
        </div>

        <div id="waitlist" className="hero-panel js-hero-panel">
          <div className="hero-orb js-orbit" aria-hidden="true" />
          <div className="panel-topline">
            <span className="panel-badge">Early access</span>
            <span className="panel-mono">Solana rail.</span>
          </div>

          <div className="payment-preview">
            <WaitlistCount />
          </div>

          <WaitlistForm
            formId="hero"
            note="Early access · No spam · Unsubscribe anytime"
            submitLabel="Join Waitlist"
            onSuccess={() => setCelebrationOpen(true)}
          />

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
          <p className="section-kicker">Get in early</p>
          <h2>Be first to try it.</h2>
          <p>
            We&apos;re opening access to early builders, operators, and users who want
            to test phone-number-native payments on Solana before the public launch.
          </p>
        </div>
        <div className="bottom-cta-panel">
          <WaitlistForm
            formId="footer"
            note="Join the first OTPay waitlist"
            submitLabel="Reserve Spot"
            onSuccess={() => setCelebrationOpen(true)}
          />
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
      <CelebrationModal isOpen={celebrationOpen} onClose={() => setCelebrationOpen(false)} />
    </main>
  );
}
