const {expect, deployContract, getContractAt, getBalance} = require("./utils/testHelper");
const Ethers = require("ethers");
const hre = require("hardhat");
const { ethers } = require("hardhat");
const { ZERO_ADDRESS, UNI_ROUTER, WETH } = require("./utils/constants");

const BN = Ethers.BigNumber;

let alice;
let pickleUniZap;

describe("UniLPZapin native currency", function () {
  before("Setup", async function () {
    pickleUniZap = await deployContract("contracts/Pickle_UniV2_ZapIn_V1.sol:Pickle_UniV2_ZapIn_V1",
      [UNI_ROUTER]
    );
    console.log("✅ pickleUniZap is deployed at ", pickleUniZap.address);
  })

  it("Should zapin successfully with WETH intermediate", async function () {
    // ETH/LOOKS uni pool zapin
    const pairAddress = "0xDC00bA87Cc2D99468f7f34BC04CBf72E111A32f7"
    const pJar = "0x69CC22B240bdcDf4A33c7B3D04a660D4cF714370";
    const pJarToken = await getContractAt("ERC20", pJar);
    

    signers = await hre.ethers.getSigners();
    alice = signers[0]
    console.log("Initial pToken balance", await pJarToken.balanceOf(alice.address))
    console.log("Initial alice balance", await getBalance(alice.address))

    await pickleUniZap.ZapIn(
      ZERO_ADDRESS,
      BN.from(10).pow(18),
      pairAddress,
      pJar,
      0,
      WETH,
      ZERO_ADDRESS,
      true,
      UNI_ROUTER,
      false,
      {
        from: alice.address,
        value: BN.from(10).pow(18)
      }
    )

    console.log("Final pToken balance", await pJarToken.balanceOf(alice.address))
    console.log("Final alice balance", await getBalance(alice.address))    
  });

  it("Should zapin successfully with a token intermediate", async function () {
    // MBABA/UST uni pool zapin 
    const pairAddress = "0x676Ce85f66aDB8D7b8323AeEfe17087A3b8CB363"
    const pJar = "0x1CF137F651D8f0A4009deD168B442ea2E870323A";
    const pJarToken = await getContractAt("ERC20", pJar);
    
    const uniFactory = await getContractAt("IUniswapV2Router02", UNI_ROUTER);


    signers = await hre.ethers.getSigners();
    alice = signers[0]
    console.log("Initial pJar balance", await pJarToken.balanceOf(alice.address))
    console.log("Initial alice balance", await getBalance(alice.address))
    
    const swapData = await uniFactory.populateTransaction.swapExactETHForTokens(
      1,
      [WETH, "0xa47c8bf37f92abed4a126bda807a7b7498661acd"],
      pickleUniZap.address,
      7955575163
    )

    await pickleUniZap.ZapIn(
      ZERO_ADDRESS,
      BN.from(10).pow(18),
      pairAddress,
      pJar,
      0,
      UNI_ROUTER,
      swapData.data,
      true,
      UNI_ROUTER,
      false,
      {
        from: alice.address,
        value: BN.from(10).pow(18)
      }
    )

    console.log("Final pJar balance", await pJarToken.balanceOf(alice.address))
    console.log("Final alice balance", await getBalance(alice.address))    
  });
});
