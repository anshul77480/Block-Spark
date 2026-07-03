const hre = require("hardhat");

async function main() {
  const fs = require("fs");
  const path = require("path");
  
  const deployedAddressPath = path.join(__dirname, "../deployed_address.txt");
  if (!fs.existsSync(deployedAddressPath)) {
    console.error("Contract deployed address file not found. Deploy the contract first.");
    process.exit(1);
  }
  
  const contractAddress = fs.readFileSync(deployedAddressPath, "utf8").trim();
  console.log(`Loading AuditLog contract at address: ${contractAddress}`);
  
  const AuditLog = await hre.ethers.getContractFactory("AuditLog");
  const contract = await AuditLog.attach(contractAddress);
  
  const total = await contract.totalRecords();
  console.log(`Total records anchored on-chain: ${total}\n`);
  
  console.log("--------------------------------------------------------------------------------");
  console.log("Index | Event Hash                                                       | Metadata");
  console.log("--------------------------------------------------------------------------------");
  
  for (let i = 0; i < total; i++) {
    const [hash, timestamp, recorder, metadata] = await contract.getRecord(i);
    const date = new Date(Number(timestamp) * 1000).toLocaleString();
    console.log(`${i.toString().padEnd(5)} | ${hash.padEnd(64)} | ${metadata} (${date})`);
  }
  console.log("--------------------------------------------------------------------------------");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
