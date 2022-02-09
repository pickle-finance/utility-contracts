const {
  expect,
  deployContract,
  getContractAt,
  getBalance,
} = require("./utils/testHelper");
const Ethers = require("ethers");
const hre = require("hardhat");
const { ethers } = require("hardhat");
const { ZERO_ADDRESS, UNI_ROUTER, WETH } = require("./utils/constants");

const BN = Ethers.BigNumber;

let alice;
let pickleUniZap;

describe("UniZapIn", function () {
  before("deploying contract :::: ", async function () {
    pickleUniZap = await deployContract(
      "contracts/Pickle_UniV2_ZapIn_V1.sol:Pickle_UniV2_ZapIn_V1",
      [UNI_ROUTER]
    );
    console.log("✅ pickleUniZap deployed at: ", pickleUniZap.address);
  });

  it("Should zapin successfully (eth --> looks/weth)", async function () {
    const pairAddress = "0xDC00bA87Cc2D99468f7f34BC04CBf72E111A32f7"; // Uniswap V2: LOOKS 3
    const pairContract = await getContractAt("ERC20", pairAddress);
    const signers = await hre.ethers.getSigners();
    alice = signers[0];
    const pUNILOOKSETH = "0x69CC22B240bdcDf4A33c7B3D04a660D4cF714370";

    const initialLPBalance = await pairContract.balanceOf(pickleUniZap.address);
    const initialAliceBalance = await getBalance(alice.address);

    console.log("initial LP balance : ", initialLPBalance);
    console.log("Alice's initial balance : ", initialAliceBalance);

    const tx = await pickleUniZap
      .connect(alice)
      .ZapIn(
        ZERO_ADDRESS,
        Ethers.BigNumber.from(10).pow(18),
        pairAddress,
        pUNILOOKSETH,
        0,
        WETH,
        ZERO_ADDRESS,
        false,
        UNI_ROUTER,
        false,
        {
          value: Ethers.BigNumber.from(10).pow(18),
        }
      );
    const txData = await tx.wait();
    const tokensReceived = txData.events.find(
      (event) => event.event === "zapIn"
    ).args.tokensRec;
    const finalAliceBalance = await getBalance(alice.address);
    console.log("Alice's final balance : ", finalAliceBalance);
    console.log("pTokens received : ", tokensReceived);
  });

  it("Should zapin successfully (eth --> mqqq/ust)", async function () {
    const pairAddress = "0x9E3B47B861B451879d43BBA404c35bdFb99F0a6c"; // Uniswap V2: MQQQ - UST 3
    const pJar = "0x7C8de3eE2244207A54b57f45286c9eE1465fee9f";
    const pJarContract = await getContractAt("ERC20", pJar);
    const signers = await hre.ethers.getSigners();
    const alice = signers[0];
    const uniFactory = await getContractAt("IUniswapV2Router02", UNI_ROUTER);
    const swapData = await uniFactory.populateTransaction.swapExactETHForTokens(
      1,
      [WETH, "0xa47c8bf37f92abed4a126bda807a7b7498661acd"],
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
        Ethers.BigNumber.from(10).pow(18),
        pairAddress,
        pJar,
        0,
        UNI_ROUTER,
        swapData.data,
        false,
        UNI_ROUTER,
        false,
        {
          value: Ethers.BigNumber.from(10).pow(18),
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
    const balanceDiff = pJarBalanceFinal - pJarBalanceInitial;
  });

  it("Should zapin successfully (dai --> mqqq/ust)", async function () {
    // swap eth with dai --> gwt dai balance
    const UST = "0xa47c8bf37f92abed4a126bda807a7b7498661acd";
    const Dai = "0x6b175474e89094c44da98b954eedeac495271d0f";
    const daiContract = await getContractAt("ERC20", Dai);

    const pairAddress = "0x9E3B47B861B451879d43BBA404c35bdFb99F0a6c"; // Uniswap V2: MQQQ - UST 3
    const pJar = "0x7C8de3eE2244207A54b57f45286c9eE1465fee9f";
    const pJarContract = await getContractAt("ERC20", pJar);
    const signers = await hre.ethers.getSigners();
    const alice = signers[0];
    const uniFactory = await getContractAt("IUniswapV2Router02", UNI_ROUTER);

    const pJarBalanceInitial = await pJarContract.balanceOf(alice.address);
    const initialAliceBalance = await getBalance(alice.address);
    console.log("Alice's initial balance : ", initialAliceBalance);
    console.log("Alice's Initial pJar balance", pJarBalanceInitial);

    await uniFactory.swapExactETHForTokens(
      1,
      [WETH, Dai],
      alice.address,
      7955575163,
      {
        value: Ethers.BigNumber.from(10).pow(18),
      }
    );

    const aliceInitialDaiBalance = await daiContract.balanceOf(alice.address);
    console.log("Alice's Initial Dai balance : ", aliceInitialDaiBalance);

    await daiContract.approve(pickleUniZap.address, aliceInitialDaiBalance, {
      from: alice.address,
    });

    const swapData =
      await uniFactory.populateTransaction.swapExactTokensForTokens(
        aliceInitialDaiBalance,
        0,
        [Dai, WETH, UST],
        pickleUniZap.address,
        7955575163
      );

    const tx = await pickleUniZap
      .connect(alice)
      .ZapIn(
        Dai,
        aliceInitialDaiBalance,
        pairAddress,
        pJar,
        0,
        UNI_ROUTER,
        swapData.data,
        false,
        UNI_ROUTER,
        false
      );
    const txData = await tx.wait();
    const tokensReceived = txData.events.find(
      (event) => event.event === "zapIn"
    ).args.tokensRec;

    const aliceFinalDaiBalance = await daiContract.balanceOf(alice.address);
    console.log(
      "Alice's Dai balance after getting WETH : ",
      aliceFinalDaiBalance
    );
    const pJarBalanceFinal = await pJarContract.balanceOf(alice.address);
    console.log("Alice's Final pJar balance : ", pJarBalanceFinal);
    console.log("pTokensReceived : ", tokensReceived);
    const balanceDiff = pJarBalanceFinal - pJarBalanceInitial;
  });

  it("Should zapin successfully (USDT --> mqqq/ust)", async function () {
    // swap eth with USDT --> gwt dai balance
    const UST = "0xa47c8bf37f92abed4a126bda807a7b7498661acd";
    const USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
    const USDTContract = await getContractAt("ERC20", USDT);

    const pairAddress = "0x9E3B47B861B451879d43BBA404c35bdFb99F0a6c"; // Uniswap V2: MQQQ - UST 3
    const pJar = "0x7C8de3eE2244207A54b57f45286c9eE1465fee9f";
    const pJarContract = await getContractAt("ERC20", pJar);
    const signers = await hre.ethers.getSigners();
    const alice = signers[0];
    const uniFactory = await getContractAt("IUniswapV2Router02", UNI_ROUTER);

    const pJarBalanceInitial = await pJarContract.balanceOf(alice.address);
    const initialAliceBalance = await getBalance(alice.address);
    console.log("Alice's initial balance : ", initialAliceBalance);
    console.log("Alice's Initial pJar balance", pJarBalanceInitial);

    await uniFactory.swapExactETHForTokens(
      1,
      [WETH, USDT],
      alice.address,
      7955575163,
      {
        value: Ethers.BigNumber.from(10).pow(18),
      }
    );

    const aliceInitialUSDTBalance = await USDTContract.balanceOf(alice.address);
    console.log("Alice's Initial USDT balance : ", aliceInitialUSDTBalance);

    await USDTContract.approve(pickleUniZap.address, aliceInitialUSDTBalance, {
      from: alice.address,
    });

    const swapData =
      await uniFactory.populateTransaction.swapExactTokensForTokens(
        aliceInitialUSDTBalance,
        0,
        [USDT, WETH, UST],
        pickleUniZap.address,
        7955575163
      );

    const tx = await pickleUniZap.connect(alice).ZapIn(
      // ZERO_ADDRESS,
      USDT,
      aliceInitialUSDTBalance,
      pairAddress,
      pJar,
      0,
      UNI_ROUTER,
      swapData.data,
      false,
      UNI_ROUTER,
      false
    );

    const txData = await tx.wait();
    const tokensReceived = txData.events.find(
      (event) => event.event === "zapIn"
    ).args.tokensRec;

    const aliceFinalUSDTBalance = await USDTContract.balanceOf(alice.address);
    console.log(
      "Alice's USDT balance after getting WETH : ",
      aliceFinalUSDTBalance
    );
    const pJarBalanceFinal = await pJarContract.balanceOf(alice.address);
    console.log("Alice's Final pJar balance : ", pJarBalanceFinal);
    console.log("pTokensReceived : ", tokensReceived);
  });
});
