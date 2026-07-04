require("@nomicfoundation/hardhat-ethers");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  networks: {
    // `npx hardhat node` serves here; the backend's RPC_URL points at it.
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    hardhat: {
      chainId: 31337,
    },
    besu: {
      url: "http://10.11.0.7:8545",
      accounts: ["8f2a55949038a9610f50fb23b5883af3b4ecb3c3bb792cbcefbd1542c692be63"],
      chainId: 1337,
    },
  },
};
