import { Wallet, Contract } from 'ethers'
import { MockProvider } from '@ethereum-waffle/provider'
import { deployContract } from 'ethereum-waffle'
import { expandTo18Decimals } from './utilities'

import UniswapV2FactoryJSON from '@uniswap/v2-core/build/UniswapV2Factory.json'
import ERC20JSON from '@uniswap/v2-core/build/ERC20.json'
import WETH9JSON from '@uniswap/v2-periphery/build/WETH9.json'
import UniswapV2Router02JSON from '@uniswap/v2-periphery/build/UniswapV2Router02.json'
import { IERC20, IUniswapV2Factory, IUniswapV2Pair, IUniswapV2Pair__factory, IUniswapV2Router02 } from '../../typechain'



export interface UniswapFixture {
  factory: IUniswapV2Factory
  router: IUniswapV2Router02
  weth: IERC20
}





export async function uniswapFixture([wallet]: Wallet[], provider: MockProvider,): Promise<UniswapFixture> {

  const weth: IERC20 = <any>await deployContract(wallet, WETH9JSON)

  const factory: IUniswapV2Factory = <any>await deployContract(wallet, UniswapV2FactoryJSON, [wallet.address])

  const router: IUniswapV2Router02 = <any>await deployContract(wallet, UniswapV2Router02JSON, [factory.address, weth.address])


  return {
    weth,
    factory: factory.connect(wallet),
    router: router.connect(wallet),
  }
}

export async function createToken([wallet]: Wallet[], premint: number) {
  let token: IERC20 = <any>await deployContract(wallet, ERC20JSON, [expandTo18Decimals(premint)])

  return token.connect(wallet)
}


export async function createPair([wallet]: Wallet[], fixure: UniswapFixture, token1: IERC20, token2: IERC20) {
  await fixure.factory.createPair(token1.address, token2.address)


  return IUniswapV2Pair__factory.connect(await fixure.factory.getPair(token1.address, token2.address), wallet)
}
