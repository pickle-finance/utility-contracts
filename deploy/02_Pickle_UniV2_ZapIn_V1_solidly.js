var Web3 = require("web3");
const main = async () => {
  const WFTM = "0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83";
  const SpookySwap = "0xF491e7B69E4244ad4002BC14e878a34207E38c29";
  const Solidly = "0xa38cd27185a464914D3046f0AB9d43356B34829D";
  const SpiritSwap = 	"0x16327E3FbDaCA3bcF7E38F5Af2599D2DDc33aE52";
  const [deployer] = await ethers.getSigners();
  const bal = await ethers.provider.getBalance(deployer.address);
  const uniV2Zapin = await ethers.getContractFactory(
    "contracts/Pickle_UniV2_ZapIn_V1_solidly.sol:Pickle_UniV2_ZapIn_V1"
  );
  const uniZap = await uniV2Zapin.deploy(
    [SpiritSwap, SpookySwap, Solidly],
    WFTM
  );
  console.log("pickle unizap solidy deployed at : ",uniZap.address);
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
