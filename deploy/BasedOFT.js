const LZ_ENDPOINTS = require("../constants/layerzeroEndpoints.json")
const CHAIN_ID = require("../constants/chainIds.json")
const MAIN_CHAIN = require("../constants/oftBaseChain.json")
const { ethers } = require("hardhat")

module.exports = async function ({ deployments, getNamedAccounts }) {
    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()

    console.log(`>>> your address: ${deployer}`)

    // get the Endpoint address
    const endpointAddr = LZ_ENDPOINTS[hre.network.name]
    const baseChainId = CHAIN_ID[MAIN_CHAIN["mainChain"]]
    const currentChainId = CHAIN_ID[hre.network.name]
    console.log(`[${hre.network.name}] LayerZero Endpoint address: ${endpointAddr}`)

    await deploy("BasedOFT", {
        from: deployer,
        args: [
            "BasedOFT",
            "OFT",
            endpointAddr,
            baseChainId === currentChainId ? ethers.utils.parseUnits("1000000", 18) : 0,
            baseChainId
        ],
        log: true,
        waitConfirmations: 1,
    })
}

module.exports.tags = ["BasedOFT"]
