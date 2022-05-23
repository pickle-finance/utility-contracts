var Web3 = require("web3");
const WFTM = "0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83";
const SpookySwap = "0xF491e7B69E4244ad4002BC14e878a34207E38c29";
const Solidly = "0xa38cd27185a464914D3046f0AB9d43356B34829D";
const SpiritSwap = "0x16327E3FbDaCA3bcF7E38F5Af2599D2DDc33aE52";
const main = async () => {
await hre.run("verify:verify", {
  address: "0x079546926bd2743b4a685E1551F9600Dc6BD5b28",
  constructorArguments: [
    [SpiritSwap, SpookySwap, Solidly],
    WFTM
  ],
});
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

