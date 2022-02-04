const {expect, increaseTime, getContractAt, getBalance, increaseBlock} = require("./utils/testHelper");
const Ethers = require("ethers");

const hre = require("hardhat");
describe("UniLPZapin", function () {
  it("Should zapin successfully", async function () {
    // const UniZapin = await ethers.getContractFactory("UniswapV2_ZapIn_General_V5");
    // const uniZapin = await getContractAt("UniswapV2_ZapIn_General_V5", "0x6D9893fa101CD2b1F8D1A12DE3189ff7b80FdC10");
    [alice, devfund, treasury] = await hre.ethers.getSigners();
    console.log(devfund.address)
    const fromToken = await getContractAt("ERC20", "0x514910771af9ca656af840dff83e8264ecf986ca");
    console.log(await fromToken.balanceOf(devfund.address))

    console.log(await getBalance(devfund.address))

    
  });
});
