require("@nomicfoundation/hardhat-ethers");
// Load blockchain-local .env first, then fall back to backend/.env for shared vars
require("dotenv").config();
require("dotenv").config({ path: "../backend/.env", override: false });

// Resolve the signing key: prefer BESU_PRIVATE_KEY, fall back to PRIVATE_KEY
const signingKey =
  process.env.BESU_PRIVATE_KEY ||
  process.env.PRIVATE_KEY ||
  "0x0000000000000000000000000000000000000000000000000000000000000000";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    hardhat: {
      chainId: 31337,
    },
    besu: {
      url: process.env.BESU_RPC_URL || "http://49.249.165.17:8080/rpc-node2/",
      accounts: [signingKey],
      // Hyperledger Besu IBFT2 / QBFT permissioned network — no gas cost
      gasPrice: 0,
      gas: 5000000,
      // Let Hardhat auto-detect chainId from the node at runtime
      // (avoids mismatch if the Besu network chainId differs)
    },
  },
};