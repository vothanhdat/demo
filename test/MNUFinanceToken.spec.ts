

const hardhat = require("hardhat")
import { ethers, waffle, } from "hardhat"
import chai, { expect } from 'chai'
import { solidity, MockProvider, createFixtureLoader, deployContract } from 'ethereum-waffle'
import { bigNumberify, expandTo18Decimals, getApprovalDigest, MINIMUM_LIQUIDITY } from './shared/utilities'
import { constants, utils, BigNumber, } from 'ethers'
import { createToken, UniswapFixture, uniswapFixture } from './shared/fixtures'
import { IUniswapV2Pair, IUniswapV2Pair__factory, MUFCFanToken, MUFCFanToken__factory, IERC20 } from '../typechain'

const { AddressZero, MaxUint256, Zero } = constants
const { defaultAbiCoder, formatEther } = utils

chai.use(solidity)


describe('BUSD-POOL', () => {
  const provider = waffle.provider

  // const provider = new MockProvider({
  //   ganacheOptions: {
  //     hardfork: 'istanbul',
  //     mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
  //     gasLimit: 9999999
  //   }
  // })

  const [wallet, alice, bob, dev] = provider.getWallets();


  const loadFixture = createFixtureLoader([<any>wallet], <any>provider)

  let swapFixture: UniswapFixture

  let token: MUFCFanToken
  let busd: IERC20
  let lpToken: IUniswapV2Pair
  let wBNBLPToken: IUniswapV2Pair

  beforeEach(async function () {

    swapFixture = await loadFixture(uniswapFixture)

    token = await ethers
      .getContractFactory("MUFCFanToken")
      .then(factory => <Promise<MUFCFanToken>>factory.connect(wallet).deploy())
    // token = await new MUFCFanToken__factory(wallet)
    //   .deploy()

    busd = await createToken([wallet], 1000000000)

    await swapFixture.factory
      .connect(wallet)
      .createPair(swapFixture.weth.address, busd.address)

    await token.connect(wallet)
      .initUniswapRoute(swapFixture.router.address, busd.address)

    lpToken = await IUniswapV2Pair__factory
      .connect(await swapFixture.factory.getPair(token.address, busd.address), wallet)

    wBNBLPToken = await IUniswapV2Pair__factory
      .connect(await swapFixture.factory.getPair(swapFixture.weth.address, busd.address), wallet)

    await token.connect(wallet)
      .setMaxTxPercent('100')

    await token.connect(wallet)
      .transfer(bob.address, (await token.balanceOf(wallet.address)).toString())

    await busd.connect(wallet)
      .transfer(bob.address, expandTo18Decimals(100000000).toString())

    await token.connect(bob)
      .approve(swapFixture.router.address, MaxUint256);

    await busd.connect(bob)
      .approve(swapFixture.router.address, MaxUint256);

    await swapFixture.router.connect(bob)
      .addLiquidityETH(
        busd.address,
        BigInt(1000000e18).toString(),
        0,
        0,
        bob.address,
        MaxUint256,
        { value: BigInt(1000e18).toString() }
      )

    await swapFixture.router.connect(bob)
      .addLiquidity(
        busd.address,
        token.address,
        BigInt(2200000e18).toString(),
        BigInt(20000e18).toString(),
        0,
        0,
        bob.address,
        MaxUint256,
      )

    await token.connect(wallet)
      .setMaxTxPercent('1')

    console.log("[START] bob WBNB-BUSD LP", (Number(await wBNBLPToken.balanceOf(bob.address)) / 1e18).toFixed(2))
    console.log("[START] WBNB-BUSD LP, BUSD", (Number(await busd.balanceOf(wBNBLPToken.address)) / 1e18).toFixed(2))
    console.log("[START] WBNB-BUSD LP, WBNB", (Number(await swapFixture.weth.balanceOf(wBNBLPToken.address)) / 1e18).toFixed(2))

    console.log("[START] bob TOKEN-BUSD LP", (Number(await lpToken.balanceOf(bob.address)) / 1e18).toFixed(2))
    console.log("[START] TOKEN-BUSD LP, BUSD", (Number(await busd.balanceOf(lpToken.address)) / 1e18).toFixed(2))
    console.log("[START] TOKEN-BUSD LP, TOKEN", (Number(await token.balanceOf(lpToken.address)) / 1e18).toFixed(2))

  })

  it('transfer', async (ctx) => {
    let maxTx = await token._maxTxAmount()
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
      // console.log("bob -> alice success", Number(await (await tx1.wait()).gasUsed))


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
      // console.log("alice -> bob success", Number(await (await tx2.wait()).gasUsed))


      // console.log('i', await (await token.balanceOf(token.address)).toString())
      // expect(true).to.eq(true)
      // console.log("contract BUSD", (Number(await busd.balanceOf(token.address)) / 1e18).toFixed(2))
      i % 10 || console.log(i,
        "[wallet] OWNER TOKEN-BUSD LP", (Number(await lpToken.balanceOf(wallet.address)) / 1e18).toFixed(2),
        `(${(Number(await busd.balanceOf(lpToken.address)) / 1e18).toFixed(2)} BUSD,${(Number(await token.balanceOf(lpToken.address)) / 1e18).toFixed(2)} TOKEN)`,
        "[contract] STUCK BUSD", (Number(await busd.balanceOf(token.address)) / 1e18).toFixed(2)
      )


    }
    console.log("Result")
    console.log("[END] bob WBNB-BUSD LP", (Number(await wBNBLPToken.balanceOf(bob.address)) / 1e18).toFixed(2))
    console.log("[END] WBNB-BUSD LP, BUSD", (Number(await busd.balanceOf(wBNBLPToken.address)) / 1e18).toFixed(2))
    console.log("[END] WBNB-BUSD LP, WBNB", (Number(await swapFixture.weth.balanceOf(wBNBLPToken.address)) / 1e18).toFixed(2))

    console.log("[END] OWNER TOKEN-BUSD LP", (Number(await lpToken.balanceOf(wallet.address)) / 1e18).toFixed(2))
    console.log("[END] TOKEN-BUSD LP, BUSD", (Number(await busd.balanceOf(lpToken.address)) / 1e18).toFixed(2))
    console.log("[END] TOKEN-BUSD LP, TOKEN", (Number(await token.balanceOf(lpToken.address)) / 1e18).toFixed(2))
    console.log("[END] STUCK BUSD", (Number(await busd.balanceOf(token.address)) / 1e18).toFixed(2))
    
    console.log("[GAS] TOTAL", totalGas.toLocaleString("us"))
    console.log("[GAS] MIN", minGas.toLocaleString("us"))
    console.log("[GAS] MAX", maxGas.toLocaleString("us"))
    
    ctx();

  })

})
