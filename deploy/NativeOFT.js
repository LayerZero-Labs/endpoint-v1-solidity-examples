const LZ_ENDPOINTS = require("../constants/layerzeroEndpoints.json")
const OFT_CONFIG = require("../constants/oftConfig.json")
const { ethers } = require("hardhat")

module.exports = async function ({ deployments, getNamedAccounts }) {
    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()

    console.log(`>>> your address: ${deployer}`)

    // get the Endpoint address
    const endpointAddr = "0xd682ECF100f6F4284138AA925348633B0611Ae21"
    console.log(`[${hre.network.name}] LayerZero Endpoint address: ${endpointAddr}`)

    await deploy("NativeOFT", {
        from: deployer,
        args: ["NativeOFT", "NPOFT", endpointAddr],
        log: true,
        waitConfirmations: 1,
    })
}

module.exports.tags = ["NativeOFT"]
