const {
  expect,
  deployContract,
  getContractAt,
  getBalance,
} = require("./utils/testHelper");
const Ethers = require("ethers");
const hre = require("hardhat");
const { ethers } = require("hardhat");
const { ZERO_ADDRESS, BEAM_ROUTER, WGLMR, moonETH, moonUSDC} = require("./utils/constants");

const BN = Ethers.BigNumber;

describe("UniZapIn", function () {
  before("deploying contract :::: ", async function () {
    pickleUniZap = await deployContract(
      "contracts/Pickle_UniV2_ZapIn_V1.sol:Pickle_UniV2_ZapIn_V1",
      [BEAM_ROUTER],
      WGLMR
    );
    console.log("✅ pickleUniZap deployed at: ", pickleUniZap.address);
  });

  it("Should zapin successfully (GLMR -> WGLMR/GLINT)", async function () {
    const pairAddress = "0x99588867e817023162F4d4829995299054a5fC57"; // WGLMR/GLINT
    const signers = await hre.ethers.getSigners();
    alice = signers[0];

    const pJar = "0xEE4587694b553aE065337ea4BCdb0C43e83bB3f2";
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
        WGLMR,
        ZERO_ADDRESS,
        false,
        BEAM_ROUTER,
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

  it("Should zapin successfully (eth->USDC/ETH)", async function () {
    const ETHContract = await getContractAt("ERC20",moonETH);
    const pairAddress = "0x6ba3071760d46040fb4dc7b627c9f68efaca3000"; // eth/usdc
    const signers = await hre.ethers.getSigners();
    alice = signers[0];
    const pJar = "0x6f40CB33a3FD953A9254356f40a59C3F4e1377D0"; // beamJar 2d
    const pJarContract = await getContractAt("ERC20", pJar);
    const pJarBalanceInitial = await pJarContract.balanceOf(alice.address);
    const initialAliceBalance = await getBalance(alice.address);
    const uniFactory = await getContractAt("IUniswapV2Router02", BEAM_ROUTER);

    console.log("Alice's initial pJar balance : ", pJarBalanceInitial);
    console.log("Alice's initial balance : ", initialAliceBalance);

    await uniFactory.swapExactETHForTokens(
      1,
      [WGLMR, moonETH],
      alice.address,
      7955575163,
      {
        value: BN.from(10).pow(18),
      }
    );

    const aliceInitialETHBalance = await ETHContract.balanceOf(alice.address);
    await ETHContract.approve(pickleUniZap.address, aliceInitialETHBalance, {
        from: alice.address,
      });

    const swapData =
      await uniFactory.populateTransaction.swapExactTokensForTokens(
        aliceInitialETHBalance,
        0,
        [moonETH, moonUSDC],
        pickleUniZap.address,
        7955575163
      );

    const tx = await pickleUniZap
      .connect(alice)
      .ZapIn(
        moonETH,
        aliceInitialETHBalance,
        pairAddress,
        pJar,
        0,
        BEAM_ROUTER,
        swapData.data,
        false,
        BEAM_ROUTER,
        false,
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

  it("Should zapin successfully (GLMR -> ETH/USDC)", async function () {
    const pairAddress = "0x6ba3071760d46040fb4dc7b627c9f68efaca3000"; // USDC/ETH 
    const pJar = "0x6f40CB33a3FD953A9254356f40a59C3F4e1377D0"; // BeamJar 2d
    const pJarContract = await getContractAt("ERC20", pJar);
    const signers = await hre.ethers.getSigners();
    const alice = signers[0];
    const uniFactory = await getContractAt("IUniswapV2Router02", BEAM_ROUTER);

    const swapData = await uniFactory.populateTransaction.swapExactETHForTokens(
      1,
      [WGLMR, moonUSDC],
      pickleUniZap.address,
      7955575163
    );

    const pJarBalanceInitial = await pJarContract.balanceOf(alice.address);
    const initialAliceBalance = await getBalance(alice.address);

    console.log("Alice's initial balance : ", initialAliceBalance);
    console.log("Alice's Initial pJar balance", pJarBalanceInitial);
 
    const tx = await pickleUniZap
      .connect(alice)
      .ZapIn(
        ZERO_ADDRESS,
        BN.from(10).pow(18),
        pairAddress,
        pJar,
        0,
        BEAM_ROUTER,
        swapData.data,
        false,
        BEAM_ROUTER,
        false,
    {
      value: BN.from(10).pow(18),
    }
  );
const txData = await tx.wait();
const tokensReceived = txData.events.find(
  (event) => event.event === "zapIn"
).args.tokensRec;

const pJarBalanceFinal = await pJarContract.balanceOf(alice.address);
console.log("Alice's Final pJar balance", pJarBalanceFinal);
console.log("Final alice balance", await getBalance(alice.address));
console.log("pTokensReceived", tokensReceived);
expect(tokensReceived).equal(BN.from(pJarBalanceFinal).sub(BN.from(pJarBalanceInitial)));
});
  it("Should zapin successfully (ETH -> USDC/USDT)", async function () {
    const ETHContract = await getContractAt("ERC20",moonETH);
    const pairAddress = "0xa35b2c07cb123ea5e1b9c7530d0812e7e03ec3c1"; //  USDC/USDT
    const signers = await hre.ethers.getSigners();
    alice = signers[0];

    const pJar = "0xE6e02865d8E6DF9b529691204FBC630159e7a9de"; //beamjar2g
    const pJarContract = await getContractAt("ERC20", pJar);
    const pJarBalanceInitial = await pJarContract.balanceOf(alice.address);
    const initialAliceBalance = await getBalance(alice.address);
    console.log("Alice's initial balance : ", initialAliceBalance);
    console.log("Alice's initial pJar balance : ", pJarBalanceInitial);
    const uniFactory = await getContractAt("IUniswapV2Router02", BEAM_ROUTER);
    // get initial balance as eth 
   await uniFactory.swapExactETHForTokens(
      1,
      [WGLMR, moonETH],
      alice.address,
      7955575163,
      {
        value: BN.from(10).pow(18),
      }
    );

    const aliceInitialETHBalance = await ETHContract.balanceOf(alice.address);
    console.log("Alice's Initial ETH balance : ",aliceInitialETHBalance);
    await ETHContract.approve(pickleUniZap.address, aliceInitialETHBalance, {
        from: alice.address,
      });
    const swapData =
    await uniFactory.populateTransaction.swapExactTokensForTokens(
      aliceInitialETHBalance,
      0,
      [moonETH, WGLMR, moonUSDC],
      pickleUniZap.address,
      7955575163
    );

    const tx = await pickleUniZap
      .connect(alice)
      .ZapIn(
        moonETH,
        aliceInitialETHBalance,
        pairAddress,
        pJar,
        0,
        BEAM_ROUTER,
        swapData.data,
        false,
        BEAM_ROUTER,
        false,
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
