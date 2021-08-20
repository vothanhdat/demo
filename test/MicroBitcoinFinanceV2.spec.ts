


import chai, { expect } from 'chai'
import { ethers, waffle, } from "hardhat"
import { solidity, MockProvider, createFixtureLoader, deployContract } from 'ethereum-waffle'
import { constants, utils, BigNumber, } from 'ethers'
import { UniswapFixture, uniswapFixture } from './shared/fixtures'
import { IUniswapV2Pair, IUniswapV2Pair__factory, MicroBitcoinFinanceV2, MicroBitcoinFinanceV2__factory } from '../typechain'

const { AddressZero, MaxUint256, Zero } = constants
const { defaultAbiCoder, formatEther } = utils

chai.use(solidity)


describe('WBNB POOL WITH FLUSH', () => {
  const provider = waffle.provider

  const [wallet, alice, bob, dev] = provider.getWallets();

  const loadFixture = createFixtureLoader([<any>wallet], provider)

  let swapFixture: UniswapFixture

  let token: MicroBitcoinFinanceV2
  let lpToken: IUniswapV2Pair

  beforeEach(async function () {

    swapFixture = await loadFixture(uniswapFixture)

    token = await new MicroBitcoinFinanceV2__factory(wallet)
      .deploy()

    await token.connect(wallet)
      .initUniswapRoute(swapFixture.router.address)

    lpToken = await IUniswapV2Pair__factory
      .connect(await swapFixture.factory.getPair(token.address, swapFixture.weth.address), wallet)

    await token.connect(wallet)
      .setMaxTxPercent('100')

    await token.connect(wallet)
      .transfer(bob.address, (await token.balanceOf(wallet.address)).toString())

    await token.connect(bob).approve(swapFixture.router.address, MaxUint256);

    await swapFixture.router.connect(bob)
      .addLiquidityETH(
        token.address,
        BigInt(5000e18).toString(), 0,
        0,
        dev.address,
        MaxUint256,
        { value: BigInt(1000e18).toString() }
      )

    await token.connect(wallet)
      .setMaxTxPercent('1')

  })

  it('transfer', async (ctx) => {

    let maxTx = await token._maxTxAmount()

    console.log("[START] OWNER TOKEN-WBNB LP", (Number(await lpToken.balanceOf(wallet.address)) / 1e18).toFixed(2))
    console.log("[START] TOKEN-WBNB LP, WBNB", (Number(await swapFixture.weth.balanceOf(lpToken.address)) / 1e18).toFixed(2))
    console.log("[START] TOKEN-WBNB LP, TOKEN", (Number(await token.balanceOf(lpToken.address)) / 1e18).toFixed(2))

    let totalGas = 0, minGas = Infinity, maxGas = 0;

    for (let i = 0; i < 300; i++) {

      // console.log('bob', (Number(await token.balanceOf(bob.address)) / 1e18).toFixed(0))
      // console.log("bob -> alice ...")
      let bobBalance = await token.balanceOf(bob.address)

      let tx1 = await token
        .connect(bob)
        .transfer(alice.address, (bobBalance.gte(maxTx) ? maxTx : bobBalance).toString())

      await tx1.wait(1)
      totalGas += Number((await tx1.wait()).gasUsed);
      minGas = Math.min(minGas, Number((await tx1.wait()).gasUsed));
      maxGas = Math.max(maxGas, Number((await tx1.wait()).gasUsed));

      // console.log('alice', (Number(await token.balanceOf(alice.address)) / 1e18).toFixed(0))
      // console.log("alice -> bob ...")
      let aliceBalance = await token.balanceOf(alice.address)

      let tx2 = await token
        .connect(alice)
        .transfer(bob.address, (aliceBalance.gte(maxTx) ? maxTx : aliceBalance).toString())

      await tx2.wait(1)
      totalGas += Number((await tx2.wait()).gasUsed);
      minGas = Math.min(minGas, Number((await tx1.wait()).gasUsed));
      maxGas = Math.max(maxGas, Number((await tx1.wait()).gasUsed));

      i % 10 || console.log(i,
        "[wallet] OWNER LP", (Number(await lpToken.balanceOf(wallet.address)) / 1e18).toFixed(2),
        `(${(Number(await swapFixture.weth.balanceOf(lpToken.address)) / 1e18).toFixed(2)} WBNB,${(Number(await token.balanceOf(lpToken.address)) / 1e18).toFixed(2)} TOKEN)`,
        "[contract] STUCK BNB", (Number(await provider.getBalance(token.address)) / 1e18).toFixed(2)
      )
    }
    console.log("[Result] ===============================")

    console.log("[END] OWNER TOKEN-WBNB LP", (Number(await lpToken.balanceOf(wallet.address)) / 1e18).toFixed(2))
    console.log("[END] TOKEN-WBNB LP, WBNB", (Number(await swapFixture.weth.balanceOf(lpToken.address)) / 1e18).toFixed(2))
    console.log("[END] TOKEN-WBNB LP, TOKEN", (Number(await token.balanceOf(lpToken.address)) / 1e18).toFixed(2))

    console.log("[END] STUCK BNB", (Number(await provider.getBalance(token.address)) / 1e18).toFixed(2))
    
    console.log("[GAS] TOTAL", totalGas.toLocaleString("us"))
    console.log("[GAS] MIN", minGas.toLocaleString("us"))
    console.log("[GAS] MAX", maxGas.toLocaleString("us"))

    ctx();
  })

})
