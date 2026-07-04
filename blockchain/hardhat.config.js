require("@nomicfoundation/hardhat-ethers");
// Load environment variables from a local .env file
require("dotenv").config(); 

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
      url: "http://10.11.0.7:8545",
      // Safely read the key from environment variables with a fallback placeholder
      accounts: [process.env.BESU_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000"],
      chainId: 1337,
      gasPrice: 0,           
      type: "legacy"         
    },
  },
};