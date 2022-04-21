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
        args: [lzEndpointAddress, "0x76BE3b62873462d2142405439777e971754E8E77"],
        log: true,
        waitConfirmations: 1,
    })
}

module.exports.tags = ["ProxyONFT1155"]
