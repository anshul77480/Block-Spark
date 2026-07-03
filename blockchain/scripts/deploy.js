// Deploys AuditLog to the running local node and writes the address to a file
// the Python backend reads (blockchain/deployed_address.txt).
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const AuditLog = await hre.ethers.getContractFactory("AuditLog");
  const auditLog = await AuditLog.deploy();
  await auditLog.waitForDeployment();

  const address = await auditLog.getAddress();
  // ADDRESS_OUT lets Docker write the address to a shared volume the backend reads.
  const outFile = process.env.ADDRESS_OUT || path.join(__dirname, "..", "deployed_address.txt");
  fs.writeFileSync(outFile, address);

  console.log(`AuditLog deployed to: ${address}`);
  console.log(`Address written to:   ${outFile}`);
  console.log("The backend reads this via CONTRACT_ADDRESS_FILE in .env");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
