# Review: wallet.html (W1 Wallet)

Checked in KO at 390x844 and 360x780, EN and JA at 390x844 (JA also at 360). Tapped both copy buttons with clipboard permission and read the clipboard. `audit.js`: clean (the mono flags are the hex address, which is correct use; it is 13px).

## Design: 65 / 100

| Criterion | Score | Evidence |
| --- | --- | --- |
| Hierarchy | 6 | The subtitle promises "포인트와 CT, 그리고 지갑 주소예요", but the address is the last block: its copy button is at y 754 at 390x844 (tab bar at 782) and fully off screen at 360x780. |
| Layout | 7 | Points card, CT card, two actions, address. Logical, but the two address blocks at the bottom look identical. |
| Spacing | 7 | Even. The CT card rows are tall (staking and KAIA rows 70px each). |
| Type | 7 | Balance figures in the wide face are strong. The address at 13px mono in 4 character groups is careful but small for something people verify by eye. |
| Colour | 6 | The points figure is lime text at display size (not an action). The lime button on the ink card has no ink edge or offset shadow, unlike every other primary button. |
| Consistency | 6 | Primary button style differs from login, staking and done. Header pill shows "+50" only here. |
| Density | 7 | Right amount for a wallet home. |
| Copy | 6 | "여기서 CT는 새 CT예요" is a sentence used as the label of a contract address. "1 CT로 바꿀 수 있어요" for 1,250P leaves the rate and the 250P remainder unexplained. |
| Mobile | 6 | Address below the fold on the small size. |
| Finish | 7 | Clean cards. The copy toast covers the address block and the button that just turned into a tick. |

## Usability: 25 / 40

| Heuristic | Score | Evidence |
| --- | --- | --- |
| Visibility of status | 3 | "7초 전 업데이트", pending "+50P, 22:10쯤 지급". Copy feedback exists but hides its own source. |
| Match with the real world | 3 | 입금 and 출금 are the right words. The KAIA row explains why KAIA is there. |
| User control | 3 | Plain navigation. |
| Consistency and standards | 3 | Copy and open icons are standard glyphs. |
| Error prevention | 1 | The token contract address sits directly under the wallet address in the same grey box with the same copy button. Clipboard after the second tap: `0x91cb…71a2`, the contract. The toast says the same "주소를 복사했어요." for both. A player who pastes that into an exchange withdrawal loses the funds. |
| Recognition over recall | 2 | Copy and explorer are icon only, 44px circles with no text. |
| Flexibility and efficiency | 3 | Deposit, withdraw, convert and staking are one tap away. No QR on this screen (deposit has it). |
| Minimal design | 3 | Fine. |
| Error recovery | 2 | Nothing tells the player which address was copied. |
| Help | 2 | No line saying "send only Kaia network CT to this address" near the address. |

## Top 5 fixes

1. **Second address block "여기서 CT는 새 CT예요" with `button[aria-label="새 CT 컨트랙트 주소 복사"]`.** It invites copying a contract as if it were a deposit address. Move it into a collapsed "토큰 정보" disclosure, label it "새 CT 토큰 컨트랙트 (여기로 보내지 마세요)", and make its toast say "컨트랙트 주소를 복사했어요."
2. **Block "내 Cojam 지갑 (Kaia)".** The task target is last and below the fold at 360x780. Move it directly under the header (above the points card) as one compact row: label, short address, and a text button "주소 복사".
3. **Icon only buttons `주소 복사` and `Kaiascan에서 보기`.** Add visible text to copy ("복사") and keep the explorer as an icon; raise the address to 15px.
4. **Toast after copy.** It covers the address and the tick. Show the confirmation in place: the button label changes to "복사됨" for 2 seconds, and the toast names the address ("내 지갑 주소를 복사했어요: 0x7A3f…1C7e").
5. **"포인트 전환" button and the `.fig--volt` points figure in the ink card.** Give the button the standard ink edge with a lime or white offset shadow so it matches the other primary buttons, make the figure white, and change the line to "1,000P = 1 CT, 지금 1 CT로 바꿀 수 있어요".
