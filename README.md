# Utility Contracts

This project includes utility smart contracts for Pickle infrastructure.

Compile contracts:

```shell
npx hardhat compile
```

Run tests on ETHEREUM:

Change hardhat.config.js.networks.hardhat.forking.url: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`

```shell
npx hardhat test test/picke_univ2_zapin_v1_ethereum.test.JS
```

Run tests on MOONBEAM

Change hardhat.config.js.networks.hardhat.forking.url: 'https://rpc.api.moonbeam.network'

```shell
npx hardhat test test/picke_univ2_zapin_v1_moonbeam.test.js
```