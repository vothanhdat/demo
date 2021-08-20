import hre from "hardhat"
import { ethers } from "hardhat"
import { BabyShikokuToken__factory as BabyShikokuToken } from "../typechain";

const pancakeSwapRoute = "0xD99D1c33F9fC3444f8101754aBC46c52416550D1"

const distributes: [string, number][] = [
  ["0x9eA653A01E3Cf1BA8a6aA17Cf34BCa8ee748480C", 100],
]


async function deployToken() {
  console.log("deploying ...")
  // console.assert(distributes.map(e => e[1]).reduce((e, f) => e + f, 0) == 100, "Percent must be full")

  const [deployer] = await ethers.getSigners();

  const BabyShikokuTokenDeployer = await new BabyShikokuToken(deployer)
    .deploy()

  const totalSulply = await BabyShikokuTokenDeployer.totalSupply()


  const amountToDistribute = totalSulply

  for (let [address, percent] of distributes) {

    await BabyShikokuTokenDeployer.connect(deployer)
      .transfer(address, amountToDistribute.mul(percent).div(100).toString())

    console.log("Transfered -> %s : %s %s", address, percent, Number(amountToDistribute.mul(percent).div(100)) / 1e9)

    await BabyShikokuTokenDeployer.excludeFromFee(address)
  }

  await BabyShikokuTokenDeployer.initUniswapRoute(pancakeSwapRoute);


  await BabyShikokuTokenDeployer.setMaxTxPercent(100)

  await hre.run("verify:verify", {
    address: BabyShikokuTokenDeployer.address,
    constructorArguments: [],
  })

}

deployToken()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
