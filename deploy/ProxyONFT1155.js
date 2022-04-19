const LZ_ENDPOINTS = require("../constants/layerzeroEndpoints.json")
const ONFT_ARGS = require("../constants/onftArgs.json")

module.exports = async function ({ deployments, getNamedAccounts }) {
    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()
    console.log(`>>> your address: ${deployer}`)

    const lzEndpointAddress = LZ_ENDPOINTS[hre.network.name]
    console.log(`[${hre.network.name}] Endpoint Address: ${lzEndpointAddress}`)

    await deploy("ProxyONFT1155", {
        from: deployer,
        args: [lzEndpointAddress, "0x6Ba1eb44B96e0F5e22a43611D9F65110a394247D"],
        log: true,
        waitConfirmations: 1,
    })
}

module.exports.tags = ["ProxyONFT1155"]
