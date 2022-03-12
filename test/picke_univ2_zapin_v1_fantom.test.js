const {
  expect,
  deployContract,
  getContractAt,
  getBalance,
} = require("./utils/testHelper");
const Ethers = require("ethers");
const hre = require("hardhat");
const { ethers } = require("hardhat");
const { ZERO_ADDRESS, SOLIDLY_ROUTER, WFTM, moonETH, moonUSDC} = require("./utils/constants");

const BN = Ethers.BigNumber;

describe("UniZapIn", function () {
  before("deploying contract :::: ", async function () {
    pickleUniZap = await deployContract(
      "contracts/Pickle_UniV2_ZapIn_V1_solidly.sol:Pickle_UniV2_ZapIn_V1",
      [SOLIDLY_ROUTER],
      WFTM
    );
    console.log("✅ pickleUniZap deployed at: ", pickleUniZap.address);
  });

  it("Should zapin successfully (FTM -> WFTM/SEX)", async function () {
    const pairAddress = "0xFCEC86aF8774d69e2e4412B8De3f4aBf1f671ecC"; // WFTM/SEX
    const signers = await hre.ethers.getSigners();
    alice = signers[0];

    const pJar = "0xFc3c538931f97458c0F44E6852768A74175DB5C2";
    const pJarContract = await getContractAt("ERC20", pJar);
    const pJarBalanceInitial = await pJarContract.balanceOf(alice.address);
    const initialAliceBalance = await getBalance(alice.address);
    console.log("Alice's initial balance : ", initialAliceBalance);
    console.log("Alice's initial pJar balance : ", pJarBalanceInitial);

    const tx = await pickleUniZap
      .connect(alice)
      .ZapIn(
        ZERO_ADDRESS,
        BN.from(10).pow(18),
        pairAddress,
        pJar,
        0,
        WFTM,
        ZERO_ADDRESS,
        false,
        SOLIDLY_ROUTER,
        false,
        {
          value: BN.from(10).pow(18),
        }
      );
    const txData = await tx.wait();
    const tokensReceived = txData.events.find(
      (event) => event.event === "zapIn"
    ).args.tokensRec;
    const finalAliceBalance = await getBalance(alice.address);
    const pJarBalanceFinal = await pJarContract.balanceOf(alice.address);
    console.log("Alice's final balance : ", finalAliceBalance);
    console.log("pTokens received : ", tokensReceived);
    expect(tokensReceived).equal(
      BN.from(pJarBalanceFinal).sub(BN.from(pJarBalanceInitial))
    );
  });
});
