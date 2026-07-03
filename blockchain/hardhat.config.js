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
  },
};
