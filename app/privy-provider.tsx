"use client";

import { PrivyProvider } from "@privy-io/react-auth";

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

export function OTPayPrivyProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!privyAppId) {
    return children;
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: ["sms"],
        appearance: {
          walletChainType: "solana-only",
          landingHeader: "Log in to OTPay",
          loginMessage: "Verify your phone number and access your Solana payment profile.",
        },
        intl: {
          defaultCountry: "NP",
        },
        embeddedWallets: {
          showWalletUIs: false,
          solana: {
            createOnLogin: "all-users",
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
