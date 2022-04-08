const LZ_ENDPOINTS = require("../constants/layerzeroEndpoints.json")
const CHAIN_ID = require("../constants/chainIds.json")
const MAIN_CHAIN = require("../constants/oftMainChain.json")
const { ethers } = require("hardhat")

module.exports = async function ({ deployments, getNamedAccounts }) {
    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()
    console.log(`>>> your address: ${deployer}`)

    // get the Endpoint address
    const endpointAddr = LZ_ENDPOINTS[hre.network.name]
    const mainChainId = CHAIN_ID[MAIN_CHAIN["mainChain"]]
    const currentChainId = CHAIN_ID[hre.network.name]
    console.log(`[${hre.network.name}] Endpoint address: ${endpointAddr}`)

    await deploy("OmnichainFungibleToken", {
        from: deployer,
        args: [
            "OmnichainFungibleToken",
            "OFT",
            endpointAddr,
            mainChainId,
            mainChainId === currentChainId ? ethers.utils.parseUnits("1000000", 18) : ethers.utils.parseUnits("0", 18),
        ],
        log: true,
        waitConfirmations: 1,
    })
}

module.exports.tags = ["OmnichainFungibleToken"]
