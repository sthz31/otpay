export function getSolscanDevnetTransactionUrl(signature: string) {
  return `https://solscan.io/tx/${signature}?cluster=devnet`;
}

export function getSolscanDevnetAddressUrl(address: string) {
  return `https://solscan.io/account/${address}?cluster=devnet`;
}
