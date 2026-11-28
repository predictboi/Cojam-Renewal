import { test } from "node:test";
import assert from "node:assert/strict";
import * as shared from "../src/index.ts";

test("index exports ABIs, addresses and time rules", () => {
  assert.ok(shared.cojamPredictAbi.some((x) => x.type === "function" && x.name === "predict"));
  assert.ok(shared.cojamStakingAbi.some((x) => x.type === "function" && x.name === "stake"));
  assert.ok(shared.erc20Abi.some((x) => x.type === "function" && x.name === "transfer"));
  assert.equal(shared.addresses.kaia.ct, "0x91cb3B346C80ff965a9667ba6228834dbedD71a2");
  assert.equal(shared.addressesFor("kairos").chainId, 1001);
  assert.equal(typeof shared.weekOf, "function");
});
