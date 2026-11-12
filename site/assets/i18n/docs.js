// Docs page strings. English is the source; ko and ja are filled by the translator.
CJ.dict({
  en: {
    "docs.title": "Swap guide",
    "docs.lede": "How to swap old CT for new CT on Kaia, what the 7 day lock means and how to stay safe.",
    "docs.toc": "On this page",
    "docs.jump": "Jump to a section",

    "docs.s.before": "Before you start",
    "docs.s.steps": "Step by step",
    "docs.s.lock": "Lock rules",
    "docs.s.special": "Special cases",
    "docs.s.fees": "Fees",
    "docs.s.safety": "Safety",
    "docs.s.contracts": "Contracts and audit",
    "docs.s.contact": "Contact",

    "docs.before.site": "<strong>Check the site.</strong> The official web address is announced at launch. Type it yourself or use a bookmark, and check the address bar before you connect a wallet.",
    "docs.before.wallet": "<strong>Use a wallet that works on Kaia.</strong> Kaia Wallet, MetaMask with the Kaia network added (chain ID 8217), or any wallet that connects through WalletConnect.",
    "docs.before.gas": "<strong>Keep some KAIA in the same wallet.</strong> Approving, swapping and claiming are separate transactions, and each one pays a small gas fee in KAIA.",

    "docs.step1.t": "Connect",
    "docs.step1.b": "Open the Swap page, choose Connect wallet and pick your wallet. If it is on another network, the page offers one button to switch to Kaia.",
    "docs.step2.t": "Approve",
    "docs.step2.b": "The first time, your wallet asks you to let the swap contract move the old CT you chose. This is its own transaction and costs a little gas.",
    "docs.step3.t": "Swap",
    "docs.step3.b": "Enter an amount (your full balance is filled in) and confirm. Your old CT goes to the swap contract and the same amount of new CT is locked for you.",
    "docs.step4.t": "Wait 7 days",
    "docs.step4.b": "The Swap page shows the unlock date and a countdown. You can close the page; nothing else is needed while you wait.",
    "docs.step5.t": "Claim",
    "docs.step5.b": "After the unlock date, open the Swap page with the same wallet and choose Claim. The new CT moves to your wallet.",
    "docs.step6.t": "Add new CT to your wallet",
    "docs.step6.b": "Choose Add new CT to wallet, or add the token by hand with the new CT address under Contracts and audit. Compare the full address, not the ticker.",

    "docs.lock.lot": "Each swap is its own lot with its own 7 day lock. Swap twice and you get two lots with two unlock dates.",
    "docs.lock.time": "The lock starts when the swap is confirmed on chain and ends exactly 7 days later.",
    "docs.lock.claim": "After that you can claim at any time. There is no deadline to claim.",
    "docs.lock.window": "The swap window runs from {start} to {end}. After it closes no new swaps are possible, but claims of locked swaps still work.",
    "docs.lock.reserve": "New CT that is not swapped by the end of the window goes to the Cojam treasury (issuance) wallet, a multisig whose address is published at launch.",

    "docs.sp.exchange.t": "CT on an exchange",
    "docs.sp.exchange.b": "The exchange handles the swap for CT it holds for you. The list of exchanges is to be announced. Follow your exchange's own notice.",
    "docs.sp.pool.t": "CT in a Klayswap pool",
    "docs.sp.pool.b": "Remove your liquidity first so the CT is back in your wallet, then swap it.",
    "docs.sp.multisig.t": "Smart contract wallets and multisigs",
    "docs.sp.multisig.b": "Any Kaia wallet that can approve and call the swap contract can swap. A multisig needs its signers for the approval, the swap and later the claim. The new CT is claimed by the same address that swapped.",
    "docs.sp.lost.t": "Lost access",
    "docs.sp.lost.b": "If you lost the seed phrase or private key for a wallet, no one can move its CT, including Cojam. The team cannot swap on your behalf.",
    "docs.sp.small.t": "Very small balances",
    "docs.sp.small.b": "Any amount above 0 can be swapped. For very small amounts, the gas in KAIA may cost more than the CT is worth.",

    "docs.fees.b": "The swap itself charges nothing and the rate is always 1 old CT to 1 new CT. You pay only Kaia gas, in KAIA, for each approval, swap and claim. Your wallet shows the exact fee before you confirm.",

    "docs.safe.seed": "<strong>Never share your seed phrase or private key.</strong> No real page or person needs it.",
    "docs.safe.dm": "<strong>No one from Cojam will message you first.</strong> Anyone who contacts you about the swap in a DM is not us.",
    "docs.safe.links": "<strong>Use only official links.</strong> Ignore links in replies, ads and DMs.",
    "docs.safe.send": "<strong>A swap never asks you to send CT to a person or a wallet.</strong> You only interact with the swap contract.",
    "docs.safe.addr": "<strong>Check full addresses.</strong> The ticker CT is used by other tokens too, including some listed on MEXC. Compare the full contract address before you add, buy or swap a token.",

    "docs.c.supply": "New CT has a fixed supply of {supply} CT, the same as old CT after burns. All of it sits in the swap reserve at launch.",
    "docs.c.plain": "New CT is a plain KIP-7 token (ERC-20 compatible, 18 decimals) with no pause, no mint, no blacklist and no owner powers.",
    "docs.c.audit": "Audit in progress",
    "docs.c.audit_b": "The report will be linked here when it is published.",

    "docs.contact.b": "Official support channels are to be announced. Until then, treat any account that offers help in a DM as a scam.",
    "docs.cta": "Go to Swap"
  },
  ko: {},
  ja: {}
});
