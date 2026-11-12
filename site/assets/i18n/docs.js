// Docs page strings. English is the source; ko and ja are filled by the translator.
CJ.dict({
  en: {
    "docs.title": "Swap guide",
    "docs.lede": "How to swap old CT for new CT on Kaia, how 10% now and 90% after 7 days works, what it costs and how to stay safe.",
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
    "docs.before.gas": "<strong>Use Kaia Wallet to swap for free.</strong> With Kaia Wallet, Cojam pays the network fee for approving, swapping and claiming. With MetaMask, keep a little KAIA in the same wallet for each transaction.",

    "docs.step1.t": "Connect",
    "docs.step1.b": "Open the Swap page, choose Connect wallet and pick your wallet. If it is on another network, the page offers one button to switch to Kaia.",
    "docs.step2.t": "Approve",
    "docs.step2.b": "The first time, your wallet asks you to let the swap contract move the old CT you chose. This is its own transaction and costs a little gas.",
    "docs.step3.t": "Swap",
    "docs.step3.b": "Enter an amount (your full balance is filled in) and confirm. Your old CT goes to the swap contract, and in the same transaction 10% of the new CT arrives in your wallet. The other 90% is locked for 7 days.",
    "docs.step4.t": "Wait 7 days",
    "docs.step4.b": "The Swap page shows the date and a countdown for the 90%. You can close the page; nothing else is needed while you wait.",
    "docs.step5.t": "Receive the 90%",
    "docs.step5.b": "After 7 days a Cojam keeper sends the 90% to your wallet automatically, shortly after the unlock, and pays the gas. You do not need to come back. If you do not want to wait, open the Swap page with the same wallet and choose Claim.",
    "docs.step6.t": "Add new CT to your wallet",
    "docs.step6.b": "Choose Add new CT to wallet, or add the token by hand with the new CT address under Contracts and audit. Compare the full address, not the ticker.",

    "docs.lock.lot": "Each swap is its own lot. 10% of it arrives at once, and the other 90% has its own 7 day lock. Swap twice and you get two lots with two unlock dates.",
    "docs.lock.split": "The 10% is rounded down to the smallest unit of CT and the locked part is the rest, so the two always add up to exactly what you swapped.",
    "docs.lock.time": "The lock starts when the swap is confirmed on chain and ends exactly 7 days later.",
    "docs.lock.keeper": "After the unlock, anyone can trigger the release, but it always pays the wallet that swapped. Cojam runs a keeper that sends it shortly after the unlock and pays the gas. No one can redirect it.",
    "docs.lock.claim": "You can also claim it yourself at any time after the unlock, for example if the keeper is late. There is no deadline.",
    "docs.lock.why": "Why the lock: it deters swap abuse and favours real holders. Only 10% is free at once, so swapping just to sell straight away does not pay.",
    "docs.lock.window": "The swap window is open for 1 year from launch, the day the swap contract is deployed: {start} to {end}. After it closes no new swaps are possible, but locked 90% remainders still release.",
    "docs.lock.reserve": "New CT that is not swapped by the end of the window goes to the new Cojam treasury multisig, whose address is published at launch.",

    "docs.sp.exchange.t": "CT on an exchange",
    "docs.sp.exchange.b": "The exchange handles the swap for CT it holds for you. The list of exchanges is to be announced. Follow your exchange's own notice.",
    "docs.sp.pool.t": "CT in a Klayswap pool",
    "docs.sp.pool.b": "Remove your liquidity first so the CT is back in your wallet, then swap it.",
    "docs.sp.multisig.t": "Smart contract wallets and multisigs",
    "docs.sp.multisig.b": "Any Kaia wallet that can approve and call the swap contract can swap. A multisig needs its signers for the approval and the swap. The 90% is released to the same address that swapped.",
    "docs.sp.lost.t": "Lost access",
    "docs.sp.lost.b": "If you lost the seed phrase or private key for a wallet, no one can move its CT, including Cojam. The team cannot swap on your behalf.",
    "docs.sp.small.t": "Very small balances",
    "docs.sp.small.b": "Any amount above 0 can be swapped. With MetaMask, the gas in KAIA may cost more than a very small amount of CT is worth; with Kaia Wallet the swap is free.",

    "docs.fees.b": "The swap charges no fee and the rate is always 1 old CT to 1 new CT. The only cost is the Kaia network fee, and with Kaia Wallet Cojam pays it for you.",
    "docs.fees.kaia": "<strong>Kaia Wallet: free.</strong> Kaia supports fee delegation: you sign the transaction in your wallet, and Cojam's fee payer co-signs it and pays the fee. You need no KAIA to approve, swap or claim. WalletConnect wallets that support fee delegation work the same way.",
    "docs.fees.mm": "<strong>MetaMask: a small fee in KAIA.</strong> MetaMask cannot sign Kaia fee delegated transactions, so you pay the network fee yourself for each approval, swap and claim. Your wallet shows the exact fee before you confirm.",
    "docs.fees.payer": "<strong>What the fee payer can do.</strong> It only pays fees for approving old CT to the swap contract, swapping and claiming on the Cojam contracts, with a limit per wallet. It cannot sign for you and can never move your tokens.",
    "docs.fees.down": "<strong>If the fee payer is busy.</strong> The Swap page says so and nothing is sent. Retry, or pay the fee yourself in KAIA.",
    "docs.fees.release": "<strong>The automatic release is always free.</strong> The keeper pays the gas to send you the 90%, from the same Cojam gas wallet.",

    "docs.gas.t": "Get KAIA for MetaMask",
    "docs.gas.b": "Only MetaMask users need KAIA. With Kaia Wallet the swap is free, so the simplest fix is to swap with Kaia Wallet instead.",
    "docs.gas.buy": "<strong>Buy KAIA</strong> on an exchange that lists it, then withdraw it to the same wallet address that holds your old CT.",
    "docs.gas.net": "<strong>Pick the Kaia network when you withdraw.</strong> KAIA sent on another network does not arrive in your Kaia wallet.",
    "docs.gas.much": "<strong>How much:</strong> Kaia fees are small, and well under 1 KAIA covers approving, swapping and claiming. Your wallet shows the exact fee before you confirm.",

    "docs.safe.seed": "<strong>Never share your seed phrase or private key.</strong> No real page or person needs it.",
    "docs.safe.dm": "<strong>No one from Cojam will message you first.</strong> Anyone who contacts you about the swap in a DM is not us.",
    "docs.safe.links": "<strong>Use only official links.</strong> Ignore links in replies, ads and DMs.",
    "docs.safe.send": "<strong>A swap never asks you to send CT to a person or a wallet.</strong> You only interact with the swap contract.",
    "docs.safe.addr": "<strong>Check full addresses.</strong> The ticker CT is used by other tokens too, including some listed on MEXC. Compare the full contract address before you add, buy or swap a token.",

    "docs.c.supply": "New CT has a fixed supply of {supply} CT, exactly the same as old CT after burns. All of it sits in the swap reserve at launch.",
    "docs.c.plain": "New CT is a plain KIP-7 token (ERC-20 compatible, 18 decimals) with no pause, no mint, no blacklist and no owner powers.",
    "docs.c.audit": "Audit in progress",
    "docs.c.audit_b": "The report will be linked here when it is published.",

    "docs.contact.b": "Official support channels are to be announced. Until then, treat any account that offers help in a DM as a scam.",
    "docs.cta": "Go to Swap"
  },
  ko: {},
  ja: {}
});
